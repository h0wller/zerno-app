#!/usr/bin/env node
/* Автоматическая проверка архитектурных правил CSS.
   Запуск: node scripts/css-audit.mjs
   Интеграция в CI: добавь в package.json → "pretest": "node scripts/css-audit.mjs" */

import { readFileSync } from 'node:fs';

const THEME = readFileSync('public/app/ui/theme-v2.css', 'utf8');
/* F5.7b: комментарии не участвуют в проверках — считаем только реальный CSS */
const THEME_CSS = THEME.replace(/\/\*[\s\S]*?\*\//g, '');
const VIEWS = readFileSync('public/app/core/views.js', 'utf8');

// Извлекаем CSS-строку из views.js (между `var rules = [` и `];`)
const rulesMatch = VIEWS.match(/var rules = \[([\s\S]*?)\];\s*css\.textContent = rules\.join/);
if (!rulesMatch) {
  console.error('❌ Не найден массив rules в views.js');
  process.exit(1);
}
const viewsCSS = rulesMatch[1]
  .replace(/['"]([^'"]*)['"]/g, '$1')   // Ф3.36: views.js отформатирован в двойные кавычки
  .replace(/\\n/g, '\n');

let failures = 0;
const fail = (msg) => { failures++; console.error('❌', msg); };
const ok = (msg) => { console.log('✅', msg); };

/* ── ПРАВИЛО 1: в theme-v2.css нет !important (кроме [hidden]) ── */
const importantMatches = THEME_CSS.match(/!important/g) || [];
const hiddenMatches = (THEME_CSS.match(/\[hidden\][^}]*!important/g) || []).length;
if (importantMatches.length > hiddenMatches) {
  fail(`theme-v2.css: найдено ${importantMatches.length - hiddenMatches} !important вне [hidden]. Базовые стили не должны иметь !important.`);
} else {
  ok('theme-v2.css: !important только в [hidden] (системное)');
}

