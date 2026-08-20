const express = require('express');
const router = express.Router();
const { get, all, query } = require('../config/database');

// Customer phone numbers are stored as bare 10-digit US numbers (no country
// code). Sinch requires full E.164 format (+1XXXXXXXXXX) — without it, a
// number like 5595869121 gets misread as country code +55 (Brazil) instead
// of US area code 559, and silently fails delivery despite a 200 OK from
// the API. This normalizes right before send; storage format is untouched.
function toE164(raw) {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (trimmed.startsWith('+')) return trimmed;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) return '+1' + digits;
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits;
  return null; // not a recognizable US number — caller should skip, not guess
}

// Sinch Build projects authenticate with Key ID + Key Secret, not a static
// API Token. We exchange them for a short-lived access token, then use that
// token to send. One token is fetched per batch and reused for every
// recipient in that send — not refetched per message.
async function getSinchAccessToken() {
  const keyId = process.env.SINCH_KEY_ID;
  const keySecret = process.env.SINCH_KEY_SECRET;
  if (!keyId || !keySecret) throw new Error('SINCH_KEY_ID / SINCH_KEY_SECRET not set');

  const basicAuth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const response = await fetch('https://auth.sinch.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + basicAuth
    },
    body: 'grant_type=client_credentials'
  });
  const raw = await response.text();
  let data = null;
  if (raw) { try { data = JSON.parse(raw); } catch (e) { data = null; } }
  if (!response.ok) {
    console.error('Sinch OAuth token request failed:', response.status, raw);
    throw new Error(`Sinch auth failed (HTTP ${response.status}): ${(data && data.error_description) || raw.slice(0, 300) || 'no response body'}`);
  }
  if (!data || !data.access_token) throw new Error('Sinch auth response missing access_token: ' + raw.slice(0, 300));
  return data.access_token;
}

async function sendSinchSMS(to, body, accessToken) {
  // Sinch's own docs: new accounts (created via Sinch Build) send SMS through
  // the Conversation API, not the standalone SMS batches endpoint we were
  // using before. Different URL, different payload shape entirely.
  const projectId = process.env.SINCH_PROJECT_ID;
  const appId = process.env.SINCH_APP_ID;
  const from = process.env.SINCH_FROM_NUMBER;
  const url = `https://us.conversation.api.sinch.com/v1/projects/${projectId}/messages:send`;

  const payload = JSON.stringify({
    app_id: appId,
    recipient: {
      identified_by: {
        channel_identities: [{ channel: 'SMS', identity: to }]
      }
    },
    message: {
      text_message: { text: body }
    },
    channel_properties: {
      SMS_SENDER: from
    }
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + accessToken },
    body: payload
  });
  const raw = await response.text();
  let data = null;
  if (raw) { try { data = JSON.parse(raw); } catch (e) { data = null; } }
  if (!response.ok) {
    console.error('Sinch SMS send failed:', response.status, raw);
    const detail = (data && (data.error && data.error.message)) || raw.slice(0, 300) || 'no response body';
    throw new Error(`Sinch error (HTTP ${response.status}): ${detail}`);
  }
  console.log(`Sinch SMS accepted for ${to}:`, raw);
  return data;
}

// Send to exactly one phone number. No database writes, no campaign history entry —
// this exists purely so a real send can be verified before it goes to the full list.
router.post('/send-test', async (req, res) => {
  try {
    const { phone, message } = req.body;
    if (!phone || !message) return res.json({ success: false, error: 'Phone and message are required' });
    const accessToken = await getSinchAccessToken();
    const to = toE164(phone);
    if (!to) return res.json({ success: false, error: `"${phone}" doesn't look like a valid US phone number` });
    await sendSinchSMS(to, message, accessToken);
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
    const accessToken = await getSinchAccessToken();

    for (const c of customers) {
      if (!c.phone) continue;
      const to = toE164(c.phone);
      if (!to) {
        console.error(`SMS skipped for ${c.phone}: not a recognizable US number`);
        failed++;
        continue;
      }
      try {
        await sendSinchSMS(to, message, accessToken);
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
