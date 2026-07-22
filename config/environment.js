require('dotenv').config();

const required = ['JWT_SECRET', 'DATABASE_PATH'];

const missing = required.filter(key => !process.env[key]);
if (missing.length > 0) {
  console.error(`[STARTUP] Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

module.exports = {
  port: parseInt(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',

  database: {
    path: process.env.DATABASE_PATH || './database/razco.db',
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: '8h',
  },

  managerPin: process.env.MANAGER_PIN || '1234',

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    fromNumber: process.env.TWILIO_FROM_NUMBER,
    enabled: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    enabled: !!process.env.OPENAI_API_KEY,
  },

  frontend: {
    url: process.env.FRONTEND_URL || 'http://localhost:5500',
  },
};
