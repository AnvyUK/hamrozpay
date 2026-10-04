require('dotenv').config();

const APP_MODE = process.env.APP_MODE || 'demo';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('❌ JWT_SECRET must be at least 32 characters. Check .env');
  process.exit(1);
}
if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length !== 64) {
  console.error('❌ ENCRYPTION_KEY must be 64 hex characters (32 bytes). Check .env');
  process.exit(1);
}

module.exports = {
  APP_MODE,
  isDemo: APP_MODE === 'demo',
  PORT: parseInt(process.env.PORT || '3000', 10),
  APP_URL: process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`,

  JWT_SECRET: process.env.JWT_SECRET,
  ENCRYPTION_KEY: Buffer.from(process.env.ENCRYPTION_KEY, 'hex'),
  DATABASE_URL: process.env.DATABASE_URL,

  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  TELEGRAM_ADMIN_CHAT_ID: process.env.TELEGRAM_ADMIN_CHAT_ID || '',

  FEES: {
    instant: 4.99,
    fast: 2.99,
    economy: 1.99
  },

  LIMITS: {
    perDay: 3000,
    perWeek: 10000,
    perMonth: 30000,
    maxRecipients: 5
  },

  DEMO_RATES: {
    'RUB-UZS': parseFloat(process.env.DEMO_RATE_RUB_UZS || '135'),
    'USD-UZS': parseFloat(process.env.DEMO_RATE_USD_UZS || '12650'),
    'RUB-TJS': parseFloat(process.env.DEMO_RATE_RUB_TJS || '0.115'),
    'USD-TJS': parseFloat(process.env.DEMO_RATE_USD_TJS || '10.85')
  }
};
