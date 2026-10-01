/* public/app/ui/scrolltop.js — синхронизация положения рейла и бонусов */
function alignRailWithCard() {
  if (window.innerWidth > 1180) {
    var rAll = document.querySelectorAll('.wrap .rail, .wrap #deliveryRail');
    rAll.forEach(function (r) { r.style.marginTop = ''; });
    return;
  }

  var isDel = (typeof brand !== 'undefined' && brand === 'delivery') || document.documentElement.getAttribute('data-brand') === 'delivery';
  var rail = isDel
    ? (document.getElementById('deliveryRail') || document.querySelector('.wrap .rail'))
    : (document.getElementById('rail') || document.querySelector('.wrap .rail'));
  if (!rail) return;

  var card = isDel
    ? document.querySelector('#deliveryGrid .card:not(.skeleton-card)')
    : document.querySelector('#grid .card:not(.skeleton-card)');
  if (!card) return;

  // Сбрасываем margin перед расчетом
  rail.style.marginTop = '0px';
  var cardTop = card.getBoundingClientRect().top;
  var railTop = rail.getBoundingClientRect().top;
  var diff = Math.max(0, Math.round(cardTop - railTop));
  rail.style.marginTop = diff + 'px';

  alignMbonusWithRail();
}

function alignMbonusWithRail() {
  if (window.innerWidth > 1180) return;
  var mb = document.getElementById('mbonusBtn');
  var isDel = (typeof brand !== 'undefined' && brand === 'delivery');
  if (!mb || isDel) return;

  var rail = document.querySelector('.wrap .rail:not([style*="display: none"])') || document.getElementById('rail');
  var railBtn = rail && rail.querySelector('button');
  if (!railBtn) return;

  var rRect = railBtn.getBoundingClientRect();
  if (rRect.width > 0) {
    mb.style.setProperty('left', Math.round(rRect.left) + 'px', 'important');
    mb.style.setProperty('width', Math.round(rRect.width) + 'px', 'important');
    mb.style.setProperty('min-width', Math.round(rRect.width) + 'px', 'important');
    mb.style.setProperty('max-width', Math.round(rRect.width) + 'px', 'important');
    mb.style.setProperty('margin', '0', 'important');
    mb.style.setProperty('box-sizing', 'border-box', 'important');
  }
}

window.alignRailWithCard = alignRailWithCard;
window.alignMbonusWithRail = alignMbonusWithRail;

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

    var dg = document.getElementById('deliveryGrid');
    if (dg) new MutationObserver(alignRailWithCard).observe(dg, { childList: true });

    var g = document.getElementById('grid');
    if (g) new MutationObserver(alignRailWithCard).observe(g, { childList: true });
  }

  btn.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  update();
  setTimeout(alignRailWithCard, 50);
  setTimeout(alignRailWithCard, 300);
  setTimeout(alignRailWithCard, 1000);
})();
