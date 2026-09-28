// scripts/fix-tg-order-receipt.mjs
// Мгновенный Telegram-чек гостю при создании заказа + повтор/отзыв при статусе "Выполнен"
// Запуск из корня: node scripts/fix-tg-order-receipt.mjs

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const TARGET_FILE = path.resolve('server/routes/orders.js');
const BAK_FILE = TARGET_FILE + '.bak-order-receipt';
const MARKER = '// [tg-order-receipt-v1]';

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

// 1. Проверяем якорь orderNotifyStaff
const FROM_NOTIFY = [
  "  orderNotifyStaff(o);",
  "  res.json({ order: o });"
].join('\n');

if (content.split(FROM_NOTIFY).length - 1 !== 1) {
  console.error('Якорь orderNotifyStaff не найден в server/routes/orders.js.');
  process.exit(1);
}

const TO_NOTIFY = [
  "  orderNotifyStaff(o);",
  "  orderNotifyCustomer(o);",
  "  res.json({ order: o });"
].join('\n');

// 2. Вставляем функцию orderNotifyCustomer перед роутом создания заказа
const FROM_POST_ROUTE = "ordersRouter.post('/api/orders', userGuard, (req, res) => {";
if (content.split(FROM_POST_ROUTE).length - 1 !== 1) {
  console.error('Якорь роута POST /api/orders не найден в server/routes/orders.js.');
  process.exit(1);
}

const TO_POST_ROUTE = [
  MARKER,
  "function orderNotifyCustomer(o) {",
  "  try {",
  "    const isPickup = o.method === 'pickup';",
  "    const timeLabel = o.is_preorder ? ('⏰ Предзаказ на: <b>' + o.slot + '</b>') : '⏰ Доставка: ~45 мин';",
  "    const dest = isPickup ? '🛍 Самовывоз: ул. Советская, 38А' : ('🚗 Доставка: ' + (o.place ? o.place + ', ' : '') + o.addr);",
  "    const lines = (o.items || []).map(i => '• ' + i.name + (i.opt ? ' (' + i.opt + ')' : '') + ' × ' + i.qty).join('\\n');",
  "    const gifts = (o.gifts || []).map(g => '🎁 ' + g.name + ' × ' + g.qty).join('\\n');",
  "    const itemsText = gifts ? (lines + '\\n' + gifts) : lines;",
  "    const payText = o.pay === 'cash' ? 'наличные' : 'картой при получении';",
  "",
  "    const text =",
  "      '🍕 <b>Заказ #' + o.no + ' принят!</b>\\n\\n' +",
  "      itemsText + '\\n\\n' +",
  "      'Итого: <b>' + o.total + ' ₽</b> · 💳 ' + payText + '\\n' +",
  "      dest + '\\n' + timeLabel + '\\n\\n' +",
  "      'Мы уже передали заказ на кухню. Статус обновится здесь автоматически 👇';",
  "",
  "    const kb = typeof orderActionKb === 'function' ? orderActionKb(o.no) : undefined;",
  "    sendPush(o.cid, '', text, kb);",
  "  } catch (err) {",
  "    console.error('[orders] orderNotifyCustomer error:', err.message);",
  "  }",
  "}",
  "",
  "ordersRouter.post('/api/orders', userGuard, (req, res) => {"
].join('\n');

// 3. Обновляем статусную отправку в /status (для статуса 'done' отдаём кнопки повтора и отзыва)
const FROM_STATUS_SEND = "  sendPush(o.cid, `🍕 Заказ #${o.no}`,\n    ORDER_STATUS[s] + (s === 'way' && o.addr ? ': ' + o.addr : ''),\n    orderActionKb(o.no));";

if (content.split(FROM_STATUS_SEND).length - 1 !== 1) {
  console.error('Якорь строки sendPush в роуте status не найден в server/routes/orders.js.');
  process.exit(1);
}

const TO_STATUS_SEND = [
  "  const isDone = s === 'done';",
  "  const base = (typeof APP_URL !== 'undefined' && APP_URL) || (typeof WEBAPP_URL !== 'undefined' && WEBAPP_URL) || 'https://friday.andcoffee.online';",
  "  const doneKb = {",
  "    inline_keyboard: [",
  "      [{ text: '🔁 Повторить заказ', web_app: { url: base + '/?src=tg&brand=delivery&reorder=' + o.id } }],",
  "      [{ text: '⭐ Оставить отзыв', web_app: { url: base + '/?src=tg&brand=delivery&tab=profile' } }],",
  "    ]",
  "  };",
  "  const kb = isDone ? doneKb : orderActionKb(o.no);",
  "  const msgTitle = isDone ? '' : ('🍕 Заказ #' + o.no);",
  "  const msgBody = isDone",
  "    ? ('🏁 <b>Заказ #' + o.no + ' выполнен!</b>\\n\\nПриятного аппетита! Спасибо, что выбираете нас 🍕\\nБудем рады вашему отзыву или новому заказу 👇')",
  "    : (ORDER_STATUS[s] + (s === 'way' && o.addr ? ': ' + o.addr : ''));",
  "  sendPush(o.cid, msgTitle, msgBody, kb);"
].join('\n');

fs.writeFileSync(BAK_FILE, raw, 'utf8');

let patched = content.split(FROM_POST_ROUTE).join(TO_POST_ROUTE);
patched = patched.split(FROM_NOTIFY).join(TO_NOTIFY);
patched = patched.split(FROM_STATUS_SEND).join(TO_STATUS_SEND);

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

console.log('Успешно: чеки заказов и статус завершения обновлены в orders.js.');
console.log('Бэкап: ' + BAK_FILE);