#!/usr/bin/env node
/**
 * scripts/fix-checkout-ux-and-timer.mjs
 * Финальный багфикс чекаута, тарифов, адресов и таймеров:
 *   1. Дропдаун улиц закрывается после выбора (justSelected + blur)
 *   2. Безусловный override тарифа доставки (Синявино 250 ₽)
 *   3. Полноценный TreeWalker для таймера предзаказа (с поддержкой дат с цифрами)
 *   4. Фича «Мои адреса»: кнопка, компактное меню (до 3 адресов), fallback на zt_saved_address
 *
 * Запуск:
 *   node scripts/fix-checkout-ux-and-timer.mjs
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

function resolvePath(relPath) { return path.join(root, relPath); }

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
  return { text: raw.replace(/\r\n/g, '\n'), eol };
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
    try { checkSyntax(absPath); }
    catch (err) { if (bak) fs.copyFileSync(bak, absPath); throw err; }
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
    } else { next = `${val}-2`; }
    console.log(`   STATIC_CACHE: ${val} -> ${next}`);
    return `${pre}${next}${quote}`;
  });
  if (!found) warnings.push('public/sw.js: не найден STATIC_CACHE');
  return found ? out : text;
}

/* ═══════════════════════════════════════════════════════════
   ЗАДАЧА 1 + ЗАДАЧА 4: Патч address-autocomplete.js
   ═══════════════════════════════════════════════════════════ */

