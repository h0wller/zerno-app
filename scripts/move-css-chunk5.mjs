#!/usr/bin/env node
/**
 * scripts/fix-address-book-v3.mjs
 * ADDRESS-BOOK v3:
 *  1) theme-v2.css: sweep всех !important вне [hidden] (правило 1 css-audit)
 *     + компенсатор специфичности для .auth-badge-confirmed
 *  2) theme-v2.css: докидывает полный токен-блок стилей шторки/дропадауна (v3)
 *  3) address-book.js: перезапись на v3 — не закрывается после удаления/сохранения
 *     (closest вместо contains), автоподстановки в форме редактирования
 *     (datalist улиц + тариф + валидация), цвета только через токены
 *  4) sw.js: STATIC_ASSETS + bump STATIC_CACHE
 * Запуск: node scripts/fix-address-book-v3.mjs && node scripts/css-audit.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const stamp = new Date().toISOString().replace(/[:T]/g, '-').replace(/\..+$/, '');
const changed = [], warnings = [];

const resolvePath = (p) => path.join(root, p);
function backupFile(abs) {
  if (!fs.existsSync(abs)) return null;
  let c = abs + '.bak-' + stamp, i = 1;
  while (fs.existsSync(c)) c = abs + '.bak-' + stamp + '-' + (i++);
  fs.copyFileSync(abs, c); return c;
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
  if (r.status !== 0) throw new Error('node --check failed: ' + abs + '\n' + (r.stderr || r.stdout));
}
function modifyFile(rel, fn) {
  const abs = resolvePath(rel);
  if (!fs.existsSync(abs)) { warnings.push('Файл не найден: ' + rel); return false; }
  const { text, eol } = readLf(abs);
  const out = fn(text);
  if (typeof out !== 'string' || out === text) return false;
  const bak = backupFile(abs);
  writeEol(abs, out, eol);
  if (rel.endsWith('.js') || rel.endsWith('.mjs')) {
    try { checkSyntax(abs); } catch (e) { if (bak) fs.copyFileSync(bak, abs); throw e; }
  }
  changed.push(rel);
  console.log('✔ Изменён: ' + rel + (bak ? ' (backup: ' + path.basename(bak) + ')' : ''));
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
  console.log('✔ Перезаписан: ' + rel + (bak ? ' (backup: ' + path.basename(bak) + ')' : ''));
  return true;
}

/* ══ 1. theme-v2.css: sweep !important вне [hidden] ══ */
function sweepImportant(text) {
  return text.replace(/([^{}]+)\{([^{}]*)\}/g, function (m, sel, body) {
    if (sel.indexOf('[hidden]') !== -1) return m;           // системное исключение правила 1
    return sel + '{' + body.replace(/\s*!important/g, '') + '}';
  });
}
function compensateBadge(text) {
  if (text.indexOf('.auth-badge-confirmed.auth-badge-confirmed') !== -1) return text;
  return text.replace(/\.auth-badge-confirmed\s*\{/g, '.auth-badge-confirmed.auth-badge-confirmed {');
}

/* ══ 2. theme-v2.css: токен-блок v3 (каскадом поверх старых хардкодов) ══ */
const BOOK_CSS_V3 = `
/* ── ADDRESS-BOOK v3: шторка и автодополнение на токенах Слоя 1 (без !important) ── */
.addr-book-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 14px; border-radius: 999px;
  background: var(--panel, #F3F8FC);
  border: 1.5px solid var(--line, #D8DFE4);
  color: var(--flame, #123A6B);
  font-size: 13px; font-weight: 700; cursor: pointer; margin-bottom: 8px;
}
.addr-book-btn:hover { border-color: var(--flame, #123A6B); }
.addr-book-sheet {
  position: fixed; left: 50%;
  bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  transform: translateX(-50%) translateY(12px);
  width: min(420px, calc(100vw - 24px));
  max-height: min(72vh, 540px);
  overflow-y: auto; overscroll-behavior: contain;
  background: var(--card, #FFFFFF);
  color: var(--ink, #101418);
  border: 1.5px solid var(--line, #D8DFE4);
  border-radius: 20px;
  box-shadow: var(--shadow-sheet, 0 -10px 40px -12px rgba(16, 20, 24, 0.25));
  padding: 14px; z-index: 1600;
  opacity: 0; pointer-events: none;
  transition: opacity 0.25s, transform 0.25s;
}
.addr-book-sheet.open { opacity: 1; pointer-events: auto; transform: translateX(-50%) translateY(0); }
.abs-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.abs-head b { font: 700 15px "Golos Text", system-ui, sans-serif; color: var(--flame, #123A6B); }
.abs-close { width: 32px; height: 32px; border-radius: 50%; background: var(--panel, #F3F8FC); color: var(--soft, #586470); font-size: 14px; }
.abs-close:hover { color: var(--ink, #101418); }
.abs-list { display: flex; flex-direction: column; gap: 6px; }
.abs-empty { font-size: 12.5px; color: var(--soft, #586470); text-align: center; padding: 14px 8px; line-height: 1.5; }
.abs-row { display: flex; align-items: center; gap: 6px; border: 1.5px solid var(--line, #D8DFE4); border-radius: 14px; padding: 4px; background: var(--card, #FFFFFF); }
.abs-pick { flex: 1; min-width: 0; text-align: left; padding: 10px; border-radius: 10px; color: var(--ink, #101418); }
.abs-pick:hover { background: var(--panel, #F3F8FC); }
.abs-title { display: block; font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.abs-ico { width: 34px; height: 34px; border-radius: 10px; background: var(--panel, #F3F8FC); color: var(--soft, #586470); font-size: 14px; flex: 0 0 auto; }
.abs-ico:hover { color: var(--flame, #123A6B); }
.abs-ico[data-abs="del"]:hover { color: var(--status-danger, #B3372B); }
.abs-edit { margin-top: 10px; border-top: 1px dashed var(--line, #D8DFE4); padding-top: 10px; display: flex; flex-direction: column; gap: 8px; }
.abs-edit label { font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--soft, #586470); display: flex; flex-direction: column; gap: 4px; }
.abs-edit input { border: 1.5px solid var(--line, #D8DFE4); border-radius: 10px; padding: 9px 12px; font-size: 14px; background: var(--card, #FFFFFF); color: var(--ink, #101418); }
.abs-edit input:focus { outline: none; border-color: var(--flame, #123A6B); }
.abs-edit input.field-error { border-color: var(--status-danger, #B3372B); background: var(--tint-danger, #FDE8E8); }
.abs-fee { font-size: 12.5px; font-weight: 600; color: var(--flame, #123A6B); background: var(--panel, #F3F8FC); border-radius: 10px; padding: 8px 12px; }
.abs-edit-acts { display: flex; gap: 8px; }
.abs-save { flex: 1; background: var(--flame, #123A6B); color: var(--cream, #FFFFFF); border-radius: 10px; padding: 10px; font-weight: 800; font-size: 13px; }
.abs-save:hover { background: var(--flame-d, #0B2446); }
.abs-cancel { flex: 0 0 auto; background: var(--panel, #F3F8FC); color: var(--soft, #586470); border-radius: 10px; padding: 10px 14px; font-weight: 700; font-size: 13px; }
.abs-add { margin-top: 10px; width: 100%; background: var(--tint-alert, #FFF6E5); border: 1.5px dashed var(--amber, #C2935F); color: var(--ink, #101418); border-radius: 12px; padding: 10px; font-weight: 800; font-size: 13px; }
.addr-dropdown {
  position: absolute; z-index: 1700;
  background: var(--card, #FFFFFF); color: var(--ink, #101418);
  border: 1.5px solid var(--line, #D8DFE4); border-radius: 14px;
  box-shadow: var(--sh, 0 10px 30px -12px rgba(16, 20, 24, 0.18));
  max-height: 240px; overflow-y: auto; overscroll-behavior: contain; padding: 4px;
}
.addr-item { display: block; width: 100%; text-align: left; padding: 10px 14px; font: 500 14px "Golos Text", system-ui, sans-serif; color: var(--ink, #101418); background: transparent; border: none; border-radius: 10px; cursor: pointer; }
.addr-item:hover, .addr-item-active { background: var(--panel, #F3F8FC); color: var(--flame, #123A6B); }
@media (prefers-reduced-motion: reduce) {
  .addr-book-sheet { transition: none; }
}
`;
function patchThemeCss(text) {
  let out = sweepImportant(text);
  out = compensateBadge(out);
  if (out.indexOf('ADDRESS-BOOK v3') === -1) out = out.trimEnd() + '\n' + BOOK_CSS_V3;
  return out;
}

/* ══ 3. address-book.js v3 ══ */
const BOOK_JS_V3 = `/* public/app/core/address-book.js — ADDRESS-BOOK v3
   v3-фиксы: шторка НЕ закрывается после удаления/сохранения (closest вместо contains,
   устойчиво к отцепленным узлам); автоподстановки в форме редактирования
   (datalist улиц по населённому пункту + тариф + валидация улицы);
   вся палитра через CSS-токены Слоя 1 (бренд применяется слоем 2 сам).
   Без MutationObserver: только события + явный refresh. */
(function () {
  'use strict';

  var MAX = 5;
  var LS = 'zt_saved_addresses';
  var LEGACY = 'zt_saved_address';

  function norm(a) {
    a = a || {};
    return {
      id: String(a.id || ((a.place || '') + '|' + (a.street || '') + '|' + (a.house || ''))),
      place: String(a.place || ''), street: String(a.street || ''), house: String(a.house || '')
    };
  }
  function read() {
    var l = [];
    try { l = JSON.parse(localStorage.getItem(LS) || '[]'); } catch (e) { l = []; }
    if (!Array.isArray(l)) l = [];
    if (!l.length) {
      try {
        var g = JSON.parse(localStorage.getItem(LEGACY) || 'null');
        if (g && (g.place || g.street)) l = [norm(g)];
      } catch (e) {}
    }
    return l.map(norm);
  }
  function write(l) {
    try {
      localStorage.setItem(LS, JSON.stringify(l.slice(0, MAX)));
      if (l.length) localStorage.setItem(LEGACY, JSON.stringify(l[0]));
    } catch (e) {}
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function title(a) { return [a.place, a.street, a.house].filter(Boolean).join(', ') || 'Пустой адрес'; }
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
  function say(t, i) { if (typeof window.toast === 'function') window.toast(t, i || '📍'); }
  function streetsFor(p) { return (window.AddressModule && window.AddressModule.getStreets) ? window.AddressModule.getStreets(p) : []; }
  function feeFor(p) { return (window.AddressModule && window.AddressModule.getFee) ? (Number(window.AddressModule.getFee(p)) || 0) : 0; }

  var sheet = null, editId = null;

  function fVal(n) { var el = sheet ? sheet.querySelector('[data-abs-f="' + n + '"]') : null; return el ? el.value.trim() : ''; }
  function fSet(n, v) { var el = sheet ? sheet.querySelector('[data-abs-f="' + n + '"]') : null; if (el) el.value = v || ''; }
  function flag(n) {
    var el = sheet ? sheet.querySelector('[data-abs-f="' + n + '"]') : null;
    if (!el) return;
    el.classList.remove('field-error'); void el.offsetWidth; el.classList.add('field-error');
    setTimeout(function () { el.classList.remove('field-error'); }, 4000);
  }
  /* Автоподстановки v3: datalist улиц + строка тарифа по населённому пункту */
  function syncPlace() {
    if (!sheet) return;
    var p = fVal('place');
    var dl = sheet.querySelector('#absStreetList');
    if (dl) {
      dl.innerHTML = streetsFor(p).map(function (s) { return '<option value="' + esc(s) + '"></option>'; }).join('');
    }
    var fee = sheet.querySelector('.abs-fee');
    if (fee) {
      var f = p ? feeFor(p) : 0;
      fee.hidden = !f;
      fee.textContent = f ? ('Доставка в этом населённом пункте: ' + f + ' ₽') : '';
    }
  }

  function ensureButton() {
    var place = document.getElementById('checkoutPlace');
    if (!place) return;
    if (document.getElementById('addrBookBtn')) return;
    var btn = document.createElement('button');
    btn.type = 'button'; btn.id = 'addrBookBtn';
    btn.className = 'addr-book-btn'; btn.textContent = '📍 Мои адреса';
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
        '<label>Улица<input type="text" data-abs-f="street" list="absStreetList" autocomplete="off"></label>' +
        '<datalist id="absStreetList"></datalist>' +
        '<div class="abs-fee" hidden></div>' +
        '<label>Дом, квартира<input type="text" data-abs-f="house" autocomplete="off"></label>' +
        '<div class="abs-edit-acts">' +
          '<button type="button" class="abs-save" data-abs="save">Сохранить</button>' +
          '<button type="button" class="abs-cancel" data-abs="cancel">Отмена</button>' +
        '</div>' +
      '</div>' +
      '<button type="button" class="abs-add" data-abs="add">＋ Сохранить текущий адрес</button>';
    document.body.appendChild(sheet);

    sheet.addEventListener('click', function (e) {
      var act = e.target.closest ? e.target.closest('[data-abs]') : null;
      if (!act) {
        var row = e.target.closest ? e.target.closest('.abs-row') : null;
        if (row) { var p = findById(row.getAttribute('data-id')); if (p) { fillForm(p); closeSheet(); } }
        return;
      }
      var cmd = act.getAttribute('data-abs');
      if (cmd === 'close') { closeSheet(); return; }
      if (cmd === 'add') { startEdit('new', formAddr()); return; }
      if (cmd === 'cancel') { stopEdit(); return; }
      if (cmd === 'save') { saveEdit(); return; }
      if (cmd === 'edit') { var a = findById(act.getAttribute('data-id')); if (a) startEdit(a.id, a); return; }
      if (cmd === 'del') {
        var id = act.getAttribute('data-id');
        write(read().filter(function (x) { return x.id !== id; }));
        if (editId === id) stopEdit();
        renderList();               /* v3: шторка остаётся открытой */
        say('Адрес удалён', '🗑');
        return;
      }
      if (cmd === 'pick') { var pk = findById(act.getAttribute('data-id')); if (pk) { fillForm(pk); closeSheet(); } return; }
    });

    /* v3: автоподстановки при вводе населённого пункта в форме редактирования */
    sheet.addEventListener('input', function (e) {
      if (e.target && e.target.getAttribute && e.target.getAttribute('data-abs-f') === 'place') syncPlace();
    });

    /* v3: клик вне — detachment-safe (closest работает по отцепленной цепочке родителей) */
    document.addEventListener('click', function (e) {
      if (!sheet || sheet.hidden) return;
      var t = e.target;
      if (t && t.closest && t.closest('#addrBookSheet, #addrBookBtn')) return;
      closeSheet();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && sheet && !sheet.hidden) closeSheet();
    });
    return sheet;
  }

  function findById(id) {
    var l = read();
    for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
    return null;
  }

  function renderList() {
    if (!sheet) return;
    var host = sheet.querySelector('.abs-list');
    if (!host) return;
    var l = read();
    if (!l.length) {
      host.innerHTML = '<div class="abs-empty">Сохранённых адресов пока нет.<br>Сохраните текущий адрес — и выбирайте его в один тап.</div>';
      return;
    }
    host.innerHTML = l.map(function (a) {
      return '<div class="abs-row" data-id="' + esc(a.id) + '">' +
        '<button type="button" class="abs-pick" data-abs="pick" data-id="' + esc(a.id) + '">' +
          '<span class="abs-title">' + esc(title(a)) + '</span></button>' +
        '<button type="button" class="abs-ico" data-abs="edit" data-id="' + esc(a.id) + '" aria-label="Изменить">✏️</button>' +
        '<button type="button" class="abs-ico" data-abs="del" data-id="' + esc(a.id) + '" aria-label="Удалить">🗑</button>' +
      '</div>';
    }).join('');
  }

  function startEdit(id, vals) {
    editId = id;
    var box = sheet.querySelector('.abs-edit');
    if (!box) return;
    box.hidden = false;
    fSet('place', vals.place); fSet('street', vals.street); fSet('house', vals.house);
    var save = sheet.querySelector('.abs-save');
    if (save) save.textContent = (id === 'new') ? 'Добавить адрес' : 'Сохранить изменения';
    syncPlace();
  }
  function stopEdit() {
    editId = null;
    var box = sheet ? sheet.querySelector('.abs-edit') : null;
    if (box) box.hidden = true;
    ['place', 'street', 'house'].forEach(function (n) {
      var el = sheet ? sheet.querySelector('[data-abs-f="' + n + '"]') : null;
      if (el) el.classList.remove('field-error');
    });
  }
  function saveEdit() {
    var a = norm({ place: fVal('place'), street: fVal('street'), house: fVal('house') });
    if (!a.place) { flag('place'); say('Укажите населённый пункт', '⚠️'); return; }
    if (!a.street) { flag('street'); say('Укажите улицу', '⚠️'); return; }
    /* v3: валидация улицы по справочнику — как в чекауте */
    if (window.AddressModule && window.AddressModule.isValidStreet &&
        streetsFor(a.place).length &&
        !window.AddressModule.isValidStreet(a.place, a.street)) {
      flag('street');
      say('В «' + a.place + '» нет улицы «' + a.street + '»', '⚠️');
      return;
    }
    var l = read().filter(function (x) { return x.id !== a.id && x.id !== editId; });
    l.unshift(a);
    write(l);
    stopEdit();
    renderList();                   /* v3: шторка остаётся открытой */
    say('Адрес сохранён', '✅');
  }
  function autoAdd(a) {
    a = norm(a);
    if (!a.place && !a.street) return;
    var l = read().filter(function (x) { return x.id !== a.id; });
    l.unshift(a);
    write(l);
    renderList();
  }

  function openSheet() { ensureSheet(); stopEdit(); renderList(); sheet.hidden = false; sheet.classList.add('open'); }
  function closeSheet() { if (!sheet) return; sheet.hidden = true; sheet.classList.remove('open'); stopEdit(); }

  function init() {
    ensureButton();
    /* кнопка переживает перерендер корзины — восстанавливаем по открытию шторки */
    document.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('#cartFab')) setTimeout(ensureButton, 50);
    }, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.AddressBook = {
    read: read, add: autoAdd, autoAdd: autoAdd, fill: fillForm,
    open: openSheet, close: closeSheet,
    refresh: function () { ensureButton(); if (sheet && !sheet.hidden) renderList(); }
  };
})();
`;

/* ══ 4. sw.js ══ */
function patchSwAssets(text) {
  if (text.indexOf("'/app/core/address-book.js'") !== -1) return text;
  return text.replace(
    /(const STATIC_ASSETS = \[[\s\S]*?)('\/app\/core\/overlay\.js',)/,
    function (m, before, ov) { return before + "'/app/core/address-book.js',\n  " + ov; }
  );
}
function patchSwCache(text) {
  var found = false;
  var out = text.replace(/(STATIC_CACHE\s*=\s*['"])([^'"]+)(['"])/, function (m, pre, val, q) {
    found = true;
    var next = /\d/.test(val) ? val.replace(/(\d+)(?=[^\d]*$)/, function (_, n) { return String(Number(n) + 1); }) : val + '-2';
    console.log('   STATIC_CACHE: ' + val + ' -> ' + next);
    return pre + next + q;
  });
  if (!found) warnings.push('sw.js: STATIC_CACHE не найден');
  return found ? out : text;
}

try {
  console.log('Task: ADDRESS-BOOK v3 + css-audit clean...\n');
  ['public/app/ui/theme-v2.css', 'public/sw.js'].forEach(function (f) {
    if (!fs.existsSync(resolvePath(f))) { console.error('❌ Не найден: ' + f); process.exit(1); }
  });

  console.log('theme-v2.css: sweep !important + компенсатор + токен-блок v3...');
  modifyFile('public/app/ui/theme-v2.css', patchThemeCss);

  console.log('address-book.js: перезапись на v3...');
  replaceFile('public/app/core/address-book.js', BOOK_JS_V3);

  console.log('sw.js: STATIC_ASSETS + bump...');
  modifyFile('public/sw.js', function (t) { return patchSwCache(patchSwAssets(t)); });

  if (warnings.length) { console.warn('\nПредупреждения:'); warnings.forEach(function (w) { console.warn(' - ' + w); }); }
  if (changed.length) { console.log('\nИзменённые файлы:'); changed.forEach(function (f) { console.log(' - ' + f); }); }
  console.log('\nГотово. Далее: node scripts/css-audit.mjs\n');
  process.exit(0);
} catch (err) {
  console.error('\n❌ Ошибка скрипта:');
  console.error(err);
  process.exit(1);
}