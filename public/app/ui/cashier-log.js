/* Ф3.4: журнал кассира — фильтрация кофейных событий */
(function () {
  'use strict';
  function filterCashLog() {
    document.querySelectorAll('#cashLog .logrow').forEach(function (r) {
      var la = r.querySelector('.la'); if (!la) return;
      var t = la.textContent || '';
      r.style.display = /заказ|задерж|доставк|Пятниц|курьер|пуш всем/i.test(t) ? 'none' : '';
    });
  }

  if (typeof setMode === 'function') {
    setMode = (function (_sm) {
      return function (_m) {
        var r = _sm.apply(this, arguments);
        setTimeout(function () {
          var cl = document.getElementById('cashLog');
          if (cl) {
            var card = cl.closest('.cash-card');
            if (card) card.style.display = '';
            filterCashLog();
          }
        }, 60);
        return r;
      };
    })(setMode);
  }

  function unhideCashLog() {
    var cl = document.getElementById('cashLog'); if (!cl) return;
    var card = cl.closest('.cash-card');
    if (card && card.style.display === 'none') card.style.display = '';
  }

  window.filterCashLog = function () {
    unhideCashLog();
    filterCashLog();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.filterCashLog, { once: true });
  } else {
    window.filterCashLog();
  }
  setTimeout(window.filterCashLog, 300);
})();