// scripts/fix-tg-ux.mjs — правит server/routes/tg.js:
//   1. welcomeKeyboard: убран «Мои бонусы», добавлены «Мои заказы»+«Задать вопрос»
//   2. /orders и callback orders: одна кнопка вместо 5 сообщений
//   3. /help: добавлены ссылки на новые разделы
// CRLF-safe. Идемпотентно. Запуск: node scripts/fix-tg-ux.mjs

import fs from 'node:fs';
import { execSync } from 'node:child_process';

const P = 'server/routes/tg.js';
const BAK = 'server/routes/tg.js.bak-ux';

if (!fs.existsSync(P)) { console.error('Не найден ' + P); process.exit(1); }

const raw = fs.readFileSync(P, 'utf8');
const isCRLF = raw.indexOf('\r\n') !== -1;
let s = raw.replace(/\r\n/g, '\n');

const write = () => fs.writeFileSync(P, isCRLF ? s.replace(/\n/g, '\r\n') : s, 'utf8');

// ─── Проверка идемпотентности ─────────────────────────────────────────
if (s.indexOf('// [tg-ux-v1]') !== -1) {
  console.log('Уже пропатчено.');
  try { execSync('node --check ' + P, { stdio: 'pipe' }); console.log('node --check: OK'); }
  catch (e) { console.error((e.stderr || '').toString()); process.exit(1); }
  process.exit(0);
}

// ─── Патч 1: welcomeKeyboard ──────────────────────────────────────────
const WK_OLD = [
  "function welcomeKeyboard(c) {",
  "  const rows = [",
  "    [{ text: '☕ Кофейня — меню и штампы', web_app: { url: APP_URL + '/?src=tg&brand=coffee' } }],",
  "    [{ text: '🍕 Пятница — доставка',     web_app: { url: APP_URL + '/?src=tg&brand=delivery' } }],",
  "  ];",
  "  if (c) {",
  "    rows.push([{ text: '🎁 Мои бонусы', callback_data: 'bonus' },",
  "               { text: '📦 Мои заказы', callback_data: 'orders' }]);",
  "  } else {",
  "    rows.push([{ text: '🔗 Привязать номер', callback_data: 'link_phone' }]);",
  "  }",
  "  return { inline_keyboard: rows };",
  "}",
].join('\n');

const WK_NEW = [
  "function welcomeKeyboard(c) { // [tg-ux-v1]",
  "  const rows = [",
  "    [{ text: '☕ Кофейня — меню и штампы', web_app: { url: APP_URL + '/?src=tg&brand=coffee' } }],",
  "    [{ text: '🍕 Пятница — доставка',     web_app: { url: APP_URL + '/?src=tg&brand=delivery' } }],",
  "  ];",
  "  if (c) {",
  "    rows.push([",
  "      { text: '📦 Мои заказы',    web_app: { url: APP_URL + '/?src=tg&brand=delivery&tab=orders' } },",
  "      { text: '💬 Задать вопрос', web_app: { url: APP_URL + '/?src=tg&tab=chat&support=choose' } },",
  "    ]);",
  "  } else {",
  "    rows.push([{ text: '🔗 Привязать номер', callback_data: 'link_phone' }]);",
  "  }",
  "  return { inline_keyboard: rows };",
  "}",
].join('\n');

if (s.indexOf(WK_OLD) === -1) {
  console.error('✗ welcomeKeyboard: не найден якорь.');
  console.error('  Возможно, файл уже правился или CRLF в другом виде.');
  console.error('  Пришли первые 30 строк файла — подстроюсь.');
  process.exit(1);
}
s = s.replace(WK_OLD, WK_NEW);
console.log('✓ welcomeKeyboard: убран «Мои бонусы», добавлены «Заказы»/«Поддержка»');

