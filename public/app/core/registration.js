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

  // Сброс Telegram-подтверждения при закрытии auth-модалки.
  window.resetRegistrationState = function () {
    window.__regTgPollGeneration = (window.__regTgPollGeneration || 0) + 1;
    if (typeof window.__registrationTgPollFinish === 'function') window.__registrationTgPollFinish();
    else if (window.__registrationTgPoll) {
      clearInterval(window.__registrationTgPoll);
      window.__registrationTgPoll = null;
    }
    var row = document.getElementById('regTgRow');
    if (row) {
      row.hidden = true;
      row.className = '';
      row.textContent = '✅ Номер подтверждён — завершите регистрацию';
    }
    var button = document.getElementById('regTgBtn');
    if (button) {
      button.disabled = false;
      button.removeAttribute('aria-busy');
      var label = button.querySelector('span');
      if (label) label.textContent = 'Подтвердить в Telegram · бесплатно';
    }
  };

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

  function completeRegistration(response, message, icon) {
    markAuthResetOnIdle();
    window.setUser(response.token, response.customer);
    closeAuth();
    if (typeof renderAll === 'function') renderAll();
    toast(message, icon);
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
        toast('Подтвердите номер в боте Telegram, затем нажмите «Продолжить» ещё раз', '🤖');
        var openTelegramLink = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.openTelegramLink;
        if (typeof openTelegramLink === 'function') openTelegramLink(response.tgUrl);
        else window.open(response.tgUrl, '_blank');
        return true;
      }

      if (response && response.token && response.customer) {
        var message = response.isNew
          ? 'Профиль создан! Приветственный напиток и бесплатная доставка — ваши 🎁'
          : 'Профиль привязан к Telegram ✅';
        completeRegistration(response, message, '🎉');
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

      var message = response.customer.verified
        ? 'Профиль создан! Приветственный напиток и бесплатная доставка — ваши 🎉'
        : 'Профиль создан! Код активации — у кассира, после него приветственный напиток и бесплатная доставка 🎁';
      completeRegistration(response, message, '');
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

    var regTgBtn = document.getElementById('regTgBtn');
    if (regTgBtn) {
      regTgBtn.onclick = async function () {
        if (regTgBtn.disabled) return;

        var ph = (document.getElementById('regPhone') || {}).value;
        var nm = ((document.getElementById('regName') || {}).value || '').trim();
        var consentBox = document.getElementById('consentBox');
        if (!consentBox || !consentBox.checked) {
          return toast('Сначала подтвердите согласие с политикой конфиденциальности', '⚠️');
        }
        if (ph10(ph).length < 10) return toast('Введите номер полностью', '📵');

        if (typeof window.__registrationTgPollFinish === 'function') window.__registrationTgPollFinish();
        else if (window.__registrationTgPoll) {
          clearInterval(window.__registrationTgPoll);
          window.__registrationTgPoll = null;
        }
        var pollGeneration = (window.__regTgPollGeneration = (window.__regTgPollGeneration || 0) + 1);
        var pollBusy = false;
        var statusRow = document.getElementById('regTgRow');
        if (statusRow) {
          statusRow.hidden = true;
          statusRow.className = '';
          statusRow.textContent = '✅ Номер подтверждён — завершите регистрацию';
        }

        var buttonLabel = regTgBtn.querySelector('span');
        var requestAccepted = false;
        beginAuthOperation();
        regTgBtn.disabled = true;
        regTgBtn.setAttribute('aria-busy', 'true');
        if (buttonLabel) buttonLabel.textContent = 'Отправляем запрос…';

        try {
          var r = await api('/auth/request-reg-otp', {
            method: 'POST',
            body: { phone: ph, name: nm, via: 'tg' }
          });
          if (pollGeneration !== window.__regTgPollGeneration) return;
          requestAccepted = true;

          if (r && r.tgUrl) {
            toast('Открываем Telegram...', '🤖');
            setTimeout(function() { window.location.href = r.tgUrl; }, 250);
          }
          toast('Подтвердите номер в Telegram', '🤖');

          if (statusRow) {
            statusRow.hidden = false;
            statusRow.className = 'auth-tg-pending';
            statusRow.textContent = 'Ожидаем подтверждение в Telegram…';
          }

          // Поллинг остаётся активным после закрытия модалки и завершает вход в фоне.
          // Лимит: 60 попыток × 2.5 с ≈ 2.5 мин.
          var regPollTries = 0;
          var pollFinished = false;
          var pollTimer;
          function finishPoll() {
            if (pollFinished) return;
            pollFinished = true;
            clearInterval(pollTimer);
            if (window.__registrationTgPoll === pollTimer) window.__registrationTgPoll = null;
            if (window.__registrationTgPollFinish === finishPoll) window.__registrationTgPollFinish = null;
            endAuthOperation();
          }
          beginAuthOperation();
          pollTimer = setInterval(async function () {
            if (pollGeneration !== window.__regTgPollGeneration) {
              finishPoll();
              return;
            }
            if (pollBusy) return;
            if (++regPollTries > 60) {
              finishPoll();
              if (pollGeneration === window.__regTgPollGeneration && statusRow) {
                statusRow.hidden = false;
                statusRow.className = 'auth-tg-timeout';
                statusRow.textContent = 'Не получили подтверждение. Отправьте запрос повторно.';
              }
              return;
            }
            pollBusy = true;
            try {
              var c = await api('/auth/check-reg?phone=' + encodeURIComponent(ph));
              if (pollGeneration !== window.__regTgPollGeneration) return;
              if (c && c.confirmed) {
                if (c.token && c.customer) {
                  markAuthResetOnIdle();
                  window.setUser(c.token, c.customer);
                  closeAuth();
                  finishPoll();
                  if (typeof renderAll === 'function') renderAll();
                  toast('Добро пожаловать, ' + c.customer.name + '! Бонусы активированы 🎉', '🎁');
                  return;
                }
                if (statusRow) {
                  statusRow.hidden = false;
                  statusRow.className = 'auth-badge-confirmed';
                  statusRow.textContent = '✅ Номер подтверждён в Telegram';
                }
                toast('Номер подтверждён через Telegram', '🎉');
              }
            } catch (_) {
              // Сетевые ошибки не завершают цикл; следующая попытка повторит запрос.
            } finally {
              pollBusy = false;
            }
          }, 2500);
          window.__registrationTgPoll = pollTimer;
          window.__registrationTgPollFinish = finishPoll;
        } catch (e) {
          if (pollGeneration === window.__regTgPollGeneration) toast(e.message, '⚠️');
        } finally {
          if (pollGeneration === window.__regTgPollGeneration) {
            regTgBtn.disabled = false;
            regTgBtn.removeAttribute('aria-busy');
            if (buttonLabel) {
              buttonLabel.textContent = requestAccepted
                ? 'Отправить повторно в Telegram'
                : 'Подтвердить в Telegram · бесплатно';
            }
          }
          endAuthOperation();
        }
      };
    }
  });
})();
