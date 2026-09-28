// scripts/fix-tg-client-auth.mjs
// Автоматический вход и регистрация через Telegram initData в PWA
// Запуск из корня: node scripts/fix-tg-client-auth.mjs

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const AUTH_FILE = path.resolve('public/app/core/auth.js');
const SW_FILE = path.resolve('public/sw.js');
const BAK_AUTH = AUTH_FILE + '.bak-tg-auth';
const BAK_SW = SW_FILE + '.bak-tg-auth';
const MARKER = '// [tg-initdata-fast-auth-v1]';

function readNorm(P) {
  const raw = fs.readFileSync(P, 'utf8');
  const isCRLF = raw.indexOf('\r\n') !== -1;
  return { content: raw.replace(/\r\n/g, '\n'), isCRLF, raw };
}

function writeNorm(P, content, isCRLF) {
  fs.writeFileSync(P, isCRLF ? content.replace(/\n/g, '\r\n') : content, 'utf8');
}

if (!fs.existsSync(AUTH_FILE)) {
  console.error('Файл не найден: ' + AUTH_FILE);
  process.exit(1);
}
if (!fs.existsSync(SW_FILE)) {
  console.error('Файл не найден: ' + SW_FILE);
  process.exit(1);
}

const authData = readNorm(AUTH_FILE);
if (authData.content.indexOf(MARKER) !== -1) {
  console.log('public/app/core/auth.js: уже пропатчено (' + MARKER + ').');
  process.exit(0);
}

// 1. Якорь в DOMContentLoaded для функции авто-логина
const FROM_DOM = "  /* ── Инициализация слушателей при загрузке DOM ── */\n  document.addEventListener('DOMContentLoaded', function () {";
const TO_DOM = [
  "  /* ── Инициализация слушателей при загрузке DOM ── */",
  "  document.addEventListener('DOMContentLoaded', function () {",
  "    " + MARKER,
  "    async function checkTgAutoLogin() {",
  "      if (localStorage.getItem('zt_user')) return;",
  "      var tg = window.Telegram && window.Telegram.WebApp;",
  "      var initData = tg && tg.initData;",
  "      if (!initData) return;",
  "      try {",
  "        if (typeof tg.ready === 'function') tg.ready();",
  "        var r = await api('/auth/tg-link', {",
  "          method: 'POST',",
  "          body: { initData: initData }",
  "        });",
  "        if (r && r.token && r.customer) {",
  "          setUser(r.token, r.customer);",
  "          if (typeof renderAll === 'function') renderAll();",
  "          if (typeof toast === 'function') toast('Вход выполнен через Telegram', '🤖');",
  "          closeAuth();",
  "        } else if (r && r.needPhone) {",
  "          window.__tgInitData = initData;",
  "          window.__tgUser = r.tgUser;",
  "          var rn = document.getElementById('regName');",
  "          if (rn && !rn.value && r.tgUser && r.tgUser.name) rn.value = r.tgUser.name;",
  "          var rtb = document.getElementById('regTgBtn');",
  "          if (rtb) rtb.style.display = 'none';",
  "        }",
  "      } catch (_) {}",
  "    }",
  "    checkTgAutoLogin();"
].join('\n');

if (authData.content.split(FROM_DOM).length - 1 !== 1) {
  console.error('Якорь DOMContentLoaded не найден в public/app/core/auth.js.');
  process.exit(1);
}

// 2. Якорь в regBtn.onclick для перехвата регистрации через TG
const FROM_REG = "        if (!/^\\d{4}$/.test(pin)) return toast('PIN — ровно 4 цифры', '🔐');\n\n        try {\n          var r = await api('/auth/register', {";
const TO_REG = [
  "        if (!/^\\d{4}$/.test(pin)) return toast('PIN — ровно 4 цифры', '🔐');",
  "",
  "        if (window.__tgInitData) {",
  "          try {",
  "            var rTg = await api('/auth/tg-link', {",
  "              method: 'POST',",
  "              body: { initData: window.__tgInitData, phone: phone, name: name, pin: pin }",
  "            });",
  "            if (rTg && rTg.token && rTg.customer) {",
  "              setUser(rTg.token, rTg.customer);",
  "              closeAuth();",
  "              if (typeof renderAll === 'function') renderAll();",
  "              toast(rTg.isNew ? 'Профиль создан! +1 штамп ваш 🎁' : 'Профиль привязан к Telegram ✅', '🎉');",
  "              return;",
  "            }",
  "          } catch (errTg) {",
  "            if (errTg.code === 409) {",
  "              toast('Номер уже зарегистрирован — входим', '🔗');",
  "              var lpTg = document.getElementById('logPhone');",
  "              if (lpTg) lpTg.value = fmtPhone(phone);",
  "              authSwap(true);",
  "              return;",
  "            }",
  "            toast(errTg.message || 'Ошибка регистрации через Telegram', '⚠️');",
  "            return;",
  "          }",
  "        }",
  "",
  "        try {",
  "          var r = await api('/auth/register', {"
].join('\n');

if (authData.content.split(FROM_REG).length - 1 !== 1) {
  console.error('Якорь regBtn.onclick не найден в public/app/core/auth.js.');
  process.exit(1);
}

// 3. Бэкап и замена auth.js
fs.writeFileSync(BAK_AUTH, authData.raw, 'utf8');
let patchedAuth = authData.content.split(FROM_DOM).join(TO_DOM);
patchedAuth = patchedAuth.split(FROM_REG).join(TO_REG);
writeNorm(AUTH_FILE, patchedAuth, authData.isCRLF);

try {
  execSync('node --check ' + AUTH_FILE, { stdio: 'pipe' });
  console.log('Синтаксис auth.js корректен (node --check passed).');
} catch (e) {
  console.error('Синтаксис auth.js сломан:');
  console.error((e.stderr || '').toString());
  fs.writeFileSync(AUTH_FILE, authData.raw, 'utf8');
  process.exit(1);
}

// 4. Инкремент STATIC_CACHE в sw.js
const swData = readNorm(SW_FILE);
const swMatch = swData.content.match(/zerno-static-v(\d+)/);
if (!swMatch) {
  console.error('Не найден токен STATIC_CACHE в public/sw.js.');
  fs.writeFileSync(AUTH_FILE, authData.raw, 'utf8');
  process.exit(1);
}

const oldVer = swMatch[0];
const newVer = 'zerno-static-v' + (parseInt(swMatch[1], 10) + 1);
const patchedSw = swData.content.replace(oldVer, newVer);

fs.writeFileSync(BAK_SW, swData.raw, 'utf8');
writeNorm(SW_FILE, patchedSw, swData.isCRLF);

try {
  execSync('node --check ' + SW_FILE, { stdio: 'pipe' });
  console.log('Синтаксис sw.js корректен. Версия кэша: ' + oldVer + ' → ' + newVer);
} catch (e) {
  console.error('Синтаксис sw.js сломан:');
  console.error((e.stderr || '').toString());
  fs.writeFileSync(AUTH_FILE, authData.raw, 'utf8');
  fs.writeFileSync(SW_FILE, swData.raw, 'utf8');
  process.exit(1);
}

console.log('Успешно: клиентский auth.js подключён к initData, sw.js обновлён.');
console.log('Бэкапы: ' + BAK_AUTH + ', ' + BAK_SW);