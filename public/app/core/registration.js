/* public/app/core/registration.js — регистрация и подтверждение телефона */
(function () {
  'use strict';


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
        var openTelegramLink = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.openTelegramLink;
        if (typeof openTelegramLink === 'function') openTelegramLink(response.tgUrl);
        else window.open(response.tgUrl, '_blank');
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

  function wait(ms) {
    return new Promise(function(resolve){ setTimeout(resolve, ms); });
  }

  function getRealTelegramMiniApp() {
    var webApp = window.Telegram && window.Telegram.WebApp;
    if (!webApp || webApp.isStub || window.__isTgMiniApp !== true) return null;
    return typeof webApp.initData === 'string' && webApp.initData.length > 0 ? webApp : null;
  }

  function getRegistrationReturnPath() {
    var target = new URL(window.location.href);
    target.searchParams.set('brand', window.brand === 'delivery' ? 'delivery' : 'coffee');
    target.searchParams.delete('auth_token');
    target.searchParams.delete('token');
    target.searchParams.delete('pollToken');
    target.searchParams.delete('ref');
    return target.pathname + target.search + target.hash;
  }

  async function pollTelegramRegistration(pollToken, expiresAt) {
    var deadline = Number(expiresAt) || (Date.now() + 10 * 60 * 1000);
    while (Date.now() < deadline) {
      try {
        if (!localStorage.getItem(TELEGRAM_REGISTRATION_SESSION_KEY)) return;
      } catch (_) {}
      try {
        var result = await api('/auth/check-reg', {
          method: 'POST',
          body: { pollToken: pollToken }
        });
        if (result && result.confirmed && result.token && result.customer) {
          try { localStorage.removeItem(TELEGRAM_REGISTRATION_SESSION_KEY); } catch (_) {}
          try { localStorage.removeItem('zt_src'); } catch (_) {}
          await completeRegistration({ token: result.token, customer: result.customer }, true, { preserveContext: true });
          return;
        }
      } catch (error) {
        if (error && error.code === 400) {
          try { localStorage.removeItem(TELEGRAM_REGISTRATION_SESSION_KEY); } catch (_) {}
          toast(error.message || 'Ссылка подтверждения регистрации устарела. Начните ещё раз.', '⚠️');
          return;
        }
      }
      await wait(document.visibilityState === 'visible' ? 1400 : 4000);
    }
    try { localStorage.removeItem(TELEGRAM_REGISTRATION_SESSION_KEY); } catch (_) {}
    toast('Срок ссылки Telegram истёк. Откройте регистрацию и запросите новую.', '⏳');
  }

  function resumeTelegramRegistration() {
    try {
      var saved = JSON.parse(localStorage.getItem(TELEGRAM_REGISTRATION_SESSION_KEY) || 'null');
      if (saved && /^[a-f0-9]{64}$/.test(String(saved.pollToken || '')) &&
          Number(saved.expiresAt) > Date.now()) {
        pollTelegramRegistration(saved.pollToken, saved.expiresAt);
      } else if (saved) {
        localStorage.removeItem(TELEGRAM_REGISTRATION_SESSION_KEY);
      }
    } catch (_) {}
  }

  async function startTelegramRegistration(button) {
    if (!button || button.disabled) return;
    var form = readRegistrationForm();
    if (!validateRegistrationForm(form)) return;

    var webApp = getRealTelegramMiniApp();
    var telegramPopup = null;
    if (!webApp || typeof webApp.openTelegramLink !== 'function') {
      try { telegramPopup = window.open('about:blank', '_blank'); } catch (_) {}
    }

    beginAuthOperation();
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.textContent = 'Открываем Telegram…';
    try {
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
      if (!response || !response.tgUrl || !/^[a-f0-9]{64}$/.test(String(response.pollToken || ''))) {
        throw new Error('Сервер не подготовил безопасную ссылку Telegram. Повторите попытку.');
      }

      var expiry = response.expiresAt ? Date.parse(response.expiresAt) : Date.now() + 10 * 60 * 1000;
      try {
        localStorage.setItem(TELEGRAM_REGISTRATION_SESSION_KEY, JSON.stringify({
          pollToken: response.pollToken,
          expiresAt: expiry
        }));
      } catch (_) {}

      if (webApp && typeof webApp.openTelegramLink === 'function') {
        webApp.openTelegramLink(response.tgUrl);
        if (telegramPopup && !telegramPopup.closed) telegramPopup.close();
      } else if (telegramPopup && !telegramPopup.closed) {
        telegramPopup.location.replace(response.tgUrl);
      } else {
        window.location.assign(response.tgUrl);
      }
      pollTelegramRegistration(response.pollToken, expiry);
    } catch (error) {
      if (telegramPopup && !telegramPopup.closed) telegramPopup.close();
      if (error && error.code === 409) {
        openExistingProfile(form.phone, 'Номер уже зарегистрирован — войдите в профиль');
      } else {
        toast(error.message || 'Не удалось открыть Telegram. Попробуйте ещё раз.', '⚠️');
      }
    } finally {
      button.disabled = false;
      button.removeAttribute('aria-busy');
      button.textContent = 'Войти через Telegram';
      endAuthOperation();
    }
  }

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
    resumeTelegramRegistration();
    var telegramButton = document.getElementById('regTgBtn');
    if (telegramButton) {
      telegramButton.onclick = function () {
        return startTelegramRegistration(telegramButton);
      };
    }

    var regBtn = document.getElementById('regBtn');
    if (regBtn) {
      regBtn.onclick = function () {
        return submitRegistration(regBtn);
      };
    }

  });
})();
