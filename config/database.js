const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const env = require('./environment');
const logger = require('../utils/logger');

let db;

function getDatabase() {
  if (db) return db;

  const dbPath = path.resolve(env.database.path);
  const dbDir = path.dirname(dbPath);

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(dbPath);

  // WAL mode: faster writes, better concurrency
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');
  db.pragma('cache_size = 10000');
  db.pragma('temp_store = MEMORY');

  logger.info(`[DB] Connected: ${dbPath}`);

  // Graceful shutdown
  process.on('exit', () => db.close());
  process.on('SIGINT', () => { db.close(); process.exit(0); });
  process.on('SIGTERM', () => { db.close(); process.exit(0); });

  return db;
}

module.exports = { getDatabase };
