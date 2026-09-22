/* public/app/ui/scrolltop.js — Ф3.57: кнопка «вверх» + умный выбор скроллера.
Владелец: window-скролл и #panel .pv. Появляется после 600px (window) / 300px (.pv). */
(function () {
'use strict';
var css = document.createElement('style');
css.textContent =
'#scrollTopBtn{position:fixed;right:88px;bottom:calc(26px + env(safe-area-inset-bottom,0px));z-index:96;width:46px;height:46px;border-radius:50%;border:1.5px solid var(--line);background:var(--card,#fff);color:var(--ink);font-size:18px;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px -8px rgba(16,20,24,.35);opacity:0;pointer-events:none;transform:translateY(8px);transition:opacity .25s,transform .25s}' +
'#scrollTopBtn.solo{right:20px}' +'#scrollTopBtn.show{opacity:1;pointer-events:auto;transform:none}' +
'#scrollTopBtn:active{transform:scale(.94)}';
document.head.appendChild(css);

var btn = document.createElement('button');
btn.id = 'scrollTopBtn';
btn.type = 'button';
btn.setAttribute('aria-label', 'Наверх');
btn.textContent = '↑';
document.body.appendChild(btn);

function activeScroller() {
  var chat = document.getElementById('chatPanel');
  if (chat && chat.classList.contains('open')) {
    var msgs = document.getElementById('chatMsgs');
    return (msgs && msgs.scrollTop > 300) ? msgs : null;
  }
  var p = document.getElementById('panel');
  if (p && p.classList.contains('open')) {
    var pv = p.querySelector('.pv');
    if (pv && pv.scrollTop > 300) return pv;
  }
  return (window.scrollY || document.documentElement.scrollTop) > 600 ? window : null;
}
var tick = false;
function onScroll() {
  if (tick) return;
  tick = true;
  requestAnimationFrame(function () {
    tick = false;
    btn.classList.toggle('show', !!activeScroller());
    var fab = document.getElementById('chatFab');
    btn.classList.toggle('solo', !fab || getComputedStyle(fab).display === 'none');
  });
}
window.addEventListener('scroll', onScroll, { passive: true });
document.addEventListener('scroll', onScroll, { passive: true, capture: true });
btn.addEventListener('click', function () {
  var s = activeScroller() || window;
  if (s === window) window.scrollTo({ top: 0, behavior: 'smooth' });
  else s.scrollTo({ top: 0, behavior: 'smooth' });
});
})();