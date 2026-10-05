const express = require('express');
const { pool } = require('../db');
const { authMiddleware, adminOnly } = require('../auth');
const { APP_MODE, DEMO_RATES } = require('../../config');

const router = express.Router();
router.use(authMiddleware, adminOnly);

router.get('/stats', async (req, res) => {
  const [users, transfers, volume, risky] = await Promise.all([
    pool.query('SELECT COUNT(*)::int AS c FROM users'),
    pool.query('SELECT COUNT(*)::int AS c FROM transfers'),
    pool.query('SELECT COALESCE(SUM(amount_sent), 0) AS s FROM transfers'),
    pool.query('SELECT COUNT(*)::int AS c FROM transfers WHERE risk_score >= 70')
  ]);
  res.json({
    users: users.rows[0].c,
    transfers: transfers.rows[0].c,
    volume: parseFloat(volume.rows[0].s),
    risky: risky.rows[0].c,
    mode: APP_MODE
  });
});

router.get('/users', async (req, res) => {
  const r = await pool.query(
    `SELECT id, email, full_name, language, is_admin, is_blocked, created_at,
     (SELECT COUNT(*)::int FROM transfers WHERE user_id = users.id) AS transfer_count
     FROM users ORDER BY created_at DESC`
  );
  res.json(r.rows);
});

router.post('/users/:id/block', async (req, res) => {
  await pool.query('UPDATE users SET is_blocked = TRUE WHERE id = $1', [req.params.id]);
  await pool.query('INSERT INTO audit_log (user_id, action, meta) VALUES ($1, $2, $3)',
    [req.user.id, 'user_blocked', JSON.stringify({ targetId: req.params.id })]);
  res.json({ ok: true });
});

router.post('/users/:id/unblock', async (req, res) => {
  await pool.query('UPDATE users SET is_blocked = FALSE WHERE id = $1', [req.params.id]);
  await pool.query('INSERT INTO audit_log (user_id, action, meta) VALUES ($1, $2, $3)',
    [req.user.id, 'user_unblocked', JSON.stringify({ targetId: req.params.id })]);
  res.json({ ok: true });
});

router.post('/users/:id/toggle-admin', async (req, res) => {
  await pool.query('UPDATE users SET is_admin = NOT is_admin WHERE id = $1', [req.params.id]);
  await pool.query('INSERT INTO audit_log (user_id, action, meta) VALUES ($1, $2, $3)',
    [req.user.id, 'admin_toggled', JSON.stringify({ targetId: req.params.id })]);
  res.json({ ok: true });
});

router.delete('/users/:id', async (req, res) => {
  await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
  await pool.query('INSERT INTO audit_log (user_id, action, meta) VALUES ($1, $2, $3)',
    [req.user.id, 'user_deleted', JSON.stringify({ targetId: req.params.id })]);
  res.json({ ok: true });
});

router.get('/transfers', async (req, res) => {
  const { status, risk } = req.query;
  let q = `SELECT t.*, u.email AS user_email, r.full_name AS recipient_name
           FROM transfers t
           LEFT JOIN users u ON u.id = t.user_id
           LEFT JOIN recipients r ON r.id = t.recipient_id
           WHERE 1=1`;
  const params = [];
  let i = 1;
  if (status) { q += ` AND t.status = $${i++}`; params.push(status); }
  if (risk === 'high') q += ` AND t.risk_score >= 70`;
  q += ` ORDER BY t.created_at DESC LIMIT 200`;
  const r = await pool.query(q, params);
  res.json(r.rows);
});

router.post('/transfers/:id/approve', async (req, res) => {
  await pool.query(`UPDATE transfers SET status = 'processing', updated_at = NOW() WHERE id = $1`, [req.params.id]);
  await pool.query('INSERT INTO audit_log (user_id, action, meta) VALUES ($1, $2, $3)',
    [req.user.id, 'transfer_approved', JSON.stringify({ transferId: req.params.id })]);
  res.json({ ok: true });
});

router.post('/transfers/:id/complete', async (req, res) => {
  await pool.query(`UPDATE transfers SET status = 'completed', updated_at = NOW() WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
});

router.post('/transfers/:id/reject', async (req, res) => {
  await pool.query(`UPDATE transfers SET status = 'rejected', updated_at = NOW() WHERE id = $1`, [req.params.id]);
  await pool.query('INSERT INTO audit_log (user_id, action, meta) VALUES ($1, $2, $3)',
    [req.user.id, 'transfer_rejected', JSON.stringify({ transferId: req.params.id })]);
  res.json({ ok: true });
});

router.get('/rates', (req, res) => res.json(DEMO_RATES));

router.get('/audit', async (req, res) => {
  const r = await pool.query(
    `SELECT a.*, u.email AS user_email FROM audit_log a
     LEFT JOIN users u ON u.id = a.user_id
     ORDER BY a.created_at DESC LIMIT 200`
  );
  res.json(r.rows);
});

router.get('/mode', (req, res) => res.json({ mode: APP_MODE }));

module.exports = router;
