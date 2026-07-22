const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { get, query } = require('../config/database');
const env = require('../config/environment');
const auth = require('../middleware/auth');
const { success, error, validationError } = require('../utils/response');
const { loginLimiter } = require('../middleware/rateLimiter');
const logger = require('../utils/logger');

router.post('/login', loginLimiter,
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return validationError(res, errors.array());

    const { email, password } = req.body;
    const employee = await get('SELECT * FROM employees WHERE email = $1 AND is_active = 1', [email]);
    if (!employee) return error(res, 'Invalid credentials', 401, 'INVALID_CREDENTIALS');

    const valid = await bcrypt.compare(password, employee.password_hash);
    if (!valid) {
      logger.warn('[AUTH] Failed login attempt', { email, ip: req.ip });
      return error(res, 'Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    await query('UPDATE employees SET last_login = NOW() WHERE id = $1', [employee.id]);

    const token = jwt.sign(
      { id: employee.id, email: employee.email, role: employee.role, name: employee.name },
      env.jwt.secret, { expiresIn: env.jwt.expiresIn }
    );

    logger.info('[AUTH] Login successful', { employeeId: employee.id, email });
    return success(res, { token, employee: { id: employee.id, name: employee.name, email: employee.email, role: employee.role } }, 'Login successful');
  }
);

router.get('/me', auth, (req, res) => success(res, { employee: req.employee }));

module.exports = router;
