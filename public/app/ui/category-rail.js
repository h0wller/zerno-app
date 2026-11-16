/* public/app/ui/category-rail.js
   Shared rail geometry and transient scroll fade. The storefront modules own
   category state and DOM; this module owns only viewport positioning/presentation. */
var railHeadObserver = null;
var observedRailHead = null;
var observedRailTopbar = null;
var railStickyLayout = null;
var railFadeTimer = null;
var railScrollTick = false;

function updateRailStickyPosition(rail, head) {
  if (!rail || !head) return;

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
  railStickyLayout = null;
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

function activeRail() {
  var isDelivery = document.documentElement.dataset.brand === 'delivery';
  return document.getElementById(isDelivery ? 'deliveryRail' : 'rail');
}

function markRailScrolling() {
  var rail = activeRail();
  if (rail) rail.classList.add('is-scroll-fading');
  if (railFadeTimer) window.clearTimeout(railFadeTimer);
  railFadeTimer = window.setTimeout(function () {
    var currentRail = activeRail();
    if (currentRail) currentRail.classList.remove('is-scroll-fading');
    railFadeTimer = null;
  }, 260);
}

window.alignRailWithCard = alignRailWithCard;

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
