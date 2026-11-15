import { Capacitor } from '@capacitor/core';

(function () {
  'use strict';
  var SECTION_ID = 'healthKitProfileSection';
  var profileIsOpen = false;
  var requestInFlight = false;
  var workoutsInFlight = false;
  var submitInFlight = false;
  var selectedWorkout = null;

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
      'Выберите одну из последних пробежек Apple Health. Zerno получит только сводку тренировки, без маршрута и GPS-точек.'));
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
      '#healthKitProfileSection .hk-workouts li{padding:9px 0;border-top:1px solid var(--line)}',
      '#healthKitProfileSection .hk-workout-option{display:flex;align-items:flex-start;gap:10px;cursor:pointer}',
      '#healthKitProfileSection .hk-workout-option span{display:grid;gap:3px}',
      '#healthKitProfileSection .hk-workout-option input{margin-top:3px;accent-color:var(--flame)}',
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
    selectedWorkout = null;
    if (!workouts.length) {
      list.appendChild(el('li', '', 'Недавних пробежек не найдено.'));
      return;
    }
    workouts.forEach(function (workout, index) {
      var item = el('li');
      var label = el('label', 'hk-workout-option');
      var input = el('input');
      input.type = 'radio';
      input.name = 'healthkit-workout';
      input.value = String(index);
      input.addEventListener('change', function () {
        selectedWorkout = workout;
        var submit = section.querySelector('.hk-submit-workout');
        if (submit) submit.disabled = false;
        state(section, 'Выбрана пробежка. Нажмите «Отправить на проверку».');
      });
      label.appendChild(input);
      var details = el('span');
      var date = new Date(workout.startedAt);
      details.appendChild(el('b', '', Number.isNaN(date.getTime()) ? 'Пробежка' :
        new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(date)));
      details.appendChild(el('small', '', (workout.distanceMeters / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 2 }) +
        ' км · ' + Math.round(workout.durationSeconds / 60) + ' мин'));
      details.appendChild(el('small', '', 'Источник: ' + workout.sourceName));
      label.appendChild(details);
      item.appendChild(label);
      list.appendChild(item);
    });
  }

    async function submitWorkouts(section, workout) {
    if (submitInFlight || !workout) return;
    submitInFlight = true;
    actions(section, []);
    state(section, 'Передаём выбранную пробежку на проверку…');
    try {
      var result = await window.api('/fitness/evidence', {
        method: 'POST', body: { activity: workout }
      });
      state(section, result.duplicate
        ? 'Эта пробежка уже отправлялась. Повторная запись не создана.'
        : 'Пробежка отправлена на проверку. Она сохранена как неподтверждённая; награда не начислена.');
      actions(section, [{ label: 'Выбрать другую тренировку', onClick: function () { loadWorkouts(section); } }]);
    } catch (error) {
      state(section, error.message || 'Не удалось отправить тренировку. Попробуйте ещё раз.');
      actions(section, [{ label: 'Повторить отправку', onClick: function () { submitWorkouts(section, workout); } }]);
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
        { label: 'Отправить на проверку', disabled: true, onClick: function () { submitWorkouts(section, selectedWorkout); } },
        { label: 'Обновить список', secondary: true, onClick: function () { loadWorkouts(section); } }
      ]);
      var submitButton = section.querySelector('.hk-actions button');
      if (submitButton) submitButton.classList.add('hk-submit-workout');
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
      if (!result || result.authorizationRequested !== true) {
        state(section, 'Не удалось завершить запрос разрешений Apple Health.');
        actions(section, [{ label: 'Повторить запрос', onClick: function () { requestAccess(section); } }]);
        return;
      }
      // HealthKit deliberately does not expose whether read access was granted.
      // Do not claim permission is granted; let the user explicitly try a read.
      state(section, 'Доступ запрошен. Выберите пробежку из списка.');
      await loadWorkouts(section);
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
      state(section, 'Выберите тренировку из Apple Health. При первом подключении потребуется разрешить доступ.');
      actions(section, [{ label: 'Выбрать тренировку', onClick: function () { requestAccess(section); } }]);
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
