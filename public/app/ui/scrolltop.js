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
    // Keep the rail in normal flow until it reaches the pin threshold.
    // The pinning controller applies the fixed viewport geometry.
    rail.style.position = 'relative';
    rail.style.top = 'auto';
    rail.style.maxHeight = 'none';
    rail.style.overflowY = 'hidden';
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

  if (!rail) {
    railDesktopAnchor = null;
    return;
  }

  // Only one brand rail can own the fixed viewport slot. When the brand changes,
  // restore the previous rail and remove its spacer before the newly visible rail
  // is measured; otherwise the old placeholder returns with the hidden view.
  if (railPinState && railPinState.rail !== rail) {
    clearRailPin(railPinState.rail);
  }

  // Late font/ResizeObserver callbacks must not overwrite the mobile fixed
  // geometry while the pinning controller owns this rail.
  if (railPinState && railPinState.rail === rail) return;

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

// Keep the mobile category rail pinned at its viewport offset while scrolling.
var railPinnedClassName = 'rail-is-pinned';
var railPinState = null;
var railPinPreserveDuringScroll = false;
var railPinSettleFrame = 0;

function getRailStickyTop() {
  var topbar = document.querySelector('header.topbar');
  var style = topbar ? getComputedStyle(topbar) : null;
  var isSticky = !!(style && (style.position === 'sticky' || style.position === 'fixed'));
  return isSticky && topbar ? Math.ceil(topbar.getBoundingClientRect().height) : 12;
}

function clearRailPin(rail) {
  railPinPreserveDuringScroll = false;
  if (railPinSettleFrame) window.cancelAnimationFrame(railPinSettleFrame);
  railPinSettleFrame = 0;
  if (!railPinState) {
    if (rail) rail.classList.remove(railPinnedClassName);
    return;
  }

  var pinnedRail = railPinState.rail;
  if (railPinState.spacer && railPinState.spacer.parentNode) {
    railPinState.spacer.parentNode.removeChild(railPinState.spacer);
  }
  if (pinnedRail) {
    pinnedRail.classList.remove(railPinnedClassName);
    pinnedRail.style.removeProperty('--rail-pinned-top');
    pinnedRail.style.removeProperty('--rail-pinned-left');
    pinnedRail.style.removeProperty('--rail-pinned-width');
    var original = railPinState.inline;
    pinnedRail.style.position = original.position;
    pinnedRail.style.top = original.top;
    pinnedRail.style.left = original.left;
    pinnedRail.style.width = original.width;
    pinnedRail.style.maxWidth = original.maxWidth;
    pinnedRail.style.margin = original.margin;
  }
  railPinState = null;
}

function pinRailAtViewportTop(rail, stickyTop) {
  if (railPinState && railPinState.rail === rail) return;

  var rect = rail.getBoundingClientRect();
  var style = getComputedStyle(rail);
  var spacer = document.createElement('div');
  spacer.className = 'rail-pin-spacer';
  spacer.setAttribute('aria-hidden', 'true');
  spacer.style.cssText = [
    'display:block',
    'box-sizing:border-box',
    'width:' + rect.width + 'px',
    'height:' + rect.height + 'px',
    'margin-top:' + style.marginTop,
    'margin-right:' + style.marginRight,
    'margin-bottom:' + style.marginBottom,
    'margin-left:' + style.marginLeft,
    'visibility:hidden',
    'pointer-events:none'
  ].join(';');
  rail.parentNode.insertBefore(spacer, rail);

  railPinState = {
    rail: rail,
    spacer: spacer,
    documentTop: rect.top + (window.scrollY || document.documentElement.scrollTop || 0),
    parent: rail.parentElement,
    inline: {
      position: rail.style.position,
      top: rail.style.top,
      left: rail.style.left,
      width: rail.style.width,
      maxWidth: rail.style.maxWidth,
      margin: rail.style.margin
    }
  };
  rail.style.setProperty('--rail-pinned-top', stickyTop + 'px');
  rail.style.setProperty('--rail-pinned-left', rect.left + 'px');
  rail.style.setProperty('--rail-pinned-width', rect.width + 'px');
  rail.style.position = 'fixed';
  rail.style.top = stickyTop + 'px';
  rail.style.left = rect.left + 'px';
  rail.style.width = rect.width + 'px';
  rail.style.maxWidth = rect.width + 'px';
  rail.style.margin = '0';
  rail.classList.add(railPinnedClassName);
}

