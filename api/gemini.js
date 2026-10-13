export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return response.status(503).json({ error: 'Gemini is not configured yet.' });
  }

  const message = typeof request.body?.message === 'string' ? request.body.message.trim() : '';
  if (!message || message.length > 2000) {
    return response.status(400).json({ error: 'Message must be between 1 and 2000 characters.' });
  }

  const history = Array.isArray(request.body?.history)
    ? request.body.history
        .filter((entry) => entry && ['user', 'model'].includes(entry.role) && typeof entry.text === 'string')
        .slice(-8)
        .map((entry) => ({ role: entry.role, parts: [{ text: entry.text.slice(0, 2000) }] }))
    : [];
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  try {
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: 'You are a warm, thoughtful spiritual reflection companion. Respond with empathy, avoid claiming to be a therapist or spiritual authority, and never shame the user. Keep replies concise. If appropriate, include one relevant Bible verse and reference.' }]
          },
          contents: [...history, { role: 'user', parts: [{ text: message }] }],
          generationConfig: { maxOutputTokens: 450, temperature: 0.7 }
        })
      }
    );

    if (!geminiResponse.ok) {
      console.error('Gemini request failed:', geminiResponse.status);
      return response.status(502).json({ error: 'The companion could not respond right now.' });
    }

    const payload = await geminiResponse.json();
    const reply = payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || '')
      .join('')
      .trim();

    if (!reply) return response.status(502).json({ error: 'The companion returned an empty response.' });
    return response.status(200).json({ response_text: reply });
  } catch (error) {
    console.error('Gemini proxy error:', error);
    return response.status(502).json({ error: 'The companion could not respond right now.' });
  }
}