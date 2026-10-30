/* public/app/ui/settings.js — настройки профиля и управление аккаунтом. */
(function () {
  'use strict';

  if (document.getElementById('settingsModal')) return;

  var modal = document.createElement('div');
  modal.className = 'modal';
  modal.id = 'settingsModal';
  modal.innerHTML =
    '<div class="modal-card settings-card" style="width:min(420px,100%)">' +
      '<button class="mclose" id="setClose" type="button" aria-label="Закрыть настройки">✕</button>' +
      '<h3>Настройки</h3>' +
      '<div class="msub">Безопасность, уведомления и аккаунт</div>' +

      '<section class="settings-section" aria-label="Безопасность и уведомления">' +
        '<div class="set-row">' +
          '<span>🔐 PIN-код</span>' +
          '<button class="btn ghost" id="setPinGo2" type="button">Изменить</button>' +
        '</div>' +
        '<div class="settings-section-title">Каналы уведомлений</div>' +
        '<div class="settings-channel-row">' +
          '<label class="chk"><input type="checkbox" id="ntTg2"> 🤖 Telegram</label>' +
          '<label class="chk"><input type="checkbox" id="ntWeb2"> 🔔 Браузер</label>' +
        '</div>' +
      '</section>' +

      '<section class="settings-section settings-account-section" aria-label="Управление аккаунтом">' +
        '<div class="settings-section-title">Аккаунт</div>' +
        '<button class="settings-account-action" id="logoutBtn" type="button">⇄ Выйти и сменить аккаунт</button>' +
        '<button class="settings-account-action is-danger" id="deleteAccBtn" type="button">Удалить аккаунт и данные</button>' +
      '</section>' +
    '</div>';
  document.body.appendChild(modal);

  var overlay = document.getElementById('overlay');
  var profileHead = document.querySelector('#profileBox .phead');

  function afterClose() {
    if (!overlay) return;
    var anotherModalOpen = !!document.querySelector('.modal.show:not(#settingsModal)');
    var panel = document.getElementById('panel');
    var panelOpen = !!(panel && panel.classList.contains('open'));

    if (anotherModalOpen) {
      overlay.classList.add('show', 'ov-high');
    } else if (panelOpen) {
      overlay.classList.add('show');
      overlay.classList.remove('ov-high');
    } else {
      overlay.classList.remove('show', 'ov-high');
    }
  }

  function closeSettings() {
    modal.classList.remove('show');
    afterClose();
  }

  function openSettings() {
    if (typeof window.syncNotifyAll === 'function') window.syncNotifyAll();
    modal.classList.add('show');
    if (overlay) overlay.classList.add('show', 'ov-high');
  }

  var gear = document.createElement('button');
  gear.type = 'button';
  gear.className = 'gear';
  gear.textContent = '⚙️';
  gear.title = 'Настройки профиля';
  gear.setAttribute('aria-label', 'Настройки профиля');
  gear.addEventListener('click', openSettings);
  if (profileHead) profileHead.appendChild(gear);

  document.getElementById('setClose').addEventListener('click', closeSettings);
  document.getElementById('setPinGo2').addEventListener('click', function () {
    closeSettings();
    var pinButton = document.getElementById('setPinBtn');
    if (pinButton) pinButton.click();
  });

  ['ntTg2', 'ntWeb2'].forEach(function (id) {
    var input = document.getElementById(id);
    input.addEventListener('change', function () {
      var tg = document.getElementById('ntTg2');
      var web = document.getElementById('ntWeb2');
      if (typeof window.applyNotify === 'function') {
        window.applyNotify(!!tg.checked, !!web.checked);
      }
    });
  });

  document.addEventListener('click', function (event) {
    if (event.target !== overlay || !modal.classList.contains('show')) return;
    event.stopPropagation();
    closeSettings();
  }, true);

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && modal.classList.contains('show')) closeSettings();
  }, true);

  window.__syncSettings = function () {
    if (typeof window.syncNotifyAll === 'function') window.syncNotifyAll();
  };

  var pinButton = document.getElementById('setPinBtn');
  if (pinButton) pinButton.style.display = 'none';
  var legacyNotifyDetails = document.getElementById('notifyDetails');
  if (legacyNotifyDetails) legacyNotifyDetails.style.display = 'none';
})();
