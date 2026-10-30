/* public/app/core/panel.js — Ф5.4: контроллер шторки профиля и вкладок.
Было inline-скрипт index.html. Зависит от: $ (utils), syncOverlay (inline → overlay.js),
openAuth (auth.js), me (state.js). Все потребители обращаются через window.* — контракт F1.3. */
(function () {
'use strict';

/* ── Переключение вкладок Бонусы / Профиль ── */
function setTab(t) {
    if (t === 'bonus' && window.brand === 'delivery') t = 'profile';
    document.querySelectorAll('.tabs button[data-tab]').forEach(function (button) {
        var selected = button.dataset.tab === t;
        button.classList.toggle('on', selected);
        button.setAttribute('aria-selected', String(selected));
        button.tabIndex = selected ? 0 : -1;
    });
    var pvBonus = document.getElementById('pvBonus');
    var pvProfile = document.getElementById('pvProfile');
    if (pvBonus) pvBonus.hidden = t !== 'bonus';
    if (pvProfile) pvProfile.hidden = t !== 'profile';
    var bonusBox = document.getElementById('bonusBox');
    if (bonusBox) bonusBox.hidden = t !== 'bonus';
}

/* ── Открытие шторки (мобильная версия ≤820px) ── */
var panelReturnFocus = null;
function openPanel(tab) {
    if (tab === 'bonus' && window.brand === 'delivery') tab = 'profile';
    setTab(tab);
    if (window.innerWidth <= 1180) {
        var panel = document.getElementById('panel');
        if (panel) {
            if (!panel.classList.contains('open')) panelReturnFocus = document.activeElement;
            panel.classList.add('open');
            var activeTab = panel.querySelector('.tabs [data-tab="' + tab + '"]');
            if (activeTab) activeTab.focus();
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
        if (panelReturnFocus && panelReturnFocus.isConnected) panelReturnFocus.focus();
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
  var tabs = document.querySelector('.tabs');
    if (tabs) {
        tabs.addEventListener('click', function (event) {
            var button = event.target.closest('[data-tab]');
            if (button) setTab(button.dataset.tab);
        });
        tabs.addEventListener('keydown', function (event) {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            var buttons = Array.prototype.slice.call(tabs.querySelectorAll('[data-tab]')).filter(function (button) {
                return !button.hidden && button.style.display !== 'none';
            });
            if (!buttons.length) return;
            var current = buttons.indexOf(document.activeElement);
            var next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
                : (current + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
            event.preventDefault();
            buttons[next].focus();
            setTab(buttons[next].dataset.tab);
        });
    }

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
                openPanel('bonus');
            } else if (typeof openAuth === 'function') {
                openAuth();
            }
        };
    }
});

/* ── Экспорт в глобальную область видимости (контракт F1.3) ── */
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
