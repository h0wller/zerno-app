#!/usr/bin/env node
/**
 * scripts/rework-address-book.mjs
 * ADDRESS-BOOK v2: постоянная кнопка «Мои адреса» с сохранением и редактированием.
 * + CATS-GUARD в editor.js + порядок тегов в index.html.
 * Без MutationObserver: рендер только по событиям.
 *
 * Запуск: node scripts/rework-address-book.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const stamp = new Date().toISOString().replace(/[:T]/g, '-').replace(/\..+$/, '');
const changed = [];
const warnings = [];

function resolvePath(p) { return path.join(root, p); }

function backupFile(abs) {
  if (!fs.existsSync(abs)) return null;
  let c = `${abs}.bak-${stamp}`, i = 1;
  while (fs.existsSync(c)) c = `${abs}.bak-${stamp}-${i++}`;
  fs.copyFileSync(abs, c);
  return c;
}

function readLf(abs) {
  const raw = fs.readFileSync(abs, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  return { text: raw.replace(/\r\n/g, '\n'), eol };
}

function writeEol(abs, text, eol) {
  fs.writeFileSync(abs, eol === '\r\n' ? text.replace(/\n/g, '\r\n') : text, 'utf8');
}

function checkSyntax(abs) {
  const r = spawnSync(process.execPath, ['--check', abs], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`node --check failed: ${abs}\n${r.stderr || r.stdout}`);
}

function modifyFile(rel, fn) {
  const abs = resolvePath(rel);
  if (!fs.existsSync(abs)) { warnings.push(`Файл не найден: ${rel}`); return false; }
  const { text, eol } = readLf(abs);
  const out = fn(text);
  if (typeof out !== 'string' || out === text) return false;
  const bak = backupFile(abs);
  writeEol(abs, out, eol);
  if (rel.endsWith('.js') || rel.endsWith('.mjs')) {
    try { checkSyntax(abs); } catch (e) { if (bak) fs.copyFileSync(bak, abs); throw e; }
  }
  changed.push(rel);
  console.log(`✔ Изменён: ${rel}${bak ? ` (backup: ${path.basename(bak)})` : ''}`);
  return true;
}

function replaceFile(rel, content) {
  const abs = resolvePath(rel);
  const bak = fs.existsSync(abs) ? backupFile(abs) : null;
  writeEol(abs, content, '\n');
  if (rel.endsWith('.js')) {
    try { checkSyntax(abs); } catch (e) { if (bak) fs.copyFileSync(bak, abs); throw e; }
  }
  changed.push(rel);
  console.log(`✔ ${bak ? 'Перезаписан' : 'Создан'}: ${rel}${bak ? ` (backup: ${path.basename(bak)})` : ''}`);
  return true;
}

function patchSwCache(text) {
  const re = /(STATIC_CACHE\s*=\s*['"])([^'"]+)(['"])/;
  let found = false;
  const out = text.replace(re, (m, pre, val, q) => {
    found = true;
    const next = /\d/.test(val) ? val.replace(/(\d+)(?=[^\d]*$)/, (_, n) => String(Number(n) + 1)) : `${val}-2`;
    console.log(`   STATIC_CACHE: ${val} -> ${next}`);
    return pre + next + q;
  });
  if (!found) warnings.push('sw.js: STATIC_CACHE не найден');
  return found ? out : text;
}

function patchSwAssets(text) {
  if (text.includes("'/app/core/address-book.js'")) return text;
  return text.replace(
    /(const STATIC_ASSETS = \[[\s\S]*?)('\/app\/core\/overlay\.js',)/,
    (m, before, ov) => before + "'/app/core/address-book.js',\n  " + ov
  );
}

/* ═══════════════════════════════════════════════════════════
   МОДУЛЬ ADDRESS-BOOK v2 (полная замена старой книги адресов)
   ═══════════════════════════════════════════════════════════ */
