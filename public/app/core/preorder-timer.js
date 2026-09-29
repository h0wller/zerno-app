/* public/app/core/preorder-timer.js — Этап 2: таймер обратного отсчёта до слота доставки
   PREORDER-TIMER v5 — фильтр инфо-карточек заведения и блоков без слова «заказ» */
(function () {
  'use strict';

  var UPDATE_INTERVAL = 30000;
  var timerId = null;

  /**
   * Парсит строку слота. Поддерживает форматы:
   *   "29.09 | 14:00–14:30"
   *   "29.09.2026 | 14:00–14:30"
   *   "Сегодня (29.09) · 13:00 – 13:30"
   *   "Завтра (30.09) · 14:00 – 14:30"
   *   "13:00 – 13:30" (только время)
   */
  function parseSlot(slotStr) {
    if (!slotStr || slotStr === 'asap' || slotStr === 'Как можно скорее (~45 мин)') return null;

    var raw = String(slotStr).trim();

    // Убираем префиксы «Сегодня»/«Завтра» со скобками с датой
    raw = raw.replace(/^(Сегодня|Завтра)\s*\(\s*([^)]+)\s*\)\s*[·•|.\-\s]+/i, '$2 | ');
    // Префиксы без скобок
    raw = raw.replace(/^(Сегодня|Завтра)\s*[·•|.\-\s]+/i, '');

    // Разделяем по «|» или «·»
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

  /**
   * PREORDER-TIMER v5: АВТОПОИСК карточек с предзаказами прямо в DOM.
   * Ищет по тексту карточки время в формате "14:00 – 14:30" / "14:00–14:30".
   * Игнорирует:
   *   - неактивные заказы (отменён, доставлен, выполнен, завершён)
   *   - инфо-карточки заведения («Ежедневно 11:00–22:00», «Режим работы», «Работаем»)
   *   - блоки без слова «заказ»
   */
  function autoInjectBadges() {
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
      if (/ежедневно|режим\s+работы|работаем/i.test(txt)) return;

      var slotMatch = txt.match(/(?:Сегодня|Завтра|\d{1,2}\.\d{2})?[^0-9\n]*\d{1,2}:\d{2}\s*[–—\-]\s*\d{1,2}:\d{2}/i);
      if (slotMatch) {
        el.dataset.preorderTimerBound = '1';
        var badge = document.createElement('div');
        badge.innerHTML = createTimerBadge(slotMatch[0]);
        if (badge.firstElementChild) {
          el.parentNode.insertBefore(badge.firstElementChild, el.nextSibling);
        }
      }
    });
  }

  function updateAllTimers() {
    // Сначала автопоиск новых карточек (PREORDER-TIMER v5)
    autoInjectBadges();

    var badges = document.querySelectorAll('.preorder-timer[data-slot]');
    var now = Date.now();

    badges.forEach(function (badge) {
      var slotStr = badge.dataset.slot;
      var parsed = parseSlot(slotStr);
      if (!parsed) {
        badge.hidden = true;
        return;
      }

      var msToStart = parsed.start.getTime() - now;
      var msToEnd = parsed.end.getTime() - now;

      if (msToStart > 0) {
        var remaining = formatRemaining(msToStart);
        if (remaining) {
          badge.hidden = false;
          badge.textContent = '⏱ До доставки ' + remaining;
          badge.classList.remove('preorder-timer-active', 'preorder-timer-way');
          badge.classList.add('preorder-timer-waiting');
        } else {
          badge.hidden = true;
        }
      } else if (msToEnd > 0) {
        badge.hidden = false;
        badge.textContent = '🚗 Курьер уже в пути';
        badge.classList.remove('preorder-timer-waiting');
        badge.classList.add('preorder-timer-active', 'preorder-timer-way');
      } else {
        badge.hidden = true;
      }
    });
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
    // Hook on profile click
    document.addEventListener('click', function(e) {
      if (e.target && e.target.closest && e.target.closest('#profileTopBtn, .ava, #mbonusBtn, [data-tab="profile"]')) {
        setTimeout(updateAllTimers, 50);
        setTimeout(updateAllTimers, 400);
        setTimeout(updateAllTimers, 1200);
      }
    });
    autoInjectBadges();
    updateAllTimers();

    timerId = setInterval(updateAllTimers, UPDATE_INTERVAL);

    // MutationObserver следит за появлением новых карточек
    var observer = new MutationObserver(function (mutations) {
      var needUpdate = false;
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (m.target && (m.target.id === 'myOrders' || (m.target.closest && m.target.closest('#myOrders, #panel, .modal')))) {
          needUpdate = true;
          break;
        }
        for (var j = 0; j < m.addedNodes.length; j++) {
          var n = m.addedNodes[j];
          if (n.nodeType === 1) {
            if (n.id === 'myOrders' || /order/i.test(n.className || '') || (n.querySelector && n.querySelector('[class*="order" i], #myOrders'))) {
              needUpdate = true;
              break;
            }
          }
        }
        if (needUpdate) break;
      }
      if (needUpdate) {
        updateAllTimers();
      }
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
