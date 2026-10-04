const { Pool } = require('pg');
const { DATABASE_URL } = require('../config');

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL && DATABASE_URL.includes('neon.tech')
    ? { rejectUnauthorized: false }
    : false
});

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT,
      language TEXT DEFAULT 'uz',
      is_admin BOOLEAN DEFAULT FALSE,
      is_blocked BOOLEAN DEFAULT FALSE,
      telegram_chat_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS recipients (
      id UUID PRIMARY KEY,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      full_name TEXT NOT NULL,
      country TEXT NOT NULL,
      method TEXT NOT NULL,
      details_encrypted TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS transfers (
      id UUID PRIMARY KEY,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      recipient_id UUID REFERENCES recipients(id),
      from_country TEXT NOT NULL,
      to_country TEXT NOT NULL,
      from_currency TEXT NOT NULL,
      to_currency TEXT NOT NULL,
      amount_sent NUMERIC(18,2) NOT NULL,
      fee NUMERIC(18,2) NOT NULL,
      rate NUMERIC(18,6) NOT NULL,
      amount_received NUMERIC(18,2) NOT NULL,
      speed TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'processing',
      risk_score INT DEFAULT 0,
      risk_reasons JSONB,
      is_demo BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id BIGSERIAL PRIMARY KEY,
      user_id UUID,
      action TEXT NOT NULL,
      meta JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_transfers_user ON transfers(user_id);
    CREATE INDEX IF NOT EXISTS idx_transfers_status ON transfers(status);
    CREATE INDEX IF NOT EXISTS idx_transfers_risk ON transfers(risk_score);
    CREATE INDEX IF NOT EXISTS idx_recipients_user ON recipients(user_id);
    CREATE INDEX IF NOT EXISTS idx_users_telegram ON users(telegram_chat_id);
  `);
  console.log('✅ DB schema ready');
}

module.exports = { pool, init };
