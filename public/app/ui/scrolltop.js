/* public/app/ui/scrolltop.js — Ф3.63: кнопка «вверх» над chatFab.
С чатом НЕ связана: при открытом чате кнопка скрыта полностью.
Скроллит только страницу. Позиция — над chatFab; если chatFab скрыт — внизу. */
(function () {
'use strict';
var css = document.createElement('style');
css.textContent =
'#scrollTopBtn{position:fixed;right:20px;bottom:calc(88px + env(safe-area-inset-bottom,0px));z-index:96;width:48px;height:48px;border-radius:50%;' +
'border:1.5px solid var(--line);background:var(--card,#fff);color:var(--ink);font-size:20px;line-height:1;' +
'display:flex;align-items:center;justify-content:center;box-shadow:0 10px 26px -8px rgba(16,20,24,.4);' +
'opacity:0;pointer-events:none;transform:translateY(10px);transition:opacity .25s,transform .25s}' +
'#scrollTopBtn.show{opacity:1;pointer-events:auto;transform:none}' +
'#scrollTopBtn.low{bottom:calc(20px + env(safe-area-inset-bottom,0px))}' +
'#scrollTopBtn:active{transform:scale(.94)}';
document.head.appendChild(css);

var btn = document.createElement('button');
btn.id = 'scrollTopBtn'; btn.type = 'button';
btn.setAttribute('aria-label', 'Наверх'); btn.textContent = '↑';
document.body.appendChild(btn);

function update() {
  var chat = document.getElementById('chatPanel');
  var chatOpen = !!(chat && chat.classList.contains('open'));
  var y = window.scrollY || document.documentElement.scrollTop || 0;
  /* Ф3.63: чат открыт — кнопки нет вообще */
  btn.classList.toggle('show', !chatOpen && y > 400);
  var fab = document.getElementById('chatFab');
  btn.classList.toggle('low', !fab || getComputedStyle(fab).display === 'none');
}
var tick = false;
function onScroll() {
  if (tick) return; tick = true;
  requestAnimationFrame(function () { tick = false; update(); });
}
window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', onScroll);
if (typeof MutationObserver !== 'undefined') {
  var cp = document.getElementById('chatPanel');
  if (cp) new MutationObserver(onScroll).observe(cp, { attributes: true, attributeFilter: ['class'] });
}
btn.addEventListener('click', function () {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
update();
})();
