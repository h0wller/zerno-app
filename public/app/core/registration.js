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
      code: (document.getElementById('regOtp') || {}).value.trim()
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

  async function completeRegistration(response, isNew) {
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

    if (!customerIsVerified(customer)) {
      openProfileAfterAuth();
      var pendingMessage = window.brand === 'delivery'
        ? 'Профиль создан, но номер ещё не подтверждён. Заказы станут доступны после активации: получите 4-значный код у кассира и введите его в профиле.'
        : 'Профиль создан, но номер ещё не подтверждён. Получите 4-значный код у кассира и введите его в профиле. До активации преимущества не доступны.';
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

  async function registerByPhone(form) {
    try {
      var response = await api('/auth/register', {
        method: 'POST',
        body: {
          name: form.name,
          phone: form.phone,
          pin: form.pin,
          code: form.code,
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
    var regBtn = document.getElementById('regBtn');
    if (regBtn) {
      regBtn.onclick = function () {
        return submitRegistration(regBtn);
      };
    }

    function syncSmsRegistrationUi() {
      var smsButton = document.getElementById('regOtpBtn');
      var smsRow = document.getElementById('regOtpRow');
      var enabled = window.SMS_AUTH_ENABLED === true;
      if (smsButton) smsButton.hidden = !enabled;
      if (!enabled && smsRow) smsRow.hidden = true;
    }

    window.addEventListener('app:config-loaded', syncSmsRegistrationUi);
    syncSmsRegistrationUi();

    var regOtpBtn = document.getElementById('regOtpBtn');
    if (regOtpBtn) {
      regOtpBtn.onclick = async function () {
        if (regOtpBtn.disabled || window.SMS_AUTH_ENABLED !== true) return;
        var phone = (document.getElementById('regPhone') || {}).value || '';
        var name = ((document.getElementById('regName') || {}).value || '').trim();
        if (ph10(phone).length < 10) return toast('Введите номер полностью', '📵');

        beginAuthOperation();
        regOtpBtn.disabled = true;
        regOtpBtn.setAttribute('aria-busy', 'true');
        regOtpBtn.textContent = 'Отправляем SMS…';
        try {
          await api('/auth/request-reg-otp', {
            method: 'POST',
            body: { phone: phone, name: name, via: 'sms' }
          });
          var row = document.getElementById('regOtpRow');
          var input = document.getElementById('regOtp');
          if (row) row.hidden = false;
          if (input) input.focus();
          toast('Код отправлен по SMS', '🔑');
        } catch (error) {
          toast(error.message || 'Не удалось отправить SMS', '⚠️');
        } finally {
          regOtpBtn.disabled = false;
          regOtpBtn.removeAttribute('aria-busy');
          regOtpBtn.textContent = 'Отправить код по SMS повторно';
          endAuthOperation();
        }
      };
    }

  });
})();
