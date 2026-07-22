const express = require('express');
const router = express.Router();
const controller = require('../controllers/customers.controller');
const { signupLimiter } = require('../middleware/rateLimiter');
const { body } = require('express-validator');
const { all, query } = require('../config/database');

router.post('/signup', signupLimiter,
  [body('name').trim().notEmpty(), body('phone').trim().notEmpty(), body('smsOptIn').isBoolean()],
  controller.signup
);

router.get('/', async (req, res) => {
  try {
    const rows = await all('SELECT c.*, t.name as tier_name FROM customers c JOIN tiers t ON c.tier_id=t.id WHERE c.is_active=1 ORDER BY c.created_at DESC LIMIT 500');
    const customers = rows.map(c => ({
      id: c.id, name: c.name, phone: c.phone, email: c.email,
      tier: c.tier_name, points: c.points, visits: c.visit_count,
      opt_in_sms: c.sms_opt_in === 1, loyalty_id: c.loyalty_id, created_at: c.created_at
    }));
    res.json({ success: true, customers });
  } catch (e) { res.json({ success: false, customers: [], error: e.message }); }
});

router.put('/:id/points', async (req, res) => {
  try {
    const pts = parseInt(req.body.points);
    await query('UPDATE customers SET points=points+$1, total_points_earned=total_points_earned+$1, updated_at=NOW() WHERE id=$2', [pts, req.params.id]);
    await query('INSERT INTO reward_points (customer_id,points,reason) VALUES ($1,$2,$3)', [req.params.id, pts, 'manual']);
    res.json({ success: true });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

router.get('/:id', controller.getById);

module.exports = router;
