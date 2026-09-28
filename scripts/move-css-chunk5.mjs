// scripts/fix-tg-loyalty-push.mjs
// Наглядные уведомления о штампах и подарках с прогресс-баром и WebApp-кнопками
// Запуск из корня проекта: node scripts/fix-tg-loyalty-push.mjs

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const TARGET_FILE = path.resolve('server/domain/loyalty.js');
const BAK_FILE = TARGET_FILE + '.bak-loyalty-push';
const MARKER = '// [tg-loyalty-push-v1]';

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
  console.log('server/domain/loyalty.js: уже пропатчено (' + MARKER + ').');
  process.exit(0);
}

// 1. Проверяем якорь импорта APP_URL
const FROM_IMPORT = "import { APP_URL } from '../config.js';";
const TO_IMPORT = "import { APP_URL } from '../services/telegram.js';";
if (content.split(FROM_IMPORT).length - 1 !== 1) {
  console.error('Якорь импорта APP_URL не найден или неоднозначен.');
  process.exit(1);
}

// 2. Проверяем целевой блок функции grant и redeem
const FROM_BODY = [
  "export function grant(cid, by) { \n" +
  "  const c = db.prepare('SELECT * FROM customers WHERE id=?').get(cid);\n" +
  "  if (!c) return null;\n" +
  "  c.stamps++; c.cups++;\n" +
  "  db.prepare('UPDATE customers SET stamps=?,cups=? WHERE id=?').run(c.stamps, c.cups, cid);\n" +
  "  addHist(cid, `Штамп ${c.stamps} из 10`, by);\n" +
  "  let ten = false;\n" +
  "  if (c.stamps >= 10) { c.stamps = 0; c.free++; ten = true;\n" +
  "    db.prepare('UPDATE customers SET stamps=?,free=? WHERE id=?').run(0, c.free, cid);\n" +
  "    addHist(cid, '🎉 10-й кофе — подарок начислен', 'Система'); }\n" +
  "  logEv(c.name, ten ? '10-й кофе — подарок начислен' : `+1 штамп → ${c.stamps} из 10`);\n" +
  "  const f = db.prepare('SELECT * FROM customers WHERE id=?').get(cid);\n" +
  "  if (ten) sendPush(cid, '🎁 Бесплатный кофе ждёт вас!', 'Вы собрали 10 штампов. Заходите — кофе за наш счёт.', { text: '☕ Мой профиль', url: APP_URL });\n" +
  "  else if (f.stamps === 9) sendPush(cid, '☕ Осталась одна чашка!', 'У вас 9 из 10 штампов. Следующий кофе — бесплатно 😉', { text: '☕ Мой профиль', url: APP_URL });\n" +
  "  return { customer: cust(f), ten, msg: ten ? '10-й штамп! Начислен бесплатный кофе' : `+1 штамп → ${f.stamps} из 10` }; \n" +
  "}\n" +
  "\n" +
  "export function redeem(cid, by, item) {\n" +
  "  const c = db.prepare('SELECT * FROM customers WHERE id=?').get(cid);\n" +
  "  if (!c || c.free < 1) return null;\n" +
  "  db.prepare('UPDATE customers SET free=? WHERE id=?').run(c.free - 1, cid);\n" +
  "  addHist(cid, `🎁 Списан бесплатный кофе: ${item || 'классика'} (осталось ${c.free - 1})`, by);\n" +
  "  logEv(c.name, 'списан бесплатный кофе: ' + (item || 'классика'));\n" +
  "  return { customer: cust(db.prepare('SELECT * FROM customers WHERE id=?').get(cid)) };\n" +
  "}"
][0];

if (content.split(FROM_BODY).length - 1 !== 1) {
  console.error('Якорь блока grant/redeem не найден в server/domain/loyalty.js.');
  process.exit(1);
}

