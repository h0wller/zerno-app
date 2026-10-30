/* public/app/ui/settings.js — настройки профиля и управление аккаунтом. */
(function () {
    'use strict';

    if (document.getElementById('settingsModal')) return;

    var modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'settingsModal';
    modal.innerHTML =
        '<div class="modal-card settings-card" role="dialog" aria-modal="true" aria-labelledby="settingsTitle" tabindex="-1">' +
            '<button class="mclose" id="setClose" type="button" aria-label="Закрыть настройки">✕</button>' +
            '<h3 id="settingsTitle">Настройки</h3>' +
            '<div class="msub">Безопасность, уведомления и аккаунт</div>' +

            '<section class="settings-section" aria-label="Безопасность">' +
                '<div class="set-row">' +
                    '<span>🔐 PIN-код</span>' +
                    '<button class="btn ghost" id="setPinGo2" type="button">Задать или изменить</button>' +
                '</div>' +
            '</section>' +

            '<section class="settings-section" aria-label="Каналы уведомлений">' +
                '<div class="settings-section-title">Каналы уведомлений</div>' +
                '<div class="settings-channel-row">' +
                    '<label class="chk"><input type="checkbox" id="ntTg2"> 🤖 Telegram</label>' +
                    '<label class="chk"><input type="checkbox" id="ntWeb2"> 🔔 Браузер</label>' +
                '</div>' +
            '</section>' +

            '<section class="settings-section settings-account-section" aria-label="Управление аккаунтом">' +
                '<div class="settings-section-title">Аккаунт</div>' +
                '<button class="settings-account-action" id="logoutBtn" type="button">⇄ Выйти и сменить аккаунт</button>' +
            '</section>' +

            '<section class="settings-section settings-danger-zone" aria-label="Опасная зона">' +
                '<div class="settings-section-title">Опасная зона</div>' +
                '<p>Удаление профиля необратимо. Имя и телефон будут удалены, история заказов сохранится без персональных данных.</p>' +
                '<button class="settings-account-action is-danger" id="deleteAccBtn" type="button" aria-expanded="false" aria-controls="deleteConfirmPanel">Удалить аккаунт и данные</button>' +
                '<div class="settings-delete-confirm" id="deleteConfirmPanel" hidden role="group" aria-labelledby="deleteConfirmTitle">' +
                    '<b id="deleteConfirmTitle">Подтвердите удаление</b>' +
                    '<p>Введите слово «УДАЛИТЬ», чтобы подтвердить необратимое действие.</p>' +
                    '<label for="deleteConfirmInput">Подтверждение</label>' +
                    '<input id="deleteConfirmInput" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="УДАЛИТЬ">' +
                    '<div class="settings-delete-actions">' +
                        '<button class="btn ghost" id="deleteCancelBtn" type="button">Отмена</button>' +
                        '<button class="btn danger" id="deleteConfirmBtn" type="button" disabled>Удалить аккаунт</button>' +
                    '</div>' +
                '</div>' +
            '</section>' +
        '</div>';
    document.body.appendChild(modal);

    var card = modal.querySelector('.settings-card');
    var gear = document.getElementById('profileSettingsBtn');
    var overlay = document.getElementById('overlay');
    var closeButton = document.getElementById('setClose');
    var deleteButton = document.getElementById('deleteAccBtn');
    var deletePanel = document.getElementById('deleteConfirmPanel');
    var deleteInput = document.getElementById('deleteConfirmInput');
    var deleteConfirm = document.getElementById('deleteConfirmBtn');

    function syncOverlay() {
        if (typeof window.syncOverlay === 'function') window.syncOverlay();
    }

    function closeDeleteConfirmation() {
        if (deletePanel) deletePanel.hidden = true;
        if (deleteInput) deleteInput.value = '';
        if (deleteConfirm) {
            deleteConfirm.disabled = true;
            deleteConfirm.textContent = 'Удалить аккаунт';
        }
        if (deleteButton) deleteButton.setAttribute('aria-expanded', 'false');
    }

    function openDeleteConfirmation() {
        if (!deletePanel) return;
        deletePanel.hidden = false;
        if (deleteButton) deleteButton.setAttribute('aria-expanded', 'true');
        if (deleteInput) {
            deleteInput.value = '';
            deleteInput.focus();
        }
        if (deleteConfirm) deleteConfirm.disabled = true;
    }

    function updateDeleteConfirmation() {
        if (!deleteInput || !deleteConfirm) return;
        deleteConfirm.disabled = deleteInput.value.trim().toLocaleUpperCase('ru-RU') !== 'УДАЛИТЬ';
    }

    function closeSettings() {
        modal.classList.remove('show');
        syncOverlay();
        if (gear) {
            gear.setAttribute('aria-expanded', 'false');
            gear.focus();
        }
    }

    function openSettings() {
        if (typeof window.syncNotifyAll === 'function') window.syncNotifyAll();
        closeDeleteConfirmation();
        modal.classList.add('show');
        if (gear) gear.setAttribute('aria-expanded', 'true');
        syncOverlay();
        closeButton.focus();
    }

    if (gear) gear.addEventListener('click', openSettings);
    if (closeButton) closeButton.addEventListener('click', closeSettings);

    document.getElementById('setPinGo2').addEventListener('click', function () {
        closeSettings();
        if (typeof window.openSetPin === 'function') {
            window.openSetPin('change', window.me ? window.me.phone : '');
        } else {
            toast('Форма PIN пока недоступна. Обновите приложение.', '⚠️');
        }
    });

    ['ntTg2', 'ntWeb2'].forEach(function (id) {
        document.getElementById(id).addEventListener('change', function () {
            var telegram = document.getElementById('ntTg2');
            var browser = document.getElementById('ntWeb2');
            if (typeof window.applyNotify === 'function') {
                window.applyNotify(!!telegram.checked, !!browser.checked);
            }
        });
    });

    if (deleteInput) deleteInput.addEventListener('input', updateDeleteConfirmation);
    document.getElementById('deleteCancelBtn').addEventListener('click', function () {
        closeDeleteConfirmation();
        if (deleteButton) deleteButton.focus();
    });
    deleteConfirm.addEventListener('click', async function () {
        if (deleteConfirm.disabled || typeof window.performAccountDeletion !== 'function') return;
        deleteConfirm.disabled = true;
        deleteConfirm.textContent = 'Удаляем…';
        var deleted = await window.performAccountDeletion();
        if (!deleted) updateDeleteConfirmation();
    });

    document.addEventListener('click', function (event) {
        if (event.target === overlay && modal.classList.contains('show')) closeSettings();
    }, true);

    document.addEventListener('keydown', function (event) {
        if (!modal.classList.contains('show')) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            if (deletePanel && !deletePanel.hidden) {
                closeDeleteConfirmation();
                if (deleteButton) deleteButton.focus();
            } else {
                closeSettings();
            }
            return;
        }
        if (event.key !== 'Tab') return;
        var focusable = Array.prototype.slice.call(card.querySelectorAll(
            'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
        )).filter(function (element) {
            return !element.closest('[hidden]');
        });
        if (!focusable.length) return;
        var first = focusable[0];
        var last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }, true);

    window.openProfileSettings = openSettings;
    window.closeProfileSettings = closeSettings;
    window.openDeleteAccountConfirmation = openDeleteConfirmation;
    window.__syncSettings = function () {
        if (typeof window.syncNotifyAll === 'function') window.syncNotifyAll();
    };
})();
