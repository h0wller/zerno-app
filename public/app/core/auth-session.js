/* public/app/core/auth-session.js — состояние пользовательской сессии */
(function () {
  'use strict';

  function setUser(token, customer) {
    window.USER_TOKEN = token;
    if (token) localStorage.setItem('zt_user', token);
    else localStorage.removeItem('zt_user');

    window.me = customer;
    var staffRole = token && customer && ['admin', 'cashier', 'dispatch'].indexOf(customer.role) !== -1
      ? customer.role
      : '';
    var root = document.documentElement;
    try {
      if (staffRole) localStorage.setItem('zt_role', staffRole);
      else localStorage.removeItem('zt_role');
    } catch (_) {}
    if (staffRole) root.setAttribute('data-staff-role', staffRole);
    else root.removeAttribute('data-staff-role');
    root.setAttribute('data-staff-ready', '1');
    window.historyLoaded = false;
    window.lastChatId = 0;

    if (typeof initChatPointer === 'function') initChatPointer();
    if (typeof showBadge === 'function') showBadge();

    window.onboarded = true;
    localStorage.setItem('zt_onb', '1');

    var initChar = (customer && customer.name && customer.name.trim())
      ? customer.name.trim().charAt(0).toUpperCase()
      : '?';
    var topAva = document.getElementById('profileTopBtn');
    if (topAva) topAva.textContent = initChar;
    var profAva = document.getElementById('avInit');
    if (profAva) profAva.textContent = initChar;

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

  window.setUser = setUser;

  /* Only the bearer token changes the authenticated session across tabs.
     zt_role is an untrusted layout hint; never reload or adopt it independently. */
  var storageReloadPending = false;
  window.addEventListener('storage', function (e) {
    if (!e || e.key !== 'zt_user') return;
    var root = document.documentElement;

    if (!e.newValue) {
      if (typeof window.setUser === 'function') {
        window.setUser(null, null);
      } else {
        root.removeAttribute('data-staff-role');
        root.setAttribute('data-staff-ready', '1');
        window.USER_TOKEN = null;
        window.me = null;
      }
      return;
    }

    if (e.newValue === window.USER_TOKEN || storageReloadPending) return;

    // The new token must pass /api/me in boot() before staff layout is restored.
    root.removeAttribute('data-staff-role');
    root.removeAttribute('data-staff-ready');
    storageReloadPending = true;
    window.location.reload();
  });
})();
