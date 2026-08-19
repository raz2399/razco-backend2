const express = require('express');
const router = express.Router();
const { get, all, query } = require('../config/database');

async function sendSinchSMS(to, body) {
  const serviceId = process.env.SINCH_SERVICE_PLAN_ID;
  const token = process.env.SINCH_API_TOKEN;
  const from = process.env.SINCH_FROM_NUMBER;
  const response = await fetch(`https://us.sms.api.sinch.com/xms/v1/${serviceId}/batches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ from, to: [to], body })
  });
  let data = null;
  const raw = await response.text();
  if (raw) { try { data = JSON.parse(raw); } catch (e) { data = null; } }
  if (!response.ok) throw new Error((data && data.text) || `Sinch error (HTTP ${response.status})`);
  return data;
}

// Send to exactly one phone number. No database writes, no campaign history entry —
// this exists purely so a real send can be verified before it goes to the full list.
router.post('/send-test', async (req, res) => {
  try {
    const { phone, message } = req.body;
    if (!phone || !message) return res.json({ success: false, error: 'Phone and message are required' });
    await sendSinchSMS(phone, message);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

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

    let sent = 0, failed = 0;

    for (const c of customers) {
      if (!c.phone) continue;
      try {
        await sendSinchSMS(c.phone, message);
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
