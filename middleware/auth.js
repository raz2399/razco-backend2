const jwt = require('jsonwebtoken');
const env = require('../config/environment');
const { error } = require('../utils/response');

module.exports = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return error(res, 'Authentication required', 401, 'UNAUTHORIZED');
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, env.jwt.secret);
    req.employee = decoded;
    next();
  } catch (err) {
    return error(res, 'Invalid or expired token', 401, 'TOKEN_INVALID');
  }
};