function patchAddressAutocomplete(text) {
  if (text.includes('CHECKOUT-UX-FIX v2')) return text;

  let result = text;

  // 1. Флаг justSelected
  if (!result.includes('var justSelected = false;')) {
    result = result.replace(
      /\(function \(\) \{\s*'use strict';/,
      `(function () {\n  'use strict';\n  var justSelected = false;`
    );
  }

  // 2. selectItem: blur + hideDropdown + блокировка повторного фокуса
  const selectItemRegex = /function selectItem\(input, value\) \{[\s\S]*?input\.(?:focus|blur)\(\);[\s\S]*?\}/;
  const newSelectItem = `function selectItem(input, value) {
    justSelected = true;
    input.value = value;
    hideDropdown();
    input.dispatchEvent(new Event('input', { bubbles: true }));
    try { input.blur(); } catch (e) {}
    setTimeout(function () { justSelected = false; }, 350);
  }`;
  if (selectItemRegex.test(result)) {
    result = result.replace(selectItemRegex, newSelectItem);
  }

  // 3. Блокировка открытия по focus при выборе
  const focusRegex = /input\.addEventListener\('focus', function \(\) \{/;
  if (focusRegex.test(result) && !result.includes('if (justSelected) return;')) {
    result = result.replace(focusRegex, `input.addEventListener('focus', function () {\n      if (justSelected) return;`);
  }

  // 4. Фича «Мои адреса» с fallback на zt_saved_address и надёжным DOM-враппером
  const addressBookBlock = `
  /* ══ CHECKOUT-UX-FIX v2: Фича «Мои адреса» ══ */
  function getSavedAddresses() {
    var addrList = [];
    try { addrList = JSON.parse(localStorage.getItem('zt_saved_addresses') || '[]'); } catch (e) {}
    if (!Array.isArray(addrList) || !addrList.length) {
      try {
        var single = JSON.parse(localStorage.getItem('zt_saved_address') || 'null');
        if (single && (single.place || single.street)) addrList = [single];
      } catch (e) {}
    }
    return Array.isArray(addrList) ? addrList : [];
  }

  function renderAddressBook() {
    var addrList = getSavedAddresses();
    var placeInput = document.getElementById('checkoutPlace');
    if (!placeInput) return;

    var oldWrap = document.getElementById('addrBookWrap');
    if (!addrList.length) {
      if (oldWrap) oldWrap.remove();
      return;
    }
    if (oldWrap) return; // Уже отрисован

    var wrap = document.createElement('div');
    wrap.id = 'addrBookWrap';
    wrap.className = 'addr-book-wrap';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'addr-book-btn';
    btn.innerHTML = '<span>📍</span> <span>Мои адреса</span>';

    var menu = document.createElement('div');
    menu.className = 'addr-book-menu';
    menu.hidden = true;

    addrList.forEach(function (addr) {
      var item = document.createElement('button');
      item.type = 'button';
      item.className = 'addr-book-item';
      var textParts = [addr.place, addr.street, addr.house].filter(Boolean);
      item.textContent = textParts.join(', ');
      item.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var cp = document.getElementById('checkoutPlace');
        var cs = document.getElementById('checkoutStreet');
        var ch = document.getElementById('checkoutHouse');
        if (cp && addr.place) {
          cp.value = addr.place;
          cp.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (cs && addr.street) {
          cs.value = addr.street;
          cs.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (ch && addr.house) {
          ch.value = addr.house;
          ch.dispatchEvent(new Event('input', { bubbles: true }));
        }
        menu.hidden = true;
      });
      menu.appendChild(item);
    });

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      menu.hidden = !menu.hidden;
    });

    document.addEventListener('click', function (e) {
      if (!wrap.contains(e.target)) menu.hidden = true;
    });

    wrap.appendChild(btn);
    wrap.appendChild(menu);

    var targetContainer = placeInput.closest('.frow, label') || placeInput.parentElement;
    if (targetContainer && targetContainer.parentElement) {
      targetContainer.parentElement.insertBefore(wrap, targetContainer);
    }
  }
`;

  if (!result.includes('CHECKOUT-UX-FIX v2: Фича «Мои адреса»')) {
    result = result.replace(/function init\(\) \{/, addressBookBlock + '\n  function init() {');
    result = result.replace(/function init\(\) \{/, 'function init() {\n    renderAddressBook();');
  }

  // Обновление кнопки в MutationObserver
  if (!result.includes('renderAddressBook(); /* observer */')) {
    result = result.replace(
      /attachToPlaceSelect\(\);/g,
      'attachToPlaceSelect();\n    renderAddressBook(); /* observer */'
    );
  }

  return result;
}

/* ═══════════════════════════════════════════════════════════
   ЗАДАЧА 2 + ЗАДАЧА 4: Патч cart.js
   ═══════════════════════════════════════════════════════════ */

function patchCartJs(text) {
  if (text.includes('CHECKOUT-UX-FIX v2')) return text;

  let result = text;

  // 1. Безусловный override тарифа доставки (Синявино 250 ₽)
  const feeRegex = /(?:\/\* ADDR-PATCH[^*]*\*\/)?\s*if \(!fee && window\.AddressModule[\s\S]*?fee = Number\(window\.AddressModule\.getFee\(curPlace\)\) \|\| 0;\s*\}/;
  const newFeeCode = `/* CHECKOUT-UX-FIX v2: безусловный override тарифа из справочника */
    if (window.AddressModule && typeof window.AddressModule.getFee === 'function') {
      var curPlace = (typeof placeVal !== 'undefined' ? placeVal : (document.getElementById('checkoutPlace') ? document.getElementById('checkoutPlace').value : ''));
      var zoneFee = Number(window.AddressModule.getFee(curPlace));
      if (zoneFee > 0) fee = zoneFee;
    }`;

  if (feeRegex.test(result)) {
    result = result.replace(feeRegex, newFeeCode);
  } else {
    // Fallback: замена стандартного fee = z ? ...
    result = result.replace(
      /fee = z \? Number\(z\.fee\) \|\| 0 : 0;/,
      `fee = z ? Number(z.fee) || 0 : 0;\n    ${newFeeCode}`
    );
  }

  // 2. Сохранение массива уникальных адресов (до 3 шт)
  const saveAddrRegex = /\/\* ADDR-PATCH[^*]*\*\/[\s\S]*?localStorage\.setItem\('zt_saved_address'[\s\S]*?\}\s*\}\s*catch\s*\(e\)\s*\{\}/;
  const newSaveAddrCode = `/* CHECKOUT-UX-FIX v2: сохраняем адреса в массив (до 3 уникальных) */
      try {
        var cpEl = document.getElementById('checkoutPlace');
        var csEl = document.getElementById('checkoutStreet');
        var chEl = document.getElementById('checkoutHouse');
        var addrToSave = {
          place: cpEl ? cpEl.value : '',
          street: csEl ? csEl.value : '',
          house: chEl ? chEl.value : ''
        };
        if (addrToSave.place || addrToSave.street) {
          var addrList = [];
          try { addrList = JSON.parse(localStorage.getItem('zt_saved_addresses') || '[]'); } catch (e) {}
          if (!Array.isArray(addrList)) addrList = [];
          addrList = addrList.filter(function (a) {
            return !(a.place === addrToSave.place && a.street === addrToSave.street && a.house === addrToSave.house);
          });
          addrList.unshift(addrToSave);
          addrList = addrList.slice(0, 3);
          localStorage.setItem('zt_saved_addresses', JSON.stringify(addrList));
          localStorage.setItem('zt_saved_address', JSON.stringify(addrToSave));
        }
      } catch (e) {}`;

  if (saveAddrRegex.test(result)) {
    result = result.replace(saveAddrRegex, newSaveAddrCode);
  } else {
    // Вставка после оформления заказа
    const toastOrderRegex = /(toast\(["']Заказ #["']\s*\+\s*r\.order\.no\s*\+\s*["'] оформлен!["'],\s*["']🎉["']\);)/;
    if (toastOrderRegex.test(result)) {
      result = result.replace(toastOrderRegex, `$1\n      ${newSaveAddrCode}`);
    }
  }

  return result;
}

/* ═══════════════════════════════════════════════════════════
   ЗАДАЧА 3: Патч preorder-timer.js
   ═══════════════════════════════════════════════════════════ */

function patchPreorderTimer(text) {
  if (text.includes('CHECKOUT-UX-FIX v2')) return text;

  let result = text;

  const autoInjectRegex = /function autoInjectBadges\(\) \{[\s\S]*?\n  \}/;
  const newAutoInjectCode = `function autoInjectBadges() {
    /* CHECKOUT-UX-FIX v2: всеядный TreeWalker по слову "предзаказ" */
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    var targetNodes = [];
    while (walker.nextNode()) {
      var node = walker.currentNode;
      if (node.nodeValue && /предзаказ/i.test(node.nodeValue)) {
        targetNodes.push(node.parentElement);
      }
    }
    targetNodes.forEach(function (el) {
      if (!el || el.dataset.preorderTimerBound) return;
      var card = el.closest('.orderCard, .order-card, .history-item, .card, .oc, [class*="order"]') || el.parentElement;
      var txt = card ? (card.textContent || '') : (el.textContent || '');
      
      // Игнорируем архивные заказы и блок графика работы
      if (/отмен|доставлен|выполнен|завершен/i.test(txt)) return;
      if (/ежедневно|режим\\s+работы|работаем/i.test(txt)) return;

      var slotMatch = txt.match(/(?:Сегодня|Завтра|\\d{1,2}\\.\\d{2})?[^0-9\\n]*\\d{1,2}:\\d{2}\\s*[–—\\-]\\s*\\d{1,2}:\\d{2}/i);
      if (slotMatch) {
        el.dataset.preorderTimerBound = '1';
        var badge = document.createElement('div');
        badge.innerHTML = createTimerBadge(slotMatch[0]);
        if (badge.firstElementChild) {
          el.parentNode.insertBefore(badge.firstElementChild, el.nextSibling);
        }
      }
    });
  }`;

  if (autoInjectRegex.test(result)) {
    result = result.replace(autoInjectRegex, newAutoInjectCode);
  }

  return result;
}

/* ═══════════════════════════════════════════════════════════
   Стили для кнопки и меню «Мои адреса»
   ═══════════════════════════════════════════════════════════ */

const ADDR_BOOK_CSS = `
/* ── CHECKOUT-UX-FIX v2: меню и кнопка «Мои адреса» ── */
.addr-book-wrap {
  position: relative;
  display: inline-block;
  margin-bottom: 10px;
}

.addr-book-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 999px;
  background: #EAF1F9;
  border: 1.5px solid rgba(62, 143, 208, 0.3);
  color: #123A6B;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.addr-book-btn:active {
  transform: scale(0.96);
  background: #D6E4F0;
}

.addr-book-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 2000;
  min-width: 250px;
  max-width: 320px;
  background: #FFFFFF;
  border: 1.5px solid rgba(62, 143, 208, 0.25);
  border-radius: 14px;
  box-shadow: 0 10px 30px rgba(18, 58, 107, 0.2);
  padding: 4px;
  animation: addr-menu-in 0.2s cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes addr-menu-in {
  from { opacity: 0; transform: translateY(-4px) scale(0.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.addr-book-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 9px 12px;
  font-size: 13px;
  line-height: 1.35;
  color: #101418;
  background: transparent;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s;
}

.addr-book-item:hover,
.addr-book-item:active {
  background: #EAF1F9;
  color: #123A6B;
}

.addr-book-item + .addr-book-item {
  margin-top: 2px;
}
`;

function patchThemeCss(text) {
  if (text.includes('CHECKOUT-UX-FIX v2')) return text;
  return text.trimEnd() + `\n/* CHECKOUT-UX-FIX v2 */${ADDR_BOOK_CSS}`;
}

/* ═══════════════════════════════════════════════════════════
   MAIN
   ═══════════════════════════════════════════════════════════ */

try {
  console.log('Applying Checkout UX polish & universal preorder timer (v2)...\n');

  modifyFile('public/app/core/address-autocomplete.js', patchAddressAutocomplete);
  modifyFile('public/app/cart.js', patchCartJs);
  modifyFile('public/app/core/preorder-timer.js', patchPreorderTimer);
  modifyFile('public/app/ui/theme-v2.css', patchThemeCss);

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
  console.error('\n❌ Ошибка скрипта:', err);
  process.exit(1);
}