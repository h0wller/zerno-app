/* public/app/ui/scrolltop.js — Ф3.60: кнопка «вверх» рядом с chatFab.
Скроллеры: window (страница), #panel .pv (профиль), #chatMsgs (лента чата).
Кнопка зеркалит тот скроллер, которым крутят сейчас (lastSrc), и мгновенно
пересчитывается при open/close чата и шторки (MutationObserver) — класс .show больше не залипает. */
(function () {
'use strict';
var css = document.createElement('style');
css.textContent =
'#scrollTopBtn{position:fixed;right:88px;bottom:calc(26px + env(safe-area-inset-bottom,0px));z-index:96;width:46px;height:46px;border-radius:50%;border:1.5px solid var(--line);background:var(--card,#fff);color:var(--ink);font-size:18px;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px -8px rgba(16,20,24,.35);opacity:0;pointer-events:none;transform:translateY(8px);transition:opacity .25s,transform .25s}' +
'#scrollTopBtn.show{opacity:1;pointer-events:auto;transform:none}' +
'#scrollTopBtn.solo{right:20px}' +
'#scrollTopBtn:active{transform:scale(.94)}';
document.head.appendChild(css);

var btn = document.createElement('button');
btn.id = 'scrollTopBtn';
btn.type = 'button';
btn.setAttribute('aria-label', 'Наверх');
btn.textContent = '↑';
document.body.appendChild(btn);

var lastSrc = 'win';
function winScroller() { return (window.scrollY || document.documentElement.scrollTop) > 600 ? window : null; }
function msgsScroller() { var m = document.getElementById('chatMsgs'); return (m && m.scrollTop > 300) ? m : null; }
function pvScroller() {
  var p = document.getElementById('panel');
  if (!p || !p.classList.contains('open')) return null;
  var pv = p.querySelector('.pv');
  return (pv && pv.scrollTop > 300) ? pv : null;
}
function activeScroller() {
  var pv = pvScroller();
  if (pv) return pv;                                   // шторка профиля — приоритет
  var chat = document.getElementById('chatPanel');
  if (chat && chat.classList.contains('open'))          // чат открыт:Serve the scroller user is touching now
    return lastSrc === 'win' ? winScroller() : msgsScroller();
  return winScroller();                                 // чат закрыт — только страница
}

var tick = false;
function refresh() {
  btn.classList.toggle('show', !!activeScroller());
  var fab = document.getElementById('chatFab');
  btn.classList.toggle('solo', !fab || getComputedStyle(fab).display === 'none');
}
function onScroll(e) {
  if (e && e.target) {                                  // запоминаем, КТО крутит
    var t = e.target;
    if (t === document || t === document.documentElement) lastSrc = 'win';
    else if (t.id === 'chatMsgs') lastSrc = 'msgs';
    else if (t.closest && t.closest('#chatPanel')) lastSrc = 'msgs';
    else if (t.closest && t.closest('#panel')) lastSrc = 'pv';
    else lastSrc = 'win';
  }
  if (tick) return;
  tick = true;
  requestAnimationFrame(function () { tick = false; refresh(); });
}

window.addEventListener('scroll', onScroll, { passive: true });
document.addEventListener('scroll', onScroll, { passive: true, capture: true });
window.addEventListener('resize', onScroll, { passive: true });
/* Ф3.60: пересчёт на open/close чата и шторки — иначе .show залипает после закрытия */
if (typeof MutationObserver !== 'undefined') {
  ['chatPanel', 'panel'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) new MutationObserver(function () { onScroll(); }).observe(el, { attributes: true, attributeFilter: ['class'] });
  });
}
btn.addEventListener('click', function () {
  var s = activeScroller() || window;
  if (s === window) window.scrollTo({ top: 0, behavior: 'smooth' });
  else s.scrollTo({ top: 0, behavior: 'smooth' });
});
refresh();
})();