require('./config/environment');
const app = require('./app');
const logger = require('./utils/logger');
const { query } = require('./config/database');

const PORT = process.env.PORT || 3000;

async function setupDatabase() {
  try {
    const result = await query("SELECT to_regclass('public.customers') AS exists");
    const tableExists = result.rows[0].exists;
    if (!tableExists) {
      logger.info('[STARTUP] No tables found — running migration...');
      await require('./database/migrations/001_initial.js');
      await require('./database/seeds/settings.js');
      logger.info('[STARTUP] Fresh database initialized');
    } else {
      logger.info('[STARTUP] Database already initialized, skipping setup');
    }
  } catch (err) {
    logger.error('[STARTUP] Database setup failed', { error: err.message });
    process.exit(1);
  }
}

setupDatabase().then(() => {
  app.listen(PORT, () => {
    logger.info(`[STARTUP] Razi-Nova Backend v2.0.0 running on port ${PORT}`);
  });
});
