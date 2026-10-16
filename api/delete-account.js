export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  const projectUrl = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const publishableKey = process.env.SUPABASE_ANON_KEY?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!projectUrl || !publishableKey || !serviceRoleKey) {
    return response.status(503).json({ error: 'Account deletion is not configured on the server.' });
  }

  const accessToken = request.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) return response.status(401).json({ error: 'Sign in again before deleting your account.' });

  try {
    const userResponse = await fetch(`${projectUrl}/auth/v1/user`, {
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${accessToken}`
      }
    });
    if (!userResponse.ok) return response.status(401).json({ error: 'Your session is invalid or expired. Sign in again.' });

    const user = await userResponse.json();
    if (!user.id) return response.status(401).json({ error: 'Could not verify your account.' });

    const userFiles = new Map();
    for (const bucket of ['avatars', 'journals']) {
      try {
        const filesResponse = await fetch(`${projectUrl}/storage/v1/object/list/${bucket}`, {
          method: 'POST',
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ prefix: user.id, limit: 1000, offset: 0 })
        });
        if (!filesResponse.ok) throw new Error(`Storage listing failed for ${bucket}: ${filesResponse.status}`);
        const files = await filesResponse.json();
        userFiles.set(bucket, (files || []).map((file) => `${user.id}/${file.name}`));
      } catch (error) {
        console.error('Could not list account storage before deletion:', error);
        return response.status(502).json({ error: 'Could not inspect your uploaded files. Your account was not deleted; please try again.' });
      }
    }

    for (const [bucket, prefixes] of userFiles) {
      if (!prefixes.length) continue;
      const storageResponse = await fetch(`${projectUrl}/storage/v1/object/${bucket}`, {
        method: 'DELETE',
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prefixes })
      });
      if (!storageResponse.ok) {
        console.error(`Could not clean up account files in ${bucket}:`, storageResponse.status);
        return response.status(502).json({ error: 'Could not remove your uploaded files. Your account was not deleted; please try again.' });
      }
    }

    const deleteResponse = await fetch(`${projectUrl}/auth/v1/admin/users/${encodeURIComponent(user.id)}`, {
      method: 'DELETE',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`
      }
    });
    if (!deleteResponse.ok) {
      console.error('Supabase account deletion failed:', deleteResponse.status);
      return response.status(502).json({ error: 'Supabase could not delete this account. Uploaded files were removed; please try again.' });
    }

    return response.status(200).json({ deleted: true });
  } catch (error) {
    console.error('Account deletion endpoint failed:', error);
    return response.status(502).json({ error: 'Account deletion could not be completed. Please try again.' });
  }
}