/* public/app/core/a11y.js — Ф3.1: a11y + reduced-motion + lazy-img.
   Растворено из fix-views.js v68-полиш. */

(function () {
  'use strict';

  /* reduced-motion: уважаем системную настройку */
  var css = document.createElement('style');
  css.textContent = '@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}';
  document.head.appendChild(css);

  /* ARIA для модалок */
  document.querySelectorAll('.modal').forEach(function (m) {
    m.setAttribute('role', 'dialog');
    m.setAttribute('aria-modal', 'true');
  });
  document.querySelectorAll('.mclose').forEach(function (b) {
    if (!b.getAttribute('aria-label')) b.setAttribute('aria-label', 'Закрыть');
  });

  /* lazy-img: loading=lazy + decoding=async, включая динамически добавленные */
  function lazify(root) {
    (root || document).querySelectorAll('img').forEach(function (img) {
      if (!img.loading) {
        img.loading = 'lazy';
        img.decoding = 'async';
      }
    });
  }
  lazify(document);
  new MutationObserver(function (ms) {
    ms.forEach(function (m) {
      m.addedNodes && m.addedNodes.forEach(function (n) {
        if (n.nodeType === 1) lazify(n);
      });
    });
  }).observe(document.body, { childList: true, subtree: true });
})();