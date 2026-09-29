#!/usr/bin/env node
/**
 * scripts/fix-floating-cart-pill.mjs
 * Багфикс плавающей кнопки корзины → pill-bubble
 * 
 * Что делает:
 * - Трансформирует public/index.html: заменяет старую разметку #cartFab
 *   на новую пилюлю с .cf-badge / .cf-sep / .cf-total
 * - Переписывает стили .cartFab в theme-v2.css под горизонтальную капсулу
 * - Убирает #cartFab из правила .chat-fab,#cartFab (корень бага: 56×56)
 * - Нормализует updateCartFab() и cartFabShow() в cart.js и delivery.js
 * - Создаёт бэкапы *.bak-*
 * - CRLF-safe
 * - node --check для изменённых JS
 * - Инкрементирует STATIC_CACHE в public/sw.js
 * 
 * Запуск:
 *   node scripts/fix-floating-cart-pill.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const stamp = new Date()
  .toISOString()
  .replace(/[:T]/g, '-')
  .replace(/\..+$/, '');

const changed = [];
const warnings = [];

function resolvePath(relPath) {
  return path.join(root, relPath);
}

function backupFile(absPath) {
  if (!fs.existsSync(absPath)) return null;
  let candidate = `${absPath}.bak-${stamp}`;
  let i = 1;
  while (fs.existsSync(candidate)) {
    candidate = `${absPath}.bak-${stamp}-${i}`;
    i += 1;
  }
  fs.copyFileSync(absPath, candidate);
  return candidate;
}

function readLf(absPath) {
  const raw = fs.readFileSync(absPath, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const text = raw.replace(/\r\n/g, '\n');
  return { text, eol };
}

function writeEol(absPath, text, eol) {
  const out = eol === '\r\n' ? text.replace(/\n/g, '\r\n') : text;
  fs.writeFileSync(absPath, out, 'utf8');
}

function checkSyntax(absPath) {
  const res = spawnSync(process.execPath, ['--check', absPath], { encoding: 'utf8' });
  if (res.status !== 0) {
    throw new Error(`node --check failed for ${absPath}\n${res.stderr || res.stdout || ''}`);
  }
}

function modifyFile(relPath, transformer) {
  const absPath = resolvePath(relPath);
  if (!fs.existsSync(absPath)) {
    warnings.push(`Файл не найден: ${relPath}`);
    return false;
  }
  const { text, eol } = readLf(absPath);
  const out = transformer(text);
  if (typeof out !== 'string' || out === text) return false;

  const bak = backupFile(absPath);
  writeEol(absPath, out, eol);

  if (relPath.endsWith('.js') || relPath.endsWith('.mjs')) {
    try {
      checkSyntax(absPath);
    } catch (err) {
      if (bak) fs.copyFileSync(bak, absPath);
      throw err;
    }
  }

  changed.push(relPath);
  console.log(`✔ Изменён: ${relPath}${bak ? ` (backup: ${path.basename(bak)})` : ''}`);
  return true;
}

function patchSw(text) {
  const re = /(STATIC_CACHE\s*=\s*['"])([^'"]+)(['"])/;
  let found = false;
  const out = text.replace(re, (m, pre, val, quote) => {
    found = true;
    let next;
    if (/\d/.test(val)) {
      next = val.replace(/(\d+)(?=[^\d]*$)/, (_, num) => String(Number(num) + 1));
    } else {
      next = `${val}-2`;
    }
    console.log(`   STATIC_CACHE: ${val} -> ${next}`);
    return `${pre}${next}${quote}`;
  });
  if (!found) warnings.push('public/sw.js: не найден STATIC_CACHE');
  return found ? out : text;
}

/* ═══════════════════════════════════════════════════════════
   НОВАЯ РАЗМЕТКА КОРЗИНЫ-ПИЛЮЛИ
   ═══════════════════════════════════════════════════════════ */
const NEW_CART_FAB_HTML = `<button type="button" id="cartFab" class="cartFab" hidden aria-label="Открыть корзину">
  <span class="cf-icon">🛒</span>
  <span class="cf-badge">0</span>
  <span class="cf-sep"></span>
  <span class="cf-total">0 ₽</span>
</button>`;

