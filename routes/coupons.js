const express = require('express');
const router = express.Router();
const { all, query } = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const coupons = await all('SELECT * FROM coupons ORDER BY created_at DESC');
    res.json({ success: true, coupons });
  } catch (e) { res.json({ success: false, coupons: [] }); }
});

router.post('/', async (req, res) => {
  try {
    const { code, name, discount_type, discount_value, expiry_date, max_uses } = req.body;
    const r = await query('INSERT INTO coupons (code,name,discount_type,discount_value,expiry_date,max_uses,is_active) VALUES ($1,$2,$3,$4,$5,$6,1) RETURNING id',
      [code, name, discount_type || 'percent', discount_value || 10, expiry_date || null, max_uses || null]);
    res.json({ success: true, id: r.rows[0].id });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

module.exports = router;
