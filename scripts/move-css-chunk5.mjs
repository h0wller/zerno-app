#!/usr/bin/env node
/**
 * scripts/fix-infinite-loops.mjs
 * Полное устранение бесконечных циклов MutationObserver и микротаск-шторма
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
function resolvePath(p) { return path.join(root, p); }

function writeFile(relPath, content) {
  const absPath = resolvePath(relPath);
  fs.writeFileSync(absPath, content, 'utf8');
  console.log(`✔ Перезаписан: ${relPath}`);
}

// ── 1. Безопасный preorder-timer.js (без бесконечных циклов) ───────────────────
const CLEAN_TIMER_JS = `/* public/app/core/preorder-timer.js — Безопасный таймер предзаказов без циклов */
(function () {
  'use strict';

  var UPDATE_INTERVAL = 30000;
  var timerId = null;
  var isUpdating = false;
  var debounceTimer = null;

  function parseSlot(slotStr) {
    if (!slotStr || slotStr === 'asap' || slotStr === 'Как можно скорее (~45 мин)') return null;

    var raw = String(slotStr).trim();
    raw = raw.replace(/^(Сегодня|Завтра)\\s*\\(\\s*([^)]+)\\s*\\)\\s*[·•|.\\-\\s]+/i, '$2 | ');
    raw = raw.replace(/^(Сегодня|Завтра)\\s*[·•|.\\-\\s]+/i, '');

    var parts = raw.split(/[|·•]/);
    var datePart = '';
    var timePart = '';

    if (parts.length >= 2) {
      datePart = parts[0].trim();
      timePart = parts.slice(1).join('·').trim();
    } else {
      datePart = '';
      timePart = raw;
    }

    var timeMatch = timePart.match(/(\\d{1,2}):(\\d{2})\\s*[–\\-\\s]+\\s*(\\d{1,2}):(\\d{2})/);
    if (!timeMatch) return null;

    var startH = parseInt(timeMatch[1], 10);
    var startM = parseInt(timeMatch[2], 10);
    var endH = parseInt(timeMatch[3], 10);
    var endM = parseInt(timeMatch[4], 10);

    var now = new Date();
    var year = now.getFullYear();
    var month = now.getMonth();
    var day = now.getDate();

    if (datePart) {
      var dateMatch = datePart.match(/(\\d{1,2})[.\\-\\/](\\d{1,2})(?:[.\\-\\/](\\d{2,4}))?/);
      if (dateMatch) {
        day = parseInt(dateMatch[1], 10);
        month = parseInt(dateMatch[2], 10) - 1;
        if (dateMatch[3]) {
          year = parseInt(dateMatch[3], 10);
          if (year < 100) year += 2000;
        } else {
          var testDate = new Date(year, month, day);
          if (testDate < new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)) {
            year += 1;
          }
        }
      }
    }

    var start = new Date(year, month, day, startH, startM, 0, 0);
    var end = new Date(year, month, day, endH, endM, 0, 0);

    if (end <= start) {
      end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
    }

    return { start: start, end: end };
  }

  function formatRemaining(ms) {
    if (ms <= 0) return null;
    var totalMin = Math.floor(ms / 60000);
    var hours = Math.floor(totalMin / 60);
    var mins = totalMin % 60;
    if (hours > 0) return '~' + hours + ' ч ' + mins + ' мин';
    if (mins <= 0) return 'меньше минуты';
    return '~' + mins + ' мин';
  }

  function autoInjectBadges() {
    var containers = document.querySelectorAll('#myOrders, #panel, .modal');
    if (!containers.length) return;

    containers.forEach(function (cont) {
      var cards = cont.querySelectorAll('.myorderCard, .orderCard, .order-card, .history-item, .card, .oc');
      cards.forEach(function (card) {
        if (card.querySelector('.preorder-timer')) return;

        var txt = card.textContent || '';
        if (/отмен|доставлен|выполнен|завершен/i.test(txt)) return;
        if (/ежедневно|режим\\s+работы|работаем/i.test(txt) || !/предзаказ/i.test(txt)) return;

        var slotMatch = txt.match(/(?:Сегодня|Завтра|\\d{1,2}\\.\\d{2})?[^0-9\\n]*\\d{1,2}:\\d{2}\\s*[–—\\-]\\s*\\d{1,2}:\\d{2}/i);
        if (slotMatch) {
          var badgeHtml = createTimerBadge(slotMatch[0]);
          if (badgeHtml) {
            var t = document.createElement('div');
            t.innerHTML = badgeHtml;
            if (t.firstElementChild) {
              card.appendChild(t.firstElementChild);
            }
          }
        }
      });
    });
  }

  function updateAllTimers() {
    if (isUpdating) return;
    isUpdating = true;
    try {
      autoInjectBadges();

      var badges = document.querySelectorAll('.preorder-timer[data-slot]');
      var now = Date.now();

      badges.forEach(function (badge) {
        var slotStr = badge.dataset.slot;
        var parsed = parseSlot(slotStr);
        if (!parsed) {
          if (!badge.hidden) badge.hidden = true;
          return;
        }

        var msToStart = parsed.start.getTime() - now;
        var msToEnd = parsed.end.getTime() - now;

        if (msToStart > 0) {
          var remaining = formatRemaining(msToStart);
          if (remaining) {
            var newText = '⏱ До доставки ' + remaining;
            if (badge.textContent !== newText) badge.textContent = newText;
            if (badge.hidden) badge.hidden = false;
            badge.classList.remove('preorder-timer-active', 'preorder-timer-way');
            badge.classList.add('preorder-timer-waiting');
          } else {
            if (!badge.hidden) badge.hidden = true;
          }
        } else if (msToEnd > 0) {
          var wayText = '🚗 Курьер уже в пути';
          if (badge.textContent !== wayText) badge.textContent = wayText;
          if (badge.hidden) badge.hidden = false;
          badge.classList.remove('preorder-timer-waiting');
          badge.classList.add('preorder-timer-active', 'preorder-timer-way');
        } else {
          if (!badge.hidden) badge.hidden = true;
        }
      });
    } finally {
      setTimeout(function () { isUpdating = false; }, 50);
    }
  }

  function createTimerBadge(slotStr) {
    if (!slotStr || slotStr === 'asap') return '';
    var parsed = parseSlot(slotStr);
    if (!parsed) return '';
    var now = Date.now();
    if (parsed.end.getTime() - now <= 0) return '';
    return '<div class="preorder-timer preorder-timer-waiting" data-slot="' +
      String(slotStr).replace(/"/g, '&quot;').replace(/</g, '&lt;') +
      '">⏱ Загрузка...</div>';
  }

  function init() {
    updateAllTimers();
    timerId = setInterval(updateAllTimers, UPDATE_INTERVAL);

    document.addEventListener('click', function (e) {
      if (e.target && e.target.closest && e.target.closest('#profileTopBtn, .ava, #mbonusBtn, [data-tab="profile"]')) {
        setTimeout(updateAllTimers, 100);
        setTimeout(updateAllTimers, 600);
      }
    });

    var observer = new MutationObserver(function (mutations) {
      if (isUpdating) return;
      var relevant = false;
      for (var i = 0; i < mutations.length; i++) {
        var t = mutations[i].target;
        if (!t) continue;
        if (t.classList && t.classList.contains('preorder-timer')) continue;
        if (t.closest && t.closest('.preorder-timer')) continue;
        if (t.id === 'myOrders' || (t.closest && t.closest('#myOrders, #panel, .modal'))) {
          relevant = true;
          break;
        }
      }
      if (!relevant) return;

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(updateAllTimers, 250);
    });

    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.PreorderTimer = {
    parseSlot: parseSlot,
    formatRemaining: formatRemaining,
    createTimerBadge: createTimerBadge,
    updateAll: updateAllTimers
  };
})();`;

writeFile('public/app/core/preorder-timer.js', CLEAN_TIMER_JS);

// ── 2. Безопасный address-autocomplete.js ──────────────────────────────────
const CLEAN_ADDR_AUTO_JS = `/* public/app/core/address-autocomplete.js — Безопасное автодополнение без циклов */
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
      btn.addEventListener('mousedown', function (e) {
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
    if (oldWrap) return;

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

    input.addEventListener('keydown', function (e) {
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
    renderAddressBook();
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
        renderAddressBook();
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
})();`;

writeFile('public/app/core/address-autocomplete.js', CLEAN_ADDR_AUTO_JS);

// ── 3. Бамп кэша SW ────────────────────────────────────────────────────────
const swPath = resolvePath('public/sw.js');
let swContent = fs.readFileSync(swPath, 'utf8');
swContent = swContent.replace(/(STATIC_CACHE\s*=\s*['"])([^'"]+)(['"])/, (m, pre, val, post) => {
  const next = val.replace(/(\d+)(?=[^\d]*$)/, (_, n) => String(Number(n) + 1));
  console.log(`✔ STATIC_CACHE: ${val} -> ${next}`);
  return `${pre}${next}${post}`;
});
fs.writeFileSync(swPath, swContent, 'utf8');

console.log('\nУспешно! Все бесконечные циклы устранены.');