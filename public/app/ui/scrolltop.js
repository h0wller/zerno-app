/* public/app/ui/scrolltop.js — сброс легаси-отступов и кнопка «Наверх»
   Ф5.71: CSS в theme/*.css, устранение MutationObserver в пользу детерминированного updateScrollTop. */
var railHeadObserver = null;
var observedRailHead = null;
var observedRailTopbar = null;

function updateRailStickyPosition(rail, head) {
  if (!rail || !head) return;

  if (!head.getBoundingClientRect().height) {
    rail.classList.remove('rail-position-ready');
    return;
  }

  var mobileViewport = window.matchMedia && window.matchMedia('(max-width: 820px)').matches;
  if (mobileViewport) {
    var viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    var maxRailHeight = Math.max(0, viewportHeight - 24);
    var visibleRailHeight = Math.min(rail.scrollHeight, maxRailHeight);

    rail.style.position = 'sticky';
    rail.style.top = Math.max(12, (viewportHeight - visibleRailHeight) / 2) + 'px';
    rail.style.maxHeight = maxRailHeight + 'px';
    rail.style.overflowY = rail.scrollHeight > maxRailHeight ? 'auto' : 'visible';
    rail.style.alignSelf = 'start';
  } else {
    rail.style.position = 'relative';
    rail.style.top = 'auto';
    rail.style.maxHeight = 'none';
    rail.style.overflowY = '';
    rail.style.alignSelf = 'stretch';
  }

  rail.style.transform = 'none';
  rail.classList.add('rail-position-ready');
}

function alignRailWithCard() {
  var isDelivery = document.documentElement.dataset.brand === 'delivery';
  var rail = document.getElementById(isDelivery ? 'deliveryRail' : 'rail');
  var head = document.querySelector(isDelivery ? '#deliveryView .menu-head' : '#menuView .menu-head');

  if (!rail) return;
  var wrap = rail.parentElement;
  if (!wrap) return;

  // Keep the category rail below the full menu header in normal flow.
  // The sticky positioning routine handles only the viewport lane.
  var headRect = head && head.getBoundingClientRect();
  if (headRect && headRect.height) {
    var wrapRect = wrap.getBoundingClientRect();
    var wrapStyle = window.getComputedStyle(wrap);
    var wrapContentTop = wrapRect.top
      + (parseFloat(wrapStyle.paddingTop) || 0)
      + (parseFloat(wrapStyle.borderTopWidth) || 0);
    // Delivery rail is aligned to the menu card itself; it must not follow subfilter or search rows.
    var isDeliveryBrand = document.documentElement.dataset.brand === 'delivery';
    var menuRow = head.querySelector('.menu-controls-row');
    var modeSeg = document.getElementById('modeSeg');
    var staffGuestMenu = !!(menuRow && modeSeg &&
      modeSeg.closest('.menu-controls-row') === menuRow);
    var mobileViewport = window.matchMedia && window.matchMedia('(max-width: 820px)').matches;
    var catalog = document.querySelector(isDeliveryBrand ? '#deliveryView #deliveryGrid' : '#menuView #grid');
    var catalogRect = catalog && catalog.getBoundingClientRect();
    var desiredTop = catalogRect ? catalogRect.top : (staffGuestMenu ? headRect.bottom + 12 : headRect.top);
    var marginTop = Math.max(0, desiredTop - wrapContentTop) + 'px';
    if (rail.style.marginTop !== marginTop) rail.style.marginTop = marginTop;
    if (!isDeliveryBrand && rail.style.height) rail.style.removeProperty('height');
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