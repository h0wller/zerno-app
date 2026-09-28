// scripts/add-tg-diag.mjs — добавляет GET /api/tg/diag в server.js.
// Идемпотентно: повторный запуск ничего не меняет.
// После правки — node --check и инкремент STATIC_CACHE в sw.js.

import fs from 'node:fs';
import { execSync } from 'node:child_process';

const P = 'server.js';
const BAK = 'server.js.bak';
const MARKER = "// [tg-diag v1] — диагностика Telegram-бота, добавляется scripts/add-tg-diag.mjs";

if (!fs.existsSync(P)) {
  console.error('Не найден ' + P);
  process.exit(1);
}

const s = fs.readFileSync(P, 'utf8');

if (s.indexOf(MARKER) !== -1) {
  console.log('Endpoint /api/tg/diag уже добавлен. Правка не нужна.');
  // Всё равно проверим синтаксис
  try {
    execSync('node --check ' + P, { stdio: 'pipe' });
    console.log('node --check: OK');
  } catch (e) {
    console.error('Синтаксис сломан:');
    console.error((e.stderr || e.stdout || '').toString());
    process.exit(1);
  }
  process.exit(0);
}

// Бэкап
fs.writeFileSync(BAK, s, 'utf8');
console.log('Бэкап: ' + BAK);

// Якорь: строка с app.get('/api/config', ...)
const anchor = "app.get('/api/config', (req, res) => res.json({ tgUsername: TG_BOT_USERNAME }));";
if (s.indexOf(anchor) === -1) {
  console.error('Не нашёл якорь в server.js:');
  console.error('  ' + anchor);
  console.error('Ищи строку с /api/config в server.js, там может быть другое форматирование.');
  console.error('Откат не нужен — файл не тронут.');
  process.exit(1);
}

const NEW_BLOCK = [
  anchor,
  '',
  MARKER,
  "app.get('/api/tg/diag', async (req, res) => {",
  "  const token = process.env.TEST_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '';",
  "  let me = null, err = null;",
  "  if (token) {",
  "    try {",
  "      const r = await fetch('https://api.telegram.org/bot' + token + '/getMe');",
  "      const j = await r.json();",
  "      me = j.ok ? j.result : null;",
  "      if (!j.ok) err = j.description;",
  "    } catch (e) { err = e.message; }",
  "  }",
  "  const secret = process.env.TG_WEBHOOK_SECRET || '';",
  "  res.json({",
  "    token_prefix: token ? token.slice(0, 12) + '…' : null,",
  "    token_len: token.length,",
  "    bot: me ? '@' + me.username : null,",
  "    bot_name: me ? me.first_name : null,",
  "    telegram_error: err,",
  "    env: {",
  "      TEST_TOKEN: process.env.TEST_TOKEN ? 'set' : 'MISSING',",
  "      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ? 'set' : 'MISSING',",
  "      TELEGRAM_BOT_USERNAME: process.env.TELEGRAM_BOT_USERNAME || null,",
  "      TG_BOT_USERNAME: process.env.TG_BOT_USERNAME || null,",
  "      PUBLIC_URL: process.env.PUBLIC_URL || null,",
  "      APP_URL: process.env.APP_URL || null,",
  "      TG_WEBHOOK_SECRET: secret ? 'set (' + secret.length + ' chars)' : 'MISSING',",
  "      NODE_ENV: process.env.NODE_ENV || null,",
  "    },",
  "  });",
  "});",
  "",
].join('\n');

const out = s.replace(anchor, NEW_BLOCK);
fs.writeFileSync(P, out, 'utf8');
console.log('Endpoint /api/tg/diag добавлен в ' + P);

// Проверка синтаксиса
try {
  execSync('node --check ' + P, { stdio: 'pipe' });
  console.log('node --check: OK');
} catch (e) {
  console.error('Синтаксис сломан:');
  console.error((e.stderr || e.stdout || '').toString());
  console.error('Откат: copy ' + BAK + ' ' + P);
  process.exit(1);
}

// Инкремент sw.js
const SW = 'public/sw.js';
if (fs.existsSync(SW)) {
  let sw = fs.readFileSync(SW, 'utf8');
  const m = sw.match(/zerno-static-v(\d+)/);
  if (m) {
    const before = m[1];
    sw = sw.replace(/zerno-static-v(\d+)/, 'zerno-static-v' + (parseInt(before, 10) + 1));
    fs.writeFileSync(SW, sw, 'utf8');
    console.log('sw.js: STATIC_CACHE v' + before + ' → v' + (parseInt(before, 10) + 1));
  }
}

console.log('');
console.log('Готово.');
console.log('');
console.log('Что дальше:');
console.log('  1. Задеплой server.js на Timeweb (как ты это обычно делаешь).');
console.log('  2. Перезапусти процесс.');
console.log('  3. Открой в браузере:');
console.log('       https://friday.andcoffee.online/api/tg/diag');
console.log('');
console.log('  Ожидаешь увидеть примерно:');
console.log('    {');
console.log('      "token_prefix": "8937507348:A…",   <- должен начинаться как токен @friday_and_coffeeBot');
console.log('      "bot": "@friday_and_coffeeBot",    <- имя нового бота');
console.log('      "telegram_error": null,');
console.log('      "env": {');
console.log('        "TEST_TOKEN": "set",');
console.log('        "PUBLIC_URL": "https://friday.andcoffee.online/",');
console.log('        ...');
console.log('      }');
console.log('    }');
console.log('');
console.log('  Если bot: "@Friday_and_coffee" или другой username — значит в .env на Timeweb СТАРЫЙ токен.');
console.log('  Если bot: null + telegram_error — токен в .env битый или пустой.');
console.log('  Если PUBLIC_URL: null — надо прописать.');
console.log('');
console.log('Откат (снесут endpoint): copy ' + BAK + ' ' + P);