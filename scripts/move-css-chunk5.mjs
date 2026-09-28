// scripts/fix-tg-splash-and-review.mjs
// 1. Диплинк tab=review: открытие профиля и фокус на отзыве
// 2. Сплэш-экран выбора заведения при клике на «Меню и штампы»
// 3. Инкремент кэша sw.js и вызов setChatMenuButton в Telegram API
// Запуск: node scripts/fix-tg-splash-and-review.mjs

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const INDEX_FILE = path.resolve('public/index.html');
const DEEP_FILE = path.resolve('public/app/core/deeplink.js');
const ORDERS_FILE = path.resolve('server/routes/orders.js');
const SETUP_FILE = path.resolve('scripts/tg-bot-setup.mjs');
const SW_FILE = path.resolve('public/sw.js');

const BAK_INDEX = INDEX_FILE + '.bak-splash-review';
const BAK_DEEP = DEEP_FILE + '.bak-splash-review';
const BAK_ORDERS = ORDERS_FILE + '.bak-splash-review';
const BAK_SW = SW_FILE + '.bak-splash-review';
const MARKER = '// [tg-splash-and-review-v1]';

function readNorm(P) {
  const raw = fs.readFileSync(P, 'utf8');
  const isCRLF = raw.indexOf('\r\n') !== -1;
  return { content: raw.replace(/\r\n/g, '\n'), isCRLF, raw };
}

function writeNorm(P, content, isCRLF) {
  fs.writeFileSync(P, isCRLF ? content.replace(/\n/g, '\r\n') : content, 'utf8');
}

function loadEnv() {
  const envPath = path.resolve('.env');
  if (!fs.existsSync(envPath)) return {};
  const raw = fs.readFileSync(envPath, 'utf8');
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const k = trimmed.slice(0, eqIdx).trim();
      let v = trimmed.slice(eqIdx + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      env[k] = v;
      if (!process.env[k]) process.env[k] = v;
    }
  }
  return env;
}

const env = loadEnv();

// ── 1. Патч public/index.html (показ сплэша при splash=1 и в Telegram) ──
const indexData = readNorm(INDEX_FILE);
const FROM_INDEX = [
  '    <script>',
  '      (function () {',
  '        var need = false;',
  '        try {',
  '          var q = new URLSearchParams(location.search);',
  '          var done = false;',
  '          try { done = !!sessionStorage.getItem("splashDone"); } catch (e) {}',
  '          need = !(',
  '            done ||',
  '            q.get("brand") ||',
  '            q.get("tab") ||',
  '            q.get("src") ||',
  '            /Telegram/i.test(navigator.userAgent)',
  '          );',
  '        } catch (e) {}',
  '        document.documentElement.classList.add(need ? "need-splash" : "no-splash");',
  '      })();',
  '    </script>'
].join('\n');

if (indexData.content.split(FROM_INDEX).length - 1 !== 1) {
  console.error('Якорь сплэша не найден в public/index.html.');
  process.exit(1);
}

const TO_INDEX = [
  '    <!-- [tg-splash-menu-fix-v1] -->',
  '    <script>',
  '      (function () {',
  '        var need = false;',
  '        try {',
  '          var q = new URLSearchParams(location.search);',
  '          var done = false;',
  '          try { done = !!sessionStorage.getItem("splashDone"); } catch (e) {}',
  '          if (q.get("splash") === "1" || q.get("splash") === "true") {',
  '            try { sessionStorage.removeItem("splashDone"); } catch (e) {}',
  '            need = true;',
  '          } else {',
  '            need = !(done || q.get("brand") || q.get("tab"));',
  '          }',
  '        } catch (e) {}',
  '        document.documentElement.classList.add(need ? "need-splash" : "no-splash");',
  '      })();',
  '    </script>'
].join('\n');

// ── 2. Патч public/app/core/deeplink.js (поддержка tab=review и tab=profile) ──
const deepData = readNorm(DEEP_FILE);
const FROM_DEEP_APPLY = [
  "      if (tab === 'orders') {",
  "        if (me) { openOrdersView(); }",
  "        else { window.__ztPendingDeep = 'orders'; openAuth(); }",
  "      }"
].join('\n');

if (deepData.content.split(FROM_DEEP_APPLY).length - 1 !== 1) {
  console.error('Якорь tab === orders не найден в public/app/core/deeplink.js.');
  process.exit(1);
}

const TO_DEEP_APPLY = [
  MARKER,
  "      function openReviewView(forReview) {",
  "        try {",
  "          openPanel('profile');",
  "          setTab('profile');",
  "          if (typeof renderProfile === 'function') renderProfile();",
  "          setTimeout(function() {",
  "            var pv = document.getElementById('pvProfile');",
  "            if (pv && !pv.hidden) {",
  "              var nu = document.getElementById('profileNoUser'), pb = document.getElementById('profileBox');",
  "              if (nu && nu.hidden && pb && pb.hidden && typeof renderProfile === 'function') { renderProfile(); }",
  "            }",
  "            var btn = document.getElementById('reviewBtn');",
  "            if (btn) {",
  "              btn.scrollIntoView({ behavior: 'smooth', block: 'center' });",
  "              btn.classList.add('glow');",
  "            }",
  "          }, 500);",
  "        } catch(e) {}",
  "      }",
  "      if (tab === 'orders') {",
  "        if (me) { openOrdersView(); }",
  "        else { window.__ztPendingDeep = 'orders'; openAuth(); }",
  "      }",
  "      if (tab === 'profile' || tab === 'review') {",
  "        if (me) { openReviewView(tab === 'review'); }",
  "        else { window.__ztPendingDeep = tab; openAuth(); }",
  "      }"
].join('\n');

