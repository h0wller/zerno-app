/* public/app/core/address-book.js — ADDRESS-BOOK v2
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
