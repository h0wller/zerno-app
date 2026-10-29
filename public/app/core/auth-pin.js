/* public/app/core/auth-pin.js — модалка задания и смены PIN */
(function () {
  'use strict';

  var setPinCtx = null;

  function armPinPasswords() {
    ['setPinInput', 'pinInput'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.type = 'password';
    });
  }

  function openSetPin(mode, phone) {
    armPinPasswords();
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

  document.addEventListener('DOMContentLoaded', function () {
    var setPinClose = document.getElementById('setPinClose');
    if (setPinClose) setPinClose.onclick = closeSetPin;

    var setPinGo = document.getElementById('setPinGo');
    if (!setPinGo) return;
    setPinGo.onclick = async function () {
      var pin = (document.getElementById('setPinInput') || {}).value.trim();
      if (!/^\d{4}$/.test(pin)) return toast('PIN — ровно 4 цифры', '🔐');
      try {
        if (setPinCtx && setPinCtx.mode === 'claim') {
          var r = await api('/auth/setup-pin', {
            method: 'POST',
            body: { phone: setPinCtx.phone, pin: pin }
          });
          window.setUser(r.token, r.customer);
          closeSetPin();
          window.closeAuth();
          if (typeof window.renderAll === 'function') window.renderAll();
          toast('PIN задан — добро пожаловать!', '🔐');
        } else {
          var rSet = await api('/auth/set-pin', {
            method: 'POST',
            body: { pin: pin }
          });
          window.me = rSet.customer;
          if (typeof window.renderProfile === 'function') window.renderProfile();
          closeSetPin();
          toast('PIN сохранён', '🔐');
        }
      } catch (e) {
        toast(e.message, '⚠️');
      }
    };
  });

  window.openSetPin = openSetPin;
  window.closeSetPin = closeSetPin;
})();
