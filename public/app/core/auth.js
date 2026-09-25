/* public/app/core/auth.js — Ф5.3: кластер авторизации (регистрация, вход, PIN, бренд-адаптация) */
(function () {
  'use strict';

  var loginMode = 'pin';
  var setPinCtx = null;
  var regPoll = null;

  function armPw() {
    ['regPin', 'logPin', 'logOtp', 'setPinInput', 'pinInput'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.type = 'password';
    });
  }

  /* ── Брендовая адаптация модалки (Вариант 3) ── */
  /* ── Брендовая адаптация модалки ── */
  function applyAuthBrand() {
    var isDeliv = (typeof brand !== 'undefined' && brand === 'delivery');
    var modal = document.getElementById('authModal');
    if (!modal) return;

    var logoContainer = modal.querySelector('.alogo');
    if (logoContainer) {
      if (isDeliv) {
        // Пятница: без рамки, крупно, на всю ширину контейнера
        logoContainer.style.background = 'transparent';
        logoContainer.style.border = 'none';
        logoContainer.style.boxShadow = 'none';
        logoContainer.style.width = '140px';
        logoContainer.style.height = 'auto';
        logoContainer.style.margin = '0 auto 12px';
        logoContainer.innerHTML = '<img src="friday-logo.svg" alt="Пятница" style="width:100%;height:auto;object-fit:contain;display:block;">';
      } else {
        // Кофейня: на белом фоне в аккуратном квадрате с скруглением
        logoContainer.style.background = '#FFFFFF';
        logoContainer.style.border = '1.5px solid var(--line, #D8DFE4)';
        logoContainer.style.boxShadow = '0 6px 20px rgba(18, 58, 107, 0.12)';
        logoContainer.style.width = '66px';
        logoContainer.style.height = '66px';
        logoContainer.style.margin = '0 auto 16px';
        logoContainer.innerHTML = '<img src="andCoffee.svg" alt="…и кофе" style="width:75%;height:75%;object-fit:contain;display:block;margin:auto;">';
      }
    }

    var msub = modal.querySelector('.msub');
    if (msub) {
      msub.innerHTML = isDeliv
        ? 'Единый профиль: сохранение адресов, подарки от 2 000 ₽ и штампы на кофе у моря.'
        : 'Копите зёрна на бесплатный кофе на кассе и заказывайте пиццу с подарками и сохранёнными адресами.';
    }
  }

  function openAuth(login) {
    if (typeof login === 'undefined') login = false;
    armPw();
    applyAuthBrand();

    var am = document.getElementById('authModal');
    if (am) am.classList.add('show');

    var rf = document.getElementById('regForm');
    var lf = document.getElementById('loginForm');
    var at = document.getElementById('authTitle');

    if (rf) rf.style.display = login ? 'none' : 'flex';
    if (lf) lf.style.display = login ? 'flex' : 'none';
    if (at) at.textContent = login ? 'Вход по номеру' : 'Создайте профиль';

    if (typeof syncOverlay === 'function') syncOverlay();
    setTimeout(function () {
      var target = login ? document.getElementById('logPhone') : document.getElementById('regName');
      if (target) target.focus();
    }, 180);
  }

  function closeAuth() {
    var am = document.getElementById('authModal');
    if (am) am.classList.remove('show');
    if (typeof syncOverlay === 'function') syncOverlay();
  }

  function authSwap(login) {
    applyAuthBrand();
    var rf = document.getElementById('regForm');
    var lf = document.getElementById('loginForm');
    var at = document.getElementById('authTitle');

    if (rf) rf.style.display = login ? 'none' : 'flex';
    if (lf) lf.style.display = login ? 'flex' : 'none';
    if (at) at.textContent = login ? 'Вход по номеру' : 'Создайте профиль';

    if (login) {
      loginMode = 'pin';
      var pr = document.getElementById('logPinRow');
      if (pr) pr.style.display = '';
      var ow = document.getElementById('logOtpWrap');
      if (ow) ow.style.display = 'none';
      var bk = document.getElementById('otpBackRow');
      if (bk) bk.style.display = 'none';
      var lb = document.getElementById('logBtn');
      if (lb) lb.textContent = 'Войти';
    }
  }

  function setUser(token, customer) {
    window.USER_TOKEN = token;
    if (token) localStorage.setItem('zt_user', token);
    else localStorage.removeItem('zt_user');

    window.me = customer;
    window.historyLoaded = false;
    window.lastChatId = 0;

    if (typeof initChatPointer === 'function') initChatPointer();
    if (typeof showBadge === 'function') showBadge();

    window.onboarded = true;
    localStorage.setItem('zt_onb', '1');

    var qm = document.getElementById('qrMini');
    var qmain = document.getElementById('qrMain');
    if (customer && customer.qr && typeof drawQR === 'function') {
      if (qm) drawQR(qm, customer.qr);
      if (qmain) drawQR(qmain, customer.qr);
    }

    var fcmT = localStorage.getItem('zt_fcm_token');
    if (fcmT && customer && typeof api === 'function') {
      api('/push/fcm', { method: 'POST', body: { token: fcmT } }).catch(function () {});
    }
  }

  function openSetPin(mode, phone) {
    armPw();
    setPinCtx = { mode: mode, phone: phone || '' };
    var inp = document.getElementById('setPinInput');
    if (inp) inp.value = '';

    var spm = document.getElementById('setPinModal');
    if (spm) {
      var msub = spm.querySelector('.msub');
      if (msub) {
        msub.innerHTML = mode === 'claim'
          ? 'Этот профиль создан до введения PIN.<br>Придумайте 4 цифры — это ваш ключ для входа.<br>Или запросите код в Telegram ниже.'
          : 'Придумайте или смените PIN (4 цифры).<br>Понадобится, если Telegram будет недоступен.';
      }
      var alt = document.getElementById('setPinOtp');
      if (alt) alt.style.display = mode === 'claim' ? '' : 'none';
      spm.classList.add('show');
    }

    if (typeof syncOverlay === 'function') syncOverlay();
    setTimeout(function () {
      var el = document.getElementById('setPinInput');
      if (el) el.focus();
    }, 150);
  }

  function closeSetPin() {
    setPinCtx = null;
    var spm = document.getElementById('setPinModal');
    if (spm) spm.classList.remove('show');
    if (typeof syncOverlay === 'function') syncOverlay();
  }

  /* ── Инициализация слушателей при загрузке DOM ── */
  document.addEventListener('DOMContentLoaded', function () {
    var toLogin = document.getElementById('toLogin');
    if (toLogin) toLogin.onclick = function () { authSwap(true); };

    var toReg = document.getElementById('toReg');
    if (toReg) toReg.onclick = function () { authSwap(false); };

    var skipAuth = document.getElementById('skipAuth');
    if (skipAuth) {
      skipAuth.onclick = function () {
        window.onboarded = true;
        localStorage.setItem('zt_onb', '1');
        closeAuth();
        if (typeof toast === 'function') toast('Можно смотреть меню. Профиль — по кнопке с аватаром', '👀');
      };
    }

    var regBtn = document.getElementById('regBtn');
    if (regBtn) {
      regBtn.onclick = async function () {
        var name = (document.getElementById('regName') || {}).value.trim();
        var phone = (document.getElementById('regPhone') || {}).value;
        var pin = (document.getElementById('regPin') || {}).value.trim();
        var code = (document.getElementById('regOtp') || {}).value.trim();

        if (name.length < 2) return toast('Введите имя', '✍️');
        if (ph10(phone).length < 10) return toast('Введите номер полностью', '📵');
        if (!/^\d{4}$/.test(pin)) return toast('PIN — ровно 4 цифры', '🔐');

        try {
          var r = await api('/auth/register', {
            method: 'POST',
            body: { name: name, phone: phone, pin: pin, code: code }
          });
          setUser(r.token, r.customer);
          closeAuth();
          if (typeof renderAll === 'function') renderAll();
          toast(r.customer.verified
            ? 'Профиль создан! Приветственный бонус ваш 🎉'
            : 'Профиль создан! Код активации — у кассира, а +1 штамп — в Telegram 🎁', '');
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
        var ph = (document.getElementById('regPhone') || {}).value;
        if (ph10(ph).length < 10) return toast('Введите номер полностью', '📵');
        try {
          var r = await api('/auth/request-reg-otp', {
            method: 'POST',
            body: { phone: ph, via: 'tg' }
          });
          window.open(r.tgUrl, '_blank');
          toast('Подтвердите номер в Telegram', '🤖');

          if (regPoll) clearInterval(regPoll);
          regPoll = setInterval(async function () {
            try {
              var c = await api('/auth/check-reg?phone=' + encodeURIComponent(ph));
              if (c.confirmed) {
                clearInterval(regPoll);
                regPoll = null;
                var row = document.getElementById('regTgRow');
                if (row) row.hidden = false;
                toast('Номер подтверждён через Telegram', '🎉');
              }
            } catch (_) {}
          }, 3000);
        } catch (e) {
          toast(e.message, '⚠️');
        }
      };
    }

    var logBtn = document.getElementById('logBtn');
    if (logBtn) {
      logBtn.onclick = async function () {
        var phone = (document.getElementById('logPhone') || {}).value;
        if (ph10(phone).length < 10) return toast('Введите номер полностью', '📵');

        try {
          if (loginMode === 'otp') {
            var otpVal = (document.getElementById('logOtp') || {}).value.trim();
            var rOtp = await api('/auth/login', {
              method: 'POST',
              body: { phone: phone, otp: otpVal }
            });
            setUser(rOtp.token, rOtp.customer);
            closeAuth();
            if (typeof renderAll === 'function') renderAll();
            toast('С возвращением, ' + rOtp.customer.name + '!', '🔗');
            if (rOtp.needPin) toast('PIN не задан. Задайте PIN в профиле — кнопка 🔐', '🔐');
          } else {
            var pinVal = (document.getElementById('logPin') || {}).value.trim();
            var rPin = await api('/auth/login', {
              method: 'POST',
              body: { phone: phone, pin: pinVal }
            });
            setUser(rPin.token, rPin.customer);
            closeAuth();
            if (typeof renderAll === 'function') renderAll();
            toast('С возвращением, ' + rPin.customer.name + '!', '🔗');
          }
        } catch (e) {
          if (e.code === 409) {
            openSetPin('claim', phone);
          } else {
            toast(e.message, '⚠️');
          }
        }
      };
    }

    var otpBtn = document.getElementById('otpBtn');
    if (otpBtn) {
      otpBtn.onclick = async function () {
        var phone = (document.getElementById('logPhone') || {}).value;
        if (ph10(phone).length < 10) return toast('Введите номер полностью', '📵');
        try {
          await api('/auth/request-otp', { method: 'POST', body: { phone: phone } });
          loginMode = 'otp';
          var pr = document.getElementById('logPinRow'); if (pr) pr.style.display = '';
          var ow = document.getElementById('logOtpWrap'); if (ow) ow.style.display = '';
          var bk = document.getElementById('otpBackRow'); if (bk) bk.style.display = '';
          var lb = document.getElementById('logBtn'); if (lb) lb.textContent = 'Войти по коду';
          toast('Код отправлен в Telegram', '🔑');
        } catch (e) {
          toast(e.message, '⚠️');
        }
      };
    }

    var otpBack = document.getElementById('otpBack');
    if (otpBack) {
      otpBack.onclick = function () {
        loginMode = 'pin';
        var pr = document.getElementById('logPinRow'); if (pr) pr.style.display = '';
        var ow = document.getElementById('logOtpWrap'); if (ow) ow.style.display = 'none';
        var bk = document.getElementById('otpBackRow'); if (bk) bk.style.display = 'none';
        var lb = document.getElementById('logBtn'); if (lb) lb.textContent = 'Войти';
      };
    }

    var setPinClose = document.getElementById('setPinClose');
    if (setPinClose) setPinClose.onclick = closeSetPin;

    var setPinGo = document.getElementById('setPinGo');
    if (setPinGo) {
      setPinGo.onclick = async function () {
        var pin = (document.getElementById('setPinInput') || {}).value.trim();
        if (!/^\d{4}$/.test(pin)) return toast('PIN — ровно 4 цифры', '🔐');
        try {
          if (setPinCtx && setPinCtx.mode === 'claim') {
            var r = await api('/auth/setup-pin', {
              method: 'POST',
              body: { phone: setPinCtx.phone, pin: pin }
            });
            setUser(r.token, r.customer);
            closeSetPin();
            closeAuth();
            if (typeof renderAll === 'function') renderAll();
            toast('PIN задан — добро пожаловать!', '🔐');
          } else {
            var rSet = await api('/auth/set-pin', {
              method: 'POST',
              body: { pin: pin }
            });
            window.me = rSet.customer;
            if (typeof renderProfile === 'function') renderProfile();
            closeSetPin();
            toast('PIN сохранён', '🔐');
          }
        } catch (e) {
          toast(e.message, '⚠️');
        }
      };
    }
    var profileTopBtn = document.getElementById('profileTopBtn');
    if (profileTopBtn) {
      profileTopBtn.onclick = function () {
        if (window.me) {
          if (typeof openPanel === 'function') openPanel('profile');
        } else {
          openAuth();
        }
      };
    }

    var brandLogo = document.querySelector('.brand');
    if (brandLogo) {
      brandLogo.onclick = function () {
        if (typeof mode !== 'undefined' && mode !== 'guest') {
          if (typeof setMode === 'function') setMode('guest');
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      };
    }
    var logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.onclick = async function () {
        try {
          var reg = await navigator.serviceWorker.ready;
          var sub = await reg.pushManager.getSubscription();
          if (sub) {
            await api('/push/unsubscribe', { method: 'POST' });
            await sub.unsubscribe();
          }
        } catch (_) {}
        try {
          await api('/exit', { method: 'POST' });
        } catch (_) {}
        window.USER_TOKEN = null;
        localStorage.removeItem('zt_user');
        window.me = null;
        window.mode = 'guest';
        if (typeof closePanel === 'function') closePanel();
        if (typeof renderAll === 'function') renderAll();
        openAuth();
      };
    }
  });

  /* ── Экспорт в глобальную область видимости ── */
  window.openAuth = openAuth;
  window.closeAuth = closeAuth;
  window.authSwap = authSwap;
  window.setUser = setUser;
  window.openSetPin = openSetPin;
  window.closeSetPin = closeSetPin;
  window.applyAuthBrand = applyAuthBrand;
})();