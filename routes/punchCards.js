const express = require('express');
const router = express.Router();
const { all, query } = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const punchCards = await all('SELECT * FROM punch_cards ORDER BY created_at DESC');
    res.json({ success: true, punch_cards: punchCards.map(c => ({...c, active: c.is_active === 1, visits_required: c.punches_required})) });
  } catch (e) { res.json({ success: false, punch_cards: [] }); }
});

router.post('/', async (req, res) => {
  try {
    const { name, reward, visits_required } = req.body;
    const r = await query('INSERT INTO punch_cards (name,reward,punches_required,is_active) VALUES ($1,$2,$3,1) RETURNING id',
      [name, reward, visits_required || 10]);
    res.json({ success: true, id: r.rows[0].id });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    await query('UPDATE punch_cards SET is_active=$1 WHERE id=$2', [req.body.active ? 1 : 0, req.params.id]);
    res.json({ success: true });
  } catch (e) { res.json({ success: false }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await query('DELETE FROM punch_cards WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

module.exports = router;
