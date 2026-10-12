#!/usr/bin/env node
/* scripts/css-dedup-step2.mjs
   Шаг 2: миграция CSS из cart.js (cartCoreStyles) в theme-v2.css и views.js.
   Надёжный поиск блока по нескольким якорям.
   Запуск: node scripts/css-dedup-step2.mjs
*/
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const FILES = {
  cart:  'public/app/cart.js',
  theme: 'public/app/ui/theme-v2.css',
  views: 'public/app/core/views.js',
};

for (const [k, p] of Object.entries(FILES)) {
  if (!existsSync(p)) { console.error(`❌ Не найден: ${p}`); process.exit(1); }
}

// ═══════════════════════════════════════════════════════════════
// 1. Находим блок cartCoreStyles в cart.js
// ═══════════════════════════════════════════════════════════════
const cartSrc = readFileSync(FILES.cart, 'utf8');

// Стратегия 1: ищем по s.id = "cartCoreStyles"
let iifeStart = cartSrc.indexOf('s.id = "cartCoreStyles"');
if (iifeStart === -1) {
  // Стратегия 2: ищем по var existing = document.getElementById("cartCoreStyles")
  iifeStart = cartSrc.indexOf('var existing = document.getElementById("cartCoreStyles")');
}
if (iifeStart === -1) {
  // Стратегия 3: ищем по комментарию "Стили Слоя 3"
  iifeStart = cartSrc.indexOf('Стили Слоя 3');
}

if (iifeStart === -1) {
  console.log('⚠️  cart.js: блок cartCoreStyles не найден (возможно, уже очищено)');
  process.exit(0);
}

// Находим начало IIFE (отступаем назад до (function () {)
let blockStart = cartSrc.lastIndexOf('(function () {', iifeStart);
if (blockStart === -1) {
  blockStart = cartSrc.lastIndexOf('/* ──', iifeStart);
}
if (blockStart === -1) {
  console.error('❌ Не удалось найти начало IIFE');
  process.exit(1);
}

// Находим конец IIFE (}); в конце файла)
let blockEnd = cartSrc.lastIndexOf('})();', cartSrc.length);
if (blockEnd === -1) {
  console.error('❌ Не удалось найти конец IIFE');
  process.exit(1);
}
blockEnd += 5; // включаем });

const iifeBlock = cartSrc.slice(blockStart, blockEnd);

// Извлекаем CSS из s.textContent = "...";
const cssMatch = iifeBlock.match(/s\.textContent\s*=\s*([\s\S]*?);/);
if (!cssMatch) {
  console.error('❌ Не удалось извлечь CSS из cartCoreStyles');
  process.exit(1);
}

let cssText = cssMatch[1];
// Убираем конкатенацию строк
cssText = cssText.replace(/\+\s*$/gm, '').replace(/\+\s*\n/g, '');
// Убираем кавычки в начале и конце каждой строки
cssText = cssText.split('\n').map(line => {
  line = line.trim();
  if (line.startsWith('"') && line.endsWith('"')) {
    return line.slice(1, -1);
  }
  if (line.startsWith("'") && line.endsWith("'")) {
    return line.slice(1, -1);
  }
  return line;
}).join('');

console.log(`📊 Извлечено CSS: ${cssText.length} символов`);

// ═══════════════════════════════════════════════════════════════
// 2. Разделяем CSS на базовые и брендовые правила
// ═══════════════════════════════════════════════════════════════
const rules = cssText.split('}').map(r => r.trim() + '}').filter(r => r.length > 3 && r.includes('{'));

const baseRules = [];
const brandRules = [];

// Дубли, которые УЖЕ есть в theme-v2.css — пропускаем
const skipSelectors = ['.cartItem', '.ci-main-row', '.ci-left', '.ci-name', '.ci-opt', '.ci-price'];

// Замены брендовых цветов на нейтральные токены для Слоя 1
const colorReplacements = {
  'rgba(58,42,28,0.18)': 'var(--line)',
  'rgba(58,42,28,.3)': 'var(--line)',
  'var(--fr-tan,#C99E6E)': 'var(--line)',
  'var(--fr-choc,#3A2A1C)': 'var(--ink)',
  'var(--flame,#C03B2A)': 'var(--flame)',
  'var(--fr-rice,#EFE6D8)': 'var(--panel)',
  '#F9F6F0': 'var(--panel)',
  '#F4EFE6': 'var(--tint-warm)',
  '#E0D9CD': 'var(--line)',
  '#FFF6E5': 'var(--tint-alert)',
  '#F2D9A5': 'var(--line)',
  '#6B4E0E': 'var(--status-alert)',
  'rgba(201,158,110,0.14)': 'var(--tint-warm)',
  'rgba(201,158,110,0.12)': 'var(--tint-warm)',
  'rgba(201,158,110,0.25)': 'var(--line)',
  'rgba(192,59,42,0.03)': 'var(--tint-danger)',
  'var(--ink,#101418)': 'var(--ink)',
  'var(--soft,#586470)': 'var(--soft)',
  'var(--line,#D8DFE4)': 'var(--line)',
  'var(--panel,#F3F8FC)': 'var(--panel)',
  'var(--green,#186A43)': 'var(--green)',
  'var(--status-danger,#B3372B)': 'var(--status-danger)',
};

