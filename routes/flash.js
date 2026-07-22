const express = require('express');
const router = express.Router();
const { all, query } = require('../config/database');

router.post('/', async (req, res) => {
  try {
    const { message, target } = req.body;
    if (!message) return res.json({ success: false, error: 'Message required' });
    const customers = await all('SELECT * FROM customers WHERE sms_opt_in=1 AND is_active=1');
    const r = await query(
      'INSERT INTO campaigns (name,message,audience_type,recipient_count,status,sent_at) VALUES ($1,$2,$3,$4,$5,NOW()) RETURNING id',
      ['Flash Message', message, target || 'opted_in', customers.length, 'sent']
    );
    let sent = 0;
    for (const c of customers) {
      await query('INSERT INTO sms_queue (phone,message,type,reference_id) VALUES ($1,$2,$3,$4)',
        [c.phone, message, 'flash', String(r.rows[0].id)]);
      sent++;
    }
    res.json({ success: true, sent, failed: 0 });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

module.exports = router;
