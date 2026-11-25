/* public/app/ui/category-rail.js
   Shared rail viewport positioning and transient scroll fade.
   menu.js / delivery.js own category state and markup; CSS owns the capsule geometry. */
var railHeadObserver = null;
var observedRailHead = null;
var observedRailTopbar = null;
var railStickyLayout = null;
var railDesktopAnchor = new WeakMap();
var fadedElements = [];
var railScrollLastY = null;
var railScrollDirection = 0;
var railScrollDirectionDistance = 0;
var railScrollHidden = false;
var RAIL_SCROLL_DIRECTION_THRESHOLD = 8;
var programmaticScrollToTop = false;
var programmaticScrollToTopTimer = null;
var railScrollTick = false;

function usesFloatingCategoryRailViewport() {
  return !!(window.matchMedia && window.matchMedia(
    '(max-width: 820px), (min-width: 821px) and (orientation: landscape) and (max-height: 480px)'
  ).matches);
}

function clearRailInlineLayout(rail) {
  [
    'position',
    'top',
    'right',
    'bottom',
    'left',
    'max-height',
    'overflow-y',
    'align-self',
    'transform',
    'margin-top',
    'height'
  ].forEach(function (property) {
    rail.style.removeProperty(property);
  });
}

function updateRailStickyPosition(rail, head) {
  if (!rail) return;

  /* The fixed capsule is entirely CSS-owned; do not let legacy sticky inline styles win. */
  if (usesFloatingCategoryRailViewport()) {
    railStickyLayout = null;
    clearRailInlineLayout(rail);
    rail.classList.add('rail-position-ready');
    return;
  }

  if (!head) return;
  if (!head.getBoundingClientRect().height) {
    railStickyLayout = null;
    rail.classList.remove('rail-position-ready');
    return;
  }

  var mobileViewport = window.matchMedia && window.matchMedia('(max-width: 820px)').matches;
  if (mobileViewport) {
    var viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    var maxRailHeight = Math.max(0, viewportHeight - 24);
    var visibleRailHeight = Math.min(rail.scrollHeight, maxRailHeight);
    var stickyTop = Math.max(12, (viewportHeight - visibleRailHeight) / 2);
    var scrollY = window.scrollY || document.documentElement.scrollTop || 0;

    if (!railStickyLayout || railStickyLayout.rail !== rail) {
      railStickyLayout = {
        rail: rail,
        documentTop: rail.getBoundingClientRect().top + scrollY
      };
    }

    var shouldStick = scrollY > 0 && scrollY >= railStickyLayout.documentTop - stickyTop;
    if (shouldStick) {
      rail.style.position = 'sticky';
      rail.style.top = stickyTop + 'px';
      rail.style.maxHeight = maxRailHeight + 'px';
      rail.style.overflowY = rail.scrollHeight > maxRailHeight ? 'auto' : 'visible';
      rail.style.alignSelf = 'start';
    } else {
      rail.style.position = 'relative';
      rail.style.top = 'auto';
      rail.style.maxHeight = 'none';
      rail.style.overflowY = '';
      rail.style.alignSelf = 'start';
    }
  } else {
    var scrollY = window.scrollY || document.documentElement.scrollTop || 0;
    var topbar = document.querySelector('header.topbar');
    var stickyTop = Math.max(12, (topbar ? topbar.getBoundingClientRect().bottom : 0) + 12);
    var desktopMaxHeight = Math.max(0, (window.innerHeight || document.documentElement.clientHeight) - stickyTop - 12);

    if (!railStickyLayout || railStickyLayout.rail !== rail) {
      railStickyLayout = {
        rail: rail,
        documentTop: rail.getBoundingClientRect().top + scrollY
      };
    }

    var shouldStick = scrollY > 0 && scrollY >= railStickyLayout.documentTop - stickyTop;
    if (shouldStick) {
      rail.style.position = 'sticky';
      rail.style.top = stickyTop + 'px';
      var maxRailHeight = Math.min(460, desktopMaxHeight);
      rail.style.maxHeight = maxRailHeight + 'px';
      rail.style.overflowY = rail.scrollHeight > maxRailHeight ? 'auto' : 'visible';
      rail.style.alignSelf = 'start';
    } else {
      railStickyLayout = null;
      rail.style.position = 'relative';
      rail.style.top = 'auto';
      rail.style.maxHeight = 'none';
      rail.style.overflowY = '';
      rail.style.alignSelf = 'start';
    }
  }

  rail.style.transform = 'none';
  rail.classList.add('rail-position-ready');
}

