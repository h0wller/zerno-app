// scripts/fix-tg-order-buttons.mjs
// Интерактивные inline-кнопки (детали заказа + чат) в уведомлениях orders.js
// Запуск из корня: node scripts/fix-tg-order-buttons.mjs

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const TARGET_FILE = path.resolve('server/routes/orders.js');
const BAK_FILE = TARGET_FILE + '.bak-order-buttons';
const MARKER = '// [tg-order-buttons-v1]';

function readNorm(P) {
  const raw = fs.readFileSync(P, 'utf8');
  const isCRLF = raw.indexOf('\r\n') !== -1;
  return { content: raw.replace(/\r\n/g, '\n'), isCRLF, raw };
}

function writeNorm(P, content, isCRLF) {
  fs.writeFileSync(P, isCRLF ? content.replace(/\n/g, '\r\n') : content, 'utf8');
}

if (!fs.existsSync(TARGET_FILE)) {
  console.error('Файл не найден: ' + TARGET_FILE);
  process.exit(1);
}

const { content, isCRLF, raw } = readNorm(TARGET_FILE);

if (content.indexOf(MARKER) !== -1) {
  console.log('server/routes/orders.js: уже пропатчено (' + MARKER + ').');
  process.exit(0);
}

// 1. Проверяем якорь импорта APP_URL
const FROM_IMPORT = "import { tgSend, TG_CHANNEL } from '../services/telegram.js';";
const TO_IMPORT = "import { tgSend, TG_CHANNEL, APP_URL } from '../services/telegram.js';";
if (content.split(FROM_IMPORT).length - 1 !== 1) {
  console.error('Якорь импорта telegram.js не найден или неоднозначен.');
  process.exit(1);
}

// 2. Проверяем точку вставки хелпера кнопок перед роутом /status
const FROM_ROUTE = "ordersRouter.post('/api/orders/:id/status', dispatchGuard, (req, res) => {";
const TO_ROUTE = [
  MARKER,
  "function orderActionKb(no) {",
  "  const base = APP_URL || WEBAPP_URL || 'https://friday.andcoffee.online';",
  "  return {",
  "    inline_keyboard: [",
  "      [{ text: '📦 Детали заказа #' + no, web_app: { url: base + '/?src=tg&brand=delivery&tab=orders&no=' + no } }],",
  "      [{ text: '💬 Чат с поддержкой', web_app: { url: base + '/?src=tg&brand=delivery&tab=chat&ctx=delivery' } }],",
  "    ]",
  "  };",
  "}",
  "",
  "ordersRouter.post('/api/orders/:id/status', dispatchGuard, (req, res) => {"
].join('\n');
if (content.split(FROM_ROUTE).length - 1 !== 1) {
  console.error('Якорь роута orders /status не найден или неоднозначен.');
  process.exit(1);
}

// 3. Проверяем старый шаблон кнопки (должен встречаться ровно 3 раза: статус, задержка, общая задержка)
const FROM_KB = "{ inline_keyboard: [[{ text: '📦 Открыть заказ', web_app: { url: WEBAPP_URL + '/?src=tg&tab=orders&no=' + o.no } }]] }";
const TO_KB = "orderActionKb(o.no)";
const kbCount = content.split(FROM_KB).length - 1;
if (kbCount !== 3) {
  console.error('Ошибка: старый блок inline_keyboard найден ' + kbCount + ' раз вместо 3.');
  process.exit(1);
}

fs.writeFileSync(BAK_FILE, raw, 'utf8');

let patched = content.split(FROM_IMPORT).join(TO_IMPORT);
patched = patched.split(FROM_ROUTE).join(TO_ROUTE);
patched = patched.split(FROM_KB).join(TO_KB);

writeNorm(TARGET_FILE, patched, isCRLF);

try {
  execSync('node --check ' + TARGET_FILE, { stdio: 'pipe' });
  console.log('Синтаксис корректен (node --check passed).');
} catch (e) {
  console.error('Синтаксис сломан:');
  console.error((e.stderr || '').toString());
  fs.writeFileSync(TARGET_FILE, raw, 'utf8');
  process.exit(1);
}

console.log('Успешно: интерактивные кнопки добавлены в orders.js.');
console.log('Бэкап: ' + BAK_FILE);