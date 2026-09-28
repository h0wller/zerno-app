// scripts/diagnose-tg.mjs — только диагностика, ничего не пишет.
// Запуск: node scripts/diagnose-tg.mjs

import fs from 'node:fs';

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8').split(/\r?\n/)
    .map(l => l.trim()).filter(l => l && !l.startsWith('#'))
    .map(l => {
      const i = l.indexOf('=');
      if (i < 0) return null;
      let v = l.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      return [l.slice(0, i).trim(), v];
    }).filter(Boolean)
);

const TOKEN   = env.TEST_TOKEN || env.TELEGRAM_BOT_TOKEN;
const SECRET  = env.TG_WEBHOOK_SECRET || '';
const APP_URL = (env.PUBLIC_URL || env.APP_URL || '').replace(/\/+$/, '');

if (!TOKEN)   { console.error('Нет токена в .env'); process.exit(1); }
if (!APP_URL) { console.error('Нет PUBLIC_URL в .env'); process.exit(1); }

const tg = async (method, body) => {
  const r = await fetch('https://api.telegram.org/bot' + TOKEN + '/' + method, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  return r.json();
};

const me = (await tg('getMe')).result;
console.log('BOT: @' + me.username + ' (' + me.first_name + ')');
console.log('');

const w = (await tg('getWebhookInfo')).result;
console.log('WEBHOOK:');
console.log('  url:                 ' + (w.url || '(не установлен)'));
console.log('  pending_update_count: ' + w.pending_update_count);
console.log('  last_error_date:     ' + (w.last_error_date ? new Date(w.last_error_date * 1000).toLocaleString('ru-RU') : '—'));
console.log('  last_error_message:  ' + (w.last_error_message || '—'));
console.log('  allowed_updates:     ' + (w.allowed_updates || []).join(', '));
console.log('');

console.log('GET ' + APP_URL + '/api/health …');
try {
  const r = await fetch(APP_URL + '/api/health', { signal: AbortSignal.timeout(10000) });
  console.log('  HTTP ' + r.status + ' · ' + (await r.text()).slice(0, 120));
} catch (e) { console.log('  ERROR: ' + e.message); }
console.log('');

console.log('POST ' + APP_URL + '/api/tg/webhook (без секрета, ожидаем 403) …');
try {
  const r = await fetch(APP_URL + '/api/tg/webhook', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: { chat: { id: 1 }, text: '/diag' } }),
    signal: AbortSignal.timeout(10000),
  });
  console.log('  HTTP ' + r.status + ' · ' + (await r.text()).slice(0, 120));
} catch (e) { console.log('  ERROR: ' + e.message); }
console.log('');

console.log('POST ' + APP_URL + '/api/tg/webhook (с секретом, ожидаем 200) …');
try {
  const r = await fetch(APP_URL + '/api/tg/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-telegram-bot-api-secret-token': SECRET },
    body: JSON.stringify({ message: { chat: { id: 1 }, text: '/diag' } }),
    signal: AbortSignal.timeout(10000),
  });
  console.log('  HTTP ' + r.status + ' · ' + (await r.text()).slice(0, 120));
} catch (e) { console.log('  ERROR: ' + e.message); }
console.log('');

// Пытаемся получить обновления напрямую, минуя webhook.
// Если они есть — значит webhook их не забирает (или старый код не отвечает).
console.log('getUpdates (что Telegram копит необработанного) …');
const upd = await tg('getUpdates', { limit: 5, timeout: 0 });
if (upd.ok && upd.result && upd.result.length) {
  console.log('  Есть ' + upd.result.length + ' необработанных обновлений:');
  for (const u of upd.result) {
    const m = u.message;
    if (m) console.log('    id=' + u.update_id + ' chat=' + m.chat.id + ' text=' + JSON.stringify(m.text));
    else console.log('    id=' + u.update_id + ' ' + Object.keys(u).filter(k => k !== 'update_id').join(','));
  }
  console.log('  → Если ты только что нажимал /start, а тут лежат updates — значит webhook не доходит до сервера.');
} else if (upd.ok) {
  console.log('  Пусто. Telegram всё отдал по webhook (или ты давно не писал).');
} else {
  console.log('  ERROR: ' + JSON.stringify(upd));
}