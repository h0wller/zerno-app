/* public/app/core/splash.js — сплэш бренда */
(function () {
  'use strict';
  var bs = document.getElementById('brandSplash');
  if (bs) bs.remove();
  var ss = document.getElementById('brandSplashStatic');
  var done = false;
  try {
    done = sessionStorage.getItem("splashDone") === '1';
  } catch (e) {}

  var QS = new URLSearchParams(location.search);
  var isAudit = document.documentElement.classList.contains('is-audit') || QS.get('lighthouse') === '1';

  function finish(choice) {
    try { sessionStorage.setItem("splashDone", "1"); } catch (e) {}
    try { localStorage.setItem("zt_brand", choice); } catch (e) {}
    document.documentElement.classList.remove('need-splash');
    document.documentElement.classList.add('no-splash');
    var el = document.getElementById('brandSplashStatic') || document.getElementById('brandSplash');
    if (el) el.remove();
    window.brand = choice;
    if ((window.mode === 'cashier' || window.mode === 'orders') && typeof window.setMode === 'function') {
      window.setMode('guest');
    }
    document.querySelectorAll('#brandSeg button').forEach(function (x) {
      x.classList.toggle('on', x.dataset.brand === choice);
    });
    if (typeof window.syncBrandViews === 'function') window.syncBrandViews();
    if (typeof window.applyAuthBrand === 'function') window.applyAuthBrand();
    if (choice === 'delivery' && typeof window.DMENU !== 'undefined' && window.DMENU.length === 0 && typeof window.loadDelivery === 'function') {
      window.loadDelivery();
    }
    if (window.chatState) window.chatState.setChatCtx(choice);
    else if (typeof window.setChatCtx === 'function') window.setChatCtx(choice);

    // Если гость новый (не авторизован) — открываем регистрацию
    if (!localStorage.getItem('zt_user') && !window.me) {
      setTimeout(function () {
        if (typeof openAuth === 'function') openAuth(false);
      }, 250);
    }
  }

  function bind(root) {
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-go]');
      if (!b) return;
      finish(b.dataset.go);
    });
  }

  if (done || isAudit) {
    if (ss) ss.remove();
    document.documentElement.classList.remove('need-splash');
    document.documentElement.classList.add('no-splash');
    return;
  }
  if (ss) { 
    bind(ss); 
    return; 
  }
})();
