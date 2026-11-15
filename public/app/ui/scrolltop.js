/* public/app/ui/scrolltop.js — сброс легаси-отступов и кнопка «Наверх»
   Ф5.71: CSS в theme/*.css, устранение MutationObserver в пользу детерминированного updateScrollTop. */
var railHeadObserver = null;
var observedRailHead = null;
var observedRailTopbar = null;

var railStickyLayout = null;
var railDesktopAnchor = null;

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
    railStickyLayout = null;
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
    var scrollY = window.scrollY || document.documentElement.scrollTop || 0;

    if (!railStickyLayout || railStickyLayout.rail !== rail) {
      railStickyLayout = {
        rail: rail,
        documentTop: rail.getBoundingClientRect().top + scrollY
      };
    }

    // Preserve the catalog-aligned start; engage sticky only once the page begins scrolling.
    var shouldStick = scrollY > 0 && scrollY >= railStickyLayout.documentTop - stickyTop;
    if (shouldStick) {
      rail.style.position = 'sticky';
      rail.style.top = stickyTop + 'px';
      rail.style.maxHeight = 'none';
      rail.style.overflowY = 'hidden';
      rail.style.alignSelf = 'stretch';
    } else {
      rail.style.position = 'relative';
      rail.style.top = 'auto';
      rail.style.maxHeight = 'none';
      rail.style.overflowY = '';
      rail.style.alignSelf = 'start';
    }
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

  if (!rail) return;
  var mobileViewport = usesHorizontalCategoryRailViewport();
  var wrap = rail.parentElement;
  if (!wrap) return;

  // Horizontal rails follow the menu header in normal flow. Desktop sidebars
  // start at the first catalog row, but keep that document-space anchor while
  // optional delivery filters expand/collapse during category switches.
  if (mobileViewport) {
    railDesktopAnchor = null;
    rail.style.removeProperty('margin-top');
    rail.style.removeProperty('height');
  } else {
    var grid = document.querySelector(isDelivery ? '#deliveryGrid' : '#grid');
    var viewportKey = window.innerWidth + 'x' + window.innerHeight;
    var anchorChanged = !railDesktopAnchor ||
      railDesktopAnchor.rail !== rail ||
      railDesktopAnchor.wrap !== wrap ||
      railDesktopAnchor.brand !== (isDelivery ? 'delivery' : 'coffee') ||
      railDesktopAnchor.viewportKey !== viewportKey;

    if (anchorChanged && grid) {
      var gridRect = grid.getBoundingClientRect();
      railDesktopAnchor = {
        rail: rail,
        wrap: wrap,
        brand: isDelivery ? 'delivery' : 'coffee',
        viewportKey: viewportKey,
        documentTop: gridRect.top + (window.scrollY || document.documentElement.scrollTop || 0)
      };
    }

    if (railDesktopAnchor && railDesktopAnchor.rail === rail) {
      var wrapRect = wrap.getBoundingClientRect();
      var wrapStyle = window.getComputedStyle(wrap);
      var wrapContentTop = wrapRect.top
        + (parseFloat(wrapStyle.paddingTop) || 0)
        + (parseFloat(wrapStyle.borderTopWidth) || 0);
      var scrollY = window.scrollY || document.documentElement.scrollTop || 0;
      var marginTop = Math.max(0, railDesktopAnchor.documentTop - (wrapContentTop + scrollY)) + 'px';
      if (rail.style.marginTop !== marginTop) rail.style.marginTop = marginTop;
    }
    railStickyLayout = null;
    rail.style.position = 'relative';
    rail.style.top = 'auto';
    rail.style.maxHeight = 'none';
    rail.style.overflowY = '';
    rail.style.alignSelf = 'stretch';
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