function alignRailWithCard() {
  var isDelivery = document.documentElement.dataset.brand === 'delivery';
  var rail = document.getElementById(isDelivery ? 'deliveryRail' : 'rail');
  var head = document.querySelector(isDelivery ? '#deliveryView .menu-head' : '#menuView .menu-head');

  if (!rail) return;
  railStickyLayout = null;

  if (usesFloatingCategoryRailViewport()) {
    railDesktopAnchor.delete(rail);
    clearRailInlineLayout(rail);
    rail.classList.add('rail-position-ready');
  } else {
    rail.style.position = 'relative';
    rail.style.top = 'auto';
    rail.style.maxHeight = 'none';
    rail.style.overflowY = '';
    rail.style.alignSelf = 'start';

    var wrap = rail.parentElement;
    if (!wrap) return;

    var headRect = head && head.getBoundingClientRect();
    if (headRect && headRect.height) {
      var wrapRect = wrap.getBoundingClientRect();
      var wrapStyle = window.getComputedStyle(wrap);
      var wrapContentTop = wrapRect.top
        + (parseFloat(wrapStyle.paddingTop) || 0)
        + (parseFloat(wrapStyle.borderTopWidth) || 0);
      var isDeliveryBrand = document.documentElement.dataset.brand === 'delivery';
      var menuRow = head.querySelector('.menu-controls-row');
      var modeSeg = document.getElementById('modeSeg');
      var staffGuestMenu = !!(menuRow && modeSeg &&
        modeSeg.closest('.menu-controls-row') === menuRow);
      var catalog = document.querySelector(isDeliveryBrand ? '#deliveryView #deliveryGrid' : '#menuView #grid');
      var catalogRect = catalog && catalog.getBoundingClientRect();
      var desiredTop = catalogRect ? catalogRect.top : (staffGuestMenu ? headRect.bottom + 12 : headRect.top);
      var anchorState = railDesktopAnchor.get(rail);
      if (!anchorState || anchorState.headHeight !== headRect.height) {
        var marginTop = Math.max(0, desiredTop - wrapContentTop) + 'px';
        railDesktopAnchor.set(rail, { marginTop: marginTop, headHeight: headRect.height });
      }
      var capturedMarginTop = railDesktopAnchor.get(rail).marginTop;
      if (rail.style.marginTop !== capturedMarginTop) rail.style.marginTop = capturedMarginTop;
      if (!isDeliveryBrand && rail.style.height) rail.style.removeProperty('height');
    } else if (rail.style.marginTop !== '0px') {
      rail.style.marginTop = '0px';
    }

    updateRailStickyPosition(rail, head);
  }

  var topbar = document.querySelector('header.topbar');
  if (typeof ResizeObserver === 'function' && (observedRailHead !== head || observedRailTopbar !== topbar)) {
    if (railHeadObserver) railHeadObserver.disconnect();
    railHeadObserver = new ResizeObserver(alignRailWithCard);
    observedRailHead = head;
    observedRailTopbar = topbar;
    if (head) railHeadObserver.observe(head);
    if (topbar) railHeadObserver.observe(topbar);
  }

  if (!window.matchMedia || !window.matchMedia('(max-width: 820px)').matches) {
    resetRailScrollDirection(readPageScrollY());
    setRailScrollHidden(false);
  } else {
    applyScrollFadeState(railScrollHidden);
  }
}

function activeRail() {
  var isDelivery = document.documentElement.dataset.brand === 'delivery';
  return document.getElementById(isDelivery ? 'deliveryRail' : 'rail');
}

function clearScrollFade() {
  railScrollHidden = false;
  fadedElements.forEach(function (element) {
    if (element && element.classList) element.classList.remove('is-scroll-fading');
  });
  fadedElements = [];
}

function currentScrollFadeTargets() {
  var targets = [];
  var rail = activeRail();
  if (rail) targets.push(rail);

  var cartFab = document.getElementById('cartFab');
  var cartOpen = document.body.classList.contains('cart-open') ||
    !!document.querySelector('#cartPanel.open');
  if (cartFab && !cartFab.hidden && cartFab.classList.contains('visible') && !cartOpen) {
    targets.push(cartFab);
  }
  return targets;
}

