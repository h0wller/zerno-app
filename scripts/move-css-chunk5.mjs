// scripts/fix-tg-webapp-and-link.mjs — правит server/routes/tg.js:
//   • все web_app URL получают ?src=tg&brand=...
//   • link_phone: уже привязан → карточка; не найден → кнопка «Создать профиль»
// Только одинарные/двойные строки — без шаблонных, чтобы не ловить $ и backtick.
// Проверяет все якоря перед заменой. Если хоть один отсутствует — не пишет.
// Запуск: node scripts/fix-tg-webapp-and-link.mjs

import fs from 'node:fs';
import { execSync } from 'node:child_process';

const P = 'server/routes/tg.js';
const BAK = 'server/routes/tg.js.bak-links';

if (!fs.existsSync(P)) {
  console.error('Не найден ' + P);
  process.exit(1);
}

let s = fs.readFileSync(P, 'utf8');

// Идемпотентность.
if (s.indexOf("?src=tg&brand=coffee") !== -1 && s.indexOf("Создать профиль") !== -1) {
  console.log('Уже пропатчено. Правка не нужна.');
  try {
    execSync('node --check ' + P, { stdio: 'pipe' });
    console.log('node --check: OK');
  } catch (e) {
    console.error('Синтаксис сломан:');
    console.error((e.stderr || '').toString());
    process.exit(1);
  }
  process.exit(0);
}

// ─── ЯКОРЯ ──────────────────────────────────────────────────────────────
// Только простые подстроки. Без шаблонных строк, без regex.

// Якорь 1: web_app url без параметров (Кофейня) — встречается 2 раза.
const A1_FROM = "web_app: { url: APP_URL }";
const A1_TO   = "web_app: { url: APP_URL + '/?src=tg&brand=coffee' }";

// Якорь 2: web_app url с ?brand=delivery (Пятница) — 3 раза.
const A2_FROM = "web_app: { url: APP_URL + '?brand=delivery' }";
const A2_TO   = "web_app: { url: APP_URL + '/?src=tg&brand=delivery' }";

// Якорь 3: web_app url с ?tab=bonus (QR) — 1 раз.
const A3_FROM = "web_app: { url: APP_URL + '?tab=bonus' }";
const A3_TO   = "web_app: { url: APP_URL + '/?src=tg&brand=coffee&tab=bonus' }";

// Якорь 4: reorder-URL — 1 раз. Содержит ${orderId} как обычные символы,
// потому что мы ищем в тексте файла, а не интерполируем.
const A4_FROM = "APP_URL}/?reorder=${orderId}";
const A4_TO   = "APP_URL}/?src=tg&brand=delivery&reorder=${orderId}";

// ─── Якорь 5: link_phone ────────────────────────────────────────────────
// Полный блок из 4 строк.
const A5_FROM = [
  "      if (data === 'link_phone') {",
  "        await tgSend(chatId, 'Нажмите кнопку ниже — привяжем профиль к этому Telegram 👇', appKb());",
  "        return;",
  "      }",
].join('\n');

// Новый блок. Собираем через массив строк, чтобы избежать шаблонных литералов.
const A5_TO = [
  "      if (data === 'link_phone') {",
  "        const existing = db.prepare('SELECT * FROM customers WHERE tg=?').get(chatId);",
  "        if (existing) {",
  "          const left = 10 - existing.stamps;",
  "          const line = existing.free",
  "            ? '🎁 Бесплатных кофе: <b>' + existing.free + '</b>'",
  "            : 'До подарка: <b>' + left + '</b> ' + (left === 1 ? 'чашка' : (left >= 2 && left <= 4 ? 'чашки' : 'чашек'));",
  "          await tgSend(chatId,",
  "            'Профиль уже привязан ✅\\n\\n<b>' + existing.name + '</b> · ' + fmtPhone(existing.phone) + '\\n\\n' +",
  "            stampBar(existing.stamps) + '\\nШтампов: <b>' + existing.stamps + '/10</b>\\n' + line,",
  "            bonusKeyboard()",
  "          );",
  "          return;",
  "        }",
  "        await tgSend(chatId,",
  "          'Привяжите номер телефона, чтобы копить штампы и получать бонусы.\\n\\n' +",
  "          'Если у вас <b>уже есть профиль</b> в приложении — нажмите кнопку ниже и поделитесь номером 👇',",
  "          appKb()",
  "        );",
  "        await tgSend(chatId,",
  "          'Если профиля ещё нет — создайте его в приложении (10 секунд):',",
  "          { inline_keyboard: [[{ text: '📝 Создать профиль', web_app: { url: APP_URL + '/?src=tg&brand=coffee' } }]] }",
  "        );",
  "        return;",
  "      }",
].join('\n');

