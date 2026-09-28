// scripts/fix-tg-staff-call.mjs
// Форматированная карточка вызова сотрудника с контактами гостя и WebApp-кнопкой
// Запуск из корня: node scripts/fix-tg-staff-call.mjs

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const TARGET_FILE = path.resolve('server/routes/chat.js');
const BAK_FILE = TARGET_FILE + '.bak-staff-call';
const MARKER = '// [tg-staff-call-card-v1]';

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
  console.log('server/routes/chat.js: уже пропатчено (' + MARKER + ').');
  process.exit(0);
}

// 1. Проверяем якорь импортов
const FROM_IMPORT = "import { sendPush } from '../services/push.js';";
const TO_IMPORT = [
  "import { sendPush } from '../services/push.js';",
  "import { fmtPhone } from '../utils/phone.js';",
  "import { APP_URL } from '../services/telegram.js';"
].join('\n');

if (content.split(FROM_IMPORT).length - 1 !== 1) {
  console.error('Якорь импорта sendPush не найден или неоднозначен.');
  process.exit(1);
}

// 2. Проверяем якорь блока вызова сотрудника
const FROM_HUMAN = [
  "  if (human) {",
  "    const roles = ctx === 'delivery' ? \"('dispatch','admin')\" : \"('cashier','admin')\";",
  "    const staff = db.prepare(" + "`" + "SELECT id FROM customers WHERE role IN ${roles}" + "`" + ").all();",
  "    for (const s of staff) sendPush(s.id, ctx === 'delivery' ? '💬 Вопрос по доставке' : '💬 Вопрос по кофейне', text.slice(0, 80));",
  "  }"
].join('\n');

if (content.split(FROM_HUMAN).length - 1 !== 1) {
  console.error('Якорь блока if (human) не найден в server/routes/chat.js.');
  process.exit(1);
}

const TO_HUMAN = [
  "  " + MARKER,
  "  if (human) {",
  "    const roles = ctx === 'delivery' ? \"('dispatch','admin')\" : \"('cashier','admin')\";",
  "    const staff = db.prepare(" + "`" + "SELECT id FROM customers WHERE role IN ${roles}" + "`" + ").all();",
  "    const cust = db.prepare('SELECT id, name, phone, tg FROM customers WHERE id=?').get(base);",
  "    const guestName = (cust && cust.name) ? cust.name : 'Гость';",
  "    const guestPhone = (cust && cust.phone) ? fmtPhone(cust.phone) : 'номер не указан';",
  "    const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');",
  "    const safeName = esc(guestName);",
  "    const safeText = esc(text.length > 200 ? text.slice(0, 197) + '...' : text);",
  "    const guestLink = (cust && cust.tg)",
  "      ? ('<a href=\"tg://user?id=' + cust.tg + '\">' + safeName + '</a>')",
  "      : ('<b>' + safeName + '</b>');",
  "",
  "    const timeStr = new Date().toLocaleTimeString('ru-RU', {",
  "      timeZone: 'Europe/Kaliningrad',",
  "      hour: '2-digit',",
  "      minute: '2-digit',",
  "    });",
  "",
  "    const brandLabel = ctx === 'delivery' ? '🍕 Доставка' : '☕ Кофейня';",
  "    const title = '🔔 <b>Вызов оператора</b> · ' + brandLabel;",
  "    const body = '\\n👤 Гость: ' + guestLink + ' (' + guestPhone + ')\\n💬 Запрос: «' + safeText + '»\\n⏰ Время: ' + timeStr;",
  "    const kb = {",
  "      inline_keyboard: [[",
  "        { text: '💬 Открыть чат в приложении', web_app: { url: (APP_URL || 'https://friday.andcoffee.online') + '/?src=tg&brand=' + ctx } }",
  "      ]]",
  "    };",
  "",
  "    for (const s of staff) {",
  "      sendPush(s.id, title, body, kb);",
  "    }",
  "  }"
].join('\n');

// 3. Проверяем якорь ответа сотрудника гостю
const FROM_REPLY = "  if (!key.startsWith('anon-')) sendPush(key.replace(/:[cd]$/, ''), '💬 Вам ответили из «…и кофе»', text.slice(0, 80));";
const TO_REPLY = [
  "  if (!key.startsWith('anon-')) {",
  "    const replyKb = {",
  "      inline_keyboard: [[",
  "        { text: '💬 Открыть ответ', web_app: { url: (APP_URL || 'https://friday.andcoffee.online') + '/?src=tg&brand=' + mctx + '&tab=chat&ctx=' + mctx } }",
  "      ]]",
  "    };",
  "    const replyTitle = mctx === 'delivery' ? '💬 Ответ поддержки · «Пятница»' : '💬 Ответ поддержки · «…и кофе»';",
  "    sendPush(key.replace(/:[cd]$/, ''), replyTitle, text.slice(0, 140), replyKb);",
  "  }"
].join('\n');

if (content.split(FROM_REPLY).length - 1 !== 1) {
  console.error('Якорь строки sendPush при ответе сотрудника не найден.');
  process.exit(1);
}

fs.writeFileSync(BAK_FILE, raw, 'utf8');

let patched = content.split(FROM_IMPORT).join(TO_IMPORT);
patched = patched.split(FROM_HUMAN).join(TO_HUMAN);
patched = patched.split(FROM_REPLY).join(TO_REPLY);

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

console.log('Успешно: карточка вызова оператора обновлена в chat.js.');
console.log('Бэкап: ' + BAK_FILE);