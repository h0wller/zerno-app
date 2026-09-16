/* public/app/ui/styles.js — Ф3.2: глобальные CSS-инъекции + panel-open observer.
   Растворено из fix-views.js, блок v62 (начало). */

(function () {
  'use strict';

  /* ── z-index + panel-open + settings CSS ── */
  var css = document.createElement('style');
  css.textContent =
    '.chat-fab{z-index:95!important}' +
    '@media(max-width:1180px){body.panel-open .chat-fab{display:none}}' +
    '.modal{z-index:340!important}' +
    '.phead .gear{margin-left:auto;width:40px;height:40px;border-radius:12px;border:1.5px solid var(--line);background:#fff;font-size:18px}' +
    '#settingsModal .set-row{display:flex;align-items:center;gap:10px;padding:12px;border:1.5px solid var(--line);border-radius:14px;margin-bottom:10px;background:#fff}' +
    '#deliveryView .search{min-width:180px;margin-left:auto}';
    var cssChat = document.createElement('style');
  cssChat.textContent =
    '.pulse{' +
    'animation:chatHintPulse 1.3s ease-in-out infinite;' +
    'background:#F3E2CE!important;border-color:#B4552D!important;color:#6B2A0E!important;font-weight:700}' +
    '@keyframes chatHintPulse{' +
    '0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(180,85,45,.45)}' +
    '50%{transform:scale(1.05);box-shadow:0 0 0 10px rgba(180,85,45,0)}}';
  document.head.appendChild(cssChat);
  document.head.appendChild(css);

  /* ── класс panel-open на body (для CSS выше) ── */
  var panel = document.getElementById('panel');
  if (panel) {
    new MutationObserver(function () {
      document.body.classList.toggle('panel-open', panel.classList.contains('open'));
    }).observe(panel, { attributes: true, attributeFilter: ['class'] });
  }
})();
/* ── Ф3.21: v61 R0 CSS (было fix-views.js) ── */
(function(){
var s=document.createElement('style');
s.textContent=
'.myOrderCard .moDate{font-size:12px;color:var(--soft);font-weight:600;margin-left:6px}'+
'#myOrdersBtn{width:100%;margin:10px 0 0}'+
'.omCard{background:var(--paper);border-radius:20px;max-width:640px;width:100%;max-height:86vh;overflow:auto;padding:18px;position:relative;box-shadow:var(--sh)}'+
'.omClose{position:absolute;top:10px;right:10px;border:0;background:#EDF2F6;border-radius:12px;padding:8px 14px;font-weight:800;cursor:pointer}'+
'#ordersModal,#redeemPick{position:fixed;inset:0;z-index:340;background:rgba(15,23,32,.45);display:none;align-items:center;justify-content:center;padding:16px}'+
'#ordersModal.show,#redeemPick.show{display:flex}'+
'#notifyDetails{margin:10px 0;border:1.5px solid var(--line);border-radius:14px;padding:10px 12px;background:#fff}'+
'#notifyDetails summary{cursor:pointer;font-weight:700}'+
'#fridayInfo{background:#EAF1F9;border:1px solid #B9CDE4;border-radius:18px;padding:14px;margin:12px 0;font-size:12.5px;color:#33507A;line-height:1.6}'+
'#fridayInfo b{display:block;font-size:12px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:4px}'+
'.topbar .brand img{height:34px;width:auto;border-radius:10px}'+
'.edBtn{position:absolute;top:8px;right:8px;z-index:3;border:0;background:rgba(255,255,255,.92);border-radius:10px;padding:6px 9px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.15)}'+
'.donoff{position:absolute;top:8px;left:8px;z-index:3;display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.94);border:1.5px solid var(--line);border-radius:999px;padding:4px 10px 4px 4px;font-size:11px;font-weight:700;cursor:pointer}'+
'.donoff input{appearance:none;width:34px;height:19px;border-radius:999px;background:#C9D3DC;position:relative;transition:.25s;cursor:pointer}'+
'.donoff input::after{content:"";position:absolute;top:2.5px;left:3px;width:14px;height:14px;border-radius:50%;background:#fff;transition:.25s}'+
'.donoff input:checked{background:#1E7A4E}.donoff input:checked::after{left:17px}'+
'.delayBtns{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;align-items:center}'+
'.delayBtns button{border:1.5px solid var(--line);background:#fff;border-radius:10px;padding:6px 10px;font-size:12px;font-weight:700}'+
'#ctxDrop{position:absolute;right:10px;top:52px;z-index:5;background:#fff;border:1.5px solid var(--line);border-radius:14px;box-shadow:var(--sh);padding:6px;display:flex;flex-direction:column;gap:4px;min-width:180px}'+
'#ctxDrop button{border:0;background:transparent;border-radius:10px;padding:10px 12px;font-weight:700;text-align:left;cursor:pointer}'+
'#redeemStats{margin:12px 0;padding:14px;background:#fff;border:1.5px solid var(--line);border-radius:14px}'+
'#redeemStats h4{margin:0 0 10px;font-size:14px}'+
'#redeemStats .rsRow{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px dashed var(--line);font-size:13px}'+
'#redeemStats .rsRow:last-child{border-bottom:none}'+
'#redeemStats b{color:var(--flame)}'+
'#ctxDrop button.on{background:#FFF6E5}';
document.head.appendChild(s);
})();
/* ── Ф5.1: панель быстрых ответов приклеена к низу чата (компактная, в одну строку) ── */
(function(){
  var s=document.createElement('style');
  s.textContent='#chatHintsBar{display:flex;flex-wrap:nowrap;gap:6px;padding:6px 8px;border-top:1px solid var(--line);overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch}'+
  '#chatHintsBar::-webkit-scrollbar{display:none}'+
  '#chatHintsBar .chatHint{margin:0;flex:0 0 auto;white-space:nowrap;font-size:12px;padding:6px 10px;border-radius:12px}'+
  '#chatHintsBar .chatHint.armed,#chatHintsBar .chatHint[data-arm="1"]{background:#FDE8E8;border-color:#B3372B;color:#B3372B;font-weight:700}'+
  'body.support-pending #chatHintsBar{display:none!important}';
  document.head.appendChild(s);
})();
/* ── Ф5.2: корзина читаема на широких экранах ── */
(function(){
  var s=document.createElement('style');
  s.textContent='@media(min-width:900px){'+
  '#cartPanel>*{max-width:860px;margin-left:auto;margin-right:auto;width:100%}'+
  '#cartPanel .cartItem{font-size:15px}'+
  '#checkoutBtn{max-width:860px;margin-left:auto;margin-right:right}'+
  '#checkoutBtn{margin-right:auto}'+
  '}';
  document.head.appendChild(s);
})();
/* ── Ф5.4: footer с контактом ── */
(function(){
  var s=document.createElement('style');
  s.textContent='.siteFooter{padding:30px 16px calc(40px + env(safe-area-inset-bottom));text-align:center;color:var(--soft);font-size:13px}'+
  '.siteFooter a{color:#1F4E8C;font-weight:700;text-decoration:none}';
  document.head.appendChild(s);
})();