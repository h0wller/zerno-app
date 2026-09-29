// scripts/fix-tg-rudiments.mjs
// Скрытие рудиментов (текст "Нет Telegram" и PWA-баннер) в Telegram Mini App
// Запуск: node scripts/fix-tg-rudiments.mjs

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const CSS_FILE = path.resolve('public/app/ui/theme-v2.css');
const OVERLAY_FILE = path.resolve('public/app/core/overlay.js');
const SW_FILE = path.resolve('public/sw.js');

const BAK_CSS = CSS_FILE + '.bak-rudiments';
const BAK_OVERLAY = OVERLAY_FILE + '.bak-rudiments';
const BAK_SW = SW_FILE + '.bak-rudiments';

function readNorm(P) {
  const raw = fs.readFileSync(P, 'utf8');
  const isCRLF = raw.indexOf('\r\n') !== -1;
  return { content: raw.replace(/\r\n/g, '\n'), isCRLF, raw };
}

function writeNorm(P, content, isCRLF) {
  fs.writeFileSync(P, isCRLF ? content.replace(/\n/g, '\r\n') : content, 'utf8');
}

// ── 1. Патч public/app/core/overlay.js (добавляем класс is-tg-app на <html>) ──
const overlayData = readNorm(OVERLAY_FILE);
let patchedOverlay = overlayData.content;

const FROM_TG_READY = 'if (typeof appInit.expand === \'function\') appInit.expand();';
const TO_TG_READY = [
  'if (typeof appInit.expand === \'function\') appInit.expand();',
  '      document.documentElement.classList.add(\'is-tg-app\');'
].join('\n');

if (!patchedOverlay.includes('is-tg-app')) {
  if (patchedOverlay.includes(FROM_TG_READY)) {
    patchedOverlay = patchedOverlay.replace(FROM_TG_READY, TO_TG_READY);
    fs.writeFileSync(BAK_OVERLAY, overlayData.raw, 'utf8');
    writeNorm(OVERLAY_FILE, patchedOverlay, overlayData.isCRLF);
    console.log('✔ public/app/core/overlay.js: добавлен перманентный класс is-tg-app.');
  }
}

// ── 2. Патч public/app/ui/theme-v2.css (скрываем small, mhint и pwa баннеры) ──
const cssData = readNorm(CSS_FILE);
let patchedCss = cssData.content;

const CSS_RULES = `
/* [tg-rudiments-cleanup-v1] */
#authModal.tg-mode small,
#authModal.tg-mode .mhint,
#authModal.tg-mode .subhint,
html.is-tg-app #pwaInstall,
html.is-tg-app .pwa-banner,
html.is-tg-app #pwaBanner,
html.is-tg-app #pwaPrompt,
html.is-tg-app .pwa-badge,
html.is-tg-app [id*="pwaInstall"] {
  display: none !important;
}
`;

if (!patchedCss.includes('[tg-rudiments-cleanup-v1]')) {
  fs.writeFileSync(BAK_CSS, cssData.raw, 'utf8');
  patchedCss = patchedCss.trimEnd() + '\n' + CSS_RULES;
  writeNorm(CSS_FILE, patchedCss, cssData.isCRLF);
  console.log('✔ public/app/ui/theme-v2.css: добавлены правила скрытия текста и PWA-баннера.');
}

// ── 3. Инкремент STATIC_CACHE в public/sw.js ──
const swData = readNorm(SW_FILE);
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
  execSync('node --check ' + OVERLAY_FILE, { stdio: 'pipe' });
  console.log('✔ Синтаксис overlay.js проверен.');
} catch (e) {
  console.error('Ошибка синтаксиса:', e.message);
  process.exit(1);
}