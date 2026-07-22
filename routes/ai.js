const express = require('express');
const router = express.Router();
const env = require('../config/environment');

router.post('/write', async (req, res) => {
  try {
    const { type, audience, notes } = req.body;
    if (!env.openai.enabled) {
      return res.json({ success: true, message: `🛒 Razco Foods tiene las mejores ofertas! Come in and save big this week! 💚 Reply STOP` });
    }
    const prompt = `You are a bilingual SMS writer for Razco Foods in California. Write a short SMS under 160 chars in English + Spanish. Campaign: ${type}. Audience: ${audience}. ${notes ? 'Notes: ' + notes : ''}. Include Reply STOP.`;
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.openai.apiKey}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', max_tokens: 200, messages: [{ role: 'user', content: prompt }] })
    });
    const data = await response.json();
    const message = data.choices?.[0]?.message?.content?.trim() || '🛒 Big deals at Razco Foods! Come in and save. Reply STOP';
    res.json({ success: true, message });
  } catch (e) {
    res.json({ success: true, message: '🛒 Razco Foods tiene las mejores ofertas! Come save big this week! 💚 Reply STOP' });
  }
});

module.exports = router;
