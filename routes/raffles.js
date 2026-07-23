const express = require('express');
const router = express.Router();
const { all, get, query } = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const raffles = await all('SELECT * FROM raffles ORDER BY created_at DESC');
    res.json({ success: true, raffles });
  } catch (e) { res.json({ success: false, raffles: [] }); }
});

router.post('/', async (req, res) => {
  try {
    const { prize, draw_date, message } = req.body;
    if (!prize) return res.json({ success: false, error: 'Prize required' });
    const r = await query(
      'INSERT INTO raffles (name, prize, draw_date, status) VALUES ($1,$2,$3,$4) RETURNING id',
      [prize, prize, draw_date || new Date().toISOString(), 'open']
    );
    res.json({ success: true, raffle: { id: r.rows[0].id, prize } });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

router.post('/:id/send', async (req, res) => {
  try {
    const customers = await all('SELECT * FROM customers WHERE sms_opt_in=1 AND is_active=1');
    const raffle = await get('SELECT * FROM raffles WHERE id=$1', [req.params.id]);
    let sent = 0;
    for (const c of customers) {
      const ticket = Math.floor(Math.random() * 90000) + 10000;
      await query('INSERT INTO raffle_entries (raffle_id, customer_id, tickets) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [req.params.id, c.id, 1]);
      await query('INSERT INTO sms_queue (phone,message,type,reference_id) VALUES ($1,$2,$3,$4)',
        [c.phone, `🎰 ¡RIFA en Razco Foods! You're entered to win ${raffle.prize}! Ticket: #${ticket}. ¡Buena suerte! 💚 Reply STOP`, 'raffle', String(req.params.id)]);
      sent++;
    }
    res.json({ success: true, sent });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

router.post('/:id/draw', async (req, res) => {
  try {
    const entries = await all('SELECT re.*, c.name, c.phone FROM raffle_entries re JOIN customers c ON c.id=re.customer_id WHERE re.raffle_id=$1', [req.params.id]);
    if (!entries.length) return res.json({ success: false, error: 'No entries' });
    const winner = entries[Math.floor(Math.random() * entries.length)];
    await query('UPDATE raffles SET winner_id=$1, status=$2, drawn_at=NOW() WHERE id=$3', [winner.customer_id, 'closed', req.params.id]);
    res.json({ success: true, winner: { name: winner.name, phone: winner.phone, ticket_number: Math.floor(Math.random() * 90000) + 10000 } });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

module.exports = router;