const ADDRESS_BOOK_JS = `/* public/app/core/address-book.js — ADDRESS-BOOK v2
   Постоянная кнопка «Мои адреса»: выбор в один тап, сохранение текущего,
   редактирование и удаление записей. Хранилище: localStorage.zt_saved_addresses
   (массив до 5 записей) + legacy-фолбэк zt_saved_address.
   Без MutationObserver: рендер только по событиям (открытие шторки/менеджера, операции). */
(function () {
  'use strict';

  var MAX_ADDRESSES = 5;
  var LS_KEY = 'zt_saved_addresses';
  var LS_LEGACY = 'zt_saved_address';

  function normAddr(a) {
    a = a || {};
    return {
      id: String(a.id || ((a.place || '') + '|' + (a.street || '') + '|' + (a.house || ''))),
      place: String(a.place || ''),
      street: String(a.street || ''),
      house: String(a.house || '')
    };
  }

  function readList() {
    var list = [];
    try { list = JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch (e) { list = []; }
    if (!Array.isArray(list)) list = [];
    if (!list.length) {
      try {
        var leg = JSON.parse(localStorage.getItem(LS_LEGACY) || 'null');
        if (leg && (leg.place || leg.street)) list = [normAddr(leg)];
      } catch (e) {}
    }
    return list.map(normAddr);
  }

  function writeList(list) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(list.slice(0, MAX_ADDRESSES)));
      if (list.length) localStorage.setItem(LS_LEGACY, JSON.stringify(list[0]));
    } catch (e) {}
  }

  function formAddr() {
    function v(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }
    return { place: v('checkoutPlace'), street: v('checkoutStreet'), house: v('checkoutHouse') };
  }

  function fillForm(a) {
    var cp = document.getElementById('checkoutPlace');
    var cs = document.getElementById('checkoutStreet');
    var ch = document.getElementById('checkoutHouse');
    if (cp) { cp.value = a.place; cp.dispatchEvent(new Event('change', { bubbles: true })); }
    if (cs) { cs.value = a.street; cs.dispatchEvent(new Event('input', { bubbles: true })); }
    if (ch) { ch.value = a.house; ch.dispatchEvent(new Event('input', { bubbles: true })); }
  }

  function titleOf(a) {
    return [a.place, a.street, a.house].filter(Boolean).join(', ') || 'Пустой адрес';
  }

  function escText(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function findById(id) {
    var list = readList();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  /* ── Публичное API (использует cart.js при успешном заказе) ── */
  function autoAdd(a) {
    a = normAddr(a);
    if (!a.place && !a.street) return;
    var list = readList().filter(function (x) { return x.id !== a.id; });
    list.unshift(a);
    writeList(list);
    renderList();
  }

  /* ── DOM менеджера ── */
  var sheet = null;
  var editId = null; /* null | 'new' | id записи */

  function ensureButton() {
    var place = document.getElementById('checkoutPlace');
    if (!place) return;
    if (document.getElementById('addrBookBtn')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'addrBookBtn';
    btn.className = 'addr-book-btn';
    btn.textContent = '📍 Мои адреса';
    btn.addEventListener('click', function (e) { e.stopPropagation(); openSheet(); });
    var label = place.closest('label') || place.parentElement;
    var parent = (label && label.parentElement) || place.parentElement;
    if (parent) parent.insertBefore(btn, label || place);
  }

  function ensureSheet() {
    if (sheet) return sheet;
    sheet = document.createElement('div');
    sheet.id = 'addrBookSheet';
    sheet.className = 'addr-book-sheet';
    sheet.hidden = true;
    sheet.innerHTML =
      '<div class="abs-head"><b>Мои адреса</b>' +
      '<button type="button" class="abs-close" data-abs="close" aria-label="Закрыть">✕</button></div>' +
      '<div class="abs-list"></div>' +
      '<div class="abs-edit" hidden>' +
        '<label>Населённый пункт<input type="text" data-abs-f="place" autocomplete="off"></label>' +
        '<label>Улица<input type="text" data-abs-f="street" autocomplete="off"></label>' +
        '<label>Дом, квартира<input type="text" data-abs-f="house" autocomplete="off"></label>' +
        '<div class="abs-edit-acts">' +
          '<button type="button" class="abs-save" data-abs="save">Сохранить</button>' +
          '<button type="button" class="abs-cancel" data-abs="cancel">Отмена</button>' +
        '</div>' +
      '</div>' +
      '<button type="button" class="abs-add" data-abs="add">＋ Сохранить текущий адрес</button>';
    document.body.appendChild(sheet);

    sheet.addEventListener('click', function (e) {
      var act = e.target.closest('[data-abs]');
      if (act) {
        var cmd = act.dataset.abs;
        if (cmd === 'close') { closeSheet(); return; }
        if (cmd === 'add') { startEdit('new', formAddr()); return; }
        if (cmd === 'save') { saveEdit(); return; }
        if (cmd === 'cancel') { stopEdit(); return; }
        if (cmd === 'edit') { var a = findById(act.dataset.id); if (a) startEdit(a.id, a); return; }
        if (cmd === 'del') {
          var id = act.dataset.id;
          writeList(readList().filter(function (x) { return x.id !== id; }));
          if (editId === id) stopEdit();
          renderList();
          return;
        }
        if (cmd === 'pick') { var p = findById(act.dataset.id); if (p) { fillForm(p); closeSheet(); } return; }
        return;
      }
      var row = e.target.closest('.abs-row');
      if (row) {
        var picked = findById(row.dataset.id);
        if (picked) { fillForm(picked); closeSheet(); }
      }
    });

    /* Закрытие по клику вне — обычный document-слушатель, без обсерверов */
    document.addEventListener('click', function (e) {
      if (!sheet || sheet.hidden) return;
      if (sheet.contains(e.target)) return;
      var btn = document.getElementById('addrBookBtn');
      if (btn && btn.contains(e.target)) return;
      closeSheet();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && sheet && !sheet.hidden) closeSheet();
    });

    return sheet;
  }

  function renderList() {
    if (!sheet) return;
    var host = sheet.querySelector('.abs-list');
    if (!host) return;
    var list = readList();
    if (!list.length) {
      host.innerHTML = '<div class="abs-empty">Сохранённых адресов пока нет.<br>Сохраните текущий адрес — и выбирайте его в один тап.</div>';
      return;
    }
    host.innerHTML = list.map(function (a) {
      return '<div class="abs-row" data-id="' + escText(a.id) + '">' +
        '<button type="button" class="abs-pick" data-abs="pick" data-id="' + escText(a.id) + '">' +
          '<span class="abs-title">' + escText(titleOf(a)) + '</span>' +
        '</button>' +
        '<button type="button" class="abs-ico" data-abs="edit" data-id="' + escText(a.id) + '" aria-label="Изменить">✏️</button>' +
        '<button type="button" class="abs-ico" data-abs="del" data-id="' + escText(a.id) + '" aria-label="Удалить">🗑</button>' +
      '</div>';
    }).join('');
  }

  function setField(name, val) {
    var el = sheet ? sheet.querySelector('[data-abs-f="' + name + '"]') : null;
    if (el) el.value = val || '';
  }
  function getField(name) {
    var el = sheet ? sheet.querySelector('[data-abs-f="' + name + '"]') : null;
    return el ? el.value.trim() : '';
  }

  function startEdit(id, values) {
    editId = id;
    var box = sheet.querySelector('.abs-edit');
    if (!box) return;
    box.hidden = false;
    setField('place', values.place);
    setField('street', values.street);
    setField('house', values.house);
    var save = sheet.querySelector('.abs-save');
    if (save) save.textContent = (id === 'new') ? 'Добавить адрес' : 'Сохранить изменения';
  }

  function stopEdit() {
    editId = null;
    var box = sheet ? sheet.querySelector('.abs-edit') : null;
    if (box) box.hidden = true;
  }

  function saveEdit() {
    var a = normAddr({ place: getField('place'), street: getField('street'), house: getField('house') });
    if (!a.place && !a.street) {
      if (typeof window.toast === 'function') toast('Укажите населённый пункт и улицу', '⚠️');
      return;
    }
    var list = readList();
    if (editId && editId !== 'new') {
      list = list.filter(function (x) { return x.id !== editId; });
      list = list.filter(function (x) { return x.id !== a.id; });
      list.unshift(a);
    } else {
      list = list.filter(function (x) { return x.id !== a.id; });
      list.unshift(a);
    }
    writeList(list);
    stopEdit();
    renderList();
  }

  function openSheet() {
    ensureSheet();
    stopEdit();
    renderList();
    sheet.hidden = false;
    sheet.classList.add('open');
  }

  function closeSheet() {
    if (!sheet) return;
    sheet.hidden = true;
    sheet.classList.remove('open');
    stopEdit();
  }

  /* ── Инициализация: только события, без MutationObserver ── */
  function init() {
    ensureButton();
    /* Кнопка переживает перерендер корзины: восстанавливаем по открытию шторки */
    document.addEventListener('click', function (e) {
      if (e.target.closest('#cartFab')) setTimeout(ensureButton, 50);
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.AddressBook = {
    read: readList,
    add: autoAdd,
    autoAdd: autoAdd,
    fill: fillForm,
    open: openSheet,
    close: closeSheet,
    refresh: function () { ensureButton(); renderList(); }
  };
})();
`;

