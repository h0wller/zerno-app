/* public/app/core/panel.js — Ф5.4: контроллер шторки профиля и вкладок.
Было inline-скрипт index.html. Зависит от: $ (utils), syncOverlay (inline → overlay.js),
openAuth (auth.js), me (state.js). Все потребители обращаются через window.* — контракт F1.3. */
(function () {
'use strict';

/* Legacy 'bonus' and 'profile' routes share the single profile surface. */
function setTab() {
    var profile = document.getElementById('pvProfile');
    if (profile) profile.hidden = false;
}

/* ── Открытие шторки (мобильная версия ≤820px) ── */
var panelReturnFocus = null;
function openPanel() {
    setTab();
    if (window.brand === 'delivery' && window.me && typeof window.loadMyOrders === 'function') {
        window.loadMyOrders();
    }
    if (window.innerWidth <= 1180) {
        var panel = document.getElementById('panel');
        if (panel) {
            if (!panel.classList.contains('open')) panelReturnFocus = document.activeElement;
            panel.classList.add('open');
            var back = panel.querySelector('.tabs .btn-back');
            if (back) back.focus();
        }
        if (typeof syncOverlay === 'function') syncOverlay();
        if (window.TgUx) window.TgUx.sync();
    }
}

/* ── Закрытие шторки ── */
function closePanel() {
    if (window.innerWidth <= 1180) {
        var panel = document.getElementById('panel');
        if (panel) panel.classList.remove('open');
        if (typeof syncOverlay === 'function') syncOverlay();
        if (window.TgUx) window.TgUx.sync();
        if (panelReturnFocus && panelReturnFocus.isConnected) panelReturnFocus.focus({ preventScroll: true });
        panelReturnFocus = null;
    }
}

/* ── Слушатели ── */
document.addEventListener('DOMContentLoaded', function () {
    /* Переключение вкладок по клику */
    /* UI-DEDUP v4: защита от дублей таб-кнопок («Мои заказы» и др.) */
  (function () {
    var seen = {};
    document.querySelectorAll('.tabs [data-tab]').forEach(function (b) {
      if (seen[b.dataset.tab]) { b.remove(); return; }
      seen[b.dataset.tab] = 1;
    });
  })();


    /* Кнопка «← Назад» (вместо inline onclick) */
    var backBtn = document.querySelector('.tabs .btn-back');
    if (backBtn) {
        backBtn.addEventListener('click', closePanel);
    }

    /* Делегирование открытия модалки заказов: данные и разметка принадлежат profile-orders.js. */
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('#myOrdersBtn, [data-tab="my-orders"], .my-orders-btn');
      if (!btn) return;
      e.preventDefault();
      if (typeof window.renderOrdersModal === 'function') window.renderOrdersModal();
    });

    /* Плавающая кнопка «Мои бонусы» */
    var mbonusBtn = document.getElementById('mbonusBtn');
  if (mbonusBtn && window.me && !mbonusBtn.dataset.st) mbonusBtn.dataset.st = '0/10'; /* F5.18b */
    if (mbonusBtn) {
        mbonusBtn.onclick = function () {
            if (typeof me !== 'undefined' && me) {
                openPanel('profile');
            } else if (typeof openAuth === 'function') {
                openAuth();
            }
        };
    }
});

/* ── Экспорт в глобальную область видимости (контракт F1.3) ── */
/* A delivery storefront opens on Profile once; later syncs preserve user tab choice. */
(function () {
  var initialDelivery = document.documentElement.getAttribute('data-brand') === 'delivery';
  var key = '__deliveryProfileDefaultInitialised';
  if (!initialDelivery || window[key]) return;
  window[key] = true;
  if (typeof window.setTab === 'function') window.setTab('profile');
  else document.addEventListener('DOMContentLoaded', function () {
    if (typeof window.setTab === 'function') window.setTab('profile');
  }, { once: true });
})();

window.setTab = setTab;
window.openPanel = openPanel;
window.closePanel = closePanel;
})();
/* ── F5.17: бонус-пилюля не закрывает футер при скролле вниз ── */
(function () {
  var mb = document.getElementById("mbonusBtn");
  var ft = document.querySelector(".siteFooter");
  if (!mb || !ft || typeof IntersectionObserver === "undefined") return;
  new IntersectionObserver(function (es) {
    es.forEach(function (en) {
      var scrolled = (window.scrollY || document.documentElement.scrollTop || 0) > 250;
      mb.classList.toggle("near-footer", en.isIntersecting && scrolled);
    });
  }, { threshold: 0.2 }).observe(ft);
})();
