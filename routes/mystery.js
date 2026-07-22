const express = require('express');
const router = express.Router();
const { all, query } = require('../config/database');

router.post('/', async (req, res) => {
  try {
    const { prizes, message } = req.body;
    if (!prizes || !message) return res.json({ success: false, error: 'Required' });
    const prizeList = prizes.split('|').map(p => p.trim()).filter(Boolean);
    const customers = await all('SELECT * FROM customers WHERE sms_opt_in=1 AND is_active=1');
    let sent = 0;
    for (const c of customers) {
      const prize = prizeList[Math.floor(Math.random() * prizeList.length)];
      const code = 'RZ' + Math.random().toString(36).substring(2, 7).toUpperCase();
      const sms = message.replace('{PRIZE}', prize).replace('{CODE}', code);
      await query('INSERT INTO sms_queue (phone,message,type,reference_id) VALUES ($1,$2,$3,$4)',
        [c.phone, sms, 'mystery', String(c.id)]);
      sent++;
    }
    res.json({ success: true, sent });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

module.exports = router;
