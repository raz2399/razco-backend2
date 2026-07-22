const rateLimit = require('express-rate-limit');

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    error: { code: 'RATE_LIMIT', message: 'Too many signups. Please try again later.' }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    error: { code: 'RATE_LIMIT', message: 'Too many login attempts. Please wait 15 minutes.' }
  },
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: {
    success: false,
    error: { code: 'RATE_LIMIT', message: 'Too many requests.' }
  },
});

module.exports = { signupLimiter, loginLimiter, apiLimiter };
