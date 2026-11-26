import { openTelegramLink } from './telegram-link.js';

/* public/app/core/registration.js — регистрация и подтверждение телефона */
(function () {
  'use strict';


  function getRegistrationReturnPath() {
    if (typeof window.getAppReturnPath === 'function') return window.getAppReturnPath(window.brand);
    var fallback = new URL(window.location.href);
    ['auth_token', 'access_token', 'token', 'pollToken', 'ref'].forEach(function (key) {
      fallback.searchParams.delete(key);
    });
    fallback.searchParams.set('brand', window.brand === 'delivery' ? 'delivery' : 'coffee');
    return fallback.pathname + fallback.search + fallback.hash;
  }

  function getRegSource() {
    try { return localStorage.getItem('zt_src') === 'qr' ? 'qr' : ''; } catch (_) { return ''; }
  }

  function beginAuthOperation() {
    if (typeof window.beginAuthOperation === 'function') window.beginAuthOperation();
  }

  function endAuthOperation() {
    if (typeof window.endAuthOperation === 'function') window.endAuthOperation();
  }

  function markAuthResetOnIdle() {
    if (typeof window.markAuthResetOnIdle === 'function') window.markAuthResetOnIdle();
  }

  function readRegistrationForm() {
    return {
      name: (document.getElementById('regName') || {}).value.trim(),
      phone: (document.getElementById('regPhone') || {}).value,
      pin: (document.getElementById('regPin') || {}).value.trim(),
    };
  }

  function validateRegistrationForm(form) {
    var consentBox = document.getElementById('consentBox');
    if (!consentBox || !consentBox.checked) {
      toast('Отметь согласие с политикой конфиденциальности', '⚠️');
      return false;
    }
    if (form.name.length < 2) {
      toast('Введите имя', '✍️');
      return false;
    }
    if (ph10(form.phone).length < 10) {
      toast('Введите номер полностью', '📵');
      return false;
    }
    if (!/^\d{4}$/.test(form.pin)) {
      toast('PIN — ровно 4 цифры', '🔐');
      return false;
    }
    return true;
  }

  function setRegistrationButtonBusy(button, busy) {
    button.disabled = busy;
    if (busy) {
      button.setAttribute('aria-busy', 'true');
      button.textContent = 'Создаём профиль…';
      return;
    }
    button.removeAttribute('aria-busy');
    button.textContent = 'Создать профиль';
  }

  function customerIsVerified(customer) {
    return !!customer && (
      customer.verified === true ||
      customer.verified === 1 ||
      Number(customer.verified) > 0
    );
  }

  function openProfileAfterAuth() {
    if (typeof window.openPanel === 'function') window.openPanel();
  }

  async function getFreeDeliveryStatus() {
    try {
      var response = await api('/me/free-delivery');
      return {
        known: true,
        available: !!(response && typeof response.code === 'string' && response.code.trim())
      };
    } catch (_) {
      return { known: false, available: false };
    }
  }

  async function completeRegistration(response, isNew, options) {
    var customer = response && response.customer;
    if (!response || !response.token || !customer) {
      throw new Error('Сервер не подтвердил создание профиля. Повторите попытку.');
    }

    markAuthResetOnIdle();
    window.setUser(response.token, customer);
    var modal = document.getElementById('authModal');
    if (modal && modal.classList.contains('show')) closeAuth();
    if (typeof window.__profileMeReady === 'function') window.__profileMeReady();
    if (typeof renderAll === 'function') renderAll();
    if (typeof window.renderProfile === 'function') window.renderProfile();
    if (typeof window.renderVerifyNote === 'function') window.renderVerifyNote();

    if (options && options.preserveContext) {
      toast('Регистрация завершена. Вы вернулись в приложение.', '✅');
      return;
    }

    if (!customerIsVerified(customer)) {
      openProfileAfterAuth();
      var pendingMessage = 'Профиль создан, но пока не активирован. В профиле откройте «Инструкция по активации» и выберите Telegram или код кассира.';
      toast(pendingMessage, '🔒');
      return;
    }

    if (window.brand !== 'delivery') {
      openProfileAfterAuth();
      var freeCoffees = Math.max(0, Number(customer.free) || 0);
      var coffeePrefix = isNew === false
        ? 'С возвращением, ' + String(customer.name || 'гость') + '.'
        : 'Профиль кофейни активирован.';
      var coffeeMessage = coffeePrefix + ' Карта штампов открыта в профиле. ';
      coffeeMessage += freeCoffees > 0
        ? 'На карте ' + freeCoffees + ' ' + (freeCoffees === 1 ? 'бесплатный кофе. ' : 'бесплатных кофе. ')
        : 'На карте сейчас нет доступного бесплатного кофе. За покупки начисляются штампы: 10 штампов дают 1 бесплатный кофе. ';
      coffeeMessage += 'Покажите QR на карте кассиру для начисления штампа или получения подарка.';
      toast(coffeeMessage, '☕');
      return;
    }

    var deliveryStatus = await getFreeDeliveryStatus();
    if (typeof window.closePanel === 'function') window.closePanel();

    var deliveryPrefix = isNew === false
      ? 'С возвращением, ' + String(customer.name || 'гость') + '.'
      : 'Профиль «Пятницы» активирован.';
    var deliveryMessage = deliveryPrefix + ' Ваши заказы сохраняются в профиле. ';
    if (deliveryStatus.available) {
      deliveryMessage += 'Бесплатная первая доставка доступна: персональный код применится автоматически в корзине, результат будет виден в строке доставки и итоговой сумме.';
    } else if (deliveryStatus.known) {
      deliveryMessage += 'Персональный код бесплатной первой доставки сейчас не назначен. Корзина не применит этот бонус.';
    } else {
      deliveryMessage += 'Статус бесплатной первой доставки пока не удалось проверить. Корзина перепроверит его при открытии — заранее обещать бонус нельзя.';
    }
    toast(deliveryMessage, '🍕');
  }

  function openExistingProfile(phone, message) {
    toast(message, '🔗');
    var loginPhone = document.getElementById('logPhone');
    if (loginPhone) loginPhone.value = fmtPhone(phone);
    authSwap(true);
  }

  async function registerThroughTelegram(form) {
    try {
      var response = await api('/auth/tg-link', {
        method: 'POST',
        body: {
          initData: window.__tgInitData,
          phone: form.phone,
          name: form.name,
          pin: form.pin,
          consent: 1,
          src: getRegSource()
        }
      });

      if (response && response.needBotConfirm) {
        // Номер сначала подтверждаем в боте, потом повторяем вход.
        toast('Подтвердите номер в боте Telegram, затем вернитесь в приложение и продолжите регистрацию', '🤖');
        await openTelegramLink(response.tgUrl);
        return true;
      }

      if (response && response.token && response.customer) {
        await completeRegistration(response, response.isNew === true ? true : response.isNew === false ? false : undefined);
        return true;
      }

      return false;
    } catch (error) {
      if (error.code === 409) {
        openExistingProfile(form.phone, 'Номер уже зарегистрирован — входим');
      } else {
        toast(error.message || 'Ошибка регистрации через Telegram', '⚠️');
      }
      return true;
    }
  }

  var TELEGRAM_REGISTRATION_SESSION_KEY = 'zt_tg_registration';
  var telegramRegistrationGeneration = 0;
  var activeTelegramRegistration = null;
  var registrationTelegramUi = { state: 'idle', message: '', url: '' };

  function wait(ms) {
    return new Promise(function(resolve){ setTimeout(resolve, ms); });
  }

  function authSessionRevision() {
    return Number(window.__authSessionRevision) || 0;
  }

  function readSavedTelegramAttempt() {
    try {
      return JSON.parse(localStorage.getItem(TELEGRAM_REGISTRATION_SESSION_KEY) || 'null');
    } catch (_) {
      return null;
    }
  }

  function writeSavedTelegramAttempt(attempt) {
    try {
      localStorage.setItem(TELEGRAM_REGISTRATION_SESSION_KEY, JSON.stringify({
        pollToken: attempt.pollToken,
        expiresAt: attempt.expiresAt,
        authSessionRevision: attempt.authSessionRevision,
        sessionToken: attempt.sessionToken
      }));
      return true;
    } catch (_) {
      return false;
    }
  }

  function clearSavedTelegramAttempt(pollToken) {
    var saved = readSavedTelegramAttempt();
    if (!pollToken || !saved || saved.pollToken === pollToken) {
      try { localStorage.removeItem(TELEGRAM_REGISTRATION_SESSION_KEY); } catch (_) {}
    }
  }

  function setRegistrationTelegramState(state, message, url) {
    registrationTelegramUi = {
      state: state,
      message: message || '',
      url: url || ''
    };
    var status = document.getElementById('regTgStatus');
    if (!status) return;
    status.dataset.state = state;
    status.hidden = state === 'idle' || (!message && !url);
    status.textContent = '';
    if (message) {
      var text = document.createElement('span');
      text.textContent = message;
      status.appendChild(text);
    }
    if (url) {
      var link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Открыть Telegram';
      status.appendChild(link);
    }
  }

  function isCurrentTelegramAttempt(attempt) {
    if (!attempt || activeTelegramRegistration !== attempt ||
        attempt.generation !== telegramRegistrationGeneration) return false;
    var saved = readSavedTelegramAttempt();
    return !!(saved && saved.pollToken === attempt.pollToken);
  }

  function stopTelegramRegistrationPoll(reason, expectedRevision) {
    var attempt = activeTelegramRegistration;
    if (!attempt) return false;
    if (typeof expectedRevision === 'number' && attempt.authSessionRevision === expectedRevision) return false;
    telegramRegistrationGeneration += 1;
    activeTelegramRegistration = null;
    clearSavedTelegramAttempt(attempt.pollToken);
    if (reason === 'session-change') {
      setRegistrationTelegramState('error', 'Сессия изменилась. Начните регистрацию через Telegram заново.');
      toast('Сессия изменилась — ожидающая регистрация отменена.', '⚠️');
    }
    return true;
  }

  function startTelegramRegistrationPoll(attempt) {
    if (!isCurrentTelegramAttempt(attempt)) return;
    pollTelegramRegistration(attempt);
  }

  async function pollTelegramRegistration(attempt) {
    while (Date.now() < attempt.expiresAt) {
      if (!isCurrentTelegramAttempt(attempt)) return;
      if (authSessionRevision() !== attempt.authSessionRevision ||
          (window.USER_TOKEN || null) !== attempt.sessionToken) {
        stopTelegramRegistrationPoll('session-change');
        return;
      }

      try {
        var result = await api('/auth/check-reg', {
          method: 'POST',
          body: { pollToken: attempt.pollToken }
        });

        if (!isCurrentTelegramAttempt(attempt)) return;
        if (authSessionRevision() !== attempt.authSessionRevision ||
            (window.USER_TOKEN || null) !== attempt.sessionToken) {
          stopTelegramRegistrationPoll('session-change');
          return;
        }

        if (result && result.confirmed && result.token && result.customer) {
          activeTelegramRegistration = null;
          clearSavedTelegramAttempt(attempt.pollToken);
          try { localStorage.removeItem('zt_src'); } catch (_) {}
          setRegistrationTelegramState('confirmed', 'Номер подтверждён. Профиль готов.');
          await completeRegistration(
            { token: result.token, customer: result.customer },
            true,
            { preserveContext: true }
          );
          return;
        }
        setRegistrationTelegramState('waiting', 'Откройте бота и поделитесь своим номером.', registrationTelegramUi.url);
      } catch (error) {
        if (!isCurrentTelegramAttempt(attempt)) return;
        if (error && error.code === 400) {
          activeTelegramRegistration = null;
          clearSavedTelegramAttempt(attempt.pollToken);
          setRegistrationTelegramState('expired', 'Ссылка Telegram устарела. Запросите новую.');
          return;
        }
        // A transient network failure must not consume the active attempt.
        setRegistrationTelegramState('waiting', 'Не удалось проверить ответ Telegram. Повторяем проверку…', registrationTelegramUi.url);
      }

      await wait(document.visibilityState === 'visible' ? 1400 : 4000);
    }

    if (!isCurrentTelegramAttempt(attempt)) return;
    activeTelegramRegistration = null;
    clearSavedTelegramAttempt(attempt.pollToken);
    setRegistrationTelegramState('expired', 'Срок ссылки Telegram истёк. Запросите новую.');
    toast('Срок ссылки Telegram истёк. Откройте регистрацию и запросите новую.', '⏳');
  }

  function resumeTelegramRegistration() {
    var saved = readSavedTelegramAttempt();
    if (!saved) return;
    if (!/^[a-f0-9]{64}$/.test(String(saved.pollToken || '')) ||
        !Number.isFinite(Number(saved.expiresAt)) || Number(saved.expiresAt) <= Date.now()) {
      clearSavedTelegramAttempt();
      setRegistrationTelegramState('expired', 'Ссылка Telegram устарела. Запросите новую.');
      return;
    }
    if (Number(saved.authSessionRevision) !== authSessionRevision() ||
        (saved.sessionToken || null) !== (window.USER_TOKEN || null)) {
      clearSavedTelegramAttempt(saved.pollToken);
      setRegistrationTelegramState('error', 'Сессия изменилась. Начните регистрацию через Telegram заново.');
      toast('Сессия изменилась — ожидающая регистрация отменена.', '⚠️');
      return;
    }

    telegramRegistrationGeneration += 1;
    var attempt = {
      pollToken: saved.pollToken,
      expiresAt: Number(saved.expiresAt),
      authSessionRevision: Number(saved.authSessionRevision) || 0,
      sessionToken: saved.sessionToken || null,
      generation: telegramRegistrationGeneration
    };
    activeTelegramRegistration = attempt;
    setRegistrationTelegramState('waiting', 'Откройте бота и поделитесь своим номером.');
    startTelegramRegistrationPoll(attempt);
  }

  async function startTelegramRegistration(button) {
    if (!button) return;
    var form = readRegistrationForm();
    if (!validateRegistrationForm(form)) return;

    // A new click supersedes the previous attempt, including an in-flight poll.
    if (activeTelegramRegistration) {
      telegramRegistrationGeneration += 1;
      activeTelegramRegistration = null;
    }
    clearSavedTelegramAttempt();
    var generation = ++telegramRegistrationGeneration;
    var revision = authSessionRevision();
    var sessionToken = window.USER_TOKEN || null;
    var attempt = null;

    beginAuthOperation();
    button.setAttribute('aria-busy', 'true');
    button.textContent = 'Открываем Telegram…';
    setRegistrationTelegramState('requesting', 'Подготавливаем ссылку Telegram…');

    try {
      var navigation = await openTelegramLink(async function () {
        var response = await api('/auth/request-reg-otp', {
          method: 'POST',
          body: {
            name: form.name,
            phone: form.phone,
            pin: form.pin,
            consent: 1,
            via: 'tg',
            returnTo: getRegistrationReturnPath(),
            src: getRegSource()
          }
        });

        if (generation !== telegramRegistrationGeneration ||
            revision !== authSessionRevision() ||
            sessionToken !== (window.USER_TOKEN || null)) {
          throw new Error('Сессия изменилась — повторите регистрацию через Telegram.');
        }
        if (!response || !response.tgUrl || !/^[a-f0-9]{64}$/.test(String(response.pollToken || ''))) {
          throw new Error('Сервер не подготовил безопасную ссылку Telegram. Повторите попытку.');
        }

        var expiry = response.expiresAt ? Date.parse(response.expiresAt) : Date.now() + 10 * 60 * 1000;
        if (!Number.isFinite(expiry) || expiry <= Date.now()) {
          throw new Error('Срок ссылки Telegram уже истёк. Запросите новую.');
        }
        attempt = {
          pollToken: response.pollToken,
          expiresAt: expiry,
          authSessionRevision: revision,
          sessionToken: sessionToken,
          generation: generation
        };
        if (!writeSavedTelegramAttempt(attempt)) {
          throw new Error('Не удалось сохранить состояние Telegram-регистрации. Разрешите локальное хранилище и повторите.');
        }
        activeTelegramRegistration = attempt;
        return response.tgUrl;
      });

      if (!attempt || generation !== telegramRegistrationGeneration ||
          revision !== authSessionRevision() ||
          sessionToken !== (window.USER_TOKEN || null)) {
        if (attempt) clearSavedTelegramAttempt(attempt.pollToken);
        throw new Error('Сессия изменилась — повторите регистрацию через Telegram.');
      }

      setRegistrationTelegramState(
        'waiting',
        'Откройте бота и поделитесь своим номером.',
        navigation && navigation.blocked ? navigation.url : ''
      );
      startTelegramRegistrationPoll(attempt);
    } catch (error) {
      if (attempt) clearSavedTelegramAttempt(attempt.pollToken);
      if (generation === telegramRegistrationGeneration) {
        activeTelegramRegistration = null;
        var isExpired = /истёк|устарела/i.test(String(error && error.message || ''));
        setRegistrationTelegramState(isExpired ? 'expired' : 'error', error.message || 'Не удалось открыть Telegram. Повторите попытку.');
      }
      if (error && error.code === 409) {
        openExistingProfile(form.phone, 'Номер уже зарегистрирован — войдите в профиль');
      } else {
        toast(error.message || 'Не удалось открыть Telegram. Попробуйте ещё раз.', '⚠️');
      }
    } finally {
      button.removeAttribute('aria-busy');
      button.textContent = 'Зарегистрироваться через Telegram';
      endAuthOperation();
    }
  }

  if (window.ztBus && typeof window.ztBus.on === 'function') {
    window.ztBus.on('auth:user-changed', function () {
      var attempt = activeTelegramRegistration;
      if (attempt && activeTelegramRegistration === attempt &&
          authSessionRevision() !== attempt.authSessionRevision &&
          registrationTelegramUi.state !== 'confirmed') {
        stopTelegramRegistrationPoll('session-change');
      }
    });
  }
  window.addEventListener('storage', function (event) {
    if (!event || event.key !== 'zt_tg_registration') return;
    var attempt = activeTelegramRegistration;
    var saved = readSavedTelegramAttempt();
    if (attempt && (!saved || saved.pollToken !== attempt.pollToken)) {
      telegramRegistrationGeneration += 1;
      activeTelegramRegistration = null;
    }
  });

  async function registerByPhone(form) {
    try {
      var response = await api('/auth/register', {
        method: 'POST',
        body: {
          name: form.name,
          phone: form.phone,
          pin: form.pin,
          consent: 1,
          src: getRegSource()
        }
      });
      try { localStorage.removeItem('zt_src'); } catch (_) {}

      await completeRegistration(response, true);
    } catch (error) {
      if (error.code === 409) {
        openExistingProfile(form.phone, 'Этот номер уже зарегистрирован — входим');
      } else {
        toast(error.message, '⚠️');
      }
    }
  }

  async function submitRegistration(button) {
    if (button.disabled) return;
    var form = readRegistrationForm();
    if (!validateRegistrationForm(form)) return;

    beginAuthOperation();
    setRegistrationButtonBusy(button, true);
    try {
      if (window.__tgInitData) {
        var handledByTelegram = await registerThroughTelegram(form);
        if (handledByTelegram) return;
      }
      await registerByPhone(form);
    } finally {
      setRegistrationButtonBusy(button, false);
      endAuthOperation();
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var telegramButton = document.getElementById('regTgBtn');
    if (telegramButton) {
      telegramButton.onclick = function () {
        return startTelegramRegistration(telegramButton);
      };
    }

    resumeTelegramRegistration();
    var regBtn = document.getElementById('regBtn');
    if (regBtn) {
      regBtn.onclick = function () {
        return submitRegistration(regBtn);
      };
    }

  });
})();
