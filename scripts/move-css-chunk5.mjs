#!/usr/bin/env node
/**
 * scripts/auth-modal-redesign.mjs
 * Задача 2: Корректный редизайн и адаптация модалки авторизации под Mini App и Web.
 * 
 * Запуск:
 *   node scripts/auth-modal-redesign.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const AUTH_JS = path.join(root, 'public/app/core/auth.js');
const THEME_CSS = path.join(root, 'public/app/ui/theme-v2.css');
const SW_FILE = path.join(root, 'public/sw.js');

const BAK_AUTH = AUTH_JS + '.bak-auth-redesign';
const BAK_THEME = THEME_CSS + '.bak-auth-redesign';
const BAK_SW = SW_FILE + '.bak-auth-redesign';

function readNorm(P) {
  const raw = fs.readFileSync(P, 'utf8');
  const isCRLF = raw.indexOf('\r\n') !== -1;
  return { content: raw.replace(/\r\n/g, '\n'), isCRLF, raw };
}

function writeNorm(P, content, isCRLF) {
  fs.writeFileSync(P, isCRLF ? content.replace(/\n/g, '\r\n') : content, 'utf8');
}

if (!fs.existsSync(AUTH_JS) || !fs.existsSync(THEME_CSS) || !fs.existsSync(SW_FILE)) {
  console.error('Ошибка: не найдены обязательные файлы в public/');
  process.exit(1);
}

const authData = readNorm(AUTH_JS);
const themeData = readNorm(THEME_CSS);
const swData = readNorm(SW_FILE);

// ── 1. Патч public/app/core/auth.js ──
// Внедряем адаптацию прямо в applyAuthBrand() — штатную функцию брендинга модалки,
// которая гарантированно вызывается при каждом открытии и переключении формы.
const FROM_BRAND = "function applyAuthBrand() {";
const TO_BRAND = [
  "// [tg-auth-modal-redesign-v2]",
  "function adaptAuthForTelegram(modal) {",
  "  var isTg = !!(window.__isTgMiniApp || window.__tgInitData || (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData));",
  "  if (!isTg || !modal) return;",
  "",
  "  modal.classList.add('tg-mode');",
  "  // Скрываем кнопку перехода в Telegram (мы уже внутри него)",
  "  var tgBtn = document.getElementById('regTgBtn');",
  "  if (tgBtn) tgBtn.style.display = 'none';",
  "",
  "  // Скрываем подсказку про кассира под кнопкой",
  "  var hint = modal.querySelector('.mhint, .subhint, #regForm .hint');",
  "  if (hint) hint.style.display = 'none';",
  "",
  "  // Скрываем чекбокс согласия ПД (акцепт нативно через Telegram ID)",
  "  var consentRow = modal.querySelector('label:has(input[type=\"checkbox\"]), .consent-row');",
  "  if (consentRow) consentRow.style.display = 'none';",
  "",
  "  // Предзаполняем имя",
  "  if (window.__tgUser && window.__tgUser.name) {",
  "    var rn = document.getElementById('regName');",
  "    if (rn && !rn.value) rn.value = window.__tgUser.name;",
  "  }",
  "}",
  "",
  "function applyAuthBrand() {"
].join('\n');

const FROM_BRAND_CALL = "if (msub) {";
const TO_BRAND_CALL = [
  "adaptAuthForTelegram(modal);",
  "    if (msub) {"
].join('\n');

// Обновляем отображение бейджа при подтверждении в браузере
const FROM_CONFIRMED = "var row = document.getElementById('regTgRow');\n                if (row) row.hidden = false;";
const TO_CONFIRMED = [
  "var row = document.getElementById('regTgRow');",
  "                if (row) {",
  "                  row.hidden = false;",
  "                  row.className = 'auth-badge-confirmed';",
  "                  row.innerHTML = '<span>✅ Номер подтверждён в Telegram</span>';",
  "                }"
].join('\n');

let patchedAuth = authData.content;
if (!patchedAuth.includes('// [tg-auth-modal-redesign-v2]')) {
  if (patchedAuth.includes(FROM_BRAND) && patchedAuth.includes(FROM_BRAND_CALL)) {
    patchedAuth = patchedAuth.replace(FROM_BRAND, TO_BRAND);
    patchedAuth = patchedAuth.replace(FROM_BRAND_CALL, TO_BRAND_CALL);
    if (patchedAuth.includes(FROM_CONFIRMED)) {
      patchedAuth = patchedAuth.replace(FROM_CONFIRMED, TO_CONFIRMED);
    }
    fs.writeFileSync(BAK_AUTH, authData.raw, 'utf8');
    writeNorm(AUTH_JS, patchedAuth, authData.isCRLF);
    console.log('✔ public/app/core/auth.js: адаптация модалки и анимированный бейдж добавлены.');
  } else {
    console.warn('⚠ public/app/core/auth.js: якоря applyAuthBrand не найдены, пропуск.');
  }
}

// ── 2. Патч public/app/ui/theme-v2.css ──
let patchedTheme = themeData.content;
if (!patchedTheme.includes('/* tg-auth-badge-redesign-v2 */')) {
  const THEME_ADDITIONS = `
/* tg-auth-badge-redesign-v2 */
.auth-badge-confirmed {
  display: flex !important;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  background: rgba(24, 106, 67, 0.12);
  border: 1.5px solid #186A43;
  color: #186A43;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  margin: 10px 0;
  animation: badgeSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes badgeSlideIn {
  from { opacity: 0; transform: translateY(-8px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

/* Упрощённый вид формы внутри Telegram Mini App */
#authModal.tg-mode #regTgBtn,
#authModal.tg-mode .mhint {
  display: none !important;
}

#authModal.tg-mode .frow:has(input[type="checkbox"]) {
  display: none !important;
}

@media (max-width: 375px) {
  #authModal .modal-body {
    padding: 16px 14px;
  }
  #authModal input {
    font-size: 16px !important; /* защита от авто-зума на iOS */
  }
}
`;
  fs.writeFileSync(BAK_THEME, themeData.raw, 'utf8');
  patchedTheme = patchedTheme + '\n' + THEME_ADDITIONS;
  writeNorm(THEME_CSS, patchedTheme, themeData.isCRLF);
  console.log('✔ public/app/ui/theme-v2.css: стили бейджа и компактной формы добавлены.');
}

// ── 3. Инкремент STATIC_CACHE в public/sw.js ──
const swMatch = swData.content.match(/zerno-static-v(\d+)/);
if (swMatch) {
  const oldVer = swMatch[0];
  const newVer = 'zerno-static-v' + (parseInt(swMatch[1], 10) + 1);
  const patchedSw = swData.content.replace(oldVer, newVer);
  fs.writeFileSync(BAK_SW, swData.raw, 'utf8');
  writeNorm(SW_FILE, patchedSw, swData.isCRLF);
  console.log(`✔ public/sw.js: кэш обновлён ${oldVer} -> ${newVer}`);
}

// ── 4. Проверка синтаксиса ──
try {
  execSync('node --check ' + AUTH_JS, { stdio: 'pipe' });
  console.log('✔ Синтаксис auth.js корректен (node --check passed).');
} catch (e) {
  fs.writeFileSync(AUTH_JS, authData.raw, 'utf8');
  console.error('Ошибка синтаксиса auth.js:', e.message);
  process.exit(1);
}