const TO_BODY = [
  MARKER,
  "function stampBar(n) {",
  "  return '🫘'.repeat(Math.min(10, Math.max(0, n))) +",
  "         '⚪'.repeat(Math.max(0, 10 - Math.min(10, Math.max(0, n))));",
  "}",
  "",
  "function cupWord(n) {",
  "  const m10 = n % 10;",
  "  const m100 = n % 100;",
  "  if (m10 === 1 && m100 !== 11) return 'чашка';",
  "  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return 'чашки';",
  "  return 'чашек';",
  "}",
  "",
  "export function grant(cid, by) {",
  "  const c = db.prepare('SELECT * FROM customers WHERE id=?').get(cid);",
  "  if (!c) return null;",
  "  c.stamps++; c.cups++;",
  "  db.prepare('UPDATE customers SET stamps=?,cups=? WHERE id=?').run(c.stamps, c.cups, cid);",
  "  addHist(cid, `Штамп ${c.stamps} из 10`, by);",
  "  let ten = false;",
  "  if (c.stamps >= 10) {",
  "    c.stamps = 0; c.free++; ten = true;",
  "    db.prepare('UPDATE customers SET stamps=?,free=? WHERE id=?').run(0, c.free, cid);",
  "    addHist(cid, '🎉 10-й кофе — подарок начислен', 'Система');",
  "  }",
  "  logEv(c.name, ten ? '10-й кофе — подарок начислен' : `+1 штамп → ${c.stamps} из 10`);",
  "  const f = db.prepare('SELECT * FROM customers WHERE id=?').get(cid);",
  "  const baseAppUrl = APP_URL || 'https://friday.andcoffee.online';",
  "  const bonusKb = {",
  "    inline_keyboard: [[",
  "      { text: '☕ Открыть карту штампов', web_app: { url: baseAppUrl + '/?src=tg&brand=coffee&tab=bonus' } }",
  "    ]]",
  "  };",
  "",
  "  if (ten) {",
  "    sendPush(",
  "      cid,",
  "      '🎁 Бесплатный кофе ваш!',",
  "      `${stampBar(10)} 10/10\\n\\nВы собрали 10 штампов! Заходите в «…и кофе» — напиток за наш счёт ☕🎉`,",
  "      {",
  "        inline_keyboard: [[",
  "          { text: '📱 Показать QR кассиру', web_app: { url: baseAppUrl + '/?src=tg&brand=coffee&tab=bonus' } }",
  "        ]]",
  "      }",
  "    );",
  "  } else if (f.stamps === 9) {",
  "    sendPush(",
  "      cid,",
  "      '🔥 Осталась всего одна чашка!',",
  "      `${stampBar(9)} 9/10\\n\\nУ вас 9 из 10 штампов. Следующий кофе — бесплатно! Ждём вас у моря 🌊`,",
  "      bonusKb",
  "    );",
  "  } else {",
  "    const left = 10 - f.stamps;",
  "    sendPush(",
  "      cid,",
  "      '☕ Вам начислен штамп!',",
  "      `${stampBar(f.stamps)} ${f.stamps}/10\\n\\nШтампов: ${f.stamps} из 10. До подарка осталось: ${left} ${cupWord(left)} 🌊`,",
  "      bonusKb",
  "    );",
  "  }",
  "  return { customer: cust(f), ten, msg: ten ? '10-й штамп! Начислен бесплатный кофе' : `+1 штамп → ${f.stamps} из 10` };",
  "}",
  "",
  "export function redeem(cid, by, item) {",
  "  const c = db.prepare('SELECT * FROM customers WHERE id=?').get(cid);",
  "  if (!c || c.free < 1) return null;",
  "  db.prepare('UPDATE customers SET free=? WHERE id=?').run(c.free - 1, cid);",
  "  addHist(cid, `🎁 Списан бесплатный кофе: ${item || 'классика'} (осталось ${c.free - 1})`, by);",
  "  logEv(c.name, 'списан бесплатный кофе: ' + (item || 'классика'));",
  "  const baseAppUrl = APP_URL || 'https://friday.andcoffee.online';",
  "  const leftFree = c.free - 1;",
  "  const freeText = leftFree > 0 ? `\\nДоступных подарков: <b>${leftFree}</b>` : '';",
  "  sendPush(",
  "    cid,",
  "    '🎁 Бесплатный кофе получен!',",
  "    `Списан подарок: <b>${item || 'кофе'}</b>.${freeText}\\nСпасибо, что вы с нами 🌊`,",
  "    {",
  "      inline_keyboard: [[",
  "        { text: '☕ Открыть меню', web_app: { url: baseAppUrl + '/?src=tg&brand=coffee' } }",
  "      ]]",
  "    }",
  "  );",
  "  return { customer: cust(db.prepare('SELECT * FROM customers WHERE id=?').get(cid)) };",
  "}"
].join('\n');

fs.writeFileSync(BAK_FILE, raw, 'utf8');

let patched = content.split(FROM_IMPORT).join(TO_IMPORT);
patched = patched.split(FROM_BODY).join(TO_BODY);

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

console.log('Успешно: уведомления о штампах и подарках обновлены в loyalty.js.');
console.log('Бэкап: ' + BAK_FILE);