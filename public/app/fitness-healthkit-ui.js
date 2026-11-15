import { Capacitor } from '@capacitor/core';

(function () {
  'use strict';
  var SECTION_ID = 'healthKitProfileSection';
  var profileIsOpen = false;
  var requestInFlight = false;
  var workoutsInFlight = false;
  var submitInFlight = false;

  function isNativeIOS() {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
  }

  function eligibleGuest() {
    var user = window.me;
    return !!user && user.role === 'guest' &&
      (user.verified === true || user.verified === 1 || user.verified > 0);
  }

  function el(tag, className, text) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = String(text);
    return element;
  }

  function sectionForProfile() {
    var profile = document.getElementById('profileBox');
    if (!profile) return null;
    var section = document.getElementById(SECTION_ID);
    if (section) return section;
    section = el('section', 'profile-brand-section');
    section.id = SECTION_ID;
    section.setAttribute('aria-labelledby', 'healthKitHeading');
    var heading = el('div', 'profile-section-heading');
    var title = el('h4', '', 'Тренировки Apple Health');
    title.id = 'healthKitHeading';
    heading.appendChild(title);
    section.appendChild(heading);
    section.appendChild(el('p', 'hk-copy',
      'Apple Watch синхронизирует пробежки с Apple Health на iPhone. Просмотр и передача сводок выполняются только по вашему действию; переданные записи не подтверждают подлинность автоматически.'));
    section.appendChild(el('p', 'hk-state', 'Проверяем Apple Health…'));
    section.appendChild(el('div', 'hk-actions'));
    section.appendChild(el('ul', 'hk-workouts'));
    var history = profile.querySelector('.profile-history-section');
    if (history) profile.insertBefore(section, history);
    else profile.appendChild(section);
    addStyles();
    return section;
  }

  function addStyles() {
    if (document.getElementById('healthKitProfileStyles')) return;
    var style = el('style');
    style.id = 'healthKitProfileStyles';
    style.textContent = [
      '#profileBox > #healthKitProfileSection{display:grid;gap:10px}',
      '#healthKitProfileSection .hk-copy,#healthKitProfileSection .hk-state{margin:0;color:var(--soft);font-size:12px;line-height:1.5}',
      '#healthKitProfileSection .hk-actions{display:flex;flex-wrap:wrap;gap:8px}',
      '#healthKitProfileSection .hk-actions button{min-height:44px;padding:9px 13px;border:1px solid var(--line);border-radius:12px;background:var(--flame);color:#fff;font-size:12px;font-weight:800}',
      '#healthKitProfileSection .hk-actions button.secondary{background:transparent;color:var(--ink)}',
      '#healthKitProfileSection .hk-workouts{display:grid;gap:8px;margin:0;padding:0;list-style:none}',
      '#healthKitProfileSection .hk-workouts li{display:grid;gap:3px;padding:9px 0;border-top:1px solid var(--line)}',
      '#healthKitProfileSection .hk-workouts small{color:var(--soft);font-size:11px}',
      '#healthKitProfileSection [hidden]{display:none!important}',
      '@media(max-width:380px){#healthKitProfileSection .hk-actions{display:grid;grid-template-columns:1fr}#healthKitProfileSection .hk-actions button{width:100%}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function state(section, message) {
    var target = section.querySelector('.hk-state');
    if (target) target.textContent = message;
  }

  function actions(section, items) {
    var host = section.querySelector('.hk-actions');
    host.replaceChildren();
    items.forEach(function (item) {
      var button = el('button', item.secondary ? 'secondary' : '', item.label);
      button.type = 'button';
      button.disabled = !!item.disabled;
      button.addEventListener('click', item.onClick);
      host.appendChild(button);
    });
  }

  function renderWorkouts(section, workouts) {
    var list = section.querySelector('.hk-workouts');
    list.replaceChildren();
    if (!workouts.length) {
      list.appendChild(el('li', '', 'Недавних пробежек не найдено.'));
      return;
    }
    workouts.forEach(function (workout) {
      var item = el('li');
      var date = new Date(workout.startedAt);
      item.appendChild(el('b', '', Number.isNaN(date.getTime()) ? 'Пробежка' :
        new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(date)));
      item.appendChild(el('small', '', (workout.distanceMeters / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 2 }) +
        ' км · ' + Math.round(workout.durationSeconds / 60) + ' мин'));
      item.appendChild(el('small', '', 'Источник: ' + workout.sourceName + ' · ' + workout.sourcePackageName));
      list.appendChild(item);
    });
  }

  async function submitWorkouts(section, workouts) {
    if (submitInFlight || !workouts.length) return;
    submitInFlight = true;
    actions(section, []);
    state(section, 'Передаём сводки на сервер. Они сохранятся как неподтверждённые доказательства.');
    var accepted = 0, duplicates = 0, rejected = 0;
    try {
      for (var i = 0; i < workouts.length; i += 1) {
        try {
          var result = await window.api('/fitness/evidence', {
            method: 'POST', body: { activity: workouts[i] }
          });
          if (result.duplicate) duplicates += 1;
          else accepted += 1;
        } catch (error) {
          rejected += 1;
          if (error && error.status === 429) break;
        }
      }
      state(section, 'Отправлено: ' + accepted + ', уже было: ' + duplicates +
        ', не принято: ' + rejected + '. Все записи остаются unverified; награды не начислены.');
      actions(section, [{ label: 'Обновить тренировки', secondary: true, onClick: function () { loadWorkouts(section); } }]);
    } finally {
      submitInFlight = false;
    }
  }

  async function loadWorkouts(section) {
    if (workoutsInFlight) return;
    workoutsInFlight = true;
    actions(section, []);
    state(section, 'Читаем недавние тренировки Apple Health…');
    try {
      var workouts = await window.ZernoHealthKit.getRecentRunningWorkouts({ days: 30, limit: 25 });
      if (!document.getElementById(SECTION_ID)) return;
      renderWorkouts(section, workouts);
      state(section, 'Найдено тренировок: ' + workouts.length + '. Это device_reported, а не подтверждение источника.');
      actions(section, [
        { label: 'Отправить сводки на проверку', onClick: function () { submitWorkouts(section, workouts); } },
        { label: 'Обновить тренировки', secondary: true, onClick: function () { loadWorkouts(section); } }
      ]);
    } catch (error) {
      state(section, error.message || 'Не удалось прочитать Apple Health.');
      actions(section, [{ label: 'Повторить', onClick: function () { loadWorkouts(section); } }]);
    } finally {
      workoutsInFlight = false;
    }
  }

  async function requestAccess(section) {
    if (requestInFlight) return;
    requestInFlight = true;
    actions(section, []);
    state(section, 'Откройте системный запрос Apple Health и разрешите чтение тренировок.');
    try {
      var result = await window.ZernoHealthKit.requestAuthorization();
      if (!result || result.authorized !== true) {
        state(section, 'Не удалось подтвердить доступ. Проверьте разрешения Apple Health в настройках iPhone.');
        actions(section, [{ label: 'Повторить запрос', onClick: function () { requestAccess(section); } }]);
        return;
      }
      state(section, 'Доступ к тренировкам разрешён.');
      actions(section, [{ label: 'Загрузить последние тренировки', onClick: function () { loadWorkouts(section); } }]);
    } catch (error) {
      state(section, error.message || 'Не удалось запросить доступ к Apple Health.');
      actions(section, [{ label: 'Повторить', onClick: function () { requestAccess(section); } }]);
    } finally {
      requestInFlight = false;
    }
  }

  async function render() {
    if (!profileIsOpen || !isNativeIOS()) return;
    var section = sectionForProfile();
    if (!section) return;
    section.hidden = !eligibleGuest();
    if (section.hidden || section.dataset.checked === '1') return;
    section.dataset.checked = '1';
    try {
      var availability = await window.ZernoHealthKit.isAvailable();
      if (!availability.available) {
        state(section, 'Apple Health недоступен на этом устройстве.');
        actions(section, []);
        return;
      }
      state(section, 'Apple Health доступен. Разрешения запрашиваются только по вашему действию.');
      actions(section, [{ label: 'Подключить Apple Health', onClick: function () { requestAccess(section); } }]);
    } catch (error) {
      state(section, error.message || 'Не удалось проверить Apple Health.');
    }
  }

  if (window.ztBus && typeof window.ztBus.on === 'function') {
    window.ztBus.on('profile:opened', function () {
      profileIsOpen = true;
      var section = document.getElementById(SECTION_ID);
      if (section) section.dataset.checked = '';
      render();
    });
    window.ztBus.on('profile:rendered', function () { render(); });
    window.ztBus.on('profile:closed', function () {
      profileIsOpen = false;
      var section = document.getElementById(SECTION_ID);
      if (!section) return;
      section.dataset.checked = '';
      section.querySelector('.hk-workouts').replaceChildren();
      actions(section, []);
      state(section, 'Сводка тренировок очищена из интерфейса при закрытии профиля.');
    });
  }
})();
