/* public/app/core/preorder-timer.js — Безопасный таймер предзаказов без циклов */
(function () {
  'use strict';

  var UPDATE_INTERVAL = 30000;
  var timerId = null;
  var isUpdating = false;
  var debounceTimer = null;

  function parseSlot(slotStr) {
    if (!slotStr || slotStr === 'asap' || slotStr === 'Как можно скорее (~45 мин)') return null;

    var raw = String(slotStr).trim();
    raw = raw.replace(/^(Сегодня|Завтра)\s*\(\s*([^)]+)\s*\)\s*[·•|.\-\s]+/i, '$2 | ');
    raw = raw.replace(/^(Сегодня|Завтра)\s*[·•|.\-\s]+/i, '');

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

    var timeMatch = timePart.match(/(\d{1,2}):(\d{2})\s*[–\-\s]+\s*(\d{1,2}):(\d{2})/);
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
      var dateMatch = datePart.match(/(\d{1,2})[.\-\/](\d{1,2})(?:[.\-\/](\d{2,4}))?/);
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
        if (/ежедневно|режим\s+работы|работаем/i.test(txt) || !/предзаказ/i.test(txt)) return;

        var slotMatch = txt.match(/(?:Сегодня|Завтра|\d{1,2}\.\d{2})?[^0-9\n]*\d{1,2}:\d{2}\s*[–—\-]\s*\d{1,2}:\d{2}/i);
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
})();