// scripts/probe-tg-webhook.mjs — отправляет поддельный callback в webhook.
// Позволяет проверить цепочку без Telegram: Telegram → webhook → сервер → ответ.
// Запуск: node --env-file=.env scripts/probe-tg-webhook.mjs

const APP_URL = (process.env.PUBLIC_URL || process.env.APP_URL || '').replace(/\/+$/, '');
const SECRET = process.env.TG_WEBHOOK_SECRET || '';
const CHAT_ID = process.env.CHAT_ID || '';

if (!APP_URL) { console.error('Нет PUBLIC_URL'); process.exit(1); }
if (!CHAT_ID) {
  console.error('Укажи CHAT_ID в переменной окружения — свой Telegram user id.');
  console.error('Найти можно через бота @userinfobot, или из логов pm2 (from=...)');
  console.error('Запуск: CHAT_ID=123456789 node --env-file=.env scripts/probe-tg-webhook.mjs');
  process.exit(1);
}

const upd = {
  update_id: 900000 + Math.floor(Math.random() * 100000),
  callback_query: {
    id: 'probe_' + Date.now(),
    from: { id: Number(CHAT_ID), is_bot: false, first_name: 'Probe' },
    message: {
      message_id: 1,
      date: Math.floor(Date.now() / 1000),
      chat: { id: Number(CHAT_ID), type: 'private' },
    },
    data: 'support_choose',
  },
};

console.log('POST ' + APP_URL + '/api/tg/webhook');
console.log('  data: support_choose, chat: ' + CHAT_ID);
console.log('');
const t0 = Date.now();
const r = await fetch(APP_URL + '/api/tg/webhook', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-telegram-bot-api-secret-token': SECRET },
  body: JSON.stringify(upd),
});
console.log('  HTTP ' + r.status + ' · ' + (Date.now() - t0) + 'ms · ' + (await r.text()).slice(0, 120));
console.log('');
console.log('Если в Telegram пришло «💬 По какой теме вопрос?» — цепочка работает.');
console.log('Если нет — смотри pm2 logs zerno-app.');
