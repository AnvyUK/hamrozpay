const express = require('express');
const { v4: uuid } = require('uuid');
const { pool } = require('../db');
const { authMiddleware, blockCheck } = require('../auth');
const { getRate } = require('../rates');
const { calculateRisk, checkLimits } = require('../fraud');
const { FEES, isDemo } = require('../../config');
const { notifyUser, notifyAdmin } = require('../telegram-bot');

const router = express.Router();
router.use(authMiddleware, blockCheck);

router.post('/quote', async (req, res) => {
  try {
    const { fromCurrency, toCurrency, amount, speed } = req.body;
    if (!FEES[speed]) return res.status(400).json({ error: 'invalid_speed' });

    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) return res.status(400).json({ error: 'invalid_amount' });

    const rate = await getRate(fromCurrency, toCurrency);
    const fee = FEES[speed];
    const received = (amountNum - fee) * rate;

    res.json({
      amount: amountNum, fee, rate,
      received: Math.round(received * 100) / 100,
      fromCurrency, toCurrency, isDemo
    });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { recipientId, fromCountry, toCountry, fromCurrency, toCurrency, amount, speed } = req.body;
    if (!FEES[speed]) return res.status(400).json({ error: 'invalid_speed' });

    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) return res.status(400).json({ error: 'invalid_amount' });

    const lim = await checkLimits(req.user.id, amountNum);
    if (!lim.ok) return res.status(429).json({ error: lim.reason });

    const rec = await pool.query(
      'SELECT id, full_name FROM recipients WHERE id = $1 AND user_id = $2',
      [recipientId, req.user.id]
    );
    if (!rec.rowCount) return res.status(404).json({ error: 'recipient_not_found' });

    const risk = await calculateRisk(req.user.id, amountNum, recipientId);
    const rate = await getRate(fromCurrency, toCurrency);
    const fee = FEES[speed];
    const received = (amountNum - fee) * rate;

    const id = uuid();
    const status = risk.score >= 70 ? 'on_hold' : 'processing';

    await pool.query(
      `INSERT INTO transfers
        (id, user_id, recipient_id, from_country, to_country, from_currency, to_currency,
         amount_sent, fee, rate, amount_received, speed, status, risk_score, risk_reasons, is_demo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [id, req.user.id, recipientId, fromCountry, toCountry, fromCurrency, toCurrency,
       amountNum, fee, rate, received, speed, status, risk.score, JSON.stringify(risk.reasons), isDemo]
    );

    await pool.query(
      `INSERT INTO audit_log (user_id, action, meta) VALUES ($1, $2, $3)`,
      [req.user.id, 'transfer_created', JSON.stringify({ id, amount: amountNum, risk: risk.score })]
    );

    const msg = `💸 *Перевод создан*\nСумма: ${amountNum} ${fromCurrency}\nПолучатель: ${rec.rows[0].full_name}\nСтатус: ${status === 'on_hold' ? '⏳ На проверке' : '✅ В обработке'}`;
    await notifyUser(req.user.id, msg);

    if (risk.score >= 70) {
      await notifyAdmin(`⚠️ *Высокий риск перевода*\nСумма: ${amountNum} ${fromCurrency}\nScore: ${risk.score}\nПричины: ${risk.reasons.join(', ')}\nID: ${id}`);
    }

    res.json({
      id, status, amount: amountNum, fee, rate,
      received: Math.round(received * 100) / 100,
      riskScore: risk.score, riskReasons: risk.reasons, isDemo
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/', async (req, res) => {
  const r = await pool.query(
    `SELECT t.*, r.full_name AS recipient_name
     FROM transfers t LEFT JOIN recipients r ON r.id = t.recipient_id
     WHERE t.user_id = $1 ORDER BY t.created_at DESC LIMIT 50`,
    [req.user.id]
  );
  res.json(r.rows);
});

router.get('/:id', async (req, res) => {
  const r = await pool.query(
    `SELECT t.*, r.full_name AS recipient_name
     FROM transfers t LEFT JOIN recipients r ON r.id = t.recipient_id
     WHERE t.id = $1 AND t.user_id = $2`,
    [req.params.id, req.user.id]
  );
  if (!r.rowCount) return res.status(404).json({ error: 'not_found' });
  res.json(r.rows[0]);
});

module.exports = router;
