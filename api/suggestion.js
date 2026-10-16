function cleanField(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function isValidEmail(value) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  const topic = cleanField(request.body?.topic, 100);
  const message = cleanField(request.body?.message, 4000);
  const replyEmail = cleanField(request.body?.email, 254);
  const honeypot = cleanField(request.body?.website, 200);

  if (honeypot) return response.status(200).json({ sent: true });
  if (!topic || !message) return response.status(400).json({ error: 'Add a topic and suggestion before sending.' });
  if (typeof request.body?.topic !== 'string' || request.body.topic.trim().length > 100
      || typeof request.body?.message !== 'string' || request.body.message.trim().length > 4000) {
    return response.status(400).json({ error: 'Your topic or message is longer than allowed.' });
  }
  if (replyEmail && !isValidEmail(replyEmail)) return response.status(400).json({ error: 'Enter a valid reply email address.' });

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.SUGGESTION_FROM_EMAIL?.trim();
  const recipients = (process.env.ADMIN_EMAILS || '').split(',').map((email) => email.trim()).filter(Boolean);
  if (!apiKey || !from || !recipients.length) {
    return response.status(503).json({ error: 'Private suggestions are not configured yet. Please contact the site administrator.' });
  }
  if (!isValidEmail(from) || recipients.some((email) => !isValidEmail(email))) {
    console.error('Suggestion email configuration contains an invalid address.');
    return response.status(503).json({ error: 'Private suggestions are not configured correctly. Please contact the site administrator.' });
  }

  const lines = [
    'A private suggestion was submitted through Daily Bread.',
    '',
    `Topic: ${topic}`,
    `Reply email: ${replyEmail || 'Not provided'}`,
    '',
    'Suggestion:',
    message,
    '',
    `Page: ${request.headers.referer || 'Daily Bread Help'}`
  ];

  try {
    const mailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from,
        to: recipients,
        reply_to: replyEmail || undefined,
        subject: `Daily Bread suggestion: ${topic}`,
        text: lines.join('\n')
      })
    });

    if (!mailResponse.ok) {
      console.error('Suggestion email provider failed:', mailResponse.status, await mailResponse.text());
      return response.status(502).json({ error: 'The email could not be delivered right now. Please try again later.' });
    }
    return response.status(200).json({ sent: true });
  } catch (error) {
    console.error('Suggestion email request failed:', error);
    return response.status(502).json({ error: 'The email could not be delivered right now. Please try again later.' });
  }
}
