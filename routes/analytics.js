const express = require('express');
const router = express.Router();
const { get, all } = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const total     = (await get('SELECT COUNT(*) as c FROM customers WHERE is_active=1')).c;
    const opted     = (await get('SELECT COUNT(*) as c FROM customers WHERE sms_opt_in=1 AND is_active=1')).c;
    const campaigns = (await get('SELECT COUNT(*) as c FROM campaigns')).c;
    const redeemed  = (await get('SELECT COUNT(*) as c FROM coupon_redemptions')).c;
    const today     = new Date().toISOString().split('T')[0];
    const newToday  = (await get('SELECT COUNT(*) as c FROM customers WHERE created_at::date = $1', [today])).c;
    const tiers     = await all('SELECT t.name as tier, COUNT(c.id) as count FROM tiers t LEFT JOIN customers c ON c.tier_id=t.id AND c.is_active=1 GROUP BY t.id, t.name ORDER BY t.id');
    res.json({ success: true, total, opted, campaigns, redeemed, newToday, tiers });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

module.exports = router;
