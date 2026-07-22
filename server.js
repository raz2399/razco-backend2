require('./config/environment');
const app = require('./app');
const logger = require('./utils/logger');
const PORT = process.env.PORT || 3000;

function setupDatabase() {
  try {
    const { getDatabase } = require('./config/database');
    const db = getDatabase();
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='customers'").get();
    if (!tableExists) {
      require('./database/migrations/001_initial.js');
      require('./database/seeds/settings.js');
      logger.info('[STARTUP] Fresh database initialized');
    } else {
      logger.info('[STARTUP] Database already initialized, skipping setup');
    }
  } catch(err) {
    logger.error('[STARTUP] Database setup failed', { error: err.message });
    process.exit(1);
  }
}

setupDatabase();

const server = app.listen(PORT, () => {
  logger.info(`[STARTUP] Razi-Nova Backend v2.0.0 running on port ${PORT}`);
});

process.on('SIGTERM', () => { server.close(() => process.exit(0)); });
process.on('uncaughtException', (err) => { logger.error('[FATAL]', { error: err.message }); process.exit(1); });
process.on('unhandledRejection', (reason) => { logger.error('[FATAL]', { reason }); process.exit(1); });
