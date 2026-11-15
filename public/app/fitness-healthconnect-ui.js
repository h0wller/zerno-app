import { Capacitor } from '@capacitor/core';

(function () {
  'use strict';

  var SECTION_ID = 'healthConnectProfileSection';
  var requestInFlight = false;
  var workoutsInFlight = false;
  var profileIsOpen = false;

  function isNativeAndroid() {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  }

  function isEligibleGuest() {
    var customer = window.me;
    return !!customer && customer.role === 'guest' &&
      (customer.verified === true || customer.verified === 1 || customer.verified > 0);
  }

  function node(tag, className, text) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined && text !== null) element.textContent = String(text);
    return element;
  }

  function addStyles() {
    if (document.getElementById('healthConnectProfileStyles')) return;
    var style = node('style');
    style.id = 'healthConnectProfileStyles';
    style.textContent = [
      '#profileBox > #healthConnectProfileSection { display:grid; gap:10px; }',
      '#healthConnectProfileSection .hc-copy { margin:0; color:var(--soft); font-size:12px; line-height:1.5; }',
      '#healthConnectProfileSection .hc-state { color:var(--soft); font-size:12px; line-height:1.5; }',
      '#healthConnectProfileSection .hc-actions { display:flex; flex-wrap:wrap; gap:8px; }',
      '#healthConnectProfileSection .hc-actions button { min-height:44px; padding:9px 13px; border:var(--profile-btn-border,1px solid var(--line)); border-radius:var(--profile-btn-radius,12px); background:var(--profile-btn-bg,var(--flame)); color:var(--profile-btn-color,#fff); font-size:12px; font-weight:800; cursor:pointer; }',
      '#healthConnectProfileSection .hc-actions button.secondary { border:var(--profile-btn-secondary-border,1px solid var(--line)); background:var(--profile-btn-secondary-bg,#fff); color:var(--profile-btn-secondary-color,var(--ink)); box-shadow:none; }',
      '#healthConnectProfileSection .hc-workouts { display:grid; gap:8px; margin:0; padding:0; list-style:none; }',
      '#healthConnectProfileSection .hc-workouts li { display:grid; gap:3px; padding:9px 0; border-top:1px solid var(--line); }',
      '#healthConnectProfileSection .hc-workouts small { color:var(--soft); font-size:11px; }',
      '#healthConnectProfileSection button:focus-visible { outline:2px solid var(--profile-focus-ring,var(--flame)); outline-offset:3px; }',
      '#healthConnectProfileSection [hidden] { display:none !important; }',
      '@media(max-width:380px){#healthConnectProfileSection .hc-actions{display:grid;grid-template-columns:1fr}#healthConnectProfileSection .hc-actions button{width:100%}}',
      '@media(prefers-reduced-motion:reduce){#healthConnectProfileSection *{transition:none!important}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function getSection() {
    var profile = document.getElementById('profileBox');
    if (!profile) return null;
    addStyles();
    var section = document.getElementById(SECTION_ID);
    if (section) return section;

    section = node('section', 'profile-brand-section');
    section.id = SECTION_ID;
    section.setAttribute('aria-labelledby', 'healthConnectHeading');
    var heading = node('div', 'profile-section-heading');
    var title = node('h4', '', 'Тренировки Android');
    title.id = 'healthConnectHeading';
    heading.appendChild(title);
    section.appendChild(heading);
    section.appendChild(node('p', 'hc-copy',
      'Подключите Health Connect и просмотрите пробежки. Передача сводок на сервер выполняется отдельно, только после вашего нажатия. До проверки источника награда не начисляется.'));
    section.appendChild(node('p', 'hc-state', 'Проверяем доступность Health Connect…'));
    section.appendChild(node('div', 'hc-actions'));
    section.appendChild(node('ul', 'hc-workouts'));
    var history = profile.querySelector('.profile-history-section');
    if (history) profile.insertBefore(section, history);
    else profile.appendChild(section);
    return section;
  }

  function setState(section, message) {
    var state = section && section.querySelector('.hc-state');
    if (state) state.textContent = message;
  }

  function setActions(section, actions) {
    var container = section && section.querySelector('.hc-actions');
    if (!container) return;
    container.replaceChildren();
    actions.forEach(function (action) {
      var button = node('button', action.secondary ? 'secondary' : '', action.label);
      button.type = 'button';
      button.disabled = !!action.disabled;
      button.addEventListener('click', action.onClick);
      container.appendChild(button);
    });
  }

  function renderWorkouts(section, workouts) {
    var list = section.querySelector('.hc-workouts');
    if (!list) return;
    list.replaceChildren();
    if (!workouts.length) {
      list.appendChild(node('li', '', 'Недавних пробежек не найдено.'));
      return;
    }
    workouts.forEach(function (workout) {
      var item = node('li');
      var date = new Date(workout.startedAt);
      var label = Number.isNaN(date.getTime()) ? 'Пробежка'
        : new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
      item.appendChild(node('b', '', label));
      item.appendChild(node('small', '', (workout.distanceMeters / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 2 }) +
        ' км · ' + Math.round(workout.durationSeconds / 60) + ' мин'));
      item.appendChild(node('small', '', 'Источник: ' + workout.sourcePackageName +
        ' · запись: ' + workout.recordingMethod));
      list.appendChild(item);
    });
  }

  async function loadWorkouts(section) {
    if (workoutsInFlight) return;
    workoutsInFlight = true;
    setState(section, 'Читаем недавние тренировки…');
    setActions(section, []);
    try {
      var workouts = await window.ZernoHealthConnect.getRecentRunningWorkouts({ days: 30, limit: 25 });
      if (!document.getElementById(SECTION_ID)) return;
      renderWorkouts(section, workouts);
      setState(section, 'Найдено тренировок: ' + workouts.length +
        '. Это данные устройства, а не серверная проверка; награды не начисляются.');
      setActions(section, [
        {
          label: 'Отправить сводки на проверку',
          onClick: function () { submitWorkouts(section, workouts); }
        },
        {
          label: 'Обновить тренировки',
          secondary: true,
          onClick: function () { loadWorkouts(section); }
        }
      ]);
    } catch (error) {
      setState(section, error.message || 'Не удалось прочитать тренировки.');
      setActions(section, [
        { label: 'Повторить загрузку', secondary: true, onClick: function () { loadWorkouts(section); } },
        { label: 'Проверить разрешения', onClick: function () { requestAccess(section); } }
      ]);
    } finally {
      workoutsInFlight = false;
    }
  }

  async function submitWorkouts(section, workouts) {
    if (!Array.isArray(workouts) || !workouts.length) {
      setState(section, 'Нет тренировок для отправки.');
      return;
    }
    setActions(section, []);
    setState(section, 'Отправляем сводки тренировок. Они сохранятся как неподтверждённые доказательства.');
    var accepted = 0;
    var duplicates = 0;
    var rejected = 0;
    for (var i = 0; i < workouts.length; i += 1) {
      try {
        var result = await window.api('/fitness/evidence', {
          method: 'POST',
          body: { activity: workouts[i] }
        });
        if (result.duplicate) duplicates += 1;
        else accepted += 1;
      } catch (error) {
        rejected += 1;
        if (error && error.status === 429) break;
      }
    }
    setState(section, 'Отправлено: ' + accepted + ', уже было: ' + duplicates +
      ', не принято: ' + rejected + '. Все принятые записи остаются unverified; награды не начислены.');
    setActions(section, [
      { label: 'Обновить тренировки', secondary: true, onClick: function () { loadWorkouts(section); } }
    ]);
  }

  async function requestAccess(section) {
    if (requestInFlight) return;
    requestInFlight = true;
    setState(section, 'Откройте системный экран Health Connect и разрешите чтение тренировок и дистанции.');
    setActions(section, []);
    try {
      var result = await window.ZernoHealthConnect.requestAuthorization();
      if (!result.allGranted) {
        setState(section, 'Доступ предоставлен не полностью. Для чтения пробежек нужны разрешения на тренировки и дистанцию.');
        setActions(section, [{ label: 'Повторить запрос разрешений', onClick: function () { requestAccess(section); } }]);
        return;
      }
      setState(section, 'Доступ к тренировкам и дистанции разрешён.');
      setActions(section, [{ label: 'Загрузить последние тренировки', onClick: function () { loadWorkouts(section); } }]);
    } catch (error) {
      setState(section, error.message || 'Не удалось запросить разрешения Health Connect.');
      setActions(section, [{ label: 'Повторить', onClick: function () { requestAccess(section); } }]);
    } finally {
      requestInFlight = false;
    }
  }

  async function render() {
    if (!profileIsOpen || !isNativeAndroid()) return;
    var section = getSection();
    if (!section) return;
    section.hidden = !isEligibleGuest();
    var customerId = String(window.me && window.me.id || '');
    if (section.hidden) return;
    if (section.dataset.customerId !== customerId) {
      section.dataset.customerId = customerId;
      section.dataset.checked = '';
      section.querySelector('.hc-workouts').replaceChildren();
    }
    if (section.dataset.checked === '1') return;
    section.dataset.checked = '1';
    try {
      var availability = await window.ZernoHealthConnect.isAvailable();
      if (!availability.available) {
        setState(section, availability.status === 'provider_update_required'
          ? 'Для подключения обновите приложение Health Connect на устройстве.'
          : 'Health Connect недоступен на этом устройстве.');
        setActions(section, []);
        return;
      }
      var permissions = await window.ZernoHealthConnect.getPermissionState();
      if (permissions.allGranted) {
        setState(section, 'Доступ к тренировкам и дистанции разрешён.');
        setActions(section, [{ label: 'Загрузить последние тренировки', onClick: function () { loadWorkouts(section); } }]);
      } else {
        setState(section, 'Health Connect доступен. Разрешения запрашиваются только по вашему действию.');
        setActions(section, [{ label: 'Подключить Health Connect', onClick: function () { requestAccess(section); } }]);
      }
    } catch (error) {
      setState(section, error.message || 'Не удалось проверить Health Connect.');
    }
  }

  if (window.ztBus && typeof window.ztBus.on === 'function') {
    window.ztBus.on('profile:rendered', function () { render(); });
    window.ztBus.on('profile:opened', function () {
      profileIsOpen = true;
      var section = document.getElementById(SECTION_ID);
      if (section) section.dataset.checked = '';
      render();
    });
    window.ztBus.on('profile:closed', function () {
      profileIsOpen = false;
      var section = document.getElementById(SECTION_ID);
      if (!section) return;
      section.dataset.checked = '';
      var list = section.querySelector('.hc-workouts');
      if (list) list.replaceChildren();
      setActions(section, []);
      setState(section, 'Сводка тренировок очищена из интерфейса при закрытии профиля.');
    });
  }
})();
