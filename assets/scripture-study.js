const HISTORY_KEY = 'daily-bread.scripture-search-history';
const form = document.getElementById('scripture-search-form');
const queryInput = document.getElementById('scripture-query');
const status = document.getElementById('scripture-status');
const results = document.getElementById('scripture-results');
const historyList = document.getElementById('scripture-history');

function readHistory() {
  try {
    const entries = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    return Array.isArray(entries) ? entries : [];
  } catch {
    return [];
  }
}

function writeHistory(entries) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, 15)));
}

function renderHistory() {
  const history = readHistory();
  historyList.replaceChildren();
  if (!history.length) {
    const empty = document.createElement('li');
    empty.className = 'history-empty';
    empty.textContent = 'Searches you make here will appear in this list.';
    historyList.append(empty);
    return;
  }

  history.forEach((entry) => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.className = 'history-query';
    button.type = 'button';
    button.textContent = entry.query;
    button.addEventListener('click', () => {
      queryInput.value = entry.query;
      form.requestSubmit();
    });
    item.append(button);
    historyList.append(item);
  });
}

function saveSearch(query) {
  const history = readHistory().filter((entry) => entry.query.toLowerCase() !== query.toLowerCase());
  history.unshift({ query, searchedAt: new Date().toISOString() });
  writeHistory(history);
  renderHistory();
}

function showReference(reference, text) {
  const article = document.createElement('article');
  article.className = 'scripture-result';
  const heading = document.createElement('h2');
  heading.textContent = reference;
  const passage = document.createElement('p');
  passage.textContent = text;
  article.append(heading, passage);
  results.append(article);
}

async function searchLocalReadings(query) {
  const response = await fetch('./assets/database.json');
  if (!response.ok) throw new Error('Daily Bread readings could not be loaded.');
  const database = await response.json();
  const terms = query.toLowerCase().split(/\s+/).filter((term) => term.length > 1);
  const matches = (database.devotionals || []).filter((entry) => {
    const searchable = `${entry.title} ${entry.reference} ${entry.scripture} ${entry.verse} ${entry.body} ${entry.thought}`.toLowerCase();
    return terms.every((term) => searchable.includes(term));
  });

  matches.forEach((entry) => {
    const article = document.createElement('article');
    article.className = 'scripture-result';
    const heading = document.createElement('h2');
    heading.textContent = `${entry.reference} · ${entry.title}`;
    const verse = document.createElement('p');
    verse.className = 'study-verse';
    verse.textContent = `“${entry.verse}”`;
    const reference = document.createElement('p');
    reference.className = 'study-reference';
    reference.textContent = `Reading: ${entry.scripture}`;
    const reflection = document.createElement('p');
    reflection.textContent = entry.body;
    article.append(heading, verse, reference, reflection);
    results.append(article);
  });
  return matches.length;
}

async function lookupReference(reference) {
  const response = await fetch(`https://bible-api.com/${encodeURIComponent(reference)}?translation=web`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.text) throw new Error(data.error || 'Passage not found. Check the reference and try again.');
  showReference(data.reference || reference, data.text.trim());
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const query = queryInput.value.trim();
  if (!query) return;

  results.replaceChildren();
  status.classList.remove('is-error');
  status.textContent = 'Searching scripture...';
  saveSearch(query);
  const referenceLike = /\d/.test(query) && /[A-Za-z]/.test(query);
  try {
    if (referenceLike) {
      await lookupReference(query);
      status.textContent = 'Passage found.';
      return;
    }
    const count = await searchLocalReadings(query);
    status.textContent = count ? `${count} reading${count === 1 ? '' : 's'} found in the Daily Bread scripture library.` : 'No local readings matched that search. Try a Bible reference such as John 3:16.';
  } catch (error) {
    status.textContent = error.message || 'Search failed. Check your connection and try again.';
    status.classList.add('is-error');
  }
});

queryInput.addEventListener('input', () => status.classList.remove('is-error'));
document.getElementById('clear-search-history').addEventListener('click', () => {
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
});

renderHistory();
