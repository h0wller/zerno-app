/* public/app/core/registration.js — регистрация и подтверждение телефона */
(function () {
  'use strict';

  var regPoll = null;
  var regPollGeneration = 0;

  function getRegSource() {
    try { return localStorage.getItem('zt_src') === 'qr' ? 'qr' : ''; } catch (_) { return ''; }
  }

  // Вызывается владельцем auth-модалки при закрытии, чтобы не оставлять polling между сессиями.
  window.resetRegistrationState = function () {
    // Инвалидируем и таймер, и любой уже выполняющийся запрос.
    regPollGeneration += 1;
    if (regPoll) { clearInterval(regPoll); regPoll = null; }
    var row = document.getElementById('regTgRow');
    if (row) {
      row.hidden = true;
      row.className = '';
      row.innerHTML = '✅ Номер подтверждён — завершите регистрацию';
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    var regBtn = document.getElementById('regBtn');
    if (regBtn) {
      regBtn.onclick = async function () {
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
      };
    }

    var regTgBtn = document.getElementById('regTgBtn');
    if (regTgBtn) {
      regTgBtn.onclick = async function () {
        // Новый запуск отменяет предыдущий цикл и все его ожидающие ответы.
        if (regPoll) { clearInterval(regPoll); regPoll = null; }
        var pollGeneration = ++regPollGeneration;
        var pollBusy = false;
        var ph = (document.getElementById('regPhone') || {}).value;
        var nm = ((document.getElementById('regName') || {}).value || '').trim();
        var consentBox = document.getElementById('consentBox');
        if (!consentBox || !consentBox.checked) {
          return toast('Сначала подтвердите согласие с политикой конфиденциальности', '⚠️');
        }
        if (ph10(ph).length < 10) return toast('Введите номер полностью', '📵');
        try {
          var r = await api('/auth/request-reg-otp', {
            method: 'POST',
            body: { phone: ph, name: nm, via: 'tg' }
          });
          if (pollGeneration !== regPollGeneration) return;
          if (r && r.tgUrl) {
            toast('Открываем Telegram...', '🤖');
            setTimeout(function() { window.location.href = r.tgUrl; }, 250);
          }
          toast('Подтвердите номер в Telegram', '🤖');

          // Лимит поллинга: 60 попыток × 2.5 с ≈ 2.5 мин.
          var regPollTries = 0;
          regPoll = setInterval(async function () {
            if (pollGeneration !== regPollGeneration || pollBusy) return;
            if (++regPollTries > 60) {
              clearInterval(regPoll);
              if (pollGeneration === regPollGeneration) regPoll = null;
              return;
            }
            pollBusy = true;
            try {
              var c = await api('/auth/check-reg?phone=' + encodeURIComponent(ph));
              // Модалка могла закрыться, пока запрос выполнялся.
              if (pollGeneration !== regPollGeneration) return;
              if (c && c.confirmed) {
                clearInterval(regPoll);
                regPoll = null;
                if (c.token && c.customer) {
                  window.setUser(c.token, c.customer);
                  closeAuth();
                  if (typeof renderAll === 'function') renderAll();
                  toast('Добро пожаловать, ' + c.customer.name + '! Бонусы активированы 🎉', '🎁');
                  return;
                }
                var row = document.getElementById('regTgRow');
                if (row) {
                  row.hidden = false;
                  row.className = 'auth-badge-confirmed';
                  row.innerHTML = '<span>✅ Номер подтверждён в Telegram</span>';
                }
                toast('Номер подтверждён через Telegram', '🎉');
              }
            } catch (_) {
              // Сетевые ошибки не завершают цикл; следующая попытка повторит запрос.
            } finally {
              pollBusy = false;
            }
          }, 2500);
        } catch (e) {
          if (pollGeneration === regPollGeneration) toast(e.message, '⚠️');
        }
      };
    }
  });
})();
