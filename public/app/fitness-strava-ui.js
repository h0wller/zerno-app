/* public/app/fitness-strava-ui.js — private, read-only Strava profile section */
(function () {
  'use strict';

  var CONSENT_VERSION = '2026-11-14-v1';
  var SECTION_ID = 'stravaProfileSection';
  var inFlight = false;
  var activitiesLoaded = false;
  var status = null;

  function injectStyles() {
    if (document.getElementById('stravaProfileStyles')) return;
    var style = document.createElement('style');
    style.id = 'stravaProfileStyles';
    style.textContent = [
      '#profileBox > #stravaProfileSection { display:grid; gap:10px; }',
      '#stravaProfileSection .strava-wordmark { color:var(--soft); font-size:10px; font-weight:700; white-space:nowrap; }',
      '#stravaProfileSection .strava-copy { margin:0; color:var(--soft); font-size:12px; line-height:1.5; }',
      '#stravaProfileSection .strava-state { color:var(--soft); font-size:12px; line-height:1.45; }',
      '#stravaProfileSection .strava-actions { display:flex; flex-wrap:wrap; gap:8px; }',
      '#stravaProfileSection .strava-actions button { min-height:44px; padding:9px 13px; border:var(--profile-btn-border,1px solid var(--line)); border-radius:var(--profile-btn-radius,12px); background:var(--profile-btn-bg,var(--flame)); color:var(--profile-btn-color,#fff); font-size:12px; font-weight:800; cursor:pointer; }',
      '#stravaProfileSection .strava-actions button.secondary { border:var(--profile-btn-secondary-border,1px solid var(--line)); background:var(--profile-btn-secondary-bg,#fff); color:var(--profile-btn-secondary-color,var(--ink)); box-shadow:none; }',
      '#stravaProfileSection button:focus-visible, #stravaProfileSection a:focus-visible, #stravaProfileSection input:focus-visible { outline:2px solid var(--profile-focus-ring,var(--flame)); outline-offset:3px; }',
      '#stravaProfileSection .strava-consent { display:grid; gap:9px; padding:12px; border:1px solid var(--line); border-radius:12px; background:var(--profile-surface,#fff); }',
      '#stravaProfileSection .strava-consent p { margin:0; color:var(--soft); font-size:12px; line-height:1.5; }',
      '#stravaProfileSection .strava-consent label { display:flex; align-items:flex-start; gap:8px; font-size:12px; line-height:1.4; }',
      '#stravaProfileSection .strava-consent input { margin-top:2px; flex:0 0 auto; }',
      '#stravaProfileSection .strava-activities { display:grid; gap:0; margin:0; padding:0; list-style:none; }',
      '#stravaProfileSection .strava-activity { display:grid; gap:4px; padding:10px 0; border-top:1px solid var(--line); min-width:0; }',
      '#stravaProfileSection .strava-activity b { font-size:12.5px; overflow-wrap:anywhere; }',
      '#stravaProfileSection .strava-activity small { color:var(--soft); font-size:11.5px; line-height:1.45; }',
      '#stravaProfileSection .strava-link { color:var(--profile-link,var(--flame)); font-size:11.5px; text-decoration:underline; text-underline-offset:3px; }',
      '#stravaProfileSection [hidden] { display:none !important; }',
      '@media (max-width:380px) { #stravaProfileSection .strava-actions { display:grid; grid-template-columns:1fr; } #stravaProfileSection .strava-actions button { width:100%; } }',
      '@media (prefers-reduced-motion:reduce) { #stravaProfileSection * { transition:none !important; } }'
    ].join('\n');
    document.head.appendChild(style);
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function button(text, className, handler) {
    var node = el('button', className || '', text);
    node.type = 'button';
    node.addEventListener('click', handler);
    return node;
  }

  function formatDistance(meters) {
    var value = Number(meters);
    if (!Number.isFinite(value) || value < 0) return '—';
    return value >= 1000 ? (value / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 2 }) + ' км'
      : Math.round(value) + ' м';
  }

  function formatDuration(seconds) {
    var value = Math.max(0, Math.round(Number(seconds) || 0));
    var hours = Math.floor(value / 3600);
    var minutes = Math.floor((value % 3600) / 60);
    return hours ? hours + ' ч ' + String(minutes).padStart(2, '0') + ' мин' : minutes + ' мин';
  }

  function formatDate(value) {
    var date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Дата не указана'
      : new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }

  function getSection() {
    var profile = document.getElementById('profileBox');
    if (!profile) return null;
    var section = document.getElementById(SECTION_ID);
    if (!section) {
      section = el('section', 'profile-brand-section');
      section.id = SECTION_ID;
      section.setAttribute('aria-labelledby', 'stravaHeading');
      var heading = el('div', 'profile-section-heading');
      heading.appendChild(el('h4', '', 'Спортивные активности'));
      heading.firstElementChild.id = 'stravaHeading';
      heading.appendChild(el('span', 'strava-wordmark', 'Powered by Strava'));
      section.appendChild(heading);
      section.appendChild(el('p', 'strava-copy',
        'Подключите аккаунт Strava, чтобы смотреть свои тренировки в профиле. Данные доступны только вам и не используются для начисления кофе или других наград.'));
      section.appendChild(el('div', 'strava-state', 'Проверяем подключение…'));
      section.appendChild(el('div', 'strava-content', ''));
      var history = profile.querySelector('.profile-history-section');
      if (history) profile.insertBefore(section, history);
      else profile.appendChild(section);
    }
    return section;
  }

  function stateNode(section) {
    return section && section.querySelector('.strava-state');
  }

  function contentNode(section) {
    return section && section.querySelector('.strava-content');
  }

  function setState(section, message) {
    var state = stateNode(section);
    if (state) state.textContent = message || '';
  }

  function setContent(section, node) {
    var content = contentNode(section);
    if (!content) return;
    content.replaceChildren();
    if (node) content.appendChild(node);
  }

  async function refreshStatus(section) {
    if (inFlight) return;
    inFlight = true;
    setState(section, 'Проверяем подключение…');
    try {
      status = await window.api('/fitness/strava/status');
      if (!document.getElementById(SECTION_ID)) return;
      if (!status.enabled) {
        setState(section, 'Подключение Strava пока выключено на сервере.');
        setContent(section, null);
        return;
      }
      if (!status.connected) {
        setState(section, 'Аккаунт Strava не подключён.');
        renderConnect(section);
        return;
      }
      setState(section, 'Аккаунт Strava подключён. Тренировки загружаются только по вашему запросу.');
      renderConnected(section);
    } catch (error) {
      status = null;
      setState(section, error.message || 'Не удалось проверить подключение Strava.');
      setContent(section, null);
    } finally {
      inFlight = false;
    }
  }

  function renderConnect(section) {
    var actions = el('div', 'strava-actions');
    actions.appendChild(button('Подключить Strava', '', function () {
      showConsent(section);
    }));
    setContent(section, actions);
  }

  async function showConsent(section) {
    if (inFlight) return;
    inFlight = true;
    setState(section, 'Загружаем условия подключения…');
    try {
      var response = await window.api('/fitness/strava/consent');
      if (!response.enabled) {
        setState(section, 'Подключение Strava пока выключено на сервере.');
        setContent(section, null);
        return;
      }
      var notice = response.notice || {};
      var panel = el('div', 'strava-consent');
      panel.appendChild(el('p', '', 'Будет запрошен только доступ activity:read: ваши активности с видимостью «Все» и «Подписчики». Закрытые активности «Только вы» не запрашиваются.'));
      if (Array.isArray(notice.data) && notice.data.length) {
        var dataList = el('ul');
        notice.data.forEach(function (field) { dataList.appendChild(el('li', '', field)); });
        panel.appendChild(dataList);
      }
      panel.appendChild(el('p', '', notice.collection || 'Тренировки запрашиваются из Strava по вашему действию.'));
      panel.appendChild(el('p', '', notice.purpose || 'Данные показываются только в вашем профиле.'));
      panel.appendChild(el('p', '', notice.storage || 'Список тренировок и маршруты не сохраняются.'));
      panel.appendChild(el('p', '', notice.withdrawal || 'Разрешение можно отозвать в настройках Strava или в Zerno App.'));
      panel.appendChild(el('p', '', notice.deletion || 'При отключении локальная связь и токены удаляются.'));
      var links = el('p');
      var stravaLink = el('a', 'strava-link', 'Настройки приложений Strava');
      stravaLink.href = 'https://www.strava.com/settings/apps';
      stravaLink.target = '_blank';
      stravaLink.rel = 'noopener noreferrer';
      links.appendChild(stravaLink);
      links.appendChild(document.createTextNode(' · Поддержка Zerno App — через чат приложения.'));
      panel.appendChild(links);

      var label = el('label');
      var checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.addEventListener('change', function () { continueButton.disabled = !checkbox.checked; });
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(' Я прочитал условия и разрешаю Zerno App получать данные моих тренировок из Strava.'));
      panel.appendChild(label);

      var actions = el('div', 'strava-actions');
      var continueButton = button('Продолжить на Strava', '', async function () {
        if (!checkbox.checked || continueButton.disabled) return;
        var popup = window.open('about:blank', '_blank');
        continueButton.disabled = true;
        setState(section, 'Подготавливаем безопасное подключение…');
        try {
          var result = await window.api('/fitness/strava/connect', {
            method: 'POST',
            body: { consent: true, consentVersion: CONSENT_VERSION }
          });
          if (!result.authorizationUrl || !/^https:\/\/www\.strava\.com\/oauth\/authorize\?/.test(result.authorizationUrl)) {
            if (popup && !popup.closed) popup.close();
            throw new Error('Сервер вернул некорректный адрес авторизации.');
          }
          if (popup && !popup.closed) {
            popup.opener = null;
            popup.location.replace(result.authorizationUrl);
          } else {
            window.location.assign(result.authorizationUrl);
          }
          setState(section, 'Завершите разрешение доступа на сайте Strava, затем вернитесь в приложение.');
        } catch (error) {
          if (popup && !popup.closed) popup.close();
          continueButton.disabled = false;
          setState(section, error.message || 'Не удалось начать подключение.');
        }
      });
      continueButton.disabled = true;
      actions.appendChild(continueButton);
      actions.appendChild(button('Отмена', 'secondary', function () {
        setContent(section, null);
        setState(section, 'Аккаунт Strava не подключён.');
        renderConnect(section);
      }));
      panel.appendChild(actions);
      setContent(section, panel);
      setState(section, 'Перед подключением подтвердите согласие на обработку данных.');
    } catch (error) {
      setState(section, error.message || 'Не удалось загрузить условия Strava.');
      setContent(section, null);
    } finally {
      inFlight = false;
    }
  }

  function renderConnected(section) {
    var actions = el('div', 'strava-actions');
    actions.appendChild(button('Показать тренировки', '', function () {
      loadActivities(section);
    }));
    actions.appendChild(button('Отключить Strava', 'secondary', async function () {
      if (!window.confirm('Отключить Strava и удалить сохранённые токены Zerno App?')) return;
      if (inFlight) return;
      inFlight = true;
      try {
        var result = await window.api('/fitness/strava/disconnect', { method: 'POST' });
        status = { enabled: true, connected: false };
        activitiesLoaded = false;
        setContent(section, null);
        setState(section, result.revoked
          ? 'Strava отключена. Разрешение отозвано.'
          : 'Локальная связь удалена. Strava не подтвердила отзыв; при необходимости удалите Zerno App в настройках Strava.');
        renderConnect(section);
      } catch (error) {
        setState(section, error.message || 'Не удалось отключить Strava.');
      } finally {
        inFlight = false;
      }
    }));
    setContent(section, actions);
  }

  async function loadActivities(section) {
    if (inFlight) return;
    inFlight = true;
    activitiesLoaded = false;
    setState(section, 'Запрашиваем ваши последние тренировки из Strava…');
    try {
      var result = await window.api('/fitness/strava/activities?page=1&per_page=10');
      var list = el('ul', 'strava-activities');
      var records = Array.isArray(result.activities) ? result.activities : [];
      if (!records.length) {
        list.appendChild(el('li', 'strava-activity', 'Тренировок для показа пока нет.'));
      }
      records.forEach(function (activity) {
        var item = el('li', 'strava-activity');
        var title = String(activity.name || activity.sportType || activity.type || 'Тренировка');
        item.appendChild(el('b', '', title));
        var kind = activity.sportType || activity.type || 'Активность';
        item.appendChild(el('small', '', kind + ' · ' + formatDate(activity.startedAt)));
        var details = formatDistance(activity.distanceMeters) + ' · движение ' + formatDuration(activity.movingTimeSeconds);
        item.appendChild(el('small', '', details));
        if (/^\\d{1,24}$/.test(String(activity.id || ''))) {
          var source = el('a', 'strava-link', 'View on Strava');
          source.href = 'https://www.strava.com/activities/' + String(activity.id);
          source.target = '_blank';
          source.rel = 'noopener noreferrer';
          item.appendChild(source);
        }
        list.appendChild(item);
      });
      setContent(section, list);
      setState(section, records.length
        ? 'Показаны последние ' + records.length + ' тренировок. Список не сохраняется в Zerno App.'
        : 'Список не сохраняется в Zerno App.');
      activitiesLoaded = true;
    } catch (error) {
      setState(section, error.message || 'Не удалось загрузить тренировки.');
      setContent(section, null);
    } finally {
      inFlight = false;
    }
  }

  function render() {
    var customer = window.me;
    var section = getSection();
    if (!section) return;
    var eligible = !!customer && customer.role === 'guest' &&
      (customer.verified === true || customer.verified === 1 || customer.verified > 0);
    section.hidden = !eligible;
    if (!eligible) {
      setContent(section, null);
      return;
    }
    if (section.dataset.customerId !== String(customer.id)) {
      section.dataset.customerId = String(customer.id);
      status = null;
      activitiesLoaded = false;
      refreshStatus(section);
      return;
    }
    if (!status) refreshStatus(section);
  }

  var originalRender = window.renderProfile;
  if (typeof originalRender === 'function' && !originalRender.__stravaWrapped) {
    var wrappedRender = function () {
      var result = originalRender.apply(this, arguments);
      render();
      return result;
    };
    wrappedRender.__stravaWrapped = true;
    window.renderProfile = wrappedRender;
  }

  if (window.ztBus && typeof window.ztBus.on === 'function') {
    window.ztBus.on('auth:user-changed', function () { render(); });
  }

  document.addEventListener('DOMContentLoaded', render, { once: true });
  if (document.readyState !== 'loading') render();

  var initialSearch = window.__initialSearch || location.search;
  var result = new URLSearchParams(initialSearch).get('strava');
  if (result === 'connected') {
    window.toast && window.toast('Strava подключена. Откройте профиль и загрузите тренировки.', '✓');
  } else if (result === 'denied') {
    window.toast && window.toast('Доступ Strava не предоставлен.', 'ℹ');
  } else if (result === 'error') {
    window.toast && window.toast('Не удалось подключить Strava. Начните заново.', '⚠');
  }
})();
