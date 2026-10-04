const TelegramBot = require('node-telegram-bot-api');
const { TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID, APP_URL } = require('../config');
const { pool } = require('./db');

let bot = null;

function initBot() {
  if (!TELEGRAM_BOT_TOKEN) {
    console.log('⚠️  Telegram bot disabled (no token)');
    return;
  }

  bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const firstName = msg.from.first_name || 'друг';

    bot.sendMessage(chatId,
      `👋 Салом, ${firstName}!\n\n` +
      `*HamrozPay* — быстрые и безопасные переводы в Узбекистан и Таджикистан.\n\n` +
      `💸 Комиссия от $1.99\n` +
      `⚡ Мгновенные переводы\n` +
      `🛡️ Защита от мошенников\n` +
      `🌐 4 языка: узбекский, таджикский, английский, русский\n\n` +
      `👇 Нажмите кнопку, чтобы открыть приложение:`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '💸 Открыть HamrozPay', web_app: { url: APP_URL } }],
            [
              { text: '📖 Помощь', callback_data: 'help' },
              { text: '🌐 Язык', callback_data: 'lang' }
            ]
          ]
        }
      }
    );
  });

  bot.onText(/\/help/, (msg) => {
    bot.sendMessage(msg.chat.id,
      `📖 *Помощь HamrozPay*\n\n` +
      `1️⃣ Откройте приложение кнопкой выше\n` +
      `2️⃣ Зарегистрируйтесь за 30 секунд\n` +
      `3️⃣ Добавьте получателя\n` +
      `4️⃣ Отправьте перевод\n\n` +
      `💬 Поддержка: @hamrozpay_support`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.onText(/\/app/, (msg) => {
    bot.sendMessage(msg.chat.id, '👇 Откройте HamrozPay:', {
      reply_markup: {
        inline_keyboard: [[
          { text: '💸 Открыть HamrozPay', web_app: { url: APP_URL } }
        ]]
      }
    });
  });

  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    if (query.data === 'help') {
      bot.sendMessage(chatId, '💬 Поддержка 24/7: @hamrozpay_support');
    } else if (query.data === 'lang') {
      bot.sendMessage(chatId, '🌐 Откройте приложение и смените язык в шапке:', {
        reply_markup: {
          inline_keyboard: [[
            { text: '💸 Открыть HamrozPay', web_app: { url: APP_URL } }
          ]]
        }
      });
    }
    bot.answerCallbackQuery(query.id);
  });

  bot.on('polling_error', (e) => console.error('Bot polling error:', e.message));

  console.log('✅ Telegram bot started');
}

async function notifyUser(userId, message) {
  if (!bot) return;
  try {
    const r = await pool.query('SELECT telegram_chat_id FROM users WHERE id = $1', [userId]);
    const chatId = r.rows[0]?.telegram_chat_id;
    if (chatId) await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  } catch (e) {
    console.error('Notify error:', e.message);
  }
}

async function notifyAdmin(message) {
  if (!bot || !TELEGRAM_ADMIN_CHAT_ID) return;
  try {
    await bot.sendMessage(TELEGRAM_ADMIN_CHAT_ID, message, { parse_mode: 'Markdown' });
  } catch (e) {
    console.error('Admin notify error:', e.message);
  }
}

module.exports = { initBot, notifyUser, notifyAdmin };