/* ═══════════════════════════════════════════════════════════
   СТИЛИ ADDRESS-BOOK v2
   ═══════════════════════════════════════════════════════════ */
const ADDRESS_BOOK_CSS = `
/* ── ADDRESS-BOOK v2: постоянная кнопка и менеджер адресов ── */
.addr-book-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 999px;
  background: #EAF1F9;
  border: 1.5px solid rgba(62, 143, 208, 0.25);
  color: #123A6B;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  margin-bottom: 8px;
  transition: background 0.2s;
}
.addr-book-btn:hover { background: #D6E4F0; }
.addr-book-sheet {
  position: fixed;
  left: 50%;
  bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  transform: translateX(-50%) translateY(12px);
  width: min(420px, calc(100vw - 24px));
  max-height: min(70vh, 520px);
  overflow-y: auto;
  overscroll-behavior: contain;
  background: #FFFFFF;
  border: 1.5px solid rgba(62, 143, 208, 0.25);
  border-radius: 20px;
  box-shadow: 0 24px 60px -18px rgba(18, 58, 107, 0.35);
  padding: 14px;
  z-index: 1600;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.25s, transform 0.25s;
}
.addr-book-sheet.open {
  opacity: 1;
  pointer-events: auto;
  transform: translateX(-50%) translateY(0);
}
.abs-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.abs-head b { font: 700 15px "Golos Text", system-ui, sans-serif; color: #123A6B; }
.abs-close { width: 32px; height: 32px; border-radius: 50%; background: #EDF2F6; font-size: 14px; }
.abs-list { display: flex; flex-direction: column; gap: 6px; }
.abs-empty { font-size: 12.5px; color: #586470; text-align: center; padding: 14px 8px; line-height: 1.5; }
.abs-row {
  display: flex; align-items: center; gap: 6px;
  border: 1.5px solid var(--line, #D8DFE4);
  border-radius: 14px; padding: 4px 6px 4px 4px; background: #fff;
}
.abs-pick { flex: 1; min-width: 0; text-align: left; padding: 10px; border-radius: 10px; }
.abs-pick:hover { background: #EAF1F9; }
.abs-title {
  display: block; font-size: 13px; font-weight: 600; color: #101418;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.abs-ico { width: 34px; height: 34px; border-radius: 10px; background: #F3F8FC; font-size: 14px; flex: 0 0 auto; }
.abs-ico:hover { background: #EAF1F9; }
.abs-edit {
  margin-top: 10px; border-top: 1px dashed var(--line, #D8DFE4);
  padding-top: 10px; display: flex; flex-direction: column; gap: 8px;
}
.abs-edit label {
  font-size: 11px; font-weight: 700; letter-spacing: 0.04em;
  text-transform: uppercase; color: #8B98A5;
  display: flex; flex-direction: column; gap: 4px;
}
.abs-edit input { border: 1.5px solid var(--line, #D8DFE4); border-radius: 10px; padding: 9px 12px; font-size: 14px; }
.abs-edit-acts { display: flex; gap: 8px; }
.abs-save { flex: 1; background: #123A6B; color: #fff; border-radius: 10px; padding: 10px; font-weight: 800; font-size: 13px; }
.abs-cancel { flex: 0 0 auto; background: #EDF2F6; color: #586470; border-radius: 10px; padding: 10px 14px; font-weight: 700; font-size: 13px; }
.abs-add {
  margin-top: 10px; width: 100%;
  background: #FFF6E5; border: 1.5px dashed #F2D9A5; color: #6B4E0E;
  border-radius: 12px; padding: 10px; font-weight: 800; font-size: 13px;
}
.abs-add:hover { background: #FDEFD2; }
@media (prefers-reduced-motion: reduce) {
  .addr-book-sheet { transition: none; }
}
`;

