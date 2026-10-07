/* public/app/ui/scrolltop.js — сброс легаси-отступов и кнопка «Наверх» */
function alignRailWithCard() {
  var r1 = document.getElementById('rail');
  var r2 = document.getElementById('deliveryRail');
  var p = document.getElementById('panel');
  if (r1 && (r1.style.marginTop || r1.style.top)) { r1.style.marginTop = ''; r1.style.top = ''; }
  if (r2 && (r2.style.marginTop || r2.style.top)) { r2.style.marginTop = ''; r2.style.top = ''; }
  if (p && p.style.marginTop) { p.style.marginTop = ''; }
}

function alignMbonusWithRail() {
  var mb = document.getElementById('mbonusBtn');
  if (mb && (mb.style.left || mb.style.width || mb.style.minWidth || mb.style.maxWidth || mb.style.margin)) {
    mb.style.left = '';
    mb.style.width = '';
    mb.style.minWidth = '';
    mb.style.maxWidth = '';
    mb.style.margin = '';
  }
}

window.alignRailWithCard = alignRailWithCard;
window.alignMbonusWithRail = alignMbonusWithRail;

(function () {
  'use strict';

  var btn = document.getElementById('scrollTopBtn');
  if (!btn) {
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

    btn = document.createElement('button');
    btn.id = 'scrollTopBtn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Наверх');
    btn.textContent = '↑';
    document.body.appendChild(btn);
  }

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

  if (typeof MutationObserver !== 'undefined') {
    var cp = document.getElementById('chatPanel');
    if (cp) new MutationObserver(onScroll).observe(cp, { attributes: true, attributeFilter: ['class'] });
  }

  btn.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Запуск не блокирует текущий такт парсинга
  requestAnimationFrame(update);
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply, { once: true });
  } else {
    apply();
  }

  window.addEventListener('resize', function () {
    clearTimeout(window.__tbT);
    window.__tbT = setTimeout(apply, 150);
  }, { passive: true });
})();