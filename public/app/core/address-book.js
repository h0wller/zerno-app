/* public/app/core/address-book.js — ADDRESS-BOOK v3
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
