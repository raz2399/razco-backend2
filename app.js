const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const env = require('./config/environment');
const requestId = require('./middleware/requestId');
const errorHandler = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');
const logger = require('./utils/logger');

const app = express();

// Security headers
app.use(helmet());

// CORS — only allow frontend origin
app.use(cors({
  origin: env.isProduction
    ? [env.frontend.url]
    : ['http://localhost:5500', 'http://127.0.0.1:5500', 'http://localhost:3000', env.frontend.url],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request ID on every request
app.use(requestId);

// Request logging
app.use((req, res, next) => {
  logger.info(`[REQ] ${req.method} ${req.path}`, { requestId: req.requestId, ip: req.ip });
  next();
});

// Global rate limit
app.use('/api', apiLimiter);

// Routes
app.use('/api/health',    require('./routes/health'));
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/customers', require('./routes/customers'));

// 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` },
    timestamp: new Date().toISOString(),
  });
});

// Global error handler — must be last
app.use(errorHandler);

module.exports = app;
