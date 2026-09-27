/* Ф5.6-финал шаг 4-fix3: chat-support.spec.js — сплэш не должен участвовать в чат-тестах.
1) prepare(): addInitScript ставит sessionStorage.splashDone='1' (как в ui-baseline) —
   статичный сплэш снимается skip-веткой splash.js до первого кадра, без навигации.
2) skipSplash(): селектор #brandSplash → #brandSplashStatic (динамического больше нет;
   страховка на случай ручных сценариев без splashDone).
Продукт не меняется — правка только тестовая. */
import fs from 'node:fs';
const P = 'tests/chat-support.spec.js';
let s = fs.readFileSync(P, 'utf8');
let changed = false;

/* 1 */
const reOnb = /localStorage\.setItem\('zt_onb',\s*'1'\);/;
if (reOnb.test(s) && !s.includes("sessionStorage.setItem('splashDone'")) {
  s = s.replace(reOnb, (m0) => m0 + " sessionStorage.setItem('splashDone', '1'); /* шаг 4-fix3: сплэш вне чат-тестов */");
  changed = true;
  console.log('✅ prepare(): splashDone в addInitScript');
} else if (s.includes("sessionStorage.setItem('splashDone'")) {
  console.log('⚠️ prepare(): splashDone уже ставится');
} else {
  console.error('❌ prepare(): якорь zt_onb не найден — покажи тело prepare()');
  process.exit(1);
}

/* 2 */
if (s.includes("page.locator('#brandSplash')")) {
  s = s.replace("page.locator('#brandSplash')", "page.locator('#brandSplashStatic')");
  changed = true;
  console.log('✅ skipSplash(): селектор → #brandSplashStatic');
} else console.log('⚠️ skipSplash(): старого селектора нет');

if (changed) { fs.writeFileSync(P, s); console.log('✅ chat-support.spec.js обновлён'); }