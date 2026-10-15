function isDeliveryServiceOpen() {
  var t = getKaliningradTime();
  var min = t.hour * 60 + t.minute;
  return min >= 660 && min < 1320;
}

/* public/app/core/preorder-timer.js — Легковесный таймер (без обсерверов и циклов) */
(function () {
  'use strict';

  function parseSlot(slotStr) {
    if (!slotStr || slotStr === 'asap') return null;
    var raw = String(slotStr).trim();
    raw = raw.replace(/^(Сегодня|Завтра)\s*\(\s*([^)]+)\s*\)\s*[·•|.\-\s]+/i, '$2 | ');
    raw = raw.replace(/^(Сегодня|Завтра)\s*[·•|.\-\s]+/i, '');

    var parts = raw.split(/[|·•]/);
    var datePart = parts.length >= 2 ? parts[0].trim() : '';
    var timePart = parts.length >= 2 ? parts.slice(1).join('·').trim() : raw;

    var timeMatch = timePart.match(/(\d{1,2}):(\d{2})\s*[–\-\s]+\s*(\d{1,2}):(\d{2})/);
    if (!timeMatch) return null;

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
        }
      }
    }

    var start = new Date(year, month, day, parseInt(timeMatch[1], 10), parseInt(timeMatch[2], 10), 0);
    var end = new Date(year, month, day, parseInt(timeMatch[3], 10), parseInt(timeMatch[4], 10), 0);
    if (end <= start) end = new Date(end.getTime() + 86400000);

    return { start: start, end: end };
  }

  function formatRemaining(ms) {
    if (ms <= 0) return null;
    var totalMin = Math.floor(ms / 60000);
    var hours = Math.floor(totalMin / 60);
    var mins = totalMin % 60;
    if (hours > 0) return '~' + hours + ' ч ' + mins + ' мин';
    return '~' + Math.max(1, mins) + ' мин';
  }

function renderTimers() {
  var markers = document.querySelectorAll('.preorder-slot[data-slot]');
  if (!markers.length) return;

  var now = Date.now();

  for (var i = 0; i < markers.length; i++) {
    var marker = markers[i];
    var slotStr = marker.getAttribute('data-slot');
    var parsed = parseSlot(slotStr);
    if (!parsed) continue;

    var card = marker.closest('.myOrderCard, .orderCard, .history-item, .card');
    if (!card) continue;

    var existing = card.querySelector('.preorder-timer');

    var statusEl = card.querySelector('.moSt, .ocStatus');
    var statusText = statusEl ? (statusEl.textContent || '') : '';
    if (/отмен|доставлен|выполнен|завершен/i.test(statusText)) {
      if (existing) existing.remove();
      continue;
    }

    var msToStart = parsed.start.getTime() - now;
    var msToEnd = parsed.end.getTime() - now;

    if (msToEnd <= 0) {
      if (existing) existing.remove();
      continue;
    }

    var badgeText = msToStart > 0
      ? '⏱ До доставки ' + formatRemaining(msToStart)
      : '🚗 Курьер уже в пути';
    var isWaiting = msToStart > 0;

    if (!existing) {
      existing = document.createElement('div');
      existing.className = 'preorder-timer ' + (isWaiting ? 'preorder-timer-waiting' : 'preorder-timer-active');
      existing.textContent = badgeText;
      marker.parentNode.insertBefore(existing, marker.nextSibling);
    } else if (existing.textContent !== badgeText) {
      existing.textContent = badgeText;
      existing.className = 'preorder-timer ' + (isWaiting ? 'preorder-timer-waiting' : 'preorder-timer-active');
    }
  }
}

  function init() {
    // Запуск строго при переходе в профиль/заказы
    document.addEventListener('click', function (e) {
      if (e.target && e.target.closest && e.target.closest('#profileTopBtn, .ava, #mbonusBtn, [data-tab="profile"], #myOrders')) {
        setTimeout(renderTimers, 100);
      }
    });

    // Ленивый фоновый запуск: активируется только когда страница свободна (Idle)
    if ('requestIdleCallback' in window) {
      requestIdleCallback(function () {
        setInterval(renderTimers, 30000);
      });
    } else {
      setTimeout(function () {
        setInterval(renderTimers, 30000);
      }, 3000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.PreorderTimer = { updateAll: renderTimers };
})();