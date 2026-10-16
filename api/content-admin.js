const API_ROOT = 'https://api.github.com';
const CONTENT_PATH = 'assets/database.json';

function jsonResponse(response, status, body) {
  return response.status(status).json(body);
}

function adminEmails() {
  return (process.env.ADMIN_EMAILS || '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean);
}

async function authorize(request) {
  const projectUrl = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const publishableKey = process.env.SUPABASE_ANON_KEY?.trim();
  const accessToken = request.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!projectUrl || !publishableKey || !accessToken) return null;

  const response = await fetch(`${projectUrl}/auth/v1/user`, {
    headers: { apikey: publishableKey, Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) return null;
  const user = await response.json();
  return adminEmails().includes(user.email?.toLowerCase()) ? user : null;
}

function githubConfig() {
  const token = process.env.GITHUB_CONTENT_TOKEN?.trim();
  const repository = process.env.GITHUB_REPOSITORY?.trim() || 'qubitguy-cell/devoweb';
  const branch = process.env.GITHUB_BRANCH?.trim() || 'main';
  return token ? { token, repository, branch } : null;
}

async function readContent(config) {
  const url = `${API_ROOT}/repos/${config.repository}/contents/${CONTENT_PATH}?ref=${encodeURIComponent(config.branch)}`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${config.token}`,
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });
  if (!response.ok) throw new Error(`GitHub content read failed (${response.status}).`);
  const file = await response.json();
  return {
    sha: file.sha,
    data: JSON.parse(Buffer.from(file.content.replace(/\s/g, ''), 'base64').toString('utf8'))
  };
}

function cleanText(value, maxLength, field) {
  if (typeof value !== 'string') throw new Error(`${field} is required.`);
  const text = value.trim();
  if (!text || text.length > maxLength) throw new Error(`${field} must be between 1 and ${maxLength} characters.`);
  return text;
}

function validateItem(type, item, content) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Content entry is invalid.');
  if (type === 'devotional') {
    const date = cleanText(item.date, 10, 'Date');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) throw new Error('Enter a valid devotional date.');
    if (content.devotionals.some((entry) => entry.date === date)) throw new Error('A devotional already exists for that date.');
    return {
      id: cleanText(item.id, 80, 'ID'),
      date,
      title: cleanText(item.title, 100, 'Title'),
      verse: cleanText(item.verse, 500, 'Verse'),
      reference: cleanText(item.reference, 80, 'Reference'),
      scripture: cleanText(item.scripture, 100, 'Reading range'),
      body: cleanText(item.body, 2000, 'Reflection'),
      thought: cleanText(item.thought, 240, 'Thought'),
      tag: cleanText(item.tag, 40, 'Tag')
    };
  }
  if (type === 'prayer') {
    return {
      category: cleanText(item.category, 40, 'Category').toLowerCase(),
      title: cleanText(item.title, 100, 'Title'),
      content: cleanText(item.content, 1500, 'Prayer')
    };
  }
  throw new Error('Unsupported content type.');
}

export default async function handler(request, response) {
  if (!['GET', 'POST'].includes(request.method)) {
    response.setHeader('Allow', 'GET, POST');
    return jsonResponse(response, 405, { error: 'Method not allowed.' });
  }

  try {
    const user = await authorize(request);
    if (!user) return jsonResponse(response, 403, { authorized: false, error: 'This account is not an authorized content editor.' });
    if (request.method === 'GET') return jsonResponse(response, 200, { authorized: true });

    const config = githubConfig();
    if (!config) return jsonResponse(response, 503, { error: 'Content publishing is not configured on the server.' });
    const { sha, data } = await readContent(config);
    if (!Array.isArray(data.devotionals) || !Array.isArray(data.prayers)) throw new Error('The content JSON has an unexpected structure.');
    const item = validateItem(request.body?.type, request.body?.item, data);
    data[request.body.type === 'devotional' ? 'devotionals' : 'prayers'].push(item);

    const updateResponse = await fetch(`${API_ROOT}/repos/${config.repository}/contents/${CONTENT_PATH}`, {
      method: 'PUT',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${config.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Add ${request.body.type}: ${item.title}`,
        content: Buffer.from(`${JSON.stringify(data, null, 2)}\n`, 'utf8').toString('base64'),
        sha,
        branch: config.branch
      })
    });
    if (!updateResponse.ok) {
      console.error('GitHub content update failed:', updateResponse.status, await updateResponse.text());
      return jsonResponse(response, 502, { error: 'GitHub could not publish the content. Check the token permissions and branch protection.' });
    }

    return jsonResponse(response, 200, { saved: true, commit: (await updateResponse.json()).commit?.html_url || '' });
  } catch (error) {
    return jsonResponse(response, 400, { error: error.message || 'Could not publish content.' });
  }
}
