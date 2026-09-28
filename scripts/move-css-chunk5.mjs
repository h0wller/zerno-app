// scripts/fix-tg-support-clean.mjs — возвращает одну кнопку + выбор темы в Telegram.
//   1. tg.js: убирает две прямые web_app-кнопки, возвращает одну с callback_data
//   2. tg.js: добавляет brand=ctx в URL кнопки «Открыть чат» (иначе чужая тема)
//   3. Проверяет, что все обработчики support_* на месте (callback + fallback text)
// Идемпотентно, CRLF-safe. Запуск: node scripts/fix-tg-support-clean.mjs

import fs from 'node:fs';
import { execSync } from 'node:child_process';

const P = 'server/routes/tg.js';
const BAK = 'server/routes/tg.js.bak-support-clean';

if (!fs.existsSync(P)) { console.error('Не найден ' + P); process.exit(1); }

const raw = fs.readFileSync(P, 'utf8');
const isCRLF = raw.indexOf('\r\n') !== -1;
let s = raw.replace(/\r\n/g, '\n');

function write() { fs.writeFileSync(P, isCRLF ? s.replace(/\n/g, '\r\n') : s, 'utf8'); }
function check() {
  try { execSync('node --check ' + P, { stdio: 'pipe' }); return true; }
  catch (e) { console.error('Синтаксис сломан:\n' + (e.stderr || '').toString()); return false; }
}

const MARKER = '// [tg-support-clean-v1]';
if (s.indexOf(MARKER) !== -1) {
  console.log('Уже пропатчено.');
  if (!check()) process.exit(1);
  process.exit(0);
}

fs.writeFileSync(BAK, raw, 'utf8');
console.log('Бэкап: ' + BAK);

// ─── Шаг 1: заменить две прямые кнопки на одну callback ───────────────
const DIRECT_BLOCK = [
  "      // [tg-direct-support-v1]",
  "      { text: '☕ Чат кофейни', web_app: { url: APP_URL + '/?src=tg&brand=coffee&tab=chat&ctx=coffee' } },",
  "      { text: '🍕 Чат доставки', web_app: { url: APP_URL + '/?src=tg&brand=delivery&tab=chat&ctx=delivery' } },",
].join('\n');

const CLEAN_BLOCK = [
  "      " + MARKER,
  "      { text: '💬 Задать вопрос', callback_data: 'support_choose' },",
].join('\n');

if (s.indexOf(DIRECT_BLOCK) === -1) {
  // Возможно, уже почищено или формат другой. Проверим есть ли callback-версия.
  if (s.indexOf("callback_data: 'support_choose'") !== -1) {
    console.log('· tg.js: кнопка «Задать вопрос» с callback уже стоит');
  } else {
    console.error('✗ tg.js: не найден блок [tg-direct-support-v1].');
    console.error('   Проверь welcomeKeyboard вручную. Что там сейчас:');
    const m = s.match(/function welcomeKeyboard[\s\S]{0,800}/);
    if (m) console.error(m[0].split('\n').slice(0, 25).join('\n'));
    process.exit(1);
  }
} else {
  s = s.replace(DIRECT_BLOCK, CLEAN_BLOCK);
  console.log('✓ tg.js: две кнопки → одна «Задать вопрос» с callback');
}

// ─── Шаг 2: brand=ctx в URL кнопки «Открыть чат» ─────────────────────
// Ищем обе формы — в callback-обработчике (fetch editMessageText) и в fallback text.
const OLD_URL_1 = "'/?src=tg&tab=chat&ctx=' + ctx"; // callback и text-fallback (одинаково)
const NEW_URL_1 = "'/?src=tg&brand=' + ctx + '&tab=chat&ctx=' + ctx";

const cnt1 = s.split(OLD_URL_1).length - 1;
if (cnt1 === 0) {
  if (s.indexOf("brand=' + ctx") !== -1) {
    console.log('· tg.js: brand=ctx уже добавлен');
  } else {
    console.warn('⚠ tg.js: не найдено "' + OLD_URL_1 + '" — возможно, URL уже другой. Пропускаю.');
  }
} else {
  s = s.split(OLD_URL_1).join(NEW_URL_1);
  console.log('✓ tg.js: brand=ctx добавлен в URL «Открыть чат» (' + cnt1 + ' мест)');
}

// ─── Шаг 3: проверка, что все обработчики на месте ────────────────────
console.log('');
console.log('Проверка обработчиков:');
const checks = [
  { name: 'callback: support_choose',         str: "if (data === 'support_choose')" },
  { name: 'callback: support_delivery/coffee', str: "if (data === 'support_delivery' || data === 'support_coffee')" },
  { name: 'fallback text: support_choose',    str: "text === 'support_choose'" },
  { name: 'fallback text: support_delivery',  str: "text === 'support_delivery'" },
];
let allOk = true;
for (const c of checks) {
  const ok = s.indexOf(c.str) !== -1;
  console.log('  ' + (ok ? '✓' : '✗') + ' ' + c.name);
  if (!ok) allOk = false;
}
if (!allOk) {
  console.error('');
  console.error('✗ Не все обработчики найдены. Прерываюсь, чтобы не сломать flow.');
  console.error('  Вероятно, предыдущие скрипты (fix-tg-support-flow / fix-tg-support-fallback)');
  console.error('  не были применены. Прогони их сначала, потом этот.');
  process.exit(1);
}

// ─── Запись + проверка ────────────────────────────────────────────────
write();
if (!check()) {
  console.error('Откат: copy ' + BAK + ' ' + P);
  process.exit(1);
}
console.log('');
console.log('✓ tg.js: записан, синтаксис OK');

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
console.log('  2. git commit -m "fix(tg): одна кнопка «Задать вопрос» + brand в URL чата"');
console.log('  3. git push');
console.log('  4. pm2 restart zerno-app --update-env');
console.log('');
console.log('ВАЖНО: нажми /start ЗАНОВО — старое сообщение с двумя кнопками не перерисуется.');
console.log('Ожидаемый флоу:');
console.log('  [💬 Задать вопрос]');
console.log('    → 💬 По какой теме вопрос?');
console.log('       [🍕 Доставка] [☕ Кофейня]');
console.log('    → Открываю чат: 🍕 Доставка');
console.log('       [💬 Открыть чат с поддержкой]');
console.log('    → Mini App: чат с Никой доставки, без сплэша');
console.log('');
console.log('Откат: copy ' + BAK + ' ' + P);