/* ═══════════════════════════════════════════════════════════
   ТРАНСФОРМЕРЫ
   ═══════════════════════════════════════════════════════════ */

/**
 * Патч public/index.html:
 * Находит старую разметку #cartFab и заменяет на новую пилюлю.
 * Поддерживает варианты:
 * - <button id="cartFab" ...>...</button>
 * - <div id="cartFab" ...>...</div>
 * - <button id="cartFab" ... /> (самозакрывающийся)
 * - Просто <... id="cartFab" ...> без закрывающего тега (заменяем до следующего >)
 */
function patchIndexHtml(text) {
  if (text.includes('class="cartFab"') && text.includes('cf-badge')) {
    return text; // уже обновлено
  }

  let result = text;
  let replaced = false;

  // Вариант 1: <button id="cartFab" ...>...</button>
  const btnPattern = /<button[^>]*id=["']cartFab["'][^>]*>[\s\S]*?<\/button>/;
  if (btnPattern.test(result)) {
    result = result.replace(btnPattern, NEW_CART_FAB_HTML);
    replaced = true;
  }

  // Вариант 2: <div id="cartFab" ...>...</div>
  if (!replaced) {
    const divPattern = /<div[^>]*id=["']cartFab["'][^>]*>[\s\S]*?<\/div>/;
    if (divPattern.test(result)) {
      result = result.replace(divPattern, NEW_CART_FAB_HTML);
      replaced = true;
    }
  }

  // Вариант 3: одиночный тег без контента (например, <div id="cartFab"></div> в одну строку)
  if (!replaced) {
    const singlePattern = /<(button|div)[^>]*id=["']cartFab["'][^>]*><\/\1>/;
    if (singlePattern.test(result)) {
      result = result.replace(singlePattern, NEW_CART_FAB_HTML);
      replaced = true;
    }
  }

  // Вариант 4: ищем любой тег с id="cartFab" и заменяем его целиком
  if (!replaced) {
    const anyTagPattern = /<[a-zA-Z][^>]*id=["']cartFab["'][^>]*>/;
    const match = result.match(anyTagPattern);
    if (match) {
      const tagMatch = match[0];
      const tagNameMatch = tagMatch.match(/^<([a-zA-Z]+)/);
      const tagName = tagNameMatch ? tagNameMatch[1] : 'div';

      // Если тег не самозакрывающийся, пробуем найти закрывающий
      if (!tagMatch.endsWith('/>')) {
        const closeTag = `</${tagName}>`;
        const startIdx = result.indexOf(tagMatch);
        const closeIdx = result.indexOf(closeTag, startIdx);
        if (closeIdx > startIdx) {
          result = result.slice(0, startIdx) + NEW_CART_FAB_HTML + result.slice(closeIdx + closeTag.length);
          replaced = true;
        } else {
          // Закрывающего тега нет — заменяем только открывающий
          result = result.replace(tagMatch, NEW_CART_FAB_HTML);
          replaced = true;
        }
      } else {
        result = result.replace(tagMatch, NEW_CART_FAB_HTML);
        replaced = true;
      }
    }
  }

  if (!replaced) {
    warnings.push('public/index.html: элемент #cartFab не найден — разметка не изменена');
    return text;
  }

  return result;
}

/**
 * Патч theme-v2.css:
 * 1. Убирает #cartFab из правила .chat-fab,#cartFab (корень бага: 56×56)
 * 2. Заменяет старые стили .cartFab на pill-bubble
 */
function patchThemeCss(text) {
  if (text.includes('CART-PILL-PATCH v2')) return text;

  let result = text;

  // ── 1. Убираем #cartFab из правила .chat-fab, #cartFab ──
  // Это правило делает кнопку круглой 56×56, ломая текст в столбик
  result = result.replace(
    /\.chat-fab,\s*\n\s*#cartFab\s*\{/g,
    '.chat-fab {'
  );
  // Также на случай, если они на одной строке
  result = result.replace(
    /\.chat-fab,\s*#cartFab\s*\{/g,
    '.chat-fab {'
  );

  // ── 2. Удаляем старые правила .cartFab ──
  result = result.replace(/\.cartFab\s*\{[^}]*\}\s*\n?/g, '');
  result = result.replace(/\.cartFab:hover\s*\{[^}]*\}\s*\n?/g, '');

  // ── 3. Вставляем новые стили пилюли ──
  const pillStyles = `
/* CART-PILL-PATCH v2: плавающая корзина-пилюля */
.cartFab {
  position: fixed;
  bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  left: 50%;
  transform: translateX(-50%) scale(0.92);
  z-index: 90;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  min-height: 48px;
  max-height: 64px;
  background: #A93226;
  color: #FFFFFF;
  border-radius: 999px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  font: 700 14px/1 "Golos Text", system-ui, sans-serif;
  white-space: nowrap;
  cursor: pointer;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s cubic-bezier(0.2, 1, 0.3, 1),
              transform 0.3s cubic-bezier(0.2, 1, 0.3, 1);
}

.cartFab.visible {
  opacity: 1;
  pointer-events: auto;
  transform: translateX(-50%) scale(1);
}

.cartFab:hover {
  background: #8B2A21;
  transform: translateX(-50%) scale(1.03);
}

.cartFab:active {
  transform: translateX(-50%) scale(0.97);
}

.cartFab .cf-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.cartFab .cf-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border-radius: 999px;
  background: #FFFFFF;
  color: #A93226;
  font: 800 11px/1 "Unbounded", system-ui, sans-serif;
  flex-shrink: 0;
}

.cartFab .cf-sep {
  width: 1px;
  height: 20px;
  background: rgba(255, 255, 255, 0.3);
  flex-shrink: 0;
}

.cartFab .cf-total {
  font: 700 14px/1 "Golos Text", system-ui, sans-serif;
  color: #FFFFFF;
  letter-spacing: 0.02em;
}

/* Планшет/Десктоп: прижимаем справа от каталога, не перекрывая чат */
@media (min-width: 821px) {
  .cartFab {
    left: auto;
    right: 80px;
    transform: scale(0.92);
  }
  .cartFab.visible {
    transform: scale(1);
  }
  .cartFab:hover {
    transform: scale(1.03);
  }
  .cartFab:active {
    transform: scale(0.97);
  }
}

`;

  result = result.trimEnd() + '\n' + pillStyles;

  // Удаляем лишние пустые строки
  result = result.replace(/\n{3,}/g, '\n\n');

  return result;
}

/**
 * Патч cart.js:
 * Заменяет cartFabShow() и window.updateCartFab на pill-версии
 */
function patchCartJs(text) {
  if (text.includes('CART-PILL-PATCH v2')) return text;

  let result = text;

  // ── 1. Заменяем cartFabShow() ──
  const oldCartFabShow = /function cartFabShow\(\)\s*\{[\s\S]*?cf\.style\.display[\s\S]*?\}\s*\}/;
  const newCartFabShow = `/* CART-PILL-PATCH v2: pill-bubble видимость через класс .visible */
function cartFabShow() {
  var cf = document.getElementById('cartFab');
  if (!cf) return;
  var isDel = checkIsDelivery();
  var isGuestOrAdmin = (typeof mode === 'undefined') || mode === 'guest' || mode === 'admin';
  var hasItems = typeof cart !== 'undefined' && cart.length > 0;
  var shouldShow = isGuestOrAdmin && isDel && hasItems;
  cf.classList.toggle('visible', shouldShow);
  cf.hidden = !shouldShow;
}`;

  if (oldCartFabShow.test(result)) {
    result = result.replace(oldCartFabShow, newCartFabShow);
  } else {
    warnings.push('public/app/cart.js: cartFabShow() не найден');
  }

  // ── 2. Заменяем window.updateCartFab ──
  const oldUpdateCartFab = /window\.updateCartFab\s*=\s*function\s*\(\)\s*\{[\s\S]*?cartFabShow\(\);\s*\};/;
  const newUpdateCartFab = `/* CART-PILL-PATCH v2: обновление содержимого пилюли */
window.updateCartFab = function () {
  var t = totalsNow();
  var fab = document.getElementById('cartFab');
  if (!fab) return;

  var hasItems = t.sum > 0;
  var cnt = (typeof cart !== 'undefined' ? cart : []).reduce(function (a, c) { return a + (c.qty || 1); }, 0);

  // Управление видимостью через класс .visible (для анимации scale/opacity)
  fab.classList.toggle('visible', hasItems);
  fab.hidden = !hasItems;

  // Обновляем содержимое пилюли
  var badge = fab.querySelector('.cf-badge');
  var total = fab.querySelector('.cf-total');
  if (badge) badge.textContent = cnt;
  if (total) total.textContent = Number(t.total).toLocaleString('ru-RU') + ' ₽';

  paintTotals();
  if (typeof syncAddButtons === 'function') syncAddButtons();
};`;

  if (oldUpdateCartFab.test(result)) {
    result = result.replace(oldUpdateCartFab, newUpdateCartFab);
  } else {
    warnings.push('public/app/cart.js: window.updateCartFab не найден');
  }

  return result;
}

/**
 * Патч delivery.js:
 * Убирает дублирующее определение window.updateCartFab и window.cartFabShow,
 * которые перебивают корректные из cart.js
 */
function patchDeliveryJs(text) {
  if (text.includes('CART-PILL-PATCH v2')) return text;

  let result = text;

  // ── 1. Удаляем дублирующее window.updateCartFab из delivery.js ──
  const dupUpdateCartFab = /window\.updateCartFab\s*=\s*function\s*\(\)\s*\{[\s\S]*?var cb = document\.getElementById\('checkoutBtn'\);[\s\S]*?\}\s*\}/;
  if (dupUpdateCartFab.test(result)) {
    result = result.replace(dupUpdateCartFab, '/* CART-PILL-PATCH v2: updateCartFab делегирован в cart.js */');
  } else {
    warnings.push('public/app/delivery.js: дубль window.updateCartFab не найден (возможно, уже удалён)');
  }

  // ── 2. Удаляем дублирующее window.cartFabShow из delivery.js ──
  const dupCartFabShow = /window\.cartFabShow\s*=\s*function\s*\(\)\s*\{[\s\S]*?cf\.style\.display[\s\S]*?\};/;
  if (dupCartFabShow.test(result)) {
    result = result.replace(dupCartFabShow, '/* CART-PILL-PATCH v2: cartFabShow делегирован в cart.js */');
  }

  return result;
}