// ─── Патч 2: /orders handler ──────────────────────────────────────────
const ORDERS_OLD = [
  "    if (text === '/orders') {",
  "      const c = db.prepare('SELECT * FROM customers WHERE tg=?').get(chatId);",
  "      if (!c) {",
  "        await tgSend(chatId, 'Сначала привяжите профиль 👇', appKb());",
  "        return;",
  "      }",
  "      const rows = db.prepare('SELECT id,no,status,total FROM orders WHERE cid=? ORDER BY no DESC LIMIT 5').all(c.id);",
  "      if (!rows.length) {",
  "        await tgSend(chatId, 'Заказов пока нет — самое время выбрать пиццу 🍕', {",
  "          inline_keyboard: [[{ text: '🍕 Открыть меню', web_app: { url: APP_URL + '/?src=tg&brand=delivery' } }]],",
  "        });",
  "        return;",
  "      }",
  "      for (const o of rows) {",
  "        const idx = STEPS.indexOf(o.status);",
  "        const bar = STEPS.map((s, i) => i <= idx && idx >= 0 ? '●' : '○').join('─');",
  "        const emoji = STATUS_EMOJI[o.status] || '•';",
  "        await tgSend(chatId,",
  "          `<b>#${o.no}</b> · ${emoji} ${ORDER_STATUS[o.status] || o.status}\\n${bar}\\nИтого: <b>${o.total} ₽</b>`,",
  "          { inline_keyboard: [",
  "            [{ text: '📦 Детали', web_app: { url: `${APP_URL}/?src=tg&brand=delivery&tab=orders&no=${o.no}` } }],",
  "            [{ text: '🔁 Повторить', callback_data: `reorder_${o.id}` }],",
  "          ]}",
  "        );",
  "      }",
  "      return;",
  "    }",
].join('\n');

const ORDERS_NEW = [
  "    if (text === '/orders') { // [tg-ux-v1]",
  "      const c = db.prepare('SELECT * FROM customers WHERE tg=?').get(chatId);",
  "      if (!c) {",
  "        await tgSend(chatId, 'Сначала привяжите профиль 👇', appKb());",
  "        return;",
  "      }",
  "      await tgSend(chatId,",
  "        '📦 Мои заказы открываются в приложении — статусы, состав и повтор одним тапом:',",
  "        { inline_keyboard: [[{ text: '📦 Открыть мои заказы', web_app: { url: APP_URL + '/?src=tg&brand=delivery&tab=orders' } }]] }",
  "      );",
  "      return;",
  "    }",
].join('\n');

if (s.indexOf(ORDERS_OLD) === -1) {
  console.error('✗ /orders: не найден якорь.');
  process.exit(1);
}
s = s.replace(ORDERS_OLD, ORDERS_NEW);
console.log('✓ /orders: одна кнопка вместо спама');

// ─── Патч 3: callback 'orders' ────────────────────────────────────────
const CB_ORDERS_OLD = [
  "      if (data === 'orders') {",
  "        const c = db.prepare('SELECT * FROM customers WHERE tg=?').get(chatId);",
  "        if (!c) {",
  "          await tgSend(chatId, 'Сначала привяжите номер — нажмите кнопку ниже 👇', appKb());",
  "          return;",
  "        }",
  "        const rows = db.prepare('SELECT id,no,status,total FROM orders WHERE cid=? ORDER BY no DESC LIMIT 5').all(c.id);",
  "        if (!rows.length) {",
  "          await tgSend(chatId, 'Заказов пока нет — самое время выбрать пиццу 🍕', {",
  "            inline_keyboard: [[{ text: '🍕 Открыть меню', web_app: { url: APP_URL + '/?src=tg&brand=delivery' } }]],",
  "          });",
  "          return;",
  "        }",
  "        for (const o of rows) {",
  "          const idx = STEPS.indexOf(o.status);",
  "          const bar = STEPS.map((s, i) => i <= idx && idx >= 0 ? '●' : '○').join('─');",
  "          const emoji = STATUS_EMOJI[o.status] || '•';",
  "          await tgSend(chatId,",
  "            `<b>#${o.no}</b> · ${emoji} ${ORDER_STATUS[o.status] || o.status}\\n${bar}\\nИтого: <b>${o.total} ₽</b>`,",
  "            { inline_keyboard: [",
  "              [{ text: '📦 Детали', web_app: { url: `${APP_URL}/?src=tg&brand=delivery&tab=orders&no=${o.no}` } }],",
  "              [{ text: '🔁 Повторить', callback_data: `reorder_${o.id}` }],",
  "            ]}",
  "          );",
  "        }",
  "        return;",
  "      }",
].join('\n');

