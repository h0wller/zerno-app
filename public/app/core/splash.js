/* public/app/core/splash.js — Ф3.3: статичный сплэш.
   Растворено из fix-views.js, блок v62 (splash).
   Зависит от window.syncBrandViews и window.setChatCtx — оба из fix-views. */

(function () {
  'use strict';

  var bs = document.getElementById('brandSplash');
  if (bs) bs.remove();
  var ss = document.getElementById('brandSplashStatic');
  if (!ss) return;

  // если сплэш уже пройден — убираем сразу
  if (sessionStorage.getItem('splashDone') === '1') {
    ss.remove();
    document.documentElement.classList.remove('need-splash');
    document.documentElement.classList.add('no-splash');
    return;
  }

  ss.addEventListener('click', function (e) {
    var b = e.target.closest('[data-go]');
    if (!b) return;
    brand = b.dataset.go;
    sessionStorage.setItem('splashDone', '1');
    document.documentElement.classList.remove('need-splash');
    document.documentElement.classList.add('no-splash');
    ss.remove();
    if (mode === 'cashier' || mode === 'orders') setMode('guest');
    document.querySelectorAll('#brandSeg button').forEach(function (x) {
      x.classList.toggle('on', x.dataset.brand === brand);
    });
    if (typeof window.syncBrandViews === 'function') window.syncBrandViews();
    if (brand === 'delivery' && !DMENU.length) loadDelivery();
    if (typeof window.setChatCtx === 'function') window.setChatCtx(brand);
  });
})();