/* ── ПРАВИЛО 2: в theme-v2.css нет [data-brand="..."] селекторов ── */
if (/\[data-brand\s*=/.test(THEME_CSS)) {
  fail('theme-v2.css: найдены [data-brand="..."] селекторы. Брендовые переопределения — в views.js (СЛОЙ 2).');
} else {
  ok('theme-v2.css: нет брендовых селекторов [data-brand="..."]');
}

/* ── ПРАВИЛО 3: в theme-v2.css нет хардкода брендовых цветов Пятницы ── */
const fridayColors = ['#B4552D', '#8B3E1F', '#3A2A1C', '#241812', '#F3E2CE', '#F3EDE6', '#D9C7AD'];
const fridayInTheme = fridayColors.filter(c => THEME_CSS.includes(c));
if (fridayInTheme.length) {
  fail(`theme-v2.css: найдены крафт-цвета Пятницы: ${fridayInTheme.join(', ')}. Брендовые цвета — в views.js.`);
} else {
  ok('theme-v2.css: нет хардкода брендовых цветов Пятницы');
}

/* ── ПРАВИЛО 4: в views.js все правила либо layout, либо начинаются с [data-brand= ── */
const viewsLines = viewsCSS.split('\n').map(l => l.trim()).filter(Boolean);
/* Ф3.32: разрешённые layout-селекторы (топбар, FAB, grid) */
const allowedGeneric = ['html.in-tg', '.grid', '.card', '.wrap', '.rail', '.panel', '.tabs', '.modal', '.chat', '.btn', '.cta', '.form', '.venueWrap', '#brandSeg', '.venueToggle', '.topbar', '.brand', 'body.editing'];
const badLines = viewsLines.filter(l => {
  /* Ф3.34: ранние разрешения (layer-2 layout + тикер-владелец) — гарантированно до return true */
  if (allowedGeneric.some(s => l.startsWith(s))) return false;
  if (l.startsWith('body.editing') || l.startsWith('.ticker') || l.startsWith('#tickerTrack')) return false;

  if (l.startsWith('/*') || l.startsWith('*')) return false;   // JS-комментарии внутри массива — не правила
  // layout/media/system — разрешены
  if (l.startsWith('@media') || l.startsWith('@keyframes') || l.startsWith('html,') || l.startsWith('body{') || l.startsWith('img,') || l === '') return false;
  // [data-brand=...] — разрешено
  if (l.startsWith('[data-brand=') || l.startsWith('html[data-brand=') || l.startsWith('body[data-brand=') || l.startsWith('html[data-brand="delivery"] body')) return false;
  /* Ф3.32: layout-селекторы топбара/карточек (не брендовые, но легитимные) */
  if (allowedGeneric.some(s => l.startsWith(s))) return false;
  // системные id-селекторы (FAB, grid, overlay) — разрешены
  if (l.startsWith('#') || l.startsWith('.topbar') || l.startsWith('.chat-fab') || l.startsWith('.addonChip') || l.startsWith('.ctxPick') || l.startsWith('.chatHint') || l.startsWith('#chatPanel') || l.startsWith('.myOrderCard') || l.startsWith('.moSt') || l.startsWith('.mo-') || l.startsWith('#myOrders') || l.startsWith('#brandSplash') || l.startsWith('#supportChooseOverlay') || l.startsWith('.venueToggle') || l.startsWith('.topbar .venueWrap') || l.startsWith('#iosHint') || l.startsWith('#installBanner') || l.startsWith('body.support-pending') || l.startsWith('#deliveryGrid') || l.startsWith('#cartFab')) return false;
  return true;
});
if (badLines.length) {
  fail(`views.js: найдены правила без бренда и вне разрешённых селекторов:\n  ${badLines.slice(0, 5).join('\n  ')}`);
} else {
  ok('views.js: все правила — либо layout/system, либо [data-brand="..."]');
}

/* ── ПРАВИЛО 5: CSS в theme-v2.css парсится без ошибок (базовая проверка баланса скобок) ── */
let depth = 0;
for (const ch of THEME) {
  if (ch === '{') depth++;
  if (ch === '}') depth--;
  if (depth < 0) break;
}
if (depth !== 0) {
  fail(`theme-v2.css: несбалансированные скобки (разница: ${depth}).`);
} else {
  ok('theme-v2.css: скобки сбалансированы');
}

/* ── ПРАВИЛО 6: в views.js нет разрывов слов (!importan t, & &, > .) ── */
const typos = ['!importan t', '& &'];   // '> .' — легитимный child-комбинатор, не опечатка

const foundTypos = typos.filter(t => viewsCSS.includes(t));
if (foundTypos.length) {
  fail(`views.js: найдены опечатки-разрывы: ${foundTypos.join(', ')}`);
} else {
  ok('views.js: нет опечаток-разрывов');
}

/* ── ПРАВИЛО 7: нет дублей селекторов в views.js ── */
const selectorCounts = {};
viewsLines.forEach(l => {
if (l.startsWith('@')) return;   // медиа-строки — не селекторные дубли
const m = l.match(/^([^{:]+){/);
  if (m) {
    const sel = m[1].trim();
    selectorCounts[sel] = (selectorCounts[sel] || 0) + 1;
  }
});
const duplicates = Object.entries(selectorCounts).filter(([, n]) => n > 1);
if (duplicates.length) {
  fail(`views.js: дубли селекторов:\n  ${duplicates.map(([s, n]) => `${s} (×${n})`).join('\n  ')}`);
} else {
  ok('views.js: нет дублей селекторов');
}
/* ── ПРАВИЛО 8: sanity-check эмитуемого CSS из views.js ── */
import { readFileSync as rfs } from 'node:fs';
const vsrc = rfs('public/app/core/views.js', 'utf8');
const m = vsrc.match(/var rules = \[([\s\S]*?)\];\s*css\.textContent = rules\.join/);
if (m) {
  const cssText = m[1].split('\n')
    .map(l => l.trim())
    .filter(l => (l.startsWith("'") || l.startsWith('"')) && (l.endsWith("',") || l.endsWith('",')))
    .map(l => l.slice(1, -2))
    .join('\n');
  let bad = 0;
  (cssText.match(/@media\([^)]*\)\s*(?=\n|$)/g) || []).forEach(x => { bad++; console.error('❌ views.js: висячий @media без блока:', x); });
  const open = (cssText.match(/\/\*/g) || []).length, close = (cssText.match(/\*\//g) || []).length;
  if (open !== close) { bad++; console.error(`❌ views.js: незакрытые CSS-комментарии (${open} vs ${close})`); }
  const watched = ['.ticker', '.brand .mark', '.opts button', '.brandSeg', '.cartPanel'];
  const idx = rfs('public/index.html', 'utf8');
  watched.forEach(sel => {
    const inIdx = new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*[{,]').test(idx);
    const inViews = cssText.includes(sel);
    if (inIdx && inViews) console.warn('⚠️ дубль-владелец:', sel, '(index.html + views.js) — кандидат на миграцию Фазы 4');
  });
  if (bad) { failures += bad; }
  else ok('views.js: эмитуемый CSS структурно корректен');
}

/* ── Итог ── */
console.log('\n' + '='.repeat(60));
if (failures === 0) {
  console.log('🎉 Архитектурных нарушений не найдено!');
  process.exit(0);
} else {
  console.error(`\n💥 Найдено нарушений: ${failures}`);
  process.exit(1);
}