const express = require('express');
const { v4: uuid } = require('uuid');
const { pool } = require('../db');
const { hashPassword, verifyPassword, signToken, authMiddleware } = require('../auth');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { email, password, fullName, language } = req.body;
    if (!email || !password || password.length < 8)
      return res.status(400).json({ error: 'invalid_input' });

    const exists = await pool.query('SELECT 1 FROM users WHERE email = $1', [email]);
    if (exists.rowCount) return res.status(409).json({ error: 'email_taken' });

    const id = uuid();
    const hash = await hashPassword(password);
    await pool.query(
      `INSERT INTO users (id, email, password_hash, full_name, language)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, email, hash, fullName || '', language || 'uz']
    );

    const user = { id, email, is_admin: false };
    res.json({ token: signToken(user), user: { id, email, fullName, language } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const r = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (!r.rowCount) return res.status(401).json({ error: 'invalid_credentials' });

    const user = r.rows[0];
    if (user.is_blocked) return res.status(403).json({ error: 'account_blocked' });

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'invalid_credentials' });

    res.json({
      token: signToken(user),
      user: { id: user.id, email: user.email, fullName: user.full_name, language: user.language }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error' });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  const r = await pool.query(
    'SELECT id, email, full_name, language, is_admin, is_blocked FROM users WHERE id = $1',
    [req.user.id]
  );
  if (!r.rowCount) return res.status(404).json({ error: 'not_found' });
  const u = r.rows[0];
  res.json({
    id: u.id, email: u.email, fullName: u.full_name, language: u.language,
    isAdmin: u.is_admin, isBlocked: u.is_blocked
  });
});

module.exports = router;