const CB_ORDERS_NEW = [
  "      if (data === 'orders') { // [tg-ux-v1]",
  "        const c = db.prepare('SELECT * FROM customers WHERE tg=?').get(chatId);",
  "        if (!c) {",
  "          await tgSend(chatId, 'Сначала привяжите номер — нажмите кнопку ниже 👇', appKb());",
  "          return;",
  "        }",
  "        await tgSend(chatId,",
  "          '📦 Мои заказы открываются в приложении:',",
  "          { inline_keyboard: [[{ text: '📦 Открыть мои заказы', web_app: { url: APP_URL + '/?src=tg&brand=delivery&tab=orders' } }]] }",
  "        );",
  "        return;",
  "      }",
].join('\n');

if (s.indexOf(CB_ORDERS_OLD) === -1) {
  console.error('✗ callback orders: не найден якорь.');
  console.error('  Если /orders уже заменили, но callback остался — пришли текущий блок.');
  process.exit(1);
}
s = s.replace(CB_ORDERS_OLD, CB_ORDERS_NEW);
console.log('✓ callback orders: одна кнопка вместо спама');

// ─── Патч 4: /help ────────────────────────────────────────────────────
const HELP_OLD = [
  "    if (text === '/help') {",
  "      await tgSend(chatId,",
  "        'Что умею:\\n' +",
  "        '/menu — меню и заказ (открывается в приложении)\\n' +",
  "        '/bonus — мои штампы и подарки\\n' +",
  "        '/orders — мои заказы\\n' +",
  "        '/start — перезапустить\\n\\n' +",
  "        'Или пишите вопрос словами — отвечу сам или позову сотрудника.',",
  "        welcomeKeyboard(db.prepare('SELECT * FROM customers WHERE tg=?').get(chatId))",
  "      );",
  "      return;",
  "    }",
].join('\n');

const HELP_NEW = [
  "    if (text === '/help') { // [tg-ux-v1]",
  "      await tgSend(chatId,",
  "        'Что умею:\\n' +",
  "        '/menu — меню кофейни и доставки\\n' +",
  "        '/bonus — мои штампы и подарки\\n' +",
  "        '/orders — мои заказы\\n' +",
  "        '/start — главное меню\\n\\n' +",
  "        'Или пишите вопрос словами — отвечу сам или позову сотрудника.',",
  "        welcomeKeyboard(db.prepare('SELECT * FROM customers WHERE tg=?').get(chatId))",
  "      );",
  "      return;",
  "    }",
].join('\n');

if (s.indexOf(HELP_OLD) !== -1) {
  s = s.replace(HELP_OLD, HELP_NEW);
  console.log('✓ /help: обновлены подсказки');
} else {
  console.log('· /help: пропущен (не найден — не критично)');
}

// ─── Запись + проверка ────────────────────────────────────────────────
fs.writeFileSync(BAK, raw, 'utf8');
console.log('Бэкап: ' + BAK);
write();

try { execSync('node --check ' + P, { stdio: 'pipe' }); console.log('node --check: OK'); }
catch (e) {
  console.error('Синтаксис сломан:');
  console.error((e.stderr || '').toString());
  console.error('Откат: copy ' + BAK + ' ' + P);
  process.exit(1);
}

// ─── sw.js ────────────────────────────────────────────────────────────
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
console.log('  2. git commit -m "fix(tg): cleaner UX — заказы одной кнопкой, поддержка через сплэш"');
console.log('  3. git push');
console.log('  4. Дождись деплоя (или pm2 restart zerno-app --update-env на сервере)');
console.log('');
console.log('Проверь в боте:');
console.log('  • /start -> 4 кнопки: Кофейня / Пятница / [Мои заказы | Задать вопрос]');
console.log('  • /orders -> одна кнопка «Открыть мои заказы»');
console.log('  • «Задать вопрос» -> открывается сплэш-выбор темы, потом чат');
console.log('  • «Мои бонусы» из /start исчезла (штампы в приветствии)');
console.log('');
console.log('Откат: copy ' + BAK + ' ' + P);