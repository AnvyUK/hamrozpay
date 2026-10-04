const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { JWT_SECRET } = require('../config');
const { pool } = require('./db');

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, isAdmin: user.is_admin },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'invalid_token' });
  }
}

async function adminOnly(req, res, next) {
  if (!req.user?.isAdmin) return res.status(403).json({ error: 'admin_only' });
  const r = await pool.query('SELECT is_blocked FROM users WHERE id = $1', [req.user.id]);
  if (r.rows[0]?.is_blocked) return res.status(403).json({ error: 'blocked' });
  next();
}

async function blockCheck(req, res, next) {
  const r = await pool.query('SELECT is_blocked FROM users WHERE id = $1', [req.user.id]);
  if (r.rows[0]?.is_blocked) return res.status(403).json({ error: 'account_blocked' });
  next();
}

async function hashPassword(p) { return bcrypt.hash(p, 12); }
async function verifyPassword(p, h) { return bcrypt.compare(p, h); }

module.exports = { signToken, authMiddleware, adminOnly, blockCheck, hashPassword, verifyPassword };
