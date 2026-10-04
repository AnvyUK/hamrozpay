const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');

const { PORT, APP_MODE, APP_URL } = require('./config');
const { init } = require('./src/db');
const { initBot } = require('./src/telegram-bot');
const authRoutes = require('./src/routes/auth.routes');
const recipientRoutes = require('./src/routes/recipient.routes');
const transferRoutes = require('./src/routes/transfer.routes');
const adminRoutes = require('./src/routes/admin.routes');

const app = express();
app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '100kb' }));

app.use('/api/', rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false
}));

app.use('/api/auth', authRoutes);
app.use('/api/recipients', recipientRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/config', (req, res) => res.json({ mode: APP_MODE }));
app.get('/health', (req, res) => res.json({ ok: true, mode: APP_MODE }));

app.use(express.static(path.join(__dirname, 'public')));

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

(async () => {
  try {
    await init();
    initBot();

    app.listen(PORT, () => {
      console.log(`\n🚀 HamrozPay running`);
      console.log(`   URL:   ${APP_URL}`);
      console.log(`   Admin: ${APP_URL}/admin`);
      console.log(`   Mode:  ${APP_MODE.toUpperCase()}\n`);
    });
  } catch (e) {
    console.error('❌ Startup failed:', e);
    process.exit(1);
  }
})();
