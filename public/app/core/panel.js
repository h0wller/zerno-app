/* public/app/core/panel.js — Ф5.4: контроллер шторки профиля и вкладок.
Было inline-скрипт index.html. Зависит от: $ (utils), syncOverlay (inline → overlay.js),
openAuth (auth.js), me (state.js). Все потребители обращаются через window.* — контракт F1.3. */
(function () {
'use strict';

/* ── Переключение вкладок Бонусы / Профиль ── */
function setTab(t) {
    document.querySelectorAll('.tabs button[data-tab]').forEach(function (b) {
        b.classList.toggle('on', b.dataset.tab === t);
    });
    var pvBonus = document.getElementById('pvBonus');
    var pvProfile = document.getElementById('pvProfile');
    if (pvBonus) pvBonus.hidden = t !== 'bonus';
    if (pvProfile) pvProfile.hidden = t !== 'profile';
    /* Управление видимостью #bonusBox — требуется для E2E-тестов */
    var bonusBox = document.getElementById('bonusBox');
    if (bonusBox) bonusBox.hidden = t !== 'bonus';
}

/* ── Открытие шторки (мобильная версия ≤1180px) ── */
function openPanel(tab) {
    setTab(tab);
    if (window.innerWidth <= 1180) {
        var p = document.getElementById('panel');
        if (p) p.classList.add('open');
        if (typeof syncOverlay === 'function') syncOverlay();
    }
}

/* ── Закрытие шторки ── */
function closePanel() {
    if (window.innerWidth <= 1180) {
        var p = document.getElementById('panel');
        if (p) p.classList.remove('open');
        if (typeof syncOverlay === 'function') syncOverlay();
    }
}

/* ── Слушатели ── */
document.addEventListener('DOMContentLoaded', function () {
    /* Переключение вкладок по клику */
    var tabs = document.querySelector('.tabs');
    if (tabs) {
        tabs.addEventListener('click', function (e) {
            var b = e.target.closest('[data-tab]');
            if (b) setTab(b.dataset.tab);
        });
    }

    /* Кнопка «← Назад» (вместо inline onclick) */
    var backBtn = document.querySelector('.tabs .btn-back');
    if (backBtn) {
        backBtn.addEventListener('click', closePanel);
    }

    /* Плавающая кнопка «Мои бонусы» */
    var mbonusBtn = document.getElementById('mbonusBtn');
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