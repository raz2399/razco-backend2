const express = require('express');
const router = express.Router();
const { get, all, query } = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const campaigns = await all('SELECT * FROM campaigns ORDER BY created_at DESC LIMIT 50');
    res.json({ success: true, campaigns });
  } catch (e) { res.json({ success: false, campaigns: [] }); }
});

router.post('/', async (req, res) => {
  try {
    const { title, type, message, target } = req.body;
    if (!title || !message) return res.json({ success: false, error: 'Required' });
    const r = await query('INSERT INTO campaigns (name,message,audience_type,status) VALUES ($1,$2,$3,$4) RETURNING id',
      [title, message, target || 'all', 'draft']);
    res.json({ success: true, id: r.rows[0].id });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

router.post('/send-now', async (req, res) => {
  try {
    const { title, message, target } = req.body;
    if (!title || !message) return res.json({ success: false, error: 'Required' });
    const customers = target === 'opted_in'
      ? await all('SELECT * FROM customers WHERE sms_opt_in=1 AND is_active=1')
      : await all('SELECT * FROM customers WHERE is_active=1');
    const r = await query('INSERT INTO campaigns (name,message,audience_type,recipient_count,status,sent_at) VALUES ($1,$2,$3,$4,$5,NOW()) RETURNING id',
      [title, message, target || 'all', customers.length, 'sent']);
    const campaignId = r.rows[0].id;
    let sent = 0;
    for (const c of customers) {
      if (c.sms_opt_in) {
        await query('INSERT INTO sms_queue (phone,message,type,reference_id) VALUES ($1,$2,$3,$4)',
          [c.phone, message, 'campaign', String(campaignId)]);
        sent++;
      }
    }
    res.json({ success: true, sent, failed: 0 });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

router.post('/:id/send', async (req, res) => {
  try {
    await query('UPDATE campaigns SET status=$1, sent_at=NOW() WHERE id=$2', ['sent', req.params.id]);
    res.json({ success: true, sent: 0, failed: 0 });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

module.exports = router;
