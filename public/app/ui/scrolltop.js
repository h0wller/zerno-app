/* public/app/ui/scrolltop.js — синхронизация положения рейла и бонусов */
function alignRailWithCard() {
  if (window.innerWidth > 1180) {
    var rAll = document.querySelectorAll('.wrap .rail, .wrap #deliveryRail');
    rAll.forEach(function (r) { r.style.marginTop = ''; });
    return;
  }
  var rail = document.querySelector('.wrap .rail:not([style*="display: none"]), .wrap #deliveryRail:not([style*="display: none"])');
  if (!rail || !rail.parentElement) return;

  var card = document.querySelector('#deliveryGrid .card, #grid .card, #deliveryView .card, #menuView .card');
  if (!card) return;

  rail.style.marginTop = '0px';
  var cardTop = card.getBoundingClientRect().top;
  var railTop = rail.getBoundingClientRect().top;
  var diff = Math.max(0, Math.round(cardTop - railTop));
  rail.style.marginTop = diff + 'px';

  if (typeof alignMbonusWithRail === 'function') alignMbonusWithRail();
}

function alignMbonusWithRail() {
  if (window.innerWidth > 1180) return;
  var mb = document.getElementById('mbonusBtn');
  var railBtn = document.querySelector('.wrap .rail button, .wrap #deliveryRail button');
  if (!mb || !railBtn) return;
  var rRect = railBtn.getBoundingClientRect();
  if (rRect.width > 0) {
    mb.style.left = Math.round(rRect.left) + 'px';
    mb.style.width = Math.round(rRect.width) + 'px';
    mb.style.minWidth = Math.round(rRect.width) + 'px';
    mb.style.maxWidth = Math.round(rRect.width) + 'px';
    mb.style.margin = '0';
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
  }
  btn.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  update();
  setTimeout(alignRailWithCard, 40);
  setTimeout(alignRailWithCard, 250);
})();
