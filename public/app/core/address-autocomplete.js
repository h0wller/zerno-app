/* public/app/core/address-autocomplete.js — Безопасное автодополнение без циклов */
(function () {
  'use strict';

  var dropdown = null;
  var activeIndex = -1;
  var items = [];
  var justSelected = false;
  var addressRestored = false;
  var addrBookTimer = null;

  function ensureDropdown() {
    if (dropdown) return dropdown;
    dropdown = document.createElement('div');
    dropdown.className = 'addr-dropdown';
    dropdown.hidden = true;
    document.body.appendChild(dropdown);
    return dropdown;
  }

  function positionDropdown(input) {
    if (!dropdown || !input) return;
    var rect = input.getBoundingClientRect();
    dropdown.style.left = rect.left + 'px';
    dropdown.style.top = (rect.bottom + 4 + window.scrollY) + 'px';
    dropdown.style.width = rect.width + 'px';
  }

  function showDropdown(input, suggestions) {
    dropdown = ensureDropdown();
    items = suggestions;
    activeIndex = -1;

    if (!suggestions.length) {
      dropdown.hidden = true;
      return;
    }

    dropdown.innerHTML = suggestions.map(function (s, i) {
      return '<button type="button" class="addr-item" data-idx="' + i + '">' +
        '<span class="addr-item-text">' + s + '</span>' +
        '</button>';
    }).join('');
    dropdown.hidden = false;
    positionDropdown(input);

    dropdown.querySelectorAll('.addr-item').forEach(function (btn) {
      btn.addEventListener('mousedown', function (_e) {
        e.preventDefault();
        var idx = parseInt(btn.dataset.idx, 10);
        selectItem(input, items[idx]);
      });
    });
  }

  function hideDropdown() {
    if (dropdown) dropdown.hidden = true;
    items = [];
    activeIndex = -1;
  }

  function selectItem(input, value) {
    justSelected = true;
    input.value = value;
    hideDropdown();
    input.dispatchEvent(new Event('input', { bubbles: true }));
    try { input.blur(); } catch (e) {}
    setTimeout(function () { justSelected = false; }, 350);
  }

  function highlightItem(index) {
    if (!dropdown) return;
    var btns = dropdown.querySelectorAll('.addr-item');
    btns.forEach(function (b, i) {
      b.classList.toggle('addr-item-active', i === index);
    });
  }

  
  
  function restoreSavedAddress() {
    if (addressRestored) return;
    try {
      var raw = localStorage.getItem('zt_saved_address');
      if (!raw) return;
      var saved = JSON.parse(raw);
      var cp = document.getElementById('checkoutPlace');
      var cs = document.getElementById('checkoutStreet');
      var ch = document.getElementById('checkoutHouse');

      if (!cp || !cs) return;
      addressRestored = true;

      if (cp && saved.place && !cp.value) {
        cp.value = saved.place;
        cp.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (cs && saved.street && !cs.value) {
        cs.value = saved.street;
        cs.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (ch && saved.house && !ch.value) {
        ch.value = saved.house;
        ch.dispatchEvent(new Event('input', { bubbles: true }));
      }
    } catch (e) {}
  }

  function attachToInput(input) {
    if (!input || input.dataset.addrBound) return;
    input.dataset.addrBound = '1';

    input.setAttribute('autocomplete', 'off');
    input.setAttribute('spellcheck', 'false');

    input.addEventListener('focus', function () {
      if (justSelected) return;
      var placeInput = document.getElementById('checkoutPlace');
      var place = placeInput ? placeInput.value : '';
      var list = (window.AddressModule && window.AddressModule.getStreets)
        ? window.AddressModule.getStreets(place) : [];
      if (!list.length) return;

      var q = (input.value || '').toLowerCase().trim();
      var filtered = q
        ? list.filter(function (s) { return s.toLowerCase().indexOf(q) > -1; })
        : list;
      showDropdown(input, filtered);
    });

    input.addEventListener('input', function () {
      var placeInput = document.getElementById('checkoutPlace');
      var place = placeInput ? placeInput.value : '';
      var list = (window.AddressModule && window.AddressModule.getStreets)
        ? window.AddressModule.getStreets(place) : [];
      var q = (input.value || '').toLowerCase().trim();
      var filtered = q
        ? list.filter(function (s) { return s.toLowerCase().indexOf(q) > -1; })
        : list;
      if (filtered.length && document.activeElement === input) {
        showDropdown(input, filtered.slice(0, 8));
      } else {
        hideDropdown();
      }
    });

    input.addEventListener('keydown', function (_e) {
      if (!items.length) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, items.length - 1);
        highlightItem(activeIndex);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
        highlightItem(activeIndex);
      } else if (e.key === 'Enter' && activeIndex >= 0) {
        e.preventDefault();
        selectItem(input, items[activeIndex]);
      } else if (e.key === 'Escape') {
        hideDropdown();
      }
    });

    input.addEventListener('blur', function () {
      setTimeout(hideDropdown, 150);
    });
  }

  function attachToPlaceSelect() {
    var placeInput = document.getElementById('checkoutPlace');
    var streetInput = document.getElementById('checkoutStreet');
    if (!placeInput || !streetInput) return;
    if (placeInput.dataset.addrPlaceBound) return;
    placeInput.dataset.addrPlaceBound = '1';

    ['change', 'input'].forEach(function (ev) {
      placeInput.addEventListener(ev, function () {
        if (window.AddressModule && window.AddressModule.populateStreets) {
          window.AddressModule.populateStreets(placeInput.value);
        }
        var streets = (window.AddressModule && window.AddressModule.getStreets)
          ? window.AddressModule.getStreets(placeInput.value) : [];
        if (streets.length && streetInput.value) {
          var isValid = window.AddressModule.isValidStreet
            ? window.AddressModule.isValidStreet(placeInput.value, streetInput.value)
            : true;
          if (!isValid) {
            streetInput.value = '';
            streetInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
      });
    });
  }

  function init() {
    var streetInput = document.getElementById('checkoutStreet');
    if (streetInput) attachToInput(streetInput);
    attachToPlaceSelect();
    restoreSavedAddress();

    window.addEventListener('resize', function () {
      if (dropdown && !dropdown.hidden) {
        var active = document.activeElement;
        if (active && active.id === 'checkoutStreet') positionDropdown(active);
      }
    });

    window.addEventListener('scroll', function () {
      if (document.activeElement !== document.getElementById('checkoutStreet')) {
        hideDropdown();
      }
    }, { passive: true });

    var observer = new MutationObserver(function (mutations) {
      var relevant = false;
      for (var i = 0; i < mutations.length; i++) {
        var t = mutations[i].target;
        if (t && (t.id === 'cartPanel' || (t.closest && t.closest('#cartPanel')))) {
          relevant = true;
          break;
        }
      }
      if (!relevant) return;

      clearTimeout(addrBookTimer);
      addrBookTimer = setTimeout(function () {
        var si = document.getElementById('checkoutStreet');
        if (si && !si.dataset.addrBound) attachToInput(si);
        attachToPlaceSelect();
        restoreSavedAddress();
      }, 150);
    });

    var cp = document.getElementById('cartPanel');
    if (cp) {
      observer.observe(cp, { childList: true, subtree: true });
    } else if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
/* UI-DEDUP v4: legacy-книга адресов вырезана, владелец — address-book.js */