function readPageScrollY() {
  return Math.max(0, window.scrollY || document.documentElement.scrollTop || 0);
}

function resetRailScrollDirection(position) {
  railScrollLastY = typeof position === 'number' ? position : readPageScrollY();
  railScrollDirection = 0;
  railScrollDirectionDistance = 0;
}

function applyScrollFadeState(hidden) {
  var targets = currentScrollFadeTargets();
  fadedElements.forEach(function (element) {
    if (targets.indexOf(element) === -1) element.classList.remove('is-scroll-fading');
  });
  fadedElements = targets;
  fadedElements.forEach(function (element) {
    element.classList.toggle('is-scroll-fading', hidden);
  });
}

function setRailScrollHidden(hidden) {
  railScrollHidden = hidden;
  applyScrollFadeState(hidden);
}

function markRailScrolling() {
  var currentY = readPageScrollY();
  if (railScrollLastY === null) {
    resetRailScrollDirection(currentY);
    return;
  }

  var delta = currentY - railScrollLastY;
  railScrollLastY = currentY;

  /* The top of the document always wins, including the final inertial scroll frame. */
  if (currentY <= 0) {
    resetRailScrollDirection(currentY);
    setRailScrollHidden(false);
    return;
  }

  /* App-driven category alignment must never change the user's rail visibility state. */
  if (programmaticScrollToTop) {
    resetRailScrollDirection(currentY);
    return;
  }

  /* Preserve the existing contract: fade only portrait/tablet rails, not compact landscape or desktop. */
  if (!window.matchMedia || !window.matchMedia('(max-width: 820px)').matches) {
    resetRailScrollDirection(currentY);
    setRailScrollHidden(false);
    return;
  }

  if (delta === 0) return;

  var nextDirection = delta > 0 ? 1 : -1;
  if (nextDirection !== railScrollDirection) {
    railScrollDirection = nextDirection;
    railScrollDirectionDistance = delta;
  } else {
    railScrollDirectionDistance += delta;
  }

  if (nextDirection > 0 &&
      railScrollDirectionDistance >= RAIL_SCROLL_DIRECTION_THRESHOLD &&
      !railScrollHidden) {
    setRailScrollHidden(true);
  } else if (nextDirection < 0 &&
      railScrollDirectionDistance <= -RAIL_SCROLL_DIRECTION_THRESHOLD &&
      railScrollHidden) {
    setRailScrollHidden(false);
  }
}

function finishProgrammaticScrollToTop() {
  if (programmaticScrollToTopTimer) {
    window.clearTimeout(programmaticScrollToTopTimer);
    programmaticScrollToTopTimer = null;
  }
  programmaticScrollToTop = false;
  resetRailScrollDirection(readPageScrollY());
}

function cancelProgrammaticScrollToTop() {
  if (!programmaticScrollToTop) return;
  finishProgrammaticScrollToTop();
}

/* Any scroll started by the app itself (retap of the active category, switching category)
   must not fade the rail: the user did not scroll, so the capsule has to stay visible. */
window.scrollToWithoutRailFade = function (top) {
  finishProgrammaticScrollToTop();
  clearScrollFade();
  var currentY = window.scrollY || document.documentElement.scrollTop || 0;
  if (top <= 0 ? currentY <= 0 : Math.abs(currentY - top) < 1) return;

  programmaticScrollToTop = true;
  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: top, behavior: reduceMotion ? 'auto' : 'smooth' });

  /* scrollend is authoritative; timeout is a fallback for older WebKit versions. */
  programmaticScrollToTopTimer = window.setTimeout(finishProgrammaticScrollToTop, 2500);
};

window.scrollToTopWithoutRailFade = function () {
  window.scrollToWithoutRailFade(0);
};

window.addEventListener('scrollend', function () {
  if (programmaticScrollToTop) finishProgrammaticScrollToTop();
}, { passive: true });
['wheel', 'touchstart', 'pointerdown'].forEach(function (eventName) {
  window.addEventListener(eventName, cancelProgrammaticScrollToTop, { passive: true });
});

window.alignRailWithCard = alignRailWithCard;
window.usesHorizontalCategoryRailViewport = usesFloatingCategoryRailViewport;

resetRailScrollDirection(readPageScrollY());

window.addEventListener('scroll', function () {
  markRailScrolling();
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
