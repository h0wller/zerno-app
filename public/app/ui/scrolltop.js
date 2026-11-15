/* public/app/ui/scrolltop.js — сброс легаси-отступов и кнопка «Наверх»
   Ф5.71: CSS в theme/*.css, устранение MutationObserver в пользу детерминированного updateScrollTop. */
var railHeadObserver = null;
var observedRailHead = null;
var observedRailTopbar = null;

var railDesktopAnchor = null;
var railAnchorReady = false;

function usesHorizontalCategoryRailViewport() {
  if (window.matchMedia) {
    return window.matchMedia('(max-width: 820px), (min-width: 821px) and (orientation: landscape) and (max-height: 480px)').matches;
  }
  return window.innerWidth <= 820 ||
    (window.innerWidth > 820 && window.innerWidth > window.innerHeight && window.innerHeight <= 480);
}

function updateRailStickyPosition(rail, head) {
  if (!rail || !head) return;

  if (!head.getBoundingClientRect().height) {
    rail.classList.remove('rail-position-ready');
    return;
  }

  var mobileViewport = usesHorizontalCategoryRailViewport();
  if (mobileViewport && window.innerWidth <= 820) {
    var topbar = document.querySelector('header.topbar');
    var topbarStyle = topbar ? window.getComputedStyle(topbar) : null;
    var topbarIsSticky = !!(topbarStyle && (topbarStyle.position === 'sticky' || topbarStyle.position === 'fixed'));
    var stickyTop = topbarIsSticky && topbar
      ? Math.ceil(topbar.getBoundingClientRect().height)
      : 12;
    // Use native CSS sticky from the first paint. The browser keeps the rail
    // in normal flow until it reaches the header, then pins it during scrolling.
    // Do not toggle position from a scroll listener: iOS Safari may deliver
    // scroll events after momentum scrolling has already settled.
    rail.style.position = 'sticky';
    rail.style.top = stickyTop + 'px';
    rail.style.maxHeight = 'none';
    rail.style.overflowY = 'hidden';
    rail.style.alignSelf = 'start';
  } else {
    railStickyLayout = null;
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

  if (!rail) {
    railDesktopAnchor = null;
    return;
  }
  railStickyLayout = null;
  rail.style.position = 'relative';
  rail.style.top = 'auto';
  rail.style.maxHeight = 'none';
  rail.style.overflowY = '';
  rail.style.alignSelf = 'start';
  var wrap = rail.parentElement;
  if (!wrap) {
    railDesktopAnchor = null;
    return;
  }

  var horizontalViewport = usesHorizontalCategoryRailViewport();
  var headRect = head && head.getBoundingClientRect();
  if (horizontalViewport) {
    // Horizontal navigation is in the menu's normal flow, not the desktop grid.
    // Drop the desktop anchor; it will be captured again when the rail returns
    // to the sidebar column after a breakpoint/orientation transition.
    railDesktopAnchor = null;
    rail.style.removeProperty('margin-top');
  } else if (headRect && headRect.height) {
    var wrapRect = wrap.getBoundingClientRect();
    var wrapStyle = window.getComputedStyle(wrap);
    var wrapContentTop = wrapRect.top
      + (parseFloat(wrapStyle.paddingTop) || 0)
      + (parseFloat(wrapStyle.borderTopWidth) || 0);
    var catalog = document.querySelector(isDelivery ? '#deliveryView #deliveryGrid' : '#menuView #grid');
    var catalogRect = catalog && catalog.getBoundingClientRect();

    var anchorOffset;
    if (!railAnchorReady) {
      // Font fallback metrics can move the menu header and catalog after first paint.
      // Keep a provisional header-relative position, but do not freeze the desktop
      // anchor until document.fonts.ready has settled.
      railDesktopAnchor = null;
      anchorOffset = Math.max(0, headRect.bottom + 12 - wrapContentTop);
    } else {
      // Capture the first catalog row once after initial typography has settled.
      // Category changes may move the grid; they must not move the desktop rail.
      var anchorMatches = railDesktopAnchor &&
        railDesktopAnchor.rail === rail &&
        railDesktopAnchor.wrap === wrap &&
        railDesktopAnchor.brand === document.documentElement.dataset.brand;
      if (!anchorMatches) railDesktopAnchor = null;
      if (!railDesktopAnchor && catalog && catalog.getClientRects().length && catalogRect) {
        railDesktopAnchor = {
          rail: rail,
          wrap: wrap,
          brand: document.documentElement.dataset.brand,
          offset: Math.max(0, catalogRect.top - wrapContentTop)
        };
      }
      anchorOffset = railDesktopAnchor
        ? railDesktopAnchor.offset
        : Math.max(0, headRect.bottom + 12 - wrapContentTop);
    }
    var marginTop = anchorOffset + 'px';
    if (rail.style.marginTop !== marginTop) rail.style.marginTop = marginTop;
    if (!isDelivery && rail.style.height) rail.style.removeProperty('height');
  } else if (rail.style.marginTop !== '0px') {
    railDesktopAnchor = null;
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
window.alignRailWithCard = alignRailWithCard;

function settleInitialRailAnchor() {
  var fontsReady = document.fonts && document.fonts.ready;
  function finalize() {
    railAnchorReady = true;
    railDesktopAnchor = null;
    alignRailWithCard();
  }
  if (fontsReady && typeof fontsReady.then === 'function') {
    fontsReady.then(finalize, finalize);
  } else {
    finalize();
  }
}
if (document.readyState === 'complete') {
  settleInitialRailAnchor();
} else {
  // Wait until stylesheets are loaded before taking the font-ready snapshot;
  // otherwise an early empty FontFaceSet promise can resolve before theme CSS.
  window.addEventListener('load', settleInitialRailAnchor, { once: true });
}

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