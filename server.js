require('./config/environment');
const app = require('./app');
const { getDatabase } = require('./config/database');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 3000;

// Auto-migrate on every startup
try {
  require('./database/migrations/001_initial.js');
  require('./database/seeds/settings.js');
  logger.info('[STARTUP] Database ready');
} catch (err) {
  logger.error('[STARTUP] Database setup failed', { error: err.message });
  process.exit(1);
}

const server = app.listen(PORT, () => {
  logger.info(`[STARTUP] Razi-Nova Backend v2.0.0 running on port ${PORT}`);
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

process.on('uncaughtException', (err) => {
  logger.error('[FATAL] Uncaught exception', { error: err.message });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('[FATAL] Unhandled rejection', { reason });
  process.exit(1);
});
