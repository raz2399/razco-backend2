require('./config/environment');
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

app.use(helmet());

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, tablets, Postman)
    if (!origin) return callback(null, true);
    // Allow all netlify.app domains and localhost
    if (origin.includes('netlify.app') || origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(requestId);

app.use((req, res, next) => {
  logger.info(`[REQ] ${req.method} ${req.path}`, { requestId: req.requestId, ip: req.ip });
  next();
});

app.use('/api', apiLimiter);

app.use('/api/health',    require('./routes/health'));
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/customers', require('./routes/customers'));

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` },
    timestamp: new Date().toISOString(),
  });
});

app.use(errorHandler);

module.exports = app;
