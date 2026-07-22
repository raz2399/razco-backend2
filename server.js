require('./config/environment'); // Validates env vars first
const app = require('./app');
const { getDatabase } = require('./config/database');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 3000;

// Initialize DB on startup
try {
  getDatabase();
  logger.info('[STARTUP] Database initialized');
} catch (err) {
  logger.error('[STARTUP] Database failed to initialize', { error: err.message });
  process.exit(1);
}

const server = app.listen(PORT, () => {
  logger.info(`[STARTUP] Razi-Nova Backend v2.0.0 running on port ${PORT}`);
  logger.info(`[STARTUP] Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`[STARTUP] Health check: http://localhost:${PORT}/api/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('[SHUTDOWN] SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('[SHUTDOWN] HTTP server closed');
    process.exit(0);
  });
});

process.on('uncaughtException', (err) => {
  logger.error('[FATAL] Uncaught exception', { error: err.message, stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('[FATAL] Unhandled rejection', { reason });
  process.exit(1);
});
