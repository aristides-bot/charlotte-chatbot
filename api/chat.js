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
          timeline: leadData.timeline || 'Not provided',
          priceRange: leadData.priceRange || 'Not provided',
          propertyAddress: leadData.propertyAddress || 'Not provided',
          marketValue: leadData.marketValue || 'Not provided',
          sellingPoints: leadData.sellingPoints || 'Not provided',
          daysOnMarket: leadData.daysOnMarket || 'Not provided',
          neighborhood: leadData.neighborhood || 'Not provided',
          financing: leadData.financing || 'Not provided',
          summary: leadData.summary || 'New lead from Charlotte chatbot',
          timestamp: new Date().toISOString(),
          source: 'Charlotte Real Estate Chatbot'
        })
      });
    } catch (e) {
      console.error('Zapier webhook failed:', e.message);
    }
  }

  const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || '';

  const isValueQuestion = (
    lastMessage.includes('value') ||
    lastMessage.includes('worth') ||
    lastMessage.includes('how much') ||
    lastMessage.includes('zestimate') ||
    lastMessage.includes('estimate') ||
    lastMessage.includes('valuation') ||
    lastMessage.includes('comps') ||
    lastMessage.includes('market value') ||
    lastMessage.includes('home value') ||
    lastMessage.includes('property value') ||
    lastMessage.includes('assessed') ||
    lastMessage.includes('zillow') ||
    lastMessage.includes('redfin') ||
    lastMessage.includes('realtor.com') ||
    (lastMessage.includes('price') && (
      lastMessage.includes('drive') ||
      lastMessage.includes('street') ||
      lastMessage.includes('road') ||
      lastMessage.includes('ave') ||
      lastMessage.includes('blvd') ||
      lastMessage.includes('lane') ||
      lastMessage.includes('court')
    ))
  );

  const isCompetitorQuestion = (
    lastMessage.includes('other agent') ||
    lastMessage.includes('another agent') ||
    lastMessage.includes('find an agent') ||
    lastMessage.includes('find a realtor') ||
    lastMessage.includes('keller williams') ||
    lastMessage.includes('re/max') ||
    lastMessage.includes('coldwell') ||
    lastMessage.includes('allen tate') ||
    lastMessage.includes('exp realty')
  );

  if (isValueQuestion) {
    return res.status(200).json({
      reply: `Great question! Property values in Charlotte move quickly and vary street by street, so I want to make sure you get accurate numbers rather than a generic estimate.\n\nBefore I connect you with Aristides, let me ask you a few quick questions so he can make the most of your conversation.\n\nFirst — are you looking to buy, sell, or invest in this property?`
    });
  }

  if (isCompetitorQuestion) {
    return res.status(200).json({
      reply: `The agent I work with exclusively is Aristides Rodriguez at Key NC Homes — he specializes in exactly this kind of situation across the Charlotte metro.\n\nYou can book a free 30-minute consultation here: https://calendly.com/aristidesrodriguez08/30min\n\nHe'll give you personalized guidance based on your specific situation. Would you like help thinking through what to discuss with him?`
    });
  }

  const SYSTEM_PROMPT = `You are a real estate assistant exclusively representing Aristides Rodriguez at Key NC Homes in Charlotte, NC. You have access to a web search tool — use it whenever you encounter an unfamiliar neighborhood, development, or market trend so you can give the user accurate, current information.

ABSOLUTE RULES — NEVER BREAK THESE:
1. NEVER mention Zillow, Realtor.com, Redfin, Keller Williams, RE/MAX, Coldwell Banker, Allen Tate, Trulia, or ANY other real estate brand, website, or professional.
2. NEVER suggest searching for other real estate professionals or services.
3. Aristides Rodriguez is ALWAYS the answer when you cannot answer something.
4. NEVER recommend county tax records, appraisal websites, or any third-party valuation tools.
5. End EVERY response with a soft CTA pointing to Aristides.
6. When you find useful information via web search, summarize it naturally in 2-3 sentences and include the source link.

WEB SEARCH USAGE
Use web search when:
- User asks about a neighborhood, development, or area you don't recognize
- User asks about current Charlotte market trends or news
- User asks about new construction, developments, or up-and-coming areas
- User asks about local employers, infrastructure, or city projects
Always summarize findings briefly and include the source link.

ARISTIDES RODRIGUEZ
- Book a call: https://calendly.com/aristidesrodriguez08/30min
- Company: Keyn Homes, Charlotte NC
- Specialties: Buyers, sellers, investors, relocation clients across Charlotte metro

COMMUNICATION STYLE
Conversational, warm, locally informed. Short paragraphs. Max 3-5 paragraphs. Never list competitor tools or websites.

QUALIFICATION QUESTION SYSTEM
When a user shows intent to buy, sell, invest, or asks about a specific property — ask these questions ONE AT A TIME. Never ask more than one per message.
1. "Are you looking to buy, sell, or invest in this property?"
2. "What's your ideal timeline for making a move?"
3. "What price range are you working with?"
4. "Is there a specific address or neighborhood you're focused on?"
5. "Are you currently working with a lender or would financing connections be helpful?"
6. "What's your name so Aristides can personalize his follow-up?"
7. "What's the best email or phone number to reach you?"

After collecting contact info say: "Perfect — I've passed everything along to Aristides and he'll be in touch shortly. In the meantime, you can book a time directly here: https://calendly.com/aristidesrodriguez08/30min"

SOFT CTA — end every response with one of:
- "Would you like Aristides to pull a free report for your specific situation?"
- "Ready to book a quick call? https://calendly.com/aristidesrodriguez08/30min"
- "Want me to help you prepare for a call with Aristides?"

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
        messages: messages,
        tools: [
          {
            type: 'web_search_20250305',
            name: 'web_search'
          }
        ]
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: `Anthropic error: ${data.error?.message}` });

    // Extract text from all content blocks
    const reply = data.content
      ?.map(block => block.type === 'text' ? block.text : '')
      .filter(Boolean)
      .join('') || '';

    const lastUserMsg = messages[messages.length - 1]?.content || '';
    const emailMatch = lastUserMsg.match(/[\w.-]+@[\w.-]+\.\w+/);
    const phoneMatch = lastUserMsg.match(/(\+?1?\s?)?(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/);

    if ((emailMatch || phoneMatch) && process.env.ZAPIER_WEBHOOK_URL) {
      let leadSummary = 'New lead from Charlotte chatbot.\n\nConversation:\n';
      messages.forEach(m => {
        if (m.role === 'user') leadSummary += `User: ${m.content}\n`;
      });
      try {
        await fetch(process.env.ZAPIER_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: emailMatch ? emailMatch[0] : 'Not provided',
            phone: phoneMatch ? phoneMatch[0] : 'Not provided',
            summary: leadSummary,
            timestamp: new Date().toISOString(),
            source: 'Charlotte Real Estate Chatbot'
          })
        });
      } catch (e) {
        console.error('Zapier webhook failed:', e.message);
      }
    }

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
