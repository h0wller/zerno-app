/* public/app/core/auth.js — владелец модалки и входа */
(function () {
  'use strict';

  var loginMode = 'pin';
  var authReturnFocus = null;
  var authFocusTimer = null;

  function setAuthFormMode(login) {
    var rf = document.getElementById('regForm');
    var lf = document.getElementById('loginForm');
    var at = document.getElementById('authTitle');
    if (rf) rf.style.display = login ? 'none' : 'flex';
    if (lf) lf.style.display = login ? 'flex' : 'none';
    if (at) at.textContent = login ? 'Вход по номеру' : 'Создайте профиль';
    var regTab = document.getElementById('toReg');
    var loginTab = document.getElementById('toLogin');
    if (regTab) regTab.setAttribute('aria-pressed', String(!login));
    if (loginTab) loginTab.setAttribute('aria-pressed', String(!!login));
  }

  function resetLoginPinState() {
    loginMode = 'pin';
    var pr = document.getElementById('logPinRow'); if (pr) pr.style.display = '';
    var ow = document.getElementById('logOtpWrap'); if (ow) ow.style.display = 'none';
    var bk = document.getElementById('otpBackRow'); if (bk) bk.style.display = 'none';
    var lb = document.getElementById('logBtn'); if (lb) lb.textContent = 'Войти';
    var hint = document.getElementById('logOtpHint');
    if (hint) { hint.hidden = true; hint.textContent = ''; }
  }

  function getValidatedLoginPhone() {
    var phone = (document.getElementById('logPhone') || {}).value;
    if (ph10(phone).length < 10) {
      toast('Введите номер полностью', '📵');
      return null;
    }
    return phone;
  }

  function armPw() {
    ['regPin', 'logPin', 'logOtp', 'pinInput'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.type = 'password';
    });
  }

  function adaptAuthForTelegram(modal) {
    var isTg = !!(window.__isTgMiniApp || window.__tgInitData || (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData));
    if (!isTg || !modal) return;

    modal.classList.add('tg-mode');
    var tgBtn = document.getElementById('regTgBtn');
    if (tgBtn) tgBtn.style.display = 'none';

    var hint = modal.querySelector('.mhint, .subhint, #regForm .hint');
    if (hint) hint.style.display = 'none';

    // Согласие рендерится в authModal и проверяется обработчиком регистрации независимо от среды.

    if (window.__tgUser && window.__tgUser.name) {
      var rn = document.getElementById('regName');
      if (rn && !rn.value) rn.value = window.__tgUser.name;
    }
  }

  function applyAuthBrand() {
    var modal = document.getElementById('authModal');
    if (!modal) return;
    adaptAuthForTelegram(modal);
    var msub = modal.querySelector('.msub');
    if (msub) msub.textContent = 'Единый профиль — заказы и бонусы. За регистрацию — приветственный напиток и бесплатная доставка.';
  }

  function openAuth(login) {
    if (typeof login === 'undefined') login = false;
    armPw();
    applyAuthBrand();

    var am = document.getElementById('authModal');
    if (am && !am.classList.contains('show')) {
      var active = document.activeElement;
      authReturnFocus = active && active !== document.body ? active : null;
    }
    if (am) am.classList.add('show');

    setAuthFormMode(login);

    if (typeof syncOverlay === 'function') syncOverlay();
    if (authFocusTimer) clearTimeout(authFocusTimer);
    authFocusTimer = setTimeout(function () {
      authFocusTimer = null;
      if (!am || !am.classList.contains('show')) return;
      // Do not steal focus after the user has started interacting with the dialog.
      if (am.contains(document.activeElement)) return;
      var target = login ? document.getElementById('logPhone') : document.getElementById('regName');
      if (target) target.focus();
    }, 180);
  }

  function resetAuthTransientState() {
    // Временные состояния не должны переживать закрытие модалки.
    if (typeof window.resetRegistrationState === 'function') window.resetRegistrationState();
    loginMode = 'pin';

    var consent = document.getElementById('consentBox');
    if (consent) consent.checked = false;

    ['regOtp', 'logOtp'].forEach(function (id) {
      var input = document.getElementById(id);
      if (input) input.value = '';
    });

    resetLoginPinState();
  }

  function closeAuth() {
    if (authFocusTimer) {
      clearTimeout(authFocusTimer);
      authFocusTimer = null;
    }
    var am = document.getElementById('authModal');
    if (am) am.classList.remove('show');
    resetAuthTransientState();
    if (typeof syncOverlay === 'function') syncOverlay();
    var returnTarget = authReturnFocus;
    authReturnFocus = null;
    if (returnTarget && returnTarget.isConnected && typeof returnTarget.focus === 'function') returnTarget.focus();
  }


  // Clicking the backdrop dismisses the auth dialog; clicks inside the card do not.
  document.addEventListener('click', function (event) {
    var modal = document.getElementById('authModal');
    if (modal && modal.classList.contains('show') && event.target === modal) closeAuth();
  });

  // A modal dialog keeps keyboard focus inside and closes on Escape.
  document.addEventListener('keydown', function (event) {
    var modal = document.getElementById('authModal');
    if (!modal || !modal.classList.contains('show')) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      closeAuth();
      return;
    }

    if (event.key !== 'Tab') return;
    var focusable = Array.prototype.filter.call(
      modal.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'),
      function (element) {
        return element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden';
      }
    );
    if (!focusable.length) {
      event.preventDefault();
      modal.focus();
      return;
    }

    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  });

  function authSwap(login) {
    applyAuthBrand();
    setAuthFormMode(login);
    if (login) resetLoginPinState();
    var target = document.getElementById(login ? 'logPhone' : 'regName');
    if (target) target.focus();
  }


  document.addEventListener('DOMContentLoaded', function () {
    async function checkTgAutoLogin() {
      if (localStorage.getItem('zt_user')) return;
      var tg = window.Telegram && window.Telegram.WebApp;
      var initData = tg && tg.initData;
      if (!initData) return;
      try {
        if (typeof tg.ready === 'function') tg.ready();
        var r = await api('/auth/tg-link', {
          method: 'POST',
          body: { initData: initData }
        });
        if (r && r.token && r.customer) {
          window.setUser(r.token, r.customer);
          if (typeof renderAll === 'function') renderAll();
          if (typeof toast === 'function') toast('Вход выполнен через Telegram', '🤖');
          closeAuth();
        } else if (r && r.needPhone) {
          window.__tgInitData = initData;
          window.__tgUser = r.tgUser;
          var rn = document.getElementById('regName');
          if (rn && !rn.value && r.tgUser && r.tgUser.name) rn.value = r.tgUser.name;
          var rtb = document.getElementById('regTgBtn');
          if (rtb) rtb.style.display = 'none';
        }
      } catch (_) {}
    }
    checkTgAutoLogin();

    var toLogin = document.getElementById('toLogin');
    if (toLogin) toLogin.onclick = function () { authSwap(true); };

    var toReg = document.getElementById('toReg');
    if (toReg) toReg.onclick = function () { authSwap(false); };

    var authModeSwitch = document.querySelector('#authModal .auth-mode-switch');
    if (authModeSwitch) {
      authModeSwitch.addEventListener('keydown', function (event) {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') return;
        var tabs = [toReg, toLogin].filter(Boolean);
        if (!tabs.length) return;
        event.preventDefault();
        var current = tabs.indexOf(document.activeElement);
        var next = event.key === 'Home' ? 0 : (event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length);
        authSwap(next === 1);
        tabs[next].focus();
      });
    }

    var skipAuth = document.getElementById('skipAuth');
    if (skipAuth) {
      skipAuth.onclick = function () {
        window.onboarded = true;
        localStorage.setItem('zt_onb', '1');
        closeAuth();
        if (typeof toast === 'function') toast('Можно смотреть меню. Профиль — по кнопке с аватаром', '👀');
      };
    }

    // Enter ведёт к следующему видимому полю, а на последнем поле отправляет форму.
    [['regForm', 'regBtn'], ['loginForm', 'logBtn']].forEach(function (pair) {
      var form = document.getElementById(pair[0]);
      if (!form) return;
      form.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' || e.target.tagName !== 'INPUT') return;
        e.preventDefault();
        var fields = Array.prototype.filter.call(
          form.querySelectorAll('input:not([type="checkbox"])'),
          function (el) { return el.offsetParent !== null && !el.disabled; }
        );
        var idx = fields.indexOf(e.target);
        if (idx > -1 && idx < fields.length - 1) { fields[idx + 1].focus(); return; }
        var btn = document.getElementById(pair[1]);
        if (btn && btn.offsetParent !== null) btn.click();
      });
    });

    var logBtn = document.getElementById('logBtn');
    if (logBtn) {
      logBtn.onclick = async function () {
        if (logBtn.disabled) return;
        var phone = getValidatedLoginPhone();
        if (!phone) return;
        logBtn.disabled = true;
        logBtn.setAttribute('aria-busy', 'true');
        logBtn.textContent = 'Входим…';
        try {
          if (loginMode === 'otp') {
            var otpVal = (document.getElementById('logOtp') || {}).value.trim();
            var rOtp = await api('/auth/login', {
              method: 'POST',
              body: { phone: phone, otp: otpVal }
            });
            window.setUser(rOtp.token, rOtp.customer);
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
            window.setUser(rPin.token, rPin.customer);
            closeAuth();
            if (typeof renderAll === 'function') renderAll();
            toast('С возвращением, ' + rPin.customer.name + '!', '🔗');
          }
        } catch (e) {
          if (e.code === 409) {
            window.openSetPin('claim', phone);
          } else {
            toast(e.message, '⚠️');
          }
        } finally {
          logBtn.disabled = false;
          logBtn.removeAttribute('aria-busy');
          logBtn.textContent = loginMode === 'otp' ? 'Войти по коду' : 'Войти';
        }
      };
    }

    var otpBtn = document.getElementById('otpBtn');
    if (otpBtn) {
      otpBtn.onclick = async function () {
        if (otpBtn.disabled) return;
        var phone = getValidatedLoginPhone();
        if (!phone) return;
        otpBtn.disabled = true;
        otpBtn.setAttribute('aria-busy', 'true');
        otpBtn.textContent = 'Отправляем код…';
        try {
          await api('/auth/request-otp', { method: 'POST', body: { phone: phone } });
          loginMode = 'otp';
          var pr = document.getElementById('logPinRow'); if (pr) pr.style.display = 'none';
          var ow = document.getElementById('logOtpWrap'); if (ow) ow.style.display = '';
          var bk = document.getElementById('otpBackRow'); if (bk) bk.style.display = '';
          var lb = document.getElementById('logBtn'); if (lb) lb.textContent = 'Войти по коду';
          var hint = document.getElementById('logOtpHint');
          if (hint) { hint.textContent = 'Код отправлен в Telegram. Введите его в поле выше.'; hint.hidden = false; }
          var otpInput = document.getElementById('logOtp');
          if (otpInput) { otpInput.value = ''; otpInput.focus(); }
          toast('Код отправлен в Telegram', '🔑');
        } catch (e) {
          toast(e.message, '⚠️');
        } finally {
          otpBtn.disabled = false;
          otpBtn.removeAttribute('aria-busy');
          otpBtn.textContent = '🔑 Не помню PIN — код в Telegram';
        }
      };
    }

    var otpBack = document.getElementById('otpBack');
    if (otpBack) otpBack.onclick = function () {
      resetLoginPinState();
      var pin = document.getElementById('logPin');
      if (pin) pin.focus();
    };

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

    var brandLogo = document.querySelector('.topbar .brand');
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
        window.setUser(null, null);
        window.mode = 'guest';
        if (typeof closePanel === 'function') closePanel();
        if (typeof renderAll === 'function') renderAll();
        openAuth();
      };
    }

    var deleteAccBtn = document.getElementById('deleteAccBtn');
    if (deleteAccBtn) {
      deleteAccBtn.onclick = async function () {
        var ok = window.confirm('Удалить профиль и персональные данные? Это действие необратимо. История заказов сохранится без имени и телефона.');
        if (!ok) return;
        try {
          var reg = await navigator.serviceWorker.ready;
          var sub = await reg.pushManager.getSubscription();
          if (sub) await sub.unsubscribe();
        } catch (_) {}
        try {
          await api('/me', { method: 'DELETE' });
        } catch (e) {
          alert('Не удалось удалить профиль. Попробуйте позже или напишите на почту из политики конфиденциальности.');
          return;
        }
        window.setUser(null, null);
        window.mode = 'guest';
        if (typeof closePanel === 'function') closePanel();
        if (typeof renderAll === 'function') renderAll();
        alert('Профиль удалён.');
        openAuth();
      };
    }
  });

  window.openAuth = openAuth;
  window.closeAuth = closeAuth;
  window.authSwap = authSwap;
  window.applyAuthBrand = applyAuthBrand;
})();
