/* public/app/core/registration.js — регистрация и подтверждение телефона */
(function () {
  'use strict';


  function getRegSource() {
    try { return localStorage.getItem('zt_src') === 'qr' ? 'qr' : ''; } catch (_) { return ''; }
  }

  // Сброс Telegram-подтверждения при закрытии auth-модалки.
  window.resetRegistrationState = function () {
    window.__regTgPollGeneration = (window.__regTgPollGeneration || 0) + 1;
    if (window.__registrationTgPoll) {
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

  document.addEventListener('DOMContentLoaded', function () {
    var regBtn = document.getElementById('regBtn');
    if (regBtn) {
      regBtn.onclick = async function () {
        if (regBtn.disabled) return;
        var name = (document.getElementById('regName') || {}).value.trim();
        var phone = (document.getElementById('regPhone') || {}).value;
        var pin = (document.getElementById('regPin') || {}).value.trim();
        var code = (document.getElementById('regOtp') || {}).value.trim();

        var consentBox = document.getElementById('consentBox');
        if (!consentBox || !consentBox.checked) {
          return toast('Отметь согласие с политикой конфиденциальности', '⚠️');
        }

        if (name.length < 2) return toast('Введите имя', '✍️');
        if (ph10(phone).length < 10) return toast('Введите номер полностью', '📵');
        if (!/^\d{4}$/.test(pin)) return toast('PIN — ровно 4 цифры', '🔐');

        regBtn.disabled = true;
        regBtn.setAttribute('aria-busy', 'true');
        regBtn.textContent = 'Создаём профиль…';
        try {
        if (window.__tgInitData) {
          try {
            var rTg = await api('/auth/tg-link', {
              method: 'POST',
              body: { initData: window.__tgInitData, phone: phone, name: name, pin: pin, consent: 1, src: getRegSource() }
            });
            if (rTg && rTg.needBotConfirm) {
              // Номер сначала подтверждаем в боте, потом повторяем вход.
              toast('Подтвердите номер в боте Telegram, затем нажмите «Продолжить» ещё раз', '🤖');
              var tgOpen = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.openTelegramLink;
              if (typeof tgOpen === 'function') tgOpen(rTg.tgUrl); else window.open(rTg.tgUrl, '_blank');
              return;
            }
            if (rTg && rTg.token && rTg.customer) {
              window.setUser(rTg.token, rTg.customer);
              closeAuth();
              if (typeof renderAll === 'function') renderAll();
              toast(rTg.isNew ? 'Профиль создан! Приветственный напиток и бесплатная доставка — ваши 🎁' : 'Профиль привязан к Telegram ✅', '🎉');
              return;
            }
          } catch (errTg) {
            if (errTg.code === 409) {
              toast('Номер уже зарегистрирован — входим', '🔗');
              var lpTg = document.getElementById('logPhone');
              if (lpTg) lpTg.value = fmtPhone(phone);
              authSwap(true);
              return;
            }
            toast(errTg.message || 'Ошибка регистрации через Telegram', '⚠️');
            return;
          }
        }

        try {
          var r = await api('/auth/register', {
            method: 'POST',
            body: { name: name, phone: phone, pin: pin, code: code, consent: 1, src: getRegSource() }
          });
          try { localStorage.removeItem('zt_src'); } catch (_) {}
          window.setUser(r.token, r.customer);
          closeAuth();
          if (typeof renderAll === 'function') renderAll();
          toast(r.customer.verified
            ? 'Профиль создан! Приветственный напиток и бесплатная доставка — ваши 🎉'
            : 'Профиль создан! Код активации — у кассира, после него приветственный напиток и бесплатная доставка 🎁', '');
        } catch (e) {
          if (e.code === 409) {
            toast('Этот номер уже зарегистрирован — входим', '🔗');
            var lp = document.getElementById('logPhone');
            if (lp) lp.value = fmtPhone(phone);
            authSwap(true);
          } else {
            toast(e.message, '⚠️');
          }
        }
        } finally {
          regBtn.disabled = false;
          regBtn.removeAttribute('aria-busy');
          regBtn.textContent = 'Создать профиль';
        }
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

        if (window.__registrationTgPoll) {
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

          // Лимит поллинга: 60 попыток × 2.5 с ≈ 2.5 мин.
          var regPollTries = 0;
          var pollTimer = setInterval(async function () {
            if (pollGeneration !== window.__regTgPollGeneration || pollBusy) return;
            if (++regPollTries > 60) {
              clearInterval(pollTimer);
              if (window.__registrationTgPoll === pollTimer) window.__registrationTgPoll = null;
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
                clearInterval(pollTimer);
                if (window.__registrationTgPoll === pollTimer) window.__registrationTgPoll = null;
                if (c.token && c.customer) {
                  window.setUser(c.token, c.customer);
                  closeAuth();
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
        }
      };
    }
  });
})();
