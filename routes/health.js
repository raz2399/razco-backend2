const express = require('express');
const router = express.Router();
const { getDatabase } = require('../config/database');
const env = require('../config/environment');

router.get('/', (req, res) => {
  const start = Date.now();

  // Check database
  let dbStatus = 'ok';
  let customerCount = 0;
  try {
    const db = getDatabase();
    customerCount = db.prepare('SELECT COUNT(*) as count FROM customers').get().count;
  } catch (err) {
    dbStatus = 'error';
  }

  const uptime = process.uptime();
  const memoryMB = Math.round(process.memoryUsage().rss / 1024 / 1024);

  res.json({
    status: dbStatus === 'ok' ? 'healthy' : 'degraded',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`,
    responseTimeMs: Date.now() - start,
    services: {
      database: dbStatus,
      sms: env.twilio.enabled ? 'configured' : 'not_configured',
      ai: env.openai.enabled ? 'configured' : 'not_configured',
    },
    stats: {
      customers: customerCount,
      memoryMB,
    },
  });
});

module.exports = router;
