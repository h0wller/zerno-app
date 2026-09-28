// scripts/fix-tg-logging.mjs — подробное логирование webhook и ошибок tgSend.
// Помогает найти, где обрывается цепочка.
// Идемпотентно, CRLF-safe. Запуск: node scripts/fix-tg-logging.mjs

import fs from 'node:fs';
import { execSync } from 'node:child_process';

function readNorm(P) {
  const raw = fs.readFileSync(P, 'utf8');
  const isCRLF = raw.indexOf('\r\n') !== -1;
  return { content: raw.replace(/\r\n/g, '\n'), isCRLF, raw };
}
function writeNorm(P, content, isCRLF) {
  fs.writeFileSync(P, isCRLF ? content.replace(/\n/g, '\r\n') : content, 'utf8');
}
function check(P) {
  try { execSync('node --check ' + P, { stdio: 'pipe' }); return true; }
  catch (e) { console.error('Синтаксис сломан в ' + P + ':\n' + (e.stderr || '').toString()); return false; }
}

// ─── 1. tg.js — лог входящих апдейтов ──────────────────────────────────
{
  const P = 'server/routes/tg.js';
  const { content, isCRLF } = readNorm(P);
  let s = content;
  const MARKER = '// [tg-logging-v1]';

  if (s.indexOf(MARKER) !== -1) {
    console.log('✓ tg.js: логирование уже есть');
  } else {
    const ANCHOR = "    const u = req.body;\n    res.json({ ok: true });\n    if (!u) return;";
    if (s.indexOf(ANCHOR) === -1) {
      console.error('✗ tg.js: не найден якорь для логирования');
      process.exit(1);
    }
    const REPLACE = [
      "    const u = req.body;",
      "    res.json({ ok: true });",
      "    if (!u) return;",
      "    " + MARKER,
      "    // Логируем всё входящее — по update_id и типу сразу видно, что прислал Telegram.",
      "    try {",
      "      var _kind = u.callback_query ? 'callback' : (u.message ? (u.message.contact ? 'contact' : 'message') : 'other');",
      "      var _body = u.callback_query ? (u.callback_query.data || '') : (u.message ? (u.message.text || (u.message.contact ? 'phone' : '')) : '');",
      "      console.log('[tg] in  kind=' + _kind + '  body=' + JSON.stringify(_body) + '  from=' + (u.message ? u.message.chat.id : (u.callback_query ? u.callback_query.from.id : '?')));",
      "    } catch (e) {}",
    ].join('\n');
    s = s.replace(ANCHOR, REPLACE);
    writeNorm(P, s, isCRLF);
    console.log('✓ tg.js: логирование входящих апдейтов');
  }
  if (!check(P)) process.exit(1);
}

// ─── 2. telegram.js — не глотать ошибки tgSend ─────────────────────────
{
  const P = 'server/services/telegram.js';
  const { content, isCRLF } = readNorm(P);
  let s = content;
  const MARKER = '// [tg-logging-v1]';

  if (s.indexOf(MARKER) !== -1) {
    console.log('✓ telegram.js: логирование уже есть');
  } else {
    const FROM = [
      "export async function tgSend(chatId, text, kb) {",
      "  const token = process.env.TEST_TOKEN || TG_TOKEN;",
      "  if (!token) return;",
      "  const body = { chat_id: chatId, text, parse_mode: 'HTML' };",
      "  if (kb) body.reply_markup = kb;",
      "  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {",
      "    method: 'POST',",
      "    headers: { 'Content-Type': 'application/json' },",
      "    body: JSON.stringify(body)",
      "  }).catch(() => {});",
      "}",
    ].join('\n');

    if (s.indexOf(FROM) === -1) {
      console.error('✗ telegram.js: не найден tgSend. Пришли его текущий вид.');
      process.exit(1);
    }

    const TO = [
      "export async function tgSend(chatId, text, kb) { // [tg-logging-v1]",
      "  const token = process.env.TEST_TOKEN || TG_TOKEN;",
      "  if (!token) { console.log('[tg] tgSend: NO TOKEN'); return; }",
      "  const body = { chat_id: chatId, text, parse_mode: 'HTML' };",
      "  if (kb) body.reply_markup = kb;",
      "  try {",
      "    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {",
      "      method: 'POST',",
      "      headers: { 'Content-Type': 'application/json' },",
      "      body: JSON.stringify(body)",
      "    });",
      "    const j = await r.json().catch(() => ({}));",
      "    if (!j.ok) {",
      "      console.error('[tg] tgSend FAIL → chat=' + chatId + '  err=' + (j.description || r.status));",
      "      console.error('[tg] tgSend text was: ' + String(text).slice(0, 80));",
      "      if (kb) console.error('[tg] tgSend kb was: ' + JSON.stringify(kb).slice(0, 200));",
      "    }",
      "  } catch (e) {",
      "    console.error('[tg] tgSend NETWORK ERR: ' + e.message);",
      "  }",
      "}",
    ].join('\n');

    s = s.replace(FROM, TO);
    writeNorm(P, s, isCRLF);
    console.log('✓ telegram.js: ошибки tgSend теперь логируются');
  }
  if (!check(P)) process.exit(1);
}

