/* public/app/ui/scrolltop.js — Ф3.62: кнопка «вверх» над chatFab.
Активный скроллер: .pv открытого профиля (моб.) → #chatMsgs открытого чата → страница.
При открытой корзине кнопка скрыта (sheet накрывает). Overscroll не трогает (см. styles.js). */
(function () {
'use strict';
if (document.getElementById('scrollTopBtn')) return;
var css = document.createElement('style');
css.textContent =
'#scrollTopBtn{position:fixed;right:20px;bottom:calc(88px + env(safe-area-inset-bottom,0px));z-index:97;width:48px;height:48px;border-radius:50%;' +
'border:1.5px solid var(--line);background:var(--card,#fff);color:var(--ink);font-size:20px;line-height:1;' +
'display:flex;align-items:center;justify-content:center;box-shadow:0 10px 26px -8px rgba(16,20,24,.4);' +
'opacity:0;pointer-events:none;transform:translateY(10px);transition:opacity .25s,transform .25s}' +
'#scrollTopBtn.show{opacity:1;pointer-events:auto;transform:none}' +
'#scrollTopBtn.low{bottom:calc(20px + env(safe-area-inset-bottom,0px))}' +
'#scrollTopBtn:active{transform:scale(.94)}';
document.head.appendChild(css);

var btn = document.createElement('button');
btn.id = 'scrollTopBtn'; btn.type = 'button';
btn.setAttribute('aria-label', 'Наверх');
btn.textContent = '↑';
document.body.appendChild(btn);

function panelOpen(){ var p = document.getElementById('panel'); return !!(p && p.classList.contains('open')); }
function chatOpen(){ var c = document.getElementById('chatPanel'); return !!(c && c.classList.contains('open')); }
function cartOpen(){ var c = document.getElementById('cartPanel'); return !!(c && c.classList.contains('open')); }
function isMobile(){ return window.matchMedia('(max-width:1180px)').matches; }

function activeScroller(){
  if (cartOpen()) return null;                      // корзина-штора накрывает — кнопку прячем
  if (isMobile() && panelOpen()){
    var p = document.getElementById('panel');
    return (p && p.querySelector('.pv:not([hidden])')) || null;
  }
  if (chatOpen()) return document.getElementById('chatMsgs');
  return document.scrollingElement || document.documentElement;
}
function topOf(s){
  if (!s) return 0;
  if (s === document.scrollingElement || s === document.documentElement) return window.scrollY || s.scrollTop || 0;
  return s.scrollTop || 0;
}
function update(){
  var s = activeScroller();
  var y = topOf(s);
  var thr = (s && s !== document.scrollingElement && s !== document.documentElement) ? 250 : 400;
  btn.classList.toggle('show', !!s && y > thr);
  var fab = document.getElementById('chatFab');
  btn.classList.toggle('low', !fab || getComputedStyle(fab).display === 'none');
}
var tick = false;
function onScroll(){ if (tick) return; tick = true; requestAnimationFrame(function(){ tick = false; update(); }); }

window.addEventListener('scroll', onScroll, { passive: true });
document.addEventListener('scroll', onScroll, { passive: true, capture: true }); // ловит скролл .pv / #chatMsgs
window.addEventListener('resize', onScroll);
['panel', 'chatPanel', 'cartPanel'].forEach(function (id) {
  var el = document.getElementById(id);
  if (el && typeof MutationObserver !== 'undefined')
    new MutationObserver(onScroll).observe(el, { attributes: true, attributeFilter: ['class', 'hidden'] });
});
btn.addEventListener('click', function () {
  var s = activeScroller() || (document.scrollingElement || document.documentElement);
  try { s.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { s.scrollTop = 0; }
});
update();
})();