// ─── Якорь 6: contact, но профиль не найден ─────────────────────────────
const A6_FROM = [
  "    } else if (u.message.contact) {",
  "      tgSend(chatId, 'Профиль с таким номером не найден ⚠️\\nСоздайте его в приложении и нажмите «Поделиться номером» ещё раз.');",
  "    } else {",
].join('\n');

const A6_TO = [
  "    } else if (u.message.contact) {",
  "      tgSend(chatId,",
  "        'Профиль с таким номером не найден ⚠️\\n\\nСоздайте его в приложении — займёт 10 секунд:',",
  "        { inline_keyboard: [[{ text: '📝 Создать профиль', web_app: { url: APP_URL + '/?src=tg&brand=coffee' } }]] }",
  "      );",
  "    } else {",
].join('\n');

// ─── ПРОВЕРКА ЯКОРЕЙ ────────────────────────────────────────────────────
const checks = [
  { name: 'A1 web_app кофейня',       from: A1_FROM, min: 2 },
  { name: 'A2 web_app пятница',       from: A2_FROM, min: 3 },
  { name: 'A3 web_app QR',            from: A3_FROM, min: 1 },
  { name: 'A4 reorder URL',           from: A4_FROM, min: 1 },
  { name: 'A5 link_phone блок',       from: A5_FROM, min: 1 },
  { name: 'A6 contact-не-найден',     from: A6_FROM, min: 1 },
];

const missing = [];
for (const c of checks) {
  let count = 0, idx = 0;
  while ((idx = s.indexOf(c.from, idx)) !== -1) { count++; idx += c.from.length; }
  console.log('  ' + (count >= c.min ? '✓' : '✗') + ' ' + c.name + ' — найдено ' + count + ' (ждём ≥ ' + c.min + ')');
  if (count < c.min) missing.push(c.name);
}

if (missing.length) {
  console.error('');
  console.error('Не найдены якоря: ' + missing.join(', '));
  console.error('Файл не тронут. Скорее всего tg.js был изменён вручную.');
  process.exit(1);
}

// ─── БЭКАП И ЗАМЕНЫ ────────────────────────────────────────────────────
fs.writeFileSync(BAK, s, 'utf8');
console.log('');
console.log('Бэкап: ' + BAK);

s = s.split(A1_FROM).join(A1_TO);
s = s.split(A2_FROM).join(A2_TO);
s = s.split(A3_FROM).join(A3_TO);
s = s.split(A4_FROM).join(A4_TO);
s = s.split(A5_FROM).join(A5_TO);
s = s.split(A6_FROM).join(A6_TO);

fs.writeFileSync(P, s, 'utf8');
console.log('tg.js: ссылки обновлены, link_phone доработан');

// ─── ПРОВЕРКА СИНТАКСИСА ────────────────────────────────────────────────
try {
  execSync('node --check ' + P, { stdio: 'pipe' });
  console.log('node --check: OK');
} catch (e) {
  console.error('Синтаксис сломан:');
  console.error((e.stderr || '').toString());
  console.error('Откат: copy ' + BAK + ' ' + P);
  process.exit(1);
}

// ─── sw.js ──────────────────────────────────────────────────────────────
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
console.log('Дальше:');
console.log('  1. git add -A');
console.log('  2. git commit -m "fix(tg): src=tg + brand в web_app ссылках, link_phone с подсказкой"');
console.log('  3. git push');
console.log('  4. На сервере: pm2 restart zerno-app');
console.log('  5. В боте:');
console.log('     • /start -> «Кофейня» -> меню БЕЗ splash');
console.log('     • /start -> «Пятница» -> меню доставки');
console.log('     • «Привязать номер» -> карточка профиля ИЛИ кнопка «Создать профиль»');
console.log('');
console.log('Откат: copy ' + BAK + ' ' + P);