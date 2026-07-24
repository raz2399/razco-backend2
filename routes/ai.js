const express = require('express');
const router = express.Router();

router.post('/write', async (req, res) => {
  try {
    const { type, audience, notes } = req.body;
    
    const prompt = `You are a bilingual SMS writer for Razco Foods grocery store in Lindsay, California. Write a short SMS under 160 characters in both English and Spanish. Campaign type: ${type}. Audience: ${audience}. ${notes ? 'Notes: ' + notes : ''}. End with: Reply STOP to opt out.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('OpenAI error:', data);
      return res.json({ success: false, error: data.error?.message || 'OpenAI error' });
    }

    const message = data.choices?.[0]?.message?.content?.trim();
    if (!message) return res.json({ success: false, error: 'No response from AI' });

    res.json({ success: true, message });
  } catch (e) {
    console.error('AI write error:', e.message);
    res.json({ success: false, error: e.message });
  }
});

module.exports = router;
