const express = require('express');
const router = express.Router();
const { get, all, query } = require('../config/database');
const twilio = require('twilio');

function getTwilioClient() {
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

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

    const customers = await all('SELECT * FROM customers WHERE is_active=1 AND sms_opt_in=1');

    const r = await query(
      'INSERT INTO campaigns (name,message,audience_type,recipient_count,status,sent_at) VALUES ($1,$2,$3,$4,$5,NOW()) RETURNING id',
      [title, message, target || 'all', customers.length, 'sent']
    );
    const campaignId = r.rows[0].id;

    const client = getTwilioClient();
    let sent = 0, failed = 0;

    for (const c of customers) {
      if (!c.phone) continue;
      try {
        await client.messages.create({
          body: message,
          from: process.env.TWILIO_FROM_NUMBER,
          to: c.phone
        });
        sent++;
      } catch (err) {
        console.error(`SMS failed for ${c.phone}:`, err.message);
        failed++;
      }
    }

    await query('UPDATE campaigns SET recipient_count=$1 WHERE id=$2', [sent, campaignId]);
    res.json({ success: true, sent, failed });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

router.post('/:id/send', async (req, res) => {
  try {
    await query('UPDATE campaigns SET status=$1, sent_at=NOW() WHERE id=$2', ['sent', req.params.id]);
    res.json({ success: true, sent: 0, failed: 0 });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

module.exports = router;
