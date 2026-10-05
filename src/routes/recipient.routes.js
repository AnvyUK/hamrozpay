const express = require('express');
const { v4: uuid } = require('uuid');
const { pool } = require('../db');
const { authMiddleware } = require('../auth');
const { encrypt, maskCard } = require('../crypto');
const { LIMITS } = require('../../config');

const router = express.Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  const r = await pool.query(
    'SELECT id, full_name, country, method, details_encrypted FROM recipients WHERE user_id = $1 ORDER BY created_at DESC',
    [req.user.id]
  );
  const list = r.rows.map(row => ({
    id: row.id, fullName: row.full_name, country: row.country, method: row.method,
    masked: row.method === 'card' ? maskCard(row.details_encrypted) : '***'
  }));
  res.json(list);
});

router.post('/', async (req, res) => {
  const { fullName, country, method, details } = req.body;
  if (!fullName || !country || !method || !details)
    return res.status(400).json({ error: 'invalid_input' });

  const cnt = await pool.query('SELECT COUNT(*)::int AS c FROM recipients WHERE user_id = $1', [req.user.id]);
  if (cnt.rows[0].c >= LIMITS.maxRecipients)
    return res.status(400).json({ error: 'max_recipients' });

  const id = uuid();
  const enc = encrypt(details);
  await pool.query(
    `INSERT INTO recipients (id, user_id, full_name, country, method, details_encrypted)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, req.user.id, fullName, country, method, enc]
  );
  res.json({ id, fullName, country, method });
});

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM recipients WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  res.json({ ok: true });
});

module.exports = router;
