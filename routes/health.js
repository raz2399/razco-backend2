const express = require('express');
const router = express.Router();
const { get } = require('../config/database');
const env = require('../config/environment');

router.get('/', async (req, res) => {
  const start = Date.now();
  let dbStatus = 'ok';
  let customerCount = 0;
  try {
    const r = await get('SELECT COUNT(*) as count FROM customers');
    customerCount = parseInt(r.count);
  } catch (err) { dbStatus = 'error'; }

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
    stats: { customers: customerCount, memoryMB },
  });
});

module.exports = router;
