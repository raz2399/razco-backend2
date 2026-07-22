const logger = require('../utils/logger');

module.exports = (err, req, res, next) => {
  logger.error('[ERROR]', {
    message: err.message,
    stack: err.stack,
    requestId: req.requestId,
    path: req.path,
    method: req.method,
  });

  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'An unexpected error occurred'
    : err.message;

  return res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || 'SERVER_ERROR',
      message,
    },
    requestId: res.locals.requestId,
    timestamp: new Date().toISOString(),
  });
};