// ─── 3. Отдельный скрипт-пробник: локально дёргает /api/tg/webhook ──
{
  const P = 'scripts/probe-tg-webhook.mjs';
  const isCRLF = false;
  const content = `// scripts/probe-tg-webhook.mjs — отправляет поддельный callback в webhook.
// Позволяет проверить цепочку без Telegram: Telegram → webhook → сервер → ответ.
// Запуск: node scripts/probe-tg-webhook.mjs
import fs from 'node:fs';

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8').split(/\\r?\\n/)
    .map(l => l.trim()).filter(l => l && !l.startsWith('#'))
    .map(l => {
      const i = l.indexOf('=');
      if (i < 0) return null;
      let v = l.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      return [l.slice(0, i).trim(), v];
    }).filter(Boolean)
);

const APP_URL = (env.PUBLIC_URL || env.APP_URL || '').replace(/\\/+$/, '');
const SECRET = env.TG_WEBHOOK_SECRET || '';
const CHAT_ID = process.env.CHAT_ID || '';

if (!APP_URL) { console.error('Нет PUBLIC_URL'); process.exit(1); }
if (!CHAT_ID) {
  console.error('Укажи CHAT_ID в переменной окружения — свой Telegram user id.');
  console.error('Найти можно через бота @userinfobot, или из логов pm2 (from=...)');
  console.error('Запуск: CHAT_ID=123456789 node scripts/probe-tg-webhook.mjs');
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
`;
  fs.writeFileSync(P, content, 'utf8');
  console.log('✓ ' + P + ' создан');
}

// ─── sw.js ────────────────────────────────────────────────────────────
{
  const P = 'public/sw.js';
  if (fs.existsSync(P)) {
    const { content, isCRLF } = readNorm(P);
    const m = content.match(/zerno-static-v(\d+)/);
    if (m) {
      const before = m[1];
      const next = content.replace(/zerno-static-v(\d+)/, 'zerno-static-v' + (parseInt(before, 10) + 1));
      writeNorm(P, next, isCRLF);
      console.log('✓ sw.js: STATIC_CACHE v' + before + ' → v' + (parseInt(before, 10) + 1));
    }
  }
}

console.log('');
console.log('Готово. Дальше:');
console.log('  1. git add -A');
console.log('  2. git commit -m "diag(tg): логирование webhook + probe-скрипт"');
console.log('  3. git push');
console.log('  4. pm2 restart zerno-app --update-env');
console.log('');
console.log('После деплоя:');
console.log('  A. Открой pm2 logs zerno-app --lines 0 на сервере.');
console.log('  B. В Telegram нажми «Задать вопрос».');
console.log('  C. Смотри логи — там будет что-то из:');
console.log('       [tg] in  kind=callback  body="support_choose"');
console.log('       [tg] tgSend FAIL → ...');
console.log('       [tg] tgSend NETWORK ERR: ...');
console.log('       (тишина = webhook не вызывается вообще)');
console.log('');
console.log('  Если тишина — проверь, что webhook указывает на этот домен:');
console.log('    node scripts/check-webhook-url.mjs');
console.log('');
console.log('  Проверить цепочку без Telegram:');
console.log('    CHAT_ID=<твой_user_id> node scripts/probe-tg-webhook.mjs');
console.log('    (узнать user_id: напиши боту @userinfobot в Telegram)');