/* ═══════════════════════════════════════════════════════════
   MAIN
   ═══════════════════════════════════════════════════════════ */

try {
  console.log('Task 1: Floating cart pill redesign...\n');

  // Проверяем обязательные файлы
  const requiredFiles = [
    'public/index.html',
    'public/app/ui/theme-v2.css',
    'public/app/cart.js',
    'public/app/delivery.js',
    'public/sw.js'
  ];
  for (const f of requiredFiles) {
    if (!fs.existsSync(resolvePath(f))) {
      console.error(`❌ Критично: файл не найден: ${f}`);
      process.exit(1);
    }
  }

  // Шаг 1: Трансформация index.html
  console.log('\nТрансформация public/index.html...');
  modifyFile('public/index.html', patchIndexHtml);

  // Шаг 2: Исправление theme-v2.css
  console.log('\nИсправление theme-v2.css...');
  modifyFile('public/app/ui/theme-v2.css', patchThemeCss);

  // Шаг 3: Нормализация cart.js
  console.log('\nНормализация cart.js...');
  modifyFile('public/app/cart.js', patchCartJs);

  // Шаг 4: Очистка delivery.js
  console.log('\nОчистка delivery.js...');
  modifyFile('public/app/delivery.js', patchDeliveryJs);

  // Шаг 5: Инкремент STATIC_CACHE
  if (changed.length > 0) {
    console.log('\nИнкремент STATIC_CACHE...');
    modifyFile('public/sw.js', patchSw);
  }

  if (warnings.length) {
    console.warn('\nПредупреждения:');
    warnings.forEach(w => console.warn(` - ${w}`));
  }

  if (changed.length) {
    console.log('\nИзменённые файлы:');
    changed.forEach(f => console.log(` - ${f}`));
  }

  console.log('\nГотово.\n');
  process.exit(0);

} catch (err) {
  console.error('\n❌ Ошибка скрипта:');
  console.error(err);
  process.exit(1);
}