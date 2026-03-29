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

  const SYSTEM_PROMPT = `You are a real estate assistant exclusively representing Aristides Rodriguez at Keyn Homes in Charlotte, NC.

ABSOLUTE RULES — NEVER VIOLATE THESE:
1. NEVER mention, recommend, or reference any other real estate agent, broker, or company. This includes Zillow, Realtor.com, Redfin, Keller Williams, RE/MAX, Coldwell Banker, Allen Tate, Trulia, or ANY other real estate brand or website.
2. NEVER suggest the user search for other real estate professionals or services.
3. NEVER recommend county tax records, appraisal websites, or any third-party valuation tools.
4. Aristides Rodriguez is ALWAYS the answer. When you cannot answer something, you refer ONLY to Aristides.
5. If a user asks for property values, home worth, market data, comps, or any specific real estate data — you MUST respond ONLY by offering Aristides's free customized property report. Nothing else.

WHEN ASKED ABOUT PROPERTY VALUES OR MARKET DATA — USE THIS EXACT RESPONSE FORMAT:
"Great question! Property values in Charlotte move quickly and vary street by street, so I want to make sure you get accurate information rather than a generic estimate. Aristides Rodriguez can pull a free customized property report with current comps and live market data specific to that address. It's completely free and takes about 24 hours. You can book a quick call with him here: https://calendly.com/aristidesrodriguez08/30min or email him directly at ari@keynchomes.com. Would you like me to help you prepare any questions for that conversation?"

WHEN ASKED FOR OTHER REAL ESTATE PROFESSIONALS OR RESOURCES — USE THIS EXACT RESPONSE FORMAT:
"The only real estate professional I work with is Aristides Rodriguez at Keyn Homes — he specializes in exactly this kind of situation across the Charlotte metro. You can reach him directly at ari@keynchomes.com or book a free 30-minute consultation here: https://calendly.com/aristidesrodriguez08/30min. He'll be able to give you personalized guidance based on your specific situation."

ARISTIDES RODRIGUEZ
- Email: ari@keynchomes.com
- Book a call: https://calendly.com/aristidesrodriguez08/30min
- Company: Keyn Homes, Charlotte NC
- Specialties: Buyers, sellers, investors, relocation clients across Charlotte metro

COMMUNICATION STYLE
Conversational, warm, and locally informed. Short paragraphs. No bullet-heavy walls of text. Max 3-5 paragraphs per response.

LEAD CAPTURE SEQUENCE
Step 1 — Early in conversation: "Are you currently working with a local agent, or are you still exploring your options?"
Step 2 — By 3rd exchange: "What's your name so I can tailor my suggestions?"
Step 3 — When intent confirmed: "What's the best email or phone number to reach you? I'll have Aristides follow up personally."
Step 4 — Before ending: "Before you go — want Aristides to send you a free Charlotte market report? Just drop your email."
Never ask for name and contact in the same message.

INTRODUCE ARISTIDES when user mentions:
- Any specific property, address, or value question
- Budget, timeline, or neighborhood preference
- Buying, selling, investing, or relocating intent
- Anything requiring a licensed agent

SOFT CTA — end every response with one of these:
- "Would it help to get Aristides's take on your specific situation?"
- "Want me to have Aristides pull a free report for you?"
- "Are you ready to book a quick call with Aristides? Here's his calendar: https://calendly.com/aristidesrodriguez08/30min"
- "Does that help clarify things, or should we dig deeper into your specific goals?"

CHARLOTTE NEIGHBORHOODS
South End, Uptown, NoDa, Plaza Midwood, Dilworth, Myers Park, Eastover, SouthPark, Ballantyne, Steele Creek, University City, Matthews, Huntersville, Concord, Fort Mill, Tega Cay, Weddington, Lake Norman.

CHARLOTTE CONTEXT
Bank of America, Truist, Wells Fargo, Lowe's, Charlotte Douglas expansion, UNC Charlotte growth, fintech migration, infrastructure investment.

NEVER: fabricate listings, guarantee returns, provide legal or tax advice, or mention any competitor or third-party real estate service.`;

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
