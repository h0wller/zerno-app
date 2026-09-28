// scripts/fix-tg-support-fallback.mjs — добавляет support_* в text-fallback.
// Telegram Desktop иногда отправляет callback_data обычным текстом.
// У нас уже есть fallback для link_phone/bonus/orders — расширяем на support_*.
// CRLF-safe, идемпотентно. Запуск: node scripts/fix-tg-support-fallback.mjs

import fs from 'node:fs';
import { execSync } from 'node:child_process';

const P = 'server/routes/tg.js';
const BAK = 'server/routes/tg.js.bak-support-fallback';

if (!fs.existsSync(P)) { console.error('Не найден ' + P); process.exit(1); }

const raw = fs.readFileSync(P, 'utf8');
const isCRLF = raw.indexOf('\r\n') !== -1;
let s = raw.replace(/\r\n/g, '\n');

function write() { fs.writeFileSync(P, isCRLF ? s.replace(/\n/g, '\r\n') : s, 'utf8'); }
function check() {
  try { execSync('node --check ' + P, { stdio: 'pipe' }); return true; }
  catch (e) { console.error('Синтаксис сломан:\n' + (e.stderr || '').toString()); return false; }
}

const MARKER = '// [support-fallback-v1]';
if (s.indexOf(MARKER) !== -1) {
  console.log('Уже пропатчено.');
  if (!check()) process.exit(1);
  process.exit(0);
}

// Найти блок fallback-text-callback от прошлого скрипта.
// Оригинал начинается с проверки if (text === 'link_phone' || text === 'bonus' || text === 'orders') {
const ANCHOR = "    if (text === 'link_phone' || text === 'bonus' || text === 'orders') {";
if (s.indexOf(ANCHOR) === -1) {
  console.error('✗ tg.js: не найден fallback-блок от fix-tg-fallbacks.mjs.');
  console.error('  Возможно, ты его не запускал или уже правил вручную.');
  console.error('  Проверь, что в файле есть строка:');
  console.error("    if (text === 'link_phone' || text === 'bonus' || text === 'orders') {");
  process.exit(1);
}

// Заменяем условие на расширенное + добавляем новые обработчики внутрь того же if
const FROM = [
  "    if (text === 'link_phone' || text === 'bonus' || text === 'orders') {",
  "      const cbChatId = String(u.message.chat.id);",
].join('\n');

const TO = [
  "    " + MARKER,
  "    if (text === 'link_phone' || text === 'bonus' || text === 'orders' ||",
  "        text === 'support_choose' || text === 'support_delivery' || text === 'support_coffee') {",
  "      const cbChatId = String(u.message.chat.id);",
  "",
  "      // ── Поддержка: тема в Telegram, чат в PWA ──",
  "      if (text === 'support_choose') {",
  "        await tgSend(cbChatId, '💬 По какой теме вопрос?', {",
  "          inline_keyboard: [",
  "            [{ text: '🍕 Доставка — «Пятница»', callback_data: 'support_delivery' }],",
  "            [{ text: '☕ Кофейня — «…и кофе»',  callback_data: 'support_coffee' }],",
  "          ]",
  "        });",
  "        return;",
  "      }",
  "      if (text === 'support_delivery' || text === 'support_coffee') {",
  "        const ctx = text === 'support_delivery' ? 'delivery' : 'coffee';",
  "        const label = ctx === 'delivery' ? '🍕 Доставка' : '☕ Кофейня';",
  "        await tgSend(cbChatId, 'Открываю чат: ' + label, {",
  "          inline_keyboard: [[",
  "            { text: '💬 Открыть чат с поддержкой', web_app: { url: APP_URL + '/?src=tg&tab=chat&ctx=' + ctx } }",
  "          ]]",
  "        });",
  "        return;",
  "      }",
  "",
].join('\n');

s = s.replace(FROM, TO);

fs.writeFileSync(BAK, raw, 'utf8');
console.log('Бэкап: ' + BAK);
write();

if (!check()) {
  console.error('Откат: copy ' + BAK + ' ' + P);
  process.exit(1);
}
console.log('✓ tg.js: support_* добавлены в text-fallback');

// sw.js — по привычке
const SW = 'public/sw.js';
if (fs.existsSync(SW)) {
  const swRaw = fs.readFileSync(SW, 'utf8');
  const swIsCRLF = swRaw.indexOf('\r\n') !== -1;
  let sw = swRaw.replace(/\r\n/g, '\n');
  const m = sw.match(/zerno-static-v(\d+)/);
  if (m) {
    const before = m[1];
    sw = sw.replace(/zerno-static-v(\d+)/, 'zerno-static-v' + (parseInt(before, 10) + 1));
    fs.writeFileSync(SW, swIsCRLF ? sw.replace(/\n/g, '\r\n') : sw, 'utf8');
    console.log('✓ sw.js: STATIC_CACHE v' + before + ' → v' + (parseInt(before, 10) + 1));
  }
}

console.log('');
console.log('Готово. Дальше:');
console.log('  1. git add -A');
console.log('  2. git commit -m "fix(tg): support_* в text-fallback (Desktop шлёт callback текстом)"');
console.log('  3. git push');
console.log('  4. pm2 restart zerno-app --update-env');
console.log('');
console.log('Проверь в боте:');
console.log('  • /start -> «Задать вопрос» -> теперь приходят ДВЕ кнопки тем в ответе');
console.log('  • Клик на тему -> сообщение редактируется в «Открываю чат: ...»');
console.log('    с кнопкой «💬 Открыть чат с поддержкой»');
console.log('  • Клик на кнопку -> Mini App открывается на нужной Нике, без сплэша');
console.log('');
console.log('Откат: copy ' + BAK + ' ' + P);