/* ═══════════════════════════════════════════════════════════
   ТРАНСФОРМЕРЫ
   ═══════════════════════════════════════════════════════════ */

/** editor.js: CATS-GUARD v1 */
function patchEditorJs(text) {
  if (text.includes('CATS-GUARD v1')) return text;
  return `/* CATS-GUARD v1: не падаем, если catalog.js не загрузился (офлайн/ISP-блок/старый кэш) */
if (typeof window.CATS === 'undefined') { window.CATS = []; }
` + text;
}

/** address-autocomplete.js: вырезаем старую книгу адресов и её обсервер */
function patchAutocomplete(text) {
  if (!text.includes('renderAddressBook') && !text.includes('addrBookObserver')) return text;
  let result = text;

  result = result.replace(
    /\/\* ══ CHECKOUT-UX-FIX v1: Фича «Мои адреса» ══ \*\/[\s\S]*?(?=\n  function init\(\) \{)/,
    ''
  );
  result = result.replace(
    /\n[ \t]*\/\* CHECKOUT-UX-FIX v1: рендерим кнопку «Мои адреса» \*\/\n[ \t]*renderAddressBook\(\);/,
    ''
  );
  result = result.replace(
    /\/\* CHECKOUT-UX-FIX v1: обновляем кнопку «Мои адреса» при мутациях \*\/\s*if \(document\.body\) \{[\s\S]*?addrBookObserver\.observe\(document\.body, \{ childList: true, subtree: true \}\);\s*\}/,
    'if (document.body) observer.observe(document.body, { childList: true, subtree: true });'
  );

  if (result.includes('renderAddressBook')) {
    warnings.push('address-autocomplete.js: остатки renderAddressBook — проверьте вручную');
  }
  return result;
}

/** cart.js: сохранение адреса через AddressBook.autoAdd */
function patchCartJs(text) {
  if (text.includes('ADDRESS-BOOK v2')) return text;
  const oldSave = /\/\/ Сохраняем адрес навсегда для будущих заказов\s*if \(draft\.place \|\| draft\.street \|\| draft\.house\) \{\s*localStorage\.setItem\('zt_saved_address', JSON\.stringify\(\{\s*place: draft\.place,\s*street: draft\.street,\s*house: draft\.house\s*\}\)\);\s*\}/;
  const newSave = `// ADDRESS-BOOK v2: сохраняем адрес в книгу (до 5, дедупликация)
    if (draft.place || draft.street || draft.house) {
      if (window.AddressBook && typeof window.AddressBook.autoAdd === 'function') {
        window.AddressBook.autoAdd({ place: draft.place, street: draft.street, house: draft.house });
      } else {
        localStorage.setItem('zt_saved_address', JSON.stringify({
          place: draft.place, street: draft.street, house: draft.house
        }));
      }
    }`;
  if (oldSave.test(text)) return text.replace(oldSave, newSave);
  warnings.push('cart.js: блок сохранения адреса в saveDraft не найден');
  return text;
}

/** index.html: порядок catalog→editor + тег address-book.js */
function patchIndexHtml(text) {
  let result = text;

  const catRe = /<script[^>]*src=["'][^"']*\/app\/core\/catalog\.js["'][^>]*><\/script>/;
  const edRe = /<script[^>]*src=["'][^"']*\/app\/core\/editor\.js["'][^>]*><\/script>/;
  const catM = result.match(catRe);
  const edM = result.match(edRe);
  if (catM && edM && result.indexOf(catM[0]) > result.indexOf(edM[0])) {
    result = result.replace(catM[0], '');
    result = result.replace(edM[0], catM[0] + '\n' + edM[0]);
    console.log('   index.html: catalog.js перемещён перед editor.js');
  }

  if (!result.includes('/app/core/address-book.js')) {
    const tag = '<script src="/app/core/address-book.js" defer></script>';
    const acRe = /(<script[^>]*src=["'][^"']*address-autocomplete\.js["'][^>]*><\/script>)/;
    const ovRe = /(<script[^>]*src=["'][^"']*overlay\.js["'][^>]*><\/script>)/;
    if (acRe.test(result)) {
      result = result.replace(acRe, (m) => m + '\n' + tag);
    } else if (ovRe.test(result)) {
      result = result.replace(ovRe, (m) => m + '\n' + tag);
    } else if (result.includes('</body>')) {
      result = result.replace('</body>', tag + '\n</body>');
    } else {
      warnings.push('index.html: не найдено место для тега address-book.js');
    }
  }
  return result;
}

function patchThemeCss(text) {
  if (text.includes('ADDRESS-BOOK v2')) return text;
  return text.trimEnd() + '\n/* ADDRESS-BOOK v2 */' + ADDRESS_BOOK_CSS;
}

/* ═══════════════════════════════════════════════════════════
   MAIN
   ═══════════════════════════════════════════════════════════ */
try {
  console.log('Task: ADDRESS-BOOK v2 + CATS-GUARD...\n');

  for (const f of ['public/app/ui/theme-v2.css', 'public/app/cart.js', 'public/index.html', 'public/sw.js']) {
    if (!fs.existsSync(resolvePath(f))) { console.error(`❌ Не найден: ${f}`); process.exit(1); }
  }

  console.log('Создание/перезапись public/app/core/address-book.js...');
  replaceFile('public/app/core/address-book.js', ADDRESS_BOOK_JS);

  console.log('\neditor.js: CATS-GUARD...');
  modifyFile('public/app/core/editor.js', patchEditorJs);

  console.log('\naddress-autocomplete.js: удаление старой книги и обсервера...');
  modifyFile('public/app/core/address-autocomplete.js', patchAutocomplete);

  console.log('\ncart.js: сохранение через AddressBook.autoAdd...');
  modifyFile('public/app/cart.js', patchCartJs);

  console.log('\nindex.html: порядок тегов + address-book.js...');
  modifyFile('public/index.html', patchIndexHtml);

  console.log('\ntheme-v2.css: стили менеджера...');
  modifyFile('public/app/ui/theme-v2.css', patchThemeCss);

  console.log('\nsw.js: STATIC_ASSETS + STATIC_CACHE...');
  modifyFile('public/sw.js', (t) => patchSwCache(patchSwAssets(t)));

  if (warnings.length) { console.warn('\nПредупреждения:'); warnings.forEach(w => console.warn(' - ' + w)); }
  if (changed.length) { console.log('\nИзменённые файлы:'); changed.forEach(f => console.log(' - ' + f)); }
  console.log('\nГотово.\n');
  process.exit(0);
} catch (err) {
  console.error('\n❌ Ошибка скрипта:');
  console.error(err);
  process.exit(1);
}