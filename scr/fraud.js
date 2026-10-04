const { pool } = require('./db');
const { LIMITS } = require('../config');

async function calculateRisk(userId, amount, recipientId) {
  let score = 0;
  const reasons = [];

  const avgRes = await pool.query(
    `SELECT COALESCE(AVG(amount_sent), 0) AS avg FROM transfers WHERE user_id = $1`,
    [userId]
  );
  const avg = parseFloat(avgRes.rows[0].avg || 0);
  if (avg > 0 && amount > avg * 3) { score += 25; reasons.push('amount_above_average'); }

  const r = await pool.query(
    `SELECT 1 FROM transfers WHERE user_id = $1 AND recipient_id = $2 LIMIT 1`,
    [userId, recipientId]
  );
  if (r.rowCount === 0) { score += 20; reasons.push('new_recipient'); }

  const hour = new Date().getUTCHours();
  if (hour >= 23 || hour <= 5) { score += 15; reasons.push('night_time'); }

  const dayRes = await pool.query(
    `SELECT COUNT(*)::int AS c FROM transfers
     WHERE user_id = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
    [userId]
  );
  if (dayRes.rows[0].c >= 4) { score += 20; reasons.push('velocity'); }

  return { score: Math.min(score, 100), reasons };
}

async function checkLimits(userId, amount) {
  const q = async (interval) => {
    const r = await pool.query(
      `SELECT COALESCE(SUM(amount_sent), 0) AS s FROM transfers
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '${interval}'`,
      [userId]
    );
    return parseFloat(r.rows[0].s);
  };
  const day = await q('24 hours');
  const week = await q('7 days');
  const month = await q('30 days');

  if (day + amount > LIMITS.perDay) return { ok: false, reason: 'daily_limit' };
  if (week + amount > LIMITS.perWeek) return { ok: false, reason: 'weekly_limit' };
  if (month + amount > LIMITS.perMonth) return { ok: false, reason: 'monthly_limit' };
  return { ok: true };
}

module.exports = { calculateRisk, checkLimits };
