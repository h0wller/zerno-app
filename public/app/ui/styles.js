/* public/app/ui/styles.js — Ф3.2: глобальные CSS-инъекции + panel-open observer.
   Растворено из fix-views.js, блок v62 (начало). */

(function () {
  'use strict';

  /* ── z-index + panel-open + settings CSS ── */
  var css = document.createElement('style');
  css.textContent =
    '.chat-fab{z-index:95!important}' +
    '@media(max-width:1180px){body.panel-open .chat-fab{display:none}}' +
    '.modal{z-index:340!important}' +
    '.phead .gear{margin-left:auto;width:40px;height:40px;border-radius:12px;border:1.5px solid var(--line);background:#fff;font-size:18px}' +
    '#settingsModal .set-row{display:flex;align-items:center;gap:10px;padding:12px;border:1.5px solid var(--line);border-radius:14px;margin-bottom:10px;background:#fff}' +
    '#deliveryView .search{min-width:180px;margin-left:auto}';
  document.head.appendChild(css);

  /* ── класс panel-open на body (для CSS выше) ── */
  var panel = document.getElementById('panel');
  if (panel) {
    new MutationObserver(function () {
      document.body.classList.toggle('panel-open', panel.classList.contains('open'));
    }).observe(panel, { attributes: true, attributeFilter: ['class'] });
  }
})();