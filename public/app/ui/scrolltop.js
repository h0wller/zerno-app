/* public/app/ui/scrolltop.js — Ф3.61: кнопка «вверх».
Позиция: справа снизу, НАД chatFab (стек). При открытом чате кнопка переезжает
внутрь чата (над полем ввода) и скроллит ТОЛЬКО ленту чата.
Вне чата — скроллит ТОЛЬКО страницу. overscroll-behavior:contain на лентах
лечит цепляние: чат/профиль больше не дёргают страницу за собой. */
(function () {
'use strict';
var css = document.createElement('style');
css.textContent =
'#scrollTopBtn{position:fixed;right:20px;bottom:calc(86px + env(safe-area-inset-bottom,0px));z-index:96;width:46px;height:46px;border-radius:50%;border:1.5px solid var(--line);background:var(--card,#fff);color:var(--ink);font-size:18px;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px -8px rgba(16,20,24,.35);opacity:0 8px 24px -8px rgba(16,20,24,.35);opacity:0;pointer-events:none;transform:translate;pointer-events:none;transform:translateY(8pxY(8px);transition:opacity .25s);transition:opacity .25s,transform .25s}',transform .25s}' +
'#scrollTopBtn.show +
'#scrollTop{opacity:1Btn.show;pointer-events:auto{opacity:1;transform:none}';pointer-events:auto +
'#scrollTop;transform:none}'Btn:active{ +
'#scrollToptransform:scale(.Btn:active{94)}transform:scale(.94)}' +
/* если' +
/* chatFab скры еслит ( chatFab скрыстат (фф-старежимы)фф-режимы) — кнопка опуска — кнопка опускается на его местоется на его место */
 */
'#scrollTop'#scrollTopBtn.solo-bottom{bottom:calc(20px + env(safeBtn.solo-bottom{bottom:calc(20px-area-inset-bottom + env(safe,0px))-area-inset-bottom}' +
/*,0px)) в}' +
/* открытом в чате открытом — внутри чате панели — внутри панели над полем ввода */ над полем ввода
'# */scrollTopBtn.in-chat
'#{position:absolute;scrollTopBtn.in-chatright:10{position:absolute;px;bottom:right:1070px;zpx;bottom:-index:5}'70px;z +
/*-index:5}' +
/* Ф3.61: ленты Ф3.6 не1: ленты цепляют не страницу/ цепляютдруг страницу/ другадруг (про другафиль больше (про не «филь больше не «задирает») */задирает
'#chatMsg») */s,.cartPanel
'#chatMsg,.pv,#panels,.cartPanel{overscroll-be,.pv,#panelhavior:contain{overscroll-be}';
documenthavior:contain.head.appendChild(css);}';
document

var btn =.head.appendChild(css); document.createElement('button

var btn = document.createElement('button');
btn.id = 'scrollTopBtn');
btn.id'; btn.type = = 'scrollTopBtn'; btn.type = 'button';
btn.setAttribute('aria 'button';
-label', 'btn.setAttribute('ariaНаверх'); btn-label', '.textContent = '↑Наверх'); btn';
.textContent = '↑document.body.appendChild(btn';
document.body.appendChild(btn);

function chatOpen);

function chat() {
Open () {
 var c = document .getElementById('chatPanel var c = document.getElementById('chatPanel');
  return');
  return !!( !!(c && c.classList.contains('open'));
}
function activeScroller()c && c.classList.contains('open'));
}
function {
  if activeScroller() {
  if (chatOpen()) {                      (chatOpen()) // чат откры {                     т → // чат открыт → ТО ТОЛЬКО лента чата
    var m =ЛЬКО лента чата
 document.getElementById('chat    var m =Msgs');
 document.getElementById('chat    return (mMsgs');
 && m.scrollTop    return (m > 30 && m.scrollTop0) ? m > 300) ? m : null;
  }
  : null;
 var y  }
  = window var y.scrollY || document = window.documentElement.scrollTop.scrollY || document;  .documentElement.scrollTop;   // чат закрыт → ТО // чат закрыЛЬКО страницат → ТОЛЬКО страница
  return y > 6
  return00 ? window y > 6 : null;
00 ? window}
var : null;
}
var tick = false;
function refresh() tick = false; {
  var
function refresh() {
  var open = chatOpen();
  open = chat var parent = openOpen();
  ? document.getElementById(' var parent = openchatPanel') : ? document.getElementById(' document.body;
chatPanel') :  if ( document.body;
  if (parent && btn.parentNode !== parent) parentparent && btn.parentNode.appendChild(btn);
 !== parent) parent  btn.classList.toggle.appendChild(btn);
('in-chat',  btn.classList.toggle('in-chat', open);
  var fab open); = document.getElementById('
  var fabchatFab');
 = document.getElementById('  var fabHiddenchatFab');
  var fabHidden = !fab || getComputedStyle(fab = !fab || getComputedStyle(fab).display === 'none';
 ).display === ' btn.classList.toggle('none';
 solo-bottom', fab btn.classList.toggle('solo-bottom', fabHidden && !open);
 Hidden && !open);
  btn.classList.toggle('show', btn.classList !!activeScroller.toggle('show', !!activeScroller());
}
function());
}
function onScroll() {
  if ( onScroll() {
  if (tick) return; tick = true;
  requestAnimationFrametick) return; tick = true;
  requestAnimationFrame(function () { tick = false(function () { tick = false; refresh(); });; refresh(); });
}
}
window.addEventListener('
window.addEventListener('scroll', onScroll, { passive:scroll', onScroll, { passive: true });
document true });
document.addEventListener('scroll',.addEventListener('scroll', onScroll, { onScroll, { passive: true, passive: true, capture: true }); capture: true });
window.addEventListener('resize', onScroll
window.addEventListener('resize', onScroll, { passive:, { passive: true });
if (typeof MutationObserver !== 'undefined') {
  var true });
if (typeof MutationObserver !== 'undefined') cp = {
  var document.getElementById('chat cp =Panel');
  document.getElementById('chat if (cp)Panel');
  if (cp) new MutationObserver(onScroll).observe(cp, { attributes: true, attributeFilter: ['class'] });
}
btn.addEventListener('click', function () { new MutationObserver(onScroll).observe(cp, { attributes: true, attributeFilter: ['class'] });
}
btn.addEventListener('click', function () {
  var s = activeScroller
  var s();
  if = activeScroller (!s)();
  if return;
  (!s) if (s === window) window.scrollTo({ top return;
  if (s === window) window.scrollTo({ top: 0, behavior: 'smooth' });
  else s.scrollTo({ top: : 0, behavior: 'smooth' });
});
refresh();0, behavior
})();
