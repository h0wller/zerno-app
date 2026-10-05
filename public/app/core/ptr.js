/* public/app/core/ptr.js — Волна 1.3: Pull-to-refresh (v3)
   PTR-PATCH v3: сброс трансформа, минимальная задержка лоадера, только тач */
(function () {
  'use strict';

  var PULL_THRESHOLD = 65;
  var TIMEOUT_MS = 5000;
  var RESISTANCE = 0.4;
  var MIN_SPINNER_MS = 400; /* минимальное время показа лоадера */

  var startY = 0;
  var pulling = false;
  var refreshing = false;
  var timeoutId = null;

  function isAtTop() {
    return (window.scrollY || window.pageYOffset || 0) <= 0;
  }

  function isOverlayOpen() {
    if (document.querySelector('.modal.show, #cartPanel.open, #panel.open')) return true;
    var overlay = document.getElementById('overlay');
    if (overlay && overlay.classList.contains('show')) return true;
    return false;
  }

  function getLoader() {
    var loader = document.getElementById('ptrLoader');
    if (!loader) {
      loader = document.createElement('div');
      loader.id = 'ptrLoader';
      loader.className = 'ptr-loader';
      loader.innerHTML = '<div class="ptr-spinner"></div>';
      document.body.appendChild(loader);
    }
    return loader;
  }

    function showLoader() {
    var loader = getLoader();
    loader.style.opacity = '1';
    loader.style.transform = 'translateY(44px) scale(1)';
    loader.classList.add('visible');
  }

  function hideLoader() {
    var loader = getLoader();
    loader.classList.remove('visible');
    loader.style.opacity = '0';
    loader.style.transform = 'translateY(-20px) scale(0.65)';
  }

  function setLoaderPosition(offsetY) {
    var loader = getLoader();
    var progress = Math.min(offsetY / PULL_THRESHOLD, 1);
    var translateY = -20 + (progress * 64);
    loader.style.opacity = String(Math.max(0.1, progress));
    loader.style.transform = 'translateY(' + translateY + 'px) scale(' + (0.65 + 0.35 * progress) + ')';
  }

  function findRefreshFn() {
    var isDelivery =
      (typeof window.brand !== 'undefined' && window.brand === 'delivery') ||
      document.documentElement.getAttribute('data-brand') === 'delivery';

    if (isDelivery) {
      if (typeof window.loadDelivery === 'function') return window.loadDelivery;
      if (typeof window.renderDeliveryMenu === 'function') return window.renderDeliveryMenu;
      if (typeof window.fetchMenu === 'function') return window.fetchMenu;
      return null;
    }

    if (typeof window.loadMe === 'function') return window.loadMe;
    if (typeof window.loadProfile === 'function') return window.loadProfile;
    if (typeof window.fetchProfile === 'function') return window.fetchProfile;
    if (typeof window.refreshMe === 'function') return window.refreshMe;
    return null;
  }

  async function doRefresh() {
    if (refreshing) return;
    refreshing = true;

    if (window.TgUx && typeof window.TgUx.haptic === 'function') {
      window.TgUx.haptic('light');
    }

    showLoader();

    timeoutId = setTimeout(function () {
      console.warn('[PTR] Таймаут: принудительное завершение');
      hideLoader();
      refreshing = false;
    }, TIMEOUT_MS);

    try {
      var refreshFn = findRefreshFn();
      if (refreshFn) {
        var result = refreshFn();
        /* PTR-PATCH v3: минимум 400 мс показа лоадера, даже если рендер синхронный */
        await Promise.all([
          Promise.resolve(result),
          new Promise(function (r) { setTimeout(r, MIN_SPINNER_MS); })
        ]);
      } else {
        console.warn('[PTR] Не найдена функция обновления');
        await new Promise(function (r) { setTimeout(r, MIN_SPINNER_MS); });
      }
    } catch (err) {
      console.error('[PTR] Ошибка обновления:', err);
    } finally {
      clearTimeout(timeoutId);
      hideLoader();
      refreshing = false;
    }
  }

  function onTouchStart(e) {
    if (refreshing || !isAtTop() || isOverlayOpen()) return;
    if (!e.touches || !e.touches[0]) return;
    startY = e.touches[0].clientY;
    pulling = true;
  }

  function onTouchMove(e) {
    if (!pulling || refreshing || !isAtTop() || isOverlayOpen()) return;
    if (!e.touches || !e.touches[0]) return;

    var currentY = e.touches[0].clientY;
    var deltaY = currentY - startY;

    if (deltaY > 0) {
      if (e.cancelable) e.preventDefault();
      setLoaderPosition(deltaY);

      if (deltaY >= PULL_THRESHOLD && window.TgUx && typeof window.TgUx.haptic === 'function') {
        var loader = getLoader();
        if (!loader.dataset.hapticFired) {
          window.TgUx.haptic('light');
          loader.dataset.hapticFired = '1';
        }
      }
    }
  }

  function onTouchEnd(e) {
    if (!pulling || refreshing) return;
    pulling = false;

    var currentY;
    if (e.changedTouches && e.changedTouches[0]) {
      currentY = e.changedTouches[0].clientY;
    } else {
      hideLoader();
      return;
    }
    var deltaY = currentY - startY;

    var loader = getLoader();
    delete loader.dataset.hapticFired;

    if (deltaY >= PULL_THRESHOLD) {
      doRefresh();
    } else {
      hideLoader();
    }
  }

  function init() {
  var hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  if (!hasTouch) return;
  document.addEventListener('touchstart', onTouchStart, { passive: true });
  // Заменить { passive: false } на { passive: true }
  document.addEventListener('touchmove', onTouchMove, { passive: true });
  document.addEventListener('touchend', onTouchEnd, { passive: true });
}

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