for (const rule of rules) {
  const braceIdx = rule.indexOf('{');
  const selector = rule.slice(0, braceIdx).trim();
  let body = rule.slice(braceIdx + 1, -1).trim();

  if (skipSelectors.includes(selector)) continue;

  // Базовое правило (нейтральные токены)
  let baseBody = body;
  for (const [from, to] of Object.entries(colorReplacements)) {
    baseBody = baseBody.split(from).join(to);
  }
  baseRules.push(`${selector}{${baseBody}}`);

  // Брендовое правило (оригинальные цвета + префикс)
  brandRules.push(`[data-brand="delivery"] ${selector}{${body}}`);
}

console.log(`📊 Найдено правил: ${rules.length}, базовых: ${baseRules.length}, брендовых: ${brandRules.length}`);

// ═══════════════════════════════════════════════════════════════
// 3. Удаляем IIFE из cart.js
// ═══════════════════════════════════════════════════════════════
const newCartSrc = cartSrc.slice(0, blockStart) + 
  '/* СЛОЙ 3 cart: стили перенесены в theme-v2.css + views.js (css-dedup-step2) */\n' + 
  cartSrc.slice(blockEnd);
writeFileSync(FILES.cart, newCartSrc, 'utf8');
console.log(`✅ cart.js: удалён блок cartCoreStyles`);

// ═══════════════════════════════════════════════════════════════
// 4. Добавляем базовые правила в theme-v2.css
// ═══════════════════════════════════════════════════════════════
const themeSrc = readFileSync(FILES.theme, 'utf8');
const themeMarker = '/* ── css-dedup-step2: перенесено из cart.js (база) ── */';

if (!themeSrc.includes(themeMarker)) {
  // Находим якорь для вставки: перед блоком deliveryGrid
  const insertAnchor = '/* ── Стили каталога и опций доставки ── */';
  const insertIdx = themeSrc.indexOf(insertAnchor);
  
  if (insertIdx === -1) {
    console.error('❌ Не найден якорь для вставки в theme-v2.css');
    process.exit(1);
  }
  
  const addition = `${themeMarker}\n${baseRules.join('\n')}\n\n`;
  const newThemeSrc = themeSrc.slice(0, insertIdx) + addition + themeSrc.slice(insertIdx);
  writeFileSync(FILES.theme, newThemeSrc, 'utf8');
  console.log(`✅ theme-v2.css: добавлено ${baseRules.length} базовых правил`);
} else {
  console.log('⚠️  theme-v2.css: правила уже добавлены');
}

// ═══════════════════════════════════════════════════════════════
// 5. Добавляем брендовые правила в views.js (массив rules)
// ═══════════════════════════════════════════════════════════════
const viewsSrc = readFileSync(FILES.views, 'utf8');
const viewsMarker = '/* ── css-dedup-step2: перенесено из cart.js (бренд) ─ */';

if (!viewsSrc.includes(viewsMarker)) {
  // Ищем конец массива rules: строка с "];" перед "css.textContent = rules.join"
  const rulesEndPattern = /css\.textContent = rules\.join/;
  const rulesEndMatch = viewsSrc.match(rulesEndPattern);
  
  if (!rulesEndMatch) {
    console.error('❌ Не найден конец массива rules в views.js');
    process.exit(1);
  }
  
  const rulesEndIdx = rulesEndMatch.index;
  const bracketIdx = viewsSrc.lastIndexOf('];', rulesEndIdx);
  
  if (bracketIdx === -1) {
    console.error('❌ Не найдена закрывающая скобка массива rules');
    process.exit(1);
  }
  
  const rulesArrayStr = brandRules.map(r => `'${r.replace(/'/g, "\\'")}',`).join('\n');
  const addition = `\n${viewsMarker}\n${rulesArrayStr}`;
  
  const newViewsSrc = viewsSrc.slice(0, bracketIdx + 2) + addition + '\n' + viewsSrc.slice(bracketIdx + 2);
  writeFileSync(FILES.views, newViewsSrc, 'utf8');
  console.log(`✅ views.js: добавлено ${brandRules.length} брендовых правил`);
} else {
  console.log('⚠️  views.js: правила уже добавлены');
}

// ═══════════════════════════════════════════════════════════════
// 6. АВТОМАТИЧЕСКИЕ ПРОВЕРКИ
// ═══════════════════════════════════════════════════════════════
console.log('\n🔬 Запуск автоматических проверок...');
try {
  execSync('node --check public/app/cart.js', { stdio: 'inherit' });
  execSync('node --check public/app/core/views.js', { stdio: 'inherit' });
  console.log('✅ Синтаксис JS файлов корректен');
  
  execSync('npm run pretest', { stdio: 'inherit' });
  console.log('✅ Архитектурный аудит (pretest) пройден');
  
  console.log('\n Шаг 2 завершён!');
} catch (e) {
  console.error('\n❌ Ошибка при выполнении проверок.');
  console.error('🔙 Откат: git checkout -- public/app/cart.js public/app/ui/theme-v2.css public/app/core/views.js');
  process.exit(1);
}

console.log('\n📝 Следующий шаг: ручная проверка визуала корзины.');