/* public/app/core/panel.js — единая панель профиля без отдельной вкладки бонусов. */
(function () {
'use strict';

var panelReturnFocus = null;

function setTab() {
    var profile = document.getElementById('pvProfile');
    if (profile) profile.hidden = false;
    var legacyBonus = document.getElementById('pvBonus');
    if (legacyBonus) legacyBonus.hidden = true;
}

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

document.addEventListener('DOMContentLoaded', function () {
    var backBtn = document.querySelector('.tabs .btn-back');
    if (backBtn) backBtn.addEventListener('click', closePanel);

    document.addEventListener('click', function (event) {
        var button = event.target.closest('#myOrdersBtn, [data-tab="my-orders"], .my-orders-btn');
        if (!button) return;
        event.preventDefault();
        if (typeof window.renderOrdersModal === 'function') window.renderOrdersModal();
    });
});

window.setTab = setTab;
window.openPanel = openPanel;
window.closePanel = closePanel;
})();
