const handler = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const key = process.env.ANTHROPIC_API_KEY;

  if (!key) {
    return res.status(500).json({ error: `API key not configured. Env keys available: ${Object.keys(process.env).filter(k => !k.includes('npm')).join(', ')}` });
  }

  const { messages } = req.body;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
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
    if (!response.ok) return res.status(response.status).json({ error: `Anthropic error: ${data.error?.message}` });

    const reply = data.content?.map(b => b.text || '').join('') || '';
    return res.status(200).json({ reply });

  } catch (err) {
    return res.status(500).json({ error: `Exception: ${err.message}` });
  }
};

module.exports = handler;