function updateRailPinning() {
  var isMobileRail = window.innerWidth <= 820;
  var isDelivery = document.documentElement.dataset.brand === 'delivery';
  var rail = document.getElementById(isDelivery ? 'deliveryRail' : 'rail');

  if (!rail) return;
  if (!isMobileRail) {
    clearRailPin(rail);
    return;
  }

  var scrollY = window.scrollY || document.documentElement.scrollTop || 0;
  var stickyTop = getRailStickyTop();
  var documentTop = railPinState && railPinState.rail === rail
    ? railPinState.documentTop
    : rail.getBoundingClientRect().top + scrollY;
  var pinThreshold = documentTop - stickyTop;
  var hasReachedPinPoint = scrollY >= pinThreshold;

  // Keep the existing fixed rail while category navigation scrolls the new
  // catalog section into place. The threshold has already been recalibrated.
  if (railPinPreserveDuringScroll && railPinState && railPinState.rail === rail) {
    pinRailAtViewportTop(rail, stickyTop);
    return;
  }

  if (!hasReachedPinPoint) {
    clearRailPin(rail);
    return;
  }

  pinRailAtViewportTop(rail, stickyTop);
}

// Scroll restoration can happen before this module subscribes to scroll events.
// Re-check after load/pageshow and two paint frames so the restored position and
// final layout are both available before deciding whether the rail is pinned.
function scheduleRailPinningUpdate() {
  window.requestAnimationFrame(function () {
    window.requestAnimationFrame(updateRailPinning);
  });
}

// Bring the newly selected catalog section to the first visible position
// without covering it with the pinned mobile rail.
window.scrollMenuContentToStart = function (contentSelector, railSelector, preservePinned) {
  var content = document.querySelector(contentSelector);
  if (!content) return;

  var viewportTop = 12;
  var rail = document.querySelector(railSelector);
  if (preservePinned && rail && !rail.classList.contains(railPinnedClassName)) {
    pinRailAtViewportTop(rail, getRailStickyTop());
  }
  if (rail && rail.classList.contains(railPinnedClassName)) {
    viewportTop = rail.getBoundingClientRect().bottom + 8;
  } else {
    var topbar = document.querySelector('header.topbar');
    var topbarStyle = topbar ? window.getComputedStyle(topbar) : null;
    var topbarSticky = !!(topbarStyle &&
      (topbarStyle.position === 'sticky' || topbarStyle.position === 'fixed'));
    if (topbarSticky && topbar) {
      viewportTop = topbar.getBoundingClientRect().bottom + 12;
    }
  }

  var targetTop = content.getBoundingClientRect().top +
    (window.scrollY || document.documentElement.scrollTop || 0);
  var nextScrollY = Math.max(0, targetTop - viewportTop);
  var pinAfterScroll = !!(rail && rail.classList.contains(railPinnedClassName) &&
    railPinState && railPinState.rail === rail);
  if (pinAfterScroll) {
    // The category replacement changes the catalog's document geometry. Keep
    // the rail pinned across that repositioning instead of reusing its old
    // threshold, which may become later than the new scroll position.
    var pinState = railPinState;
    var pinnedTop = getRailStickyTop();
    var nextDocumentTop = nextScrollY + pinnedTop;
    pinState.documentTop = Math.min(pinState.documentTop, nextDocumentTop - 2);
    railPinPreserveDuringScroll = true;
    if (railPinSettleFrame) window.cancelAnimationFrame(railPinSettleFrame);
    var lastScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    var stableFrames = 0;
    var observedScrollMovement = false;
    var settleFrames = 0;
    var finishPinPreservation = function () {
      railPinPreserveDuringScroll = false;
      railPinSettleFrame = 0;
      updateRailPinning();
    };
    var waitForScrollToSettle = function () {
      var currentScrollY = window.scrollY || document.documentElement.scrollTop || 0;
      var moved = Math.abs(currentScrollY - lastScrollY) >= 0.5;
      if (moved) {
        observedScrollMovement = true;
        stableFrames = 0;
      } else if (observedScrollMovement || Math.abs(currentScrollY - nextScrollY) <= 1) {
        stableFrames += 1;
      }
      lastScrollY = currentScrollY;
      settleFrames += 1;
      if (stableFrames >= 3 || settleFrames >= 120) {
        finishPinPreservation();
        return;
      }
      railPinSettleFrame = window.requestAnimationFrame(waitForScrollToSettle);
    };
    railPinSettleFrame = window.requestAnimationFrame(waitForScrollToSettle);
  }
  window.scrollTo({ top: nextScrollY, behavior: 'smooth' });
};

window.addEventListener('scroll', updateRailPinning, { passive: true });
window.addEventListener('load', scheduleRailPinningUpdate, { once: true });
window.addEventListener('pageshow', scheduleRailPinningUpdate);
if (document.readyState === 'complete') scheduleRailPinningUpdate();
window.addEventListener('resize', function () {
  var isDelivery = document.documentElement.dataset.brand === 'delivery';
  var rail = document.getElementById(isDelivery ? 'deliveryRail' : 'rail');
  clearRailPin(rail);
}, { passive: true });

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