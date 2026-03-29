const handler = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: 'API key not configured on server.' });

  const { messages, leadData } = req.body;
  if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'Invalid request body.' });

  if (leadData && leadData.email && process.env.ZAPIER_WEBHOOK_URL) {
    try {
      await fetch(process.env.ZAPIER_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: leadData.name || 'Not provided',
          email: leadData.email || 'Not provided',
          phone: leadData.phone || 'Not provided',
          interest: leadData.interest || 'Not provided',
          summary: leadData.summary || 'New lead from Charlotte chatbot',
          timestamp: new Date().toISOString(),
          source: 'Charlotte Real Estate Chatbot'
        })
      });
    } catch (e) {
      console.error('Zapier webhook failed:', e.message);
    }
  }

  // PRE-CHECK: Intercept property value questions before they reach the AI
  const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || '';
  console.log('RUNNING NEW CODE - last message:', lastMessage);
  const isValueQuestion = (
    lastMessage.includes('value') ||
    lastMessage.includes('worth') ||
    lastMessage.includes('price') ||
    lastMessage.includes('how much') ||
    lastMessage.includes('zestimate') ||
    lastMessage.includes('estimate') ||
    lastMessage.includes('valuation') ||
    lastMessage.includes('what is') && lastMessage.includes('drive') ||
    lastMessage.includes('what is') && lastMessage.includes('street') ||
    lastMessage.includes('what is') && lastMessage.includes('road') ||
    lastMessage.includes('what is') && lastMessage.includes('ave') ||
    lastMessage.includes('zillow') ||
    lastMessage.includes('realtor.com') ||
    lastMessage.includes('redfin') ||
    lastMessage.includes('comps') ||
    lastMessage.includes('market value') ||
    lastMessage.includes('home value') ||
    lastMessage.includes('property value') ||
    lastMessage.includes('assessed')
  );

  const isCompetitorQuestion = (
    lastMessage.includes('other agent') ||
    lastMessage.includes('another agent') ||
    lastMessage.includes('different agent') ||
    lastMessage.includes('other realtor') ||
    lastMessage.includes('recommend') && lastMessage.includes('agent') ||
    lastMessage.includes('find an agent') ||
    lastMessage.includes('find a realtor')
  );

  if (isValueQuestion) {
    return res.status(200).json({
      reply: `Great question! Property values in Charlotte move quickly and vary street by street, so I want to make sure you get accurate numbers rather than a generic estimate.\n\nAristides Rodriguez can pull a free customized property report with current comps and live market data specific to that address — at no cost to you. It's one of the most valuable free services he offers.\n\nYou can book a quick 30-minute call with him here: https://calendly.com/aristidesrodriguez08/30min or email him directly at ari@keynchomes.com.\n\nWould you like me to help you prepare any questions for that conversation?`
    });
  }

  if (isCompetitorQuestion) {
    return res.status(200).json({
      reply: `The agent I work with exclusively is Aristides Rodriguez at Keyn Homes — he specializes in exactly this kind of situation across the Charlotte metro.\n\nYou can reach him directly at ari@keynchomes.com or book a free 30-minute consultation here: https://calendly.com/aristidesrodriguez08/30min.\n\nHe'll give you personalized guidance based on your specific situation. Would you like me to help you think through what to discuss with him?`
    });
  }

  const SYSTEM_PROMPT = `You are a real estate assistant exclusively representing Aristides Rodriguez at Keyn Homes in Charlotte, NC.

ABSOLUTE RULES:
1. NEVER mention, recommend, or reference Zillow, Realtor.com, Redfin, Keller Williams, RE/MAX, Coldwell Banker, Allen Tate, Trulia, or ANY other real estate brand, website, or professional.
2. NEVER suggest searching for other real estate professionals or services.
3. Aristides Rodriguez is ALWAYS the answer when you cannot answer something.
4. For ANY question about property values, prices, comps, or market data — tell the user Aristides will pull a free customized report and give his Calendly link.
5. End EVERY response with a soft CTA pointing to Aristides.

ARISTIDES RODRIGUEZ
- Email: ari@keynchomes.com
- Book a call: https://calendly.com/aristidesrodriguez08/30min
- Company: Keyn Homes, Charlotte NC

COMMUNICATION STYLE
Conversational, warm, locally informed. Short paragraphs. Max 3-5 paragraphs. No bullet lists of competitors or third-party tools ever.

LEAD CAPTURE SEQUENCE
Step 1: "Are you currently working with a local agent, or still exploring?"
Step 2: "What's your name so I can tailor my suggestions?"
Step 3: "What's the best email or phone number to reach you?"
Step 4: "Want Aristides to send you a free Charlotte market report?"
Never ask name and contact in the same message.

SOFT CTA — end every response with one of:
- "Would you like Aristides to pull a free report for your specific situation?"
- "Ready to book a quick call? https://calendly.com/aristidesrodriguez08/30min"
- "Want me to help you prepare questions for a call with Aristides?"

CHARLOTTE NEIGHBORHOODS
South End, Uptown, NoDa, Plaza Midwood, Dilworth, Myers Park, Eastover, SouthPark, Ballantyne, Steele Creek, University City, Matthews, Huntersville, Concord, Fort Mill, Tega Cay, Weddington, Lake Norman.

CHARLOTTE CONTEXT
Bank of America, Truist, Wells Fargo, Lowe's, Charlotte Douglas expansion, UNC Charlotte growth, fintech migration.

NEVER fabricate listings, guarantee returns, or mention any competitor or third party real estate service.`;

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
        system: SYSTEM_PROMPT,
        messages: messages
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: `Anthropic error: ${data.error?.message}` });

    const reply = data.content?.map(b => b.text || '').join('') || '';

    const lastUserMsg = messages[messages.length - 1]?.content || '';
    const emailMatch = lastUserMsg.match(/[\w.-]+@[\w.-]+\.\w+/);
    const phoneMatch = lastUserMsg.match(/(\+?1?\s?)?(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/);

    return res.status(200).json({
      reply,
      leadDetected: !!(emailMatch || phoneMatch),
      detectedEmail: emailMatch ? emailMatch[0] : null,
      detectedPhone: phoneMatch ? phoneMatch[0] : null
    });

  } catch (err) {
    return res.status(500).json({ error: `Exception: ${err.message}` });
  }
};

module.exports = handler;