const FROM_DEEP_SETUSER = "        if (pend === 'bonus') setTimeout(function() { openPanel('profile'); setTab('bonus'); }, 150);";
const TO_DEEP_SETUSER = [
  "        if (pend === 'bonus') setTimeout(function() { openPanel('profile'); setTab('bonus'); }, 150);",
  "        if (pend === 'profile' || pend === 'review') setTimeout(function() { openReviewView(pend === 'review'); }, 150);"
].join('\n');

if (deepData.content.split(FROM_DEEP_SETUSER).length - 1 !== 1) {
  console.error('Якорь setUser в public/app/core/deeplink.js не найден.');
  process.exit(1);
}

// ── 3. Патч server/routes/orders.js (кнопка отзыва с tab=review) ──
const ordersData = readNorm(ORDERS_FILE);
const FROM_ORDERS_REVIEW = "tab=profile";
const TO_ORDERS_REVIEW = "tab=review";

if (ordersData.content.split(FROM_ORDERS_REVIEW).length - 1 < 1) {
  console.error('Якорь tab=profile не найден в server/routes/orders.js.');
  process.exit(1);
}

// ── Запись бэкапов и применение замен ──
fs.writeFileSync(BAK_INDEX, indexData.raw, 'utf8');
const patchedIndex = indexData.content.split(FROM_INDEX).join(TO_INDEX);
writeNorm(INDEX_FILE, patchedIndex, indexData.isCRLF);

fs.writeFileSync(BAK_DEEP, deepData.raw, 'utf8');
let patchedDeep = deepData.content.split(FROM_DEEP_APPLY).join(TO_DEEP_APPLY);
patchedDeep = patchedDeep.split(FROM_DEEP_SETUSER).join(TO_DEEP_SETUSER);
writeNorm(DEEP_FILE, patchedDeep, deepData.isCRLF);

fs.writeFileSync(BAK_ORDERS, ordersData.raw, 'utf8');
const patchedOrders = ordersData.content.split(FROM_ORDERS_REVIEW).join(TO_ORDERS_REVIEW);
writeNorm(ORDERS_FILE, patchedOrders, ordersData.isCRLF);

// ── 4. Инкремент STATIC_CACHE в sw.js ──
const swData = readNorm(SW_FILE);
const swMatch = swData.content.match(/zerno-static-v(\d+)/);
if (!swMatch) {
  console.error('Не найден токен STATIC_CACHE в public/sw.js.');
  process.exit(1);
}

const oldVer = swMatch[0];
const newVer = 'zerno-static-v' + (parseInt(swMatch[1], 10) + 1);
const patchedSw = swData.content.replace(oldVer, newVer);

fs.writeFileSync(BAK_SW, swData.raw, 'utf8');
writeNorm(SW_FILE, patchedSw, swData.isCRLF);

// ── Валидация синтаксиса ──
try {
  execSync('node --check ' + DEEP_FILE, { stdio: 'pipe' });
  execSync('node --check ' + ORDERS_FILE, { stdio: 'pipe' });
  execSync('node --check ' + SW_FILE, { stdio: 'pipe' });
  console.log('Синтаксис файлов корректен (node --check passed).');
} catch (e) {
  console.error('Синтаксис сломан:');
  console.error((e.stderr || '').toString());
  fs.writeFileSync(INDEX_FILE, indexData.raw, 'utf8');
  fs.writeFileSync(DEEP_FILE, deepData.raw, 'utf8');
  fs.writeFileSync(ORDERS_FILE, ordersData.raw, 'utf8');
  fs.writeFileSync(SW_FILE, swData.raw, 'utf8');
  process.exit(1);
}

// ── 5. Обновление Menu Button в Telegram Bot API ──
const token = process.env.TEST_TOKEN || process.env.TELEGRAM_BOT_TOKEN || process.env.TG_TOKEN;
const appUrl = (process.env.APP_URL || process.env.PUBLIC_URL || 'https://friday.andcoffee.online').replace(/\/+$/, '');

if (token) {
  console.log('Обновление Menu Button в Telegram API для URL:', appUrl + '/?src=tg&splash=1');
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/setChatMenuButton`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        menu_button: {
          type: 'web_app',
          text: 'Меню и штампы',
          web_app: { url: appUrl + '/?src=tg&splash=1' }
        }
      })
    });
    const j = await res.json().catch(() => ({}));
    console.log('[tg] setChatMenuButton:', j.ok ? 'OK' : j.description);
  } catch (err) {
    console.warn('[tg] Не удалось обновить кнопку меню через API:', err.message);
  }
} else {
  console.log('Токен не найден в .env — пропуск вызова setChatMenuButton.');
}

console.log('Успешно: сплэш-экран и диплинк отзыва настроены.');
console.log('Кэш обновлён: ' + oldVer + ' → ' + newVer);