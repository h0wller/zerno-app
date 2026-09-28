// scripts/fix-tg-chat-url-dedup.mjs
// 1. Исправление URL открытия чата (&tab=chat&ctx=...)
// 2. Устранение дублей заказов у сотрудников и дедупликация TG-рассылки
// Запуск из корня: node scripts/fix-tg-chat-url-dedup.mjs

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const CHAT_FILE = path.resolve('server/routes/chat.js');
const ORDERS_FILE = path.resolve('server/routes/orders.js');
const BAK_CHAT = CHAT_FILE + '.bak-chat-url-dedup';
const BAK_ORDERS = ORDERS_FILE + '.bak-chat-url-dedup';
const MARKER = '// [tg-chat-url-dedup-v1]';

function readNorm(P) {
  const raw = fs.readFileSync(P, 'utf8');
  const isCRLF = raw.indexOf('\r\n') !== -1;
  return { content: raw.replace(/\r\n/g, '\n'), isCRLF, raw };
}

function writeNorm(P, content, isCRLF) {
  fs.writeFileSync(P, isCRLF ? content.replace(/\n/g, '\r\n') : content, 'utf8');
}

if (!fs.existsSync(CHAT_FILE)) {
  console.error('Файл не найден: ' + CHAT_FILE);
  process.exit(1);
}
if (!fs.existsSync(ORDERS_FILE)) {
  console.error('Файл не найден: ' + ORDERS_FILE);
  process.exit(1);
}

const chatData = readNorm(CHAT_FILE);
const ordersData = readNorm(ORDERS_FILE);

if (chatData.content.indexOf(MARKER) !== -1 && ordersData.content.indexOf(MARKER) !== -1) {
  console.log('Файлы chat.js и orders.js уже пропатчены (' + MARKER + ').');
  process.exit(0);
}

// ── 1. Патч chat.js (URL чата и дедупликация вызова оператора) ──
const FROM_CHAT_KB = "        { text: '💬 Открыть чат в приложении', web_app: { url: (APP_URL || 'https://friday.andcoffee.online') + '/?src=tg&brand=' + ctx } }";
const TO_CHAT_KB = "        { text: '💬 Открыть чат в приложении', web_app: { url: (APP_URL || 'https://friday.andcoffee.online') + '/?src=tg&brand=' + ctx + '&tab=chat&ctx=' + ctx } }";

if (chatData.content.split(FROM_CHAT_KB).length - 1 !== 1) {
  console.error('Якорь кнопки чата не найден в server/routes/chat.js.');
  process.exit(1);
}

const FROM_CHAT_LOOP = [
  "    for (const s of staff) {",
  "      sendPush(s.id, title, body, kb);",
  "    }"
].join('\n');

const TO_CHAT_LOOP = [
  "    " + MARKER,
  "    const sentTgChat = new Set();",
  "    for (const s of staff) {",
  "      const sCust = db.prepare('SELECT tg FROM customers WHERE id=?').get(s.id);",
  "      if (sCust && sCust.tg) {",
  "        if (sentTgChat.has(String(sCust.tg))) continue;",
  "        sentTgChat.add(String(sCust.tg));",
  "      }",
  "      sendPush(s.id, title, body, kb);",
  "    }"
].join('\n');

if (chatData.content.split(FROM_CHAT_LOOP).length - 1 !== 1) {
  console.error('Якорь цикла отправки стаффу не найден в server/routes/chat.js.');
  process.exit(1);
}

// ── 2. Патч orders.js (устранение дублей заказов) ──
const FROM_ORDER_NOTIFY = [
  "function orderNotifyStaff(o) {",
  "  const lines = o.items.map(i => `${i.qty}× ${i.name}${i.opt ? ' (' + i.opt + ')' : ''} — ${i.qty * i.price} ₽`);",
  "  const gifts = o.gifts.map(g => `🎁 ${g.name} ×${g.qty}`);",
  "  const timeLabel = o.is_preorder ? `⏰ ПРЕДЗАКАЗ: ${o.slot}` : `⏰ ${o.slot === 'asap' ? 'как можно скорее' : o.slot}`;",
  "  const txt = `${o.name} ${o.phone}\\n${o.method === 'pickup' ? '🛍 Самовывоз, Советская 38А' : '🚗 ' + o.place + ', ' + o.addr}\\n${timeLabel} · 💳 ${o.pay === 'cash' ? 'наличные' : 'карта при получении'}\\n${lines.concat(gifts).join('\\n')}\\nИтого: ${o.total} ₽ (скидка ${o.discount} ₽, доставка ${o.fee} ₽)${o.comment ? '\\n💬 ' + o.comment : ''}`;",
  "  const staff = db.prepare(\"SELECT id FROM customers WHERE role IN ('cashier','admin','dispatch')\").all();",
  "  for (const s of staff) sendPush(s.id, o.is_preorder ? `⏰ Предзаказ #${o.no}` : `🍕 Новый заказ #${o.no}`, txt);",
  "  logEv(o.name, `${o.is_preorder ? 'предзаказ' : 'заказ'} #${o.no} на ${o.total} ₽`);",
  "}"
].join('\n');

if (ordersData.content.split(FROM_ORDER_NOTIFY).length - 1 !== 1) {
  console.error('Якорь orderNotifyStaff не найден в server/routes/orders.js.');
  process.exit(1);
}

const TO_ORDER_NOTIFY = [
  MARKER,
  "function orderNotifyStaff(o) {",
  "  const lines = o.items.map(i => `${i.qty}× ${i.name}${i.opt ? ' (' + i.opt + ')' : ''} — ${i.qty * i.price} ₽`);",
  "  const gifts = o.gifts.map(g => `🎁 ${g.name} ×${g.qty}`);",
  "  const timeLabel = o.is_preorder ? `⏰ ПРЕДЗАКАЗ: ${o.slot}` : `⏰ ${o.slot === 'asap' ? 'как можно скорее' : o.slot}`;",
  "  const txt = `👨‍🍳 <b>[Кухня] Заказ #${o.no}</b>\\n\\n👤 ${o.name} (${o.phone})\\n${o.method === 'pickup' ? '🛍 Самовывоз: Советская 38А' : '🚗 Доставка: ' + (o.place ? o.place + ', ' : '') + o.addr}\\n${timeLabel} · 💳 ${o.pay === 'cash' ? 'наличные' : 'карта при получении'}\\n\\n${lines.concat(gifts).join('\\n')}\\n\\nИтого: <b>${o.total} ₽</b>${o.comment ? '\\n💬 ' + o.comment : ''}`;",
  "",
  "  const staff = db.prepare(\"SELECT id, tg FROM customers WHERE role IN ('cashier','admin','dispatch')\").all();",
  "  const sentTg = new Set();",
  "",
  "  // Исключаем покупателя, если он сам является сотрудником (он уже получает чек покупателя)",
  "  const buyer = db.prepare('SELECT tg FROM customers WHERE id=?').get(o.cid);",
  "  if (buyer && buyer.tg) sentTg.add(String(buyer.tg));",
  "",
  "  const base = (typeof APP_URL !== 'undefined' && APP_URL) || 'https://friday.andcoffee.online';",
  "  const staffKb = {",
  "    inline_keyboard: [[",
  "      { text: '📋 Открыть заказы', web_app: { url: base + '/?src=tg&brand=delivery&tab=orders' } }",
  "    ]]",
  "  };",
  "",
  "  for (const s of staff) {",
  "    if (!s.tg || sentTg.has(String(s.tg))) continue;",
  "    sentTg.add(String(s.tg));",
  "    sendPush(s.id, '', txt, staffKb);",
  "  }",
  "  logEv(o.name, `${o.is_preorder ? 'предзаказ' : 'заказ'} #${o.no} на ${o.total} ₽`);",
  "}"
].join('\n');

// ── Применение патчей и бэкапы ──
fs.writeFileSync(BAK_CHAT, chatData.raw, 'utf8');
let patchedChat = chatData.content.split(FROM_CHAT_KB).join(TO_CHAT_KB);
patchedChat = patchedChat.split(FROM_CHAT_LOOP).join(TO_CHAT_LOOP);
writeNorm(CHAT_FILE, patchedChat, chatData.isCRLF);

fs.writeFileSync(BAK_ORDERS, ordersData.raw, 'utf8');
let patchedOrders = ordersData.content.split(FROM_ORDER_NOTIFY).join(TO_ORDER_NOTIFY);
writeNorm(ORDERS_FILE, patchedOrders, ordersData.isCRLF);

// ── Проверка синтаксиса ──
try {
  execSync('node --check ' + CHAT_FILE, { stdio: 'pipe' });
  execSync('node --check ' + ORDERS_FILE, { stdio: 'pipe' });
  console.log('Синтаксис обоих файлов корректен (node --check passed).');
} catch (e) {
  console.error('Синтаксис сломан:');
  console.error((e.stderr || '').toString());
  fs.writeFileSync(CHAT_FILE, chatData.raw, 'utf8');
  fs.writeFileSync(ORDERS_FILE, ordersData.raw, 'utf8');
  process.exit(1);
}

console.log('Успешно: URL чата исправлен, дубли заказов устранены.');
console.log('Бэкапы: ' + BAK_CHAT + ', ' + BAK_ORDERS);