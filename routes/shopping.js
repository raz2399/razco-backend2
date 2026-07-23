const express = require('express');
const router = express.Router();
const { get } = require('../config/database');
const env = require('../config/environment');

router.post('/shopping-list', async (req, res) => {
  try {
    const customer = await get('SELECT * FROM customers WHERE id=$1', [req.body.customer_id]);
    if (!customer) return res.json({ success: false, error: 'Customer not found' });

    const message = `🛒 ¡Hola ${customer.name}! This week at Razco Foods: Fresh avocados 3/$1, chicken legs $0.99/lb, tortillas 3/$5. ¡Ven y ahorra familia! 💚 Reply STOP`;
    res.json({ success: true, message });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

module.exports = router;
