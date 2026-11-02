/* public/app/ui/scrolltop.js — сброс легаси-отступов и кнопка «Наверх»
   Ф5.71: CSS в theme/*.css, устранение MutationObserver в пользу детерминированного updateScrollTop. */
var railHeadObserver = null;
var observedRailHead = null;

function alignRailWithCard() {
  var isDelivery = document.documentElement.dataset.brand === 'delivery';
  var rail = document.getElementById(isDelivery ? 'deliveryRail' : 'rail');
  var head = document.querySelector(isDelivery ? '#deliveryView .menu-head' : '#menuView .menu-head');

  if (!rail) return;
  if (!window.matchMedia('(max-width: 820px)').matches || !head || !head.offsetHeight) {
    rail.style.removeProperty('margin-top');
    if (railHeadObserver) railHeadObserver.disconnect();
    observedRailHead = null;
    return;
  }

  var wrap = rail.parentElement;
  if (!wrap) return;

  var wrapRect = wrap.getBoundingClientRect();
  var headRect = head.getBoundingClientRect();
  var wrapStyle = window.getComputedStyle(wrap);
  var offset = headRect.bottom - wrapRect.top
    - (parseFloat(wrapStyle.paddingTop) || 0)
    - (parseFloat(wrapStyle.borderTopWidth) || 0);
  var marginTop = Math.max(0, offset) + 'px';

  if (rail.style.marginTop !== marginTop) rail.style.marginTop = marginTop;

  if (typeof ResizeObserver === 'function' && observedRailHead !== head) {
    if (railHeadObserver) railHeadObserver.disconnect();
    railHeadObserver = new ResizeObserver(alignRailWithCard);
    observedRailHead = head;
    railHeadObserver.observe(head);
  }
}
function alignMbonusWithRail() {}
window.alignRailWithCard = alignRailWithCard;
window.alignMbonusWithRail = alignMbonusWithRail;
window.addEventListener('resize', alignRailWithCard, { passive: true });
window.addEventListener('load', alignRailWithCard, { once: true });
requestAnimationFrame(alignRailWithCard);

(function () {
  'use strict';

  var nav = document.getElementById('pageNavigation');
  if (!nav) {
    nav = document.createElement('nav');
    nav.id = 'pageNavigation';
    nav.setAttribute('aria-label', 'Навигация по странице');
    document.body.appendChild(nav);
  }

  var btn = document.getElementById('scrollTopBtn');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'scrollTopBtn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Наверх');
    btn.textContent = '↑';
  }
  if (btn.parentElement !== nav) nav.appendChild(btn);

  function update() {
    // ── READ PHASE (без вызова getComputedStyle) ──
    var chat = document.getElementById('chatPanel');
    var chatOpen = !!(chat && chat.classList.contains('open'));
    var y = window.scrollY || document.documentElement.scrollTop || 0;
    var fab = document.getElementById('chatFab');
    var isCashier = document.body.classList.contains('is-cashier');
    var fabHidden = !fab || fab.hidden || fab.style.display === 'none' || isCashier;

    // ── WRITE PHASE ──
    btn.classList.toggle('show', !chatOpen && y > 400);
    btn.classList.toggle('low', fabHidden);
  }

  var tick = false;
  function onScroll() {
    if (tick) return;
    tick = true;
    requestAnimationFrame(function () {
      tick = false;
      update();
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });

  btn.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

 if (window.ztBus) {
    window.ztBus.on('ui:update-scrolltop', update);
  }
  window.updateScrollTop = update; // временно для обратной совместимости

  // Запуск не блокирует текущий такт парсинга
  requestAnimationFrame(update);
})();