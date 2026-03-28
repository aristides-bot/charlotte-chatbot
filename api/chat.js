export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'API key not configured on server.' });
  }

  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid request body.' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: 'You are a helpful Charlotte NC real estate assistant.',
        messages: messages
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Anthropic error: ${data.error?.message || JSON.stringify(data)}`
      });
    }

    const reply = data.content?.map(b => b.text || '').join('') || '';
    return res.status(200).json({ reply });

  } catch (err) {
    return res.status(500).json({ error: `Server exception: ${err.message}` });
  }
}
