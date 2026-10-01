/* public/app/ui/scrolltop.js — синхронизация положения рейла и бонусов */
function alignRailWithCard() {
  var rail = document.getElementById('rail') || document.querySelector('.rail, #deliveryRail');
  if (!rail) return;
  if (window.innerWidth >= 821) {
    rail.style.marginTop = '';
    return;
  }
  var card = document.querySelector('#deliveryView:not([hidden]) .card, #menuView:not([hidden]) .card, .card');
  if (!card) return;
  var wrap = rail.closest('.wrap') || document.querySelector('.wrap');
  if (wrap) {
    var wrapTop = wrap.getBoundingClientRect().top + window.scrollY;
    var cardTop = card.getBoundingClientRect().top + window.scrollY;
    var offset = Math.max(0, Math.round(cardTop - wrapTop));
    rail.style.marginTop = offset + 'px';
  }
}

function alignMbonusWithRail() {
  if (window.innerWidth > 1180) return;
  var mb = document.getElementById('mbonusBtn');
  var railBtn = document.querySelector('.wrap .rail button, .wrap #deliveryRail button');
  if (!mb || !railBtn) return;
  var rRect = railBtn.getBoundingClientRect();
  if (rRect.width > 0) {
    if (window.innerWidth >= 821) { mb.style.left = Math.round(rRect.left) + 'px'; } else { mb.style.left = ""; mb.style.width = ""; mb.style.minWidth = ""; mb.style.maxWidth = ""; }
    if (window.innerWidth >= 821) { mb.style.width = Math.round(rRect.width) + 'px'; } else { mb.style.left = ""; mb.style.width = ""; mb.style.minWidth = ""; mb.style.maxWidth = ""; }
    if (window.innerWidth >= 821) { mb.style.minWidth = Math.round(rRect.width) + 'px'; } else { mb.style.left = ""; mb.style.width = ""; mb.style.minWidth = ""; mb.style.maxWidth = ""; }
    if (window.innerWidth >= 821) { mb.style.maxWidth = Math.round(rRect.width) + 'px'; } else { mb.style.left = ""; mb.style.width = ""; mb.style.minWidth = ""; mb.style.maxWidth = ""; }
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
