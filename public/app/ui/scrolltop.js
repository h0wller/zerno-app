/* public/app/ui/scrolltop.js — сброс легаси-отступов и кнопка «Наверх»
   Ф5.71: CSS в theme/*.css, устранение MutationObserver в пользу детерминированного updateScrollTop. */
var railHeadObserver = null;
var observedRailHead = null;
var observedRailTopbar = null;

function updateRailStickyPosition(rail, head) {
  if (!rail || !head) return;

  var headRect = head.getBoundingClientRect();
  if (!headRect.height) {
    rail.classList.remove('rail-position-ready');
    return;
  }

  var topbar = document.querySelector('header.topbar');
  var topbarBottom = topbar ? topbar.getBoundingClientRect().bottom : 0;
  var laneTop = Math.max(0, topbarBottom, headRect.bottom) + 12;
  var laneBottom = (window.innerHeight || document.documentElement.clientHeight) - 12;
  var availableHeight = Math.max(0, laneBottom - laneTop);
  var stickyTop = laneTop + availableHeight / 2;

  var top = stickyTop + 'px';
  var maxHeight = availableHeight + 'px';
  if (rail.style.top !== top) rail.style.top = top;
  if (rail.style.maxHeight !== maxHeight) rail.style.maxHeight = maxHeight;
  if (rail.style.transform !== 'translateY(-50%)') rail.style.transform = 'translateY(-50%)';
  rail.classList.add('rail-position-ready');
}

function alignRailWithCard() {
  var isDelivery = document.documentElement.dataset.brand === 'delivery';
  var rail = document.getElementById(isDelivery ? 'deliveryRail' : 'rail');
  var head = document.querySelector(isDelivery ? '#deliveryView .menu-head' : '#menuView .menu-head');

  if (!rail) return;
  var wrap = rail.parentElement;
  if (!wrap) return;

  var headRect = head && head.getBoundingClientRect();
  if (headRect && headRect.height) {
    var wrapRect = wrap.getBoundingClientRect();
    var wrapStyle = window.getComputedStyle(wrap);
    var offset = headRect.bottom - wrapRect.top
      - (parseFloat(wrapStyle.paddingTop) || 0)
      - (parseFloat(wrapStyle.borderTopWidth) || 0)
      + 12;
    var marginTop = Math.max(0, offset) + 'px';
    if (rail.style.marginTop !== marginTop) rail.style.marginTop = marginTop;
  } else if (rail.style.marginTop !== '0px') {
    rail.style.marginTop = '0px';
  }

  updateRailStickyPosition(rail, head);

  var topbar = document.querySelector('header.topbar');
  if (typeof ResizeObserver === 'function' && (observedRailHead !== head || observedRailTopbar !== topbar)) {
    if (railHeadObserver) railHeadObserver.disconnect();
    railHeadObserver = new ResizeObserver(alignRailWithCard);
    observedRailHead = head;
    observedRailTopbar = topbar;
    if (head) railHeadObserver.observe(head);
    if (topbar) railHeadObserver.observe(topbar);
  }
}
function alignMbonusWithRail() {}
window.alignRailWithCard = alignRailWithCard;
window.alignMbonusWithRail = alignMbonusWithRail;
var railScrollTick = false;
window.addEventListener('scroll', function () {
  if (railScrollTick) return;
  railScrollTick = true;
  requestAnimationFrame(function () {
    railScrollTick = false;
    var isDelivery = document.documentElement.dataset.brand === 'delivery';
    updateRailStickyPosition(
      document.getElementById(isDelivery ? 'deliveryRail' : 'rail'),
      document.querySelector(isDelivery ? '#deliveryView .menu-head' : '#menuView .menu-head')
    );
  });
}, { passive: true });
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