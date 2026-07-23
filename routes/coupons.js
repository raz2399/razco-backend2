const express = require('express');
const router = express.Router();
const { all, get, query } = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const coupons = await all('SELECT * FROM coupons ORDER BY created_at DESC');
    res.json({ success: true, coupons });
  } catch (e) { res.json({ success: false, coupons: [] }); }
});

router.post('/', async (req, res) => {
  try {
    const { title, description, type, value, free_item, valid_until, tier_required } = req.body;
    const code = 'RZ' + Math.random().toString(36).substring(2, 7).toUpperCase();
    const name = title || 'Coupon';
    const discount_type = type || 'percent';
    const discount_value = parseFloat(value) || 10;
    const r = await query(
      'INSERT INTO coupons (code,name,description,discount_type,discount_value,expiry_date,is_active) VALUES ($1,$2,$3,$4,$5,$6,1) RETURNING id',
      [code, name, description || '', discount_type, discount_value, valid_until || null]
    );
    res.json({ success: true, id: r.rows[0].id, coupon: { id: r.rows[0].id, code } });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

router.put('/:id/toggle', async (req, res) => {
  try {
    await query('UPDATE coupons SET is_active = CASE WHEN is_active=1 THEN 0 ELSE 1 END WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await query('DELETE FROM coupons WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

module.exports = router;
