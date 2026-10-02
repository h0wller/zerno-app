/* public/app/ui/scrolltop.js — синхронизация положения рейла и бонусов */

/* [fix-all v5] Единственный владелец positioning рейла.
   — sticky-top = центр экрана (срабатывает, когда natural-top уходит вверх).
   — margin-top  = верх ВИДИМОЙ сетки (#grid либо #deliveryGrid).
   На y=0 rail визуально совпадает с верхом первой карточки,
   при скролле — фиксируется по центру. Без условий на y. */
function alignRailWithCard() {
  var rail = visibleRail();
  if (!rail) return;

  if (window.innerWidth >= 1181) {
    rail.style.top = '';
    rail.style.marginTop = '';
    return;
  }

  var railH = rail.offsetHeight || 0;
  rail.style.top = Math.max(8, Math.round((window.innerHeight - railH) / 2)) + 'px';

  var wrap = rail.parentElement;
  var grid = visibleGrid(rail);
  if (!wrap || !grid) { rail.style.marginTop = ''; return; }

  var wrapStyle = window.getComputedStyle(wrap);
  var wrapInnerTop = wrap.getBoundingClientRect().top + (parseFloat(wrapStyle.paddingTop) || 0);
  var gridTop = grid.getBoundingClientRect().top;
  rail.style.marginTop = Math.max(0, Math.round(gridTop - wrapInnerTop)) + 'px';
}

function visibleRail() {
  var ids = ['rail', 'deliveryRail'];
  for (var i = 0; i < ids.length; i++) {
    var el = document.getElementById(ids[i]);
    if (!el) continue;
    if (el.hidden) continue;
    if (window.getComputedStyle(el).display === 'none') continue;
    return el;
  }
  return null;
}

function visibleGrid(rail) {
  function ok(el) {
    if (!el) return false;
    if (el.hidden) return false;
    if (el.closest && el.closest('[hidden]')) return false;
    if (window.getComputedStyle(el).display === 'none') return false;
    return true;
  }
  var scope = (rail && rail.closest && rail.closest('section')) || document;
  var g = scope.querySelector('#grid');           if (ok(g)) return g;
  g = scope.querySelector('#deliveryGrid');       if (ok(g)) return g;
  g = document.getElementById('grid');            if (ok(g)) return g;
  g = document.getElementById('deliveryGrid');     if (ok(g)) return g;
  return null;
}

function alignMbonusWithRail() {
  /* [fix-all v5] Отключено: mbonusBtn выравнивается гридом в F5.62. */
  var mb = document.getElementById('mbonusBtn');
  if (!mb) return;
  mb.style.left = '';
  mb.style.width = '';
  mb.style.minWidth = '';
  mb.style.maxWidth = '';
  mb.style.margin = '';
}

window.alignRailWithCard = alignRailWithCard;
window.alignMbonusWithRail = alignMbonusWithRail;

(function railScrollLoop() {
  var raf = false;
  function tick() {
    if (raf) return;
    raf = true;
    requestAnimationFrame(function () { raf = false; alignRailWithCard(); });
  }
  window.addEventListener('scroll', tick, { passive: true });
  window.addEventListener('resize', tick);
  window.addEventListener('orientationchange', tick);
  if (typeof MutationObserver !== 'undefined' && document.body) {
    var mo = new MutationObserver(tick);
    ['#menuView', '#deliveryView', '#grid', '#deliveryGrid'].forEach(function (sel) {
      var el = document.querySelector(sel);
      if (el) mo.observe(el, { attributes: true, attributeFilter: ['hidden', 'style', 'class'] });
    });
  }
  setTimeout(alignRailWithCard, 40);
  setTimeout(alignRailWithCard, 250);
  setTimeout(alignRailWithCard, 800);
})();
(function () {
  'use strict';
  var css = document.createElement('style');
  css.textContent =
    '#scrollTopBtn{position:fixed;right:20px;bottom:calc(88px + env(safe-area-inset-bottom,0px));z-index:96;width:48px;height:48px;border-radius:50%;' +
    'border:1.5px solid var(--line);background:var(--card,#fff);color:var(--ink);font-size:20px;line-height:1;' +
    'display:flex;align-items:center;justify-content:center;box-shadow:0 10px 24px -8px rgba(16,20,24,.4);' +
    'opacity:0;pointer-events:none;transform:translateY(10px);transition:opacity .25s,transform .25s}' +
    '#scrollTopBtn.show{opacity:1;pointer-events:auto;transform:none}' +
    '#scrollTopBtn.low{bottom:calc(20px + env(safe-area-inset-bottom,0px))}' +
    '#scrollTopBtn:active{transform:scale(.94)}';
  document.head.appendChild(css);

  var btn = document.createElement('button');
  btn.id = 'scrollTopBtn';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Наверх');
  btn.textContent = '↑';
  document.body.appendChild(btn);

  function update() {
    var chat = document.getElementById('chatPanel');
    var chatOpen = !!(chat && chat.classList.contains('open'));
    var y = window.scrollY || document.documentElement.scrollTop || 0;
    btn.classList.toggle('show', !chatOpen && y > 400);
    var fab = document.getElementById('chatFab');
    btn.classList.toggle('low', !fab || getComputedStyle(fab).display === 'none');
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
  window.addEventListener('resize', function () {
    onScroll();
    alignRailWithCard();
  });
  if (typeof MutationObserver !== 'undefined') {
    var cp = document.getElementById('chatPanel');
    if (cp) new MutationObserver(onScroll).observe(cp, { attributes: true, attributeFilter: ['class'] });
  }
  btn.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  update();
  setTimeout(alignRailWithCard, 40);
  setTimeout(alignRailWithCard, 250);
})();


/* [fix-all v6] topbar-right wrap-toggle */
(function topbarRightToggle() {
  function unwrap() {
    var w = document.querySelector('.topbar-right');
    if (!w || !w.parentNode) return;
    var topbar = w.parentNode;
    while (w.firstChild) topbar.insertBefore(w.firstChild, w);
    w.remove();
  }
  function wrap() {
    var topbar = document.querySelector('.topbar');
    var profile = document.getElementById('profileTopBtn');
    var mbonus = document.getElementById('mbonusBtn');
    if (!topbar || !profile || !mbonus) return;
    if (mbonus.parentElement && mbonus.parentElement.classList.contains('topbar-right')) return;
    var w = document.createElement('div');
    w.className = 'topbar-right';
    mbonus.parentNode.insertBefore(w, mbonus);
    w.appendChild(mbonus);
    w.appendChild(profile);
  }
  function apply() {
    if (window.innerWidth >= 821) wrap();
    else unwrap();
  }
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', apply);
  else apply();
  window.addEventListener('resize', function () {
    clearTimeout(window.__tbT);
    window.__tbT = setTimeout(apply, 100);
  });
  setTimeout(apply, 200);
  setTimeout(apply, 1000);
})();
