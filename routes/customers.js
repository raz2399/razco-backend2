const express = require('express');
const { body, param, query } = require('express-validator');
const router = express.Router();
const controller = require('../controllers/customers.controller');
const auth = require('../middleware/auth');
const { signupLimiter } = require('../middleware/rateLimiter');

// POST /api/customers/signup — Public (kiosk)
router.post('/signup',
  signupLimiter,
  [
    body('name')
      .trim()
      .notEmpty().withMessage('Name is required')
      .isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters'),
    body('phone')
      .trim()
      .notEmpty().withMessage('Phone number is required'),
    body('email')
      .optional({ nullable: true, checkFalsy: true })
      .isEmail().withMessage('Invalid email format')
      .normalizeEmail(),
    body('smsOptIn')
      .isBoolean().withMessage('SMS opt-in must be true or false'),
  ],
  controller.signup
);

// All routes below require manager auth
router.use(auth);

// GET /api/customers
router.get('/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 200 }),
    query('search').optional().isString().trim(),
  ],
  controller.getAll
);

// GET /api/customers/:id
router.get('/:id',
  [param('id').isInt({ min: 1 }).withMessage('Invalid customer ID')],
  controller.getById
);

// GET /api/customers/:id/history
router.get('/:id/history',
  [param('id').isInt({ min: 1 })],
  controller.getHistory
);

module.exports = router;
