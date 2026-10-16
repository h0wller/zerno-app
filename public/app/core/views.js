/* public/app/core/views.js — Ф3.22/Ф3.41/Ф3.55: флаги и state-мост чата, CSS-инжекция (СЛОЙ 2),
DOM-переезды, виды/режимы (sv/setMode/brandSeg), дропдаун заведений, пуш-баббл. */
(function () {
'use strict';

/* ========== 0. Флаги и state-мост чата ========== */
var QS = new URLSearchParams(location.search);
var IN_TG = /Telegram/i.test(navigator.userAgent);
if (IN_TG) document.body.classList.add('in-tg');

/* Ф3.56: safe-area фолбэк строго для iOS standalone без вызова принудительного reflow */
(function () {
  var isStandalone = (navigator.standalone === true) || matchMedia('(display-mode: standalone)').matches;
  var isIos = /iPhone|iPad|iPod/.test(navigator.userAgent);
  if (isStandalone && isIos) {
    document.documentElement.style.setProperty('--sat', '47px');
  }
})();

var _DEEP = !!(QS.get('brand') || QS.get('tab') || QS.get('src'));
var SUPPORT_ENTRY = (QS.get('tab') === 'chat' || QS.get('support') === 'choose');
var ctxFromUrl = (QS.get('ctx') === 'delivery' || QS.get('ctx') === 'coffee') ? QS.get('ctx') : '';
var chosenSupportCtx = SUPPORT_ENTRY ? (ctxFromUrl || sessionStorage.getItem('zt_support_ctx') || '') : '';
var supportPending = SUPPORT_ENTRY && !chosenSupportCtx;
var chatCtx = localStorage.getItem('zt_chatctx') || '';
if (chosenSupportCtx) chatCtx = chosenSupportCtx;

window.__fvChatState = {
  getChatCtx: function () { return chatCtx; },
  setChatCtx: function (v) { chatCtx = v; try { localStorage.setItem('zt_chatctx', v); } catch (e) {} },
  getSupportPending: function () { return supportPending; },
  setSupportPending: function (v) { supportPending = v; },
  getChosenSupportCtx: function () { return chosenSupportCtx; },
  setChosenSupportCtx: function (v) { chosenSupportCtx = v; try { sessionStorage.setItem('zt_support_ctx', v); } catch (e) {} }
};

if (supportPending) {
  document.body.classList.add('support-pending');
  var ov0 = document.getElementById('supportChooseOverlay');
  if (ov0) { ov0.style.display = 'flex'; ov0.style.zIndex = '10002'; }
}

/* ========== 1. CSS (СЛОЙ 2: layout + брендовые переопределения) ========== */
var css = document.createElement('style');
var rules = [
 'html[data-brand="delivery"].is-cashier, html[data-brand="delivery"] body.is-cashier, html[data-brand="delivery"] #cashierView, html[data-brand="delivery"] #ordersView { background: var(--cashier-bg, #F6EEE1); }',
 'html[data-brand="delivery"] .cash-card, html[data-brand="delivery"] #ordersView .card, html[data-brand="delivery"] #ordersView article { background: #FFFDF9; border-color: #E8DCCB; }',
 'html[data-brand="delivery"] .single-meta .price, html[data-brand="delivery"] #itemZoomOverlay b + span { color: var(--price-color, #C03B2A); }',
 '@media(min-width:821px){body:not(.is-cashier) .wrap > .rail,body:not(.is-cashier) .wrap > #deliveryRail{grid-column:1}body:not(.is-cashier) .wrap > section{grid-column:2;min-width:0}body:not(.is-cashier) .wrap > .panel{grid-column:3}}',
 'html,body{overflow-x:hidden;overflow-x:clip;max-width:100%}',
 'img,canvas,svg,video{max-width:100%}',
 '#deliveryGrid .opts button:active{transform:translateY(1px)}',
 '@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}',
 '#deliveryGrid .opts.shake{animation:shake .4s}',
 '@media(max-width:820px){#brandSeg{overflow-x:auto;scrollbar-width:none}#modeSeg{overflow-x:auto;scrollbar-width:none}#brandSeg::-webkit-scrollbar,#modeSeg::-webkit-scrollbar{display:none}#brandSeg button,#modeSeg button{flex:0 0 auto}}',
 '@media(max-width:400px){#brandSeg button,#modeSeg button{font-size:12px;padding:6px 12px}}',
 '@media(max-width:690px){.venueToggle .vt-label{display:none}.venueToggle{padding:0 10px;gap:4px}}',
 '@media(max-width:1023px){[data-brand="delivery"] .topbar .brand b,[data-brand="delivery"] .topbar .brand small,[data-brand="delivery"] .topbar .brand > div:not(.mark){display:none!important}}',
'@media(max-width:690px){[data-brand="coffee"] .topbar .brand small,[data-brand="coffee"] .topbar .brand .brand-text{display:none!important}[data-brand="coffee"] .topbar .brand .mark{width:44px!important;height:44px!important;min-width:44px!important;max-height:44px!important}[data-brand="coffee"] .topbar .brand > div:not(.mark){overflow:visible!important;padding-right:4px}}',
'@media(max-width:690px){[data-brand="coffee"] .topbar .brand b#brandTitle{display:block;flex:0 0 auto;font:400 22px/1 Prata,serif;letter-spacing:.01em;white-space:nowrap;color:#2F95F5;-webkit-text-stroke:1.1px #2F95F5;paint-order:stroke fill;text-shadow:1px 1px 0 #2E3238,2px 2px 0 #2E3238,3px 3px 0 #23272C;filter:drop-shadow(0 0 5px rgba(47,149,245,.45))}[data-brand="coffee"] .topbar .brand b#brandTitle::first-letter{text-transform:uppercase}}',
'@media(max-width:360px){[data-brand="coffee"] .topbar .brand b#brandTitle{font-size:18px}}',
'.topbar #profileTopBtn, #avInit{font-family:Golos Text,system-ui,-apple-system,sans-serif;font-weight:700;-webkit-text-fill-color:currentColor}',
 '@media(max-width:690px){[data-brand="delivery"] .topbar .brand .mark{width:160px!important;max-width:min(54vw,176px)!important;height:44px!important;max-height:44px!important}}', '[data-brand="delivery"] .topbar .brand .mark{width:var(--mark-w,160px);height:var(--mark-h,40px);max-height:var(--mark-h,40px);max-width:min(60vw,420px);flex:0 1 auto;border-radius:8px}',
 '[data-brand="delivery"] .topbar .brand .mark img,[data-brand="delivery"] .topbar .brand .mark svg{width:100%;height:100%;max-width:100%;max-height:100%;object-fit:contain}',
 '@media(min-width:821px) and (max-width:1180px){.wrap{grid-template-columns:92px minmax(0,1fr) 350px;gap:18px;padding:18px}.wrap > .rail{grid-column:1}.wrap > section{grid-column:2;min-width:0}.wrap > .panel{grid-column:3;position:sticky;top:118px;transform:none;max-height:calc(100vh - 140px)}.tabs .btn-back{display:none}}',
 '@media(min-width:821px){#mbonusBtn{height:40px;min-width:0;max-width:180px;display:inline-flex;flex-direction:row;align-items:center;gap:8px;padding:0 12px;border-radius:999px;background:#101418;color:#fff;box-shadow:0 4px 12px rgba(16,20,24,.15);white-space:nowrap;overflow:hidden}}',
 '@media(max-width:820px){.wrap{grid-template-columns:80px minmax(0,1fr);gap:10px;padding:10px 12px 28px 8px}.wrap .rail,.wrap #deliveryRail{position:sticky;top:max(72px,calc(50dvh - 175px));transform:none;height:fit-content;max-height:calc(100dvh - 100px);display:flex;flex-direction:column;gap:6px;width:80px;min-width:80px;padding:4px;margin:0;overflow-y:auto;overflow-x:hidden;scrollbar-width:none}.wrap .rail::-webkit-scrollbar,.wrap #deliveryRail::-webkit-scrollbar{display:none}.wrap .rail button,.wrap #deliveryRail button{flex-direction:column;align-items:center;justify-content:center;gap:3px;width:100%;min-height:54px;padding:6px 2px;margin:0;border-radius:12px;font-size:9.5px;line-height:1.1;white-space:normal;text-align:center}.wrap .rail .re,.wrap #deliveryRail .re{font-size:19px;margin:0}.panel{position:fixed;top:0;right:0;bottom:0;z-index:120;width:min(400px,100%);max-height:none;border-radius:22px 0 0 22px;transform:translateX(105%);transition:.35s cubic-bezier(.2,1,.3,1);padding-top:calc(env(safe-area-inset-top) + 6px)}.panel.open{transform:none}.tabs{order:99;margin-top:auto;background:var(--panel);border-top:1px solid var(--line);padding:8px 12px calc(8px + env(safe-area-inset-bottom))}.tabs button{padding:13px 6px;font-size:14px}.mbonus.near-footer{opacity:0;pointer-events:none;transform:translateY(8px)}#mbonusBtn{position:fixed;left:8px;right:auto;bottom:calc(12px + env(safe-area-inset-bottom,0px));width:60px;max-width:60px;height:auto;display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px 4px;border-radius:16px;background:#101418;z-index:94;box-shadow:0 10px 24px -6px rgba(16,20,24,.45);transform:none}.wrap .rail,.wrap #deliveryRail{align-self:start}.scan{grid-template-columns:1fr;justify-items:center;text-align:center}body.is-cashier .wrap{grid-template-columns:1fr!important;max-width:900px;padding:14px 16px 40px}body.is-cashier .wrap > .rail,body.is-cashier .wrap > #deliveryRail{display:none!important}}',
 '[data-brand="delivery"] .venueToggle{border:2px solid var(--fr-choc);background:var(--fr-paper);color:var(--fr-choc);box-shadow:2px 2px 0 var(--fr-choc)}',
 '[data-brand="delivery"] .venueToggle:hover{background:#EFE6D8;box-shadow:3px 3px 0 var(--fr-choc);transform:translate(-1px,-1px)}',
 '[data-brand="delivery"] .venueWrap #brandSeg{background:#FFFDF9;border:1px solid #C99E6E;box-shadow:0 10px 25px rgba(58,42,28,0.18);border-radius:14px}',
 '[data-brand="delivery"] .venueWrap #brandSeg button:hover{background:#F6EEE1;transform:none}',
 '[data-brand="delivery"] .venueWrap #brandSeg button.on{background:#C03B2A;border:none;box-shadow:none;border-radius:9px;color:#fff}',
 '[data-brand="delivery"] .authPrompt{background:linear-gradient(135deg,#F6EEE1,#EFE6D8);border:2px dashed var(--fr-choc);color:var(--fr-choc)}',
 '[data-brand="delivery"] .authPrompt button{background:var(--flame);border:2px solid var(--fr-choc);box-shadow:2px 2px 0 var(--fr-choc);color:#fff}',
 '@media(max-width:820px){#panel.open{position:fixed;top:0;left:0;right:0;bottom:0;width:100%;height:100%;max-height:100%;border-radius:0;margin:0;transform:none;z-index:320}#panel .tabs{padding-bottom:calc(env(safe-area-inset-bottom,0px) + 10px)}}', '#chatPanel [class="chip"],#chatPanel #chips,#chatPanel .chips{display:none}',
 '#supportChooseOverlay .ctxPick,#chatPanel .ctxPick{display:flex;gap:8px;margin:8px 0}',
 '#supportChooseOverlay .ctxPick button,#chatPanel .ctxPick button{flex:1;padding:10px;border-radius:14px;font-size:14px;font-weight:700;border:1.5px solid var(--line);background:#fff;cursor:pointer}',
 '#supportChooseOverlay .ctxPick .cpD,#chatPanel .ctxPick .cpD{border-color:#F2D9A5;background:#FFF6E5;color:#6B4E0E}',
 '#supportChooseOverlay .ctxPick .cpC,#chatPanel .ctxPick .cpC{color:var(--ink)}',
 'body.support-pending .hintsWrap{display:none}',
 '#supportChooseOverlay{position:fixed;inset:0;z-index:10002;background:var(--paper);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center}',
 '#supportChooseOverlay .scTitle{font:400 22px Prata,serif}',
 '#supportChooseOverlay .scSub{color:var(--soft);font-size:13px}',
 '#supportChooseOverlay .scBtns{width:100%;max-width:340px}',
 '.card .tag{position:absolute;top:8px;left:8px;z-index:2;pointer-events:none;max-width:calc(100% - 16px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
 '#iosHint,#installBanner{top:auto;bottom:calc(96px + env(safe-area-inset-bottom))}',
 '.rail,#deliveryRail{padding:8px 6px 16px;margin:-8px -6px -16px;overflow-x:auto;overflow-y:hidden}',
 '@media(min-width:1181px){.rail{overflow:visible;padding:0;margin:0}}',
 '#deliveryRail button{transition:transform .15s,box-shadow .15s,background .15s}',
 '#deliveryRail button:hover{transform:translateY(-1px)}',
 '#deliveryRail button.on:hover{transform:none}',
 '[data-brand="delivery"] #deliveryRail{background:transparent}',
 '[data-brand="delivery"] #rail button,[data-brand="delivery"] #deliveryRail button{background:var(--fr-paper);border:2px solid var(--fr-tan);color:var(--fr-choc)}',
 '[data-brand="delivery"] .panel .btn.fire,[data-brand="delivery"] #profileBox .btn.fire,[data-brand="delivery"] .authBtn{background:var(--flame);border:2px solid var(--fr-choc);box-shadow:3px 3px 0 var(--fr-choc);color:#fff}',
 'html[data-brand="delivery"] body{background-color:#F3EDE6;background-image:radial-gradient(rgba(58,42,28,.1) 1px,transparent 1.5px);background-size:12px 12px}',
 '[data-brand="delivery"] h1,[data-brand="delivery"] h2,[data-brand="delivery"] h3,[data-brand="delivery"] .cbody h3{font-family:Unbounded,sans-serif;color:var(--fr-choc)}',
 '[data-brand="delivery"] .comp i{background:var(--fr-rice);border-color:var(--fr-tan);color:var(--fr-choc)}',
 '[data-brand="delivery"] #deliveryGrid .opts button{border:2px solid var(--fr-tan);background:#fff}',
 '[data-brand="delivery"] #deliveryGrid .opts button.sel{background:var(--btn-fire-bg,var(--flame));border:var(--btn-fire-border,2px solid var(--fr-choc));box-shadow:var(--btn-fire-shadow,2px 2px 0 var(--fr-choc));color:var(--btn-fire-color,#fff)}',
 '[data-brand="delivery"] #deliveryGrid .opts button.sel .op,[data-brand="delivery"] #deliveryGrid .opts button.sel .opt-size,[data-brand="delivery"] #deliveryGrid .opts button.sel .opt-crust,[data-brand="delivery"] #deliveryGrid .opts button.sel .opt-weight,[data-brand="delivery"] #deliveryGrid .opts button.sel .opt-price{color:var(--btn-fire-color,#fff)}',
 '[data-brand="delivery"] #deliveryRail button.on{background:var(--flame);border:2px solid var(--fr-choc);box-shadow:2px 2px 0 var(--fr-choc);color:#fff;font:700 13px Unbounded,sans-serif}',
 '[data-brand="delivery"] #brandSeg,[data-brand="delivery"] #modeSeg{background:var(--esp)}',
 '[data-brand="delivery"] #brandSeg button.on,[data-brand="delivery"] #modeSeg button.on{background:var(--flame);color:#fff}',
 '[data-brand="delivery"] #cartFab,[data-brand="delivery"] .chat-fab{background:var(--flame);border:2px solid var(--fr-choc);box-shadow:3px 3px 0 var(--fr-choc)}',
 '[data-brand="delivery"] #cartPanel,[data-brand="delivery"] .cartPanel{background:var(--fr-rice);border:3px solid var(--fr-choc);border-bottom:none}',
 '[data-brand="delivery"] .cartPanel .cartItem{border-bottom:1.5px dashed rgba(58,42,28,.3);color:#3A2A1C;font-weight:600}',
  '[data-brand="delivery"] #scrollTopBtn{background:var(--fr-paper,#F6EEE1);border:1.5px solid #3a2a1c}',
'#deliveryGrid .cbody .desc{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:2.75em}',
 '#deliveryGrid .cbody .opts{margin-top:auto}',
 '[data-brand="delivery"] .chatHead .op{background:#F6EEE1;border:0;display:flex;align-items:center;justify-content:center;font-size:20px}',
 '[data-brand="delivery"] .chat-fab::before{border-color:#C03B2A}',
 '[data-brand="delivery"] .chatHead .av{background:var(--fr-paper);background-image:none;color:var(--fr-choc)}',
 '[data-brand="delivery"] .mo-new,[data-brand="delivery"] .mo-accept,[data-brand="delivery"] .mo-way{background:var(--fr-rice);color:var(--flame)}',
 '[data-brand="delivery"] #tickerTrack,[data-brand="delivery"] #ticker{background:var(--fr-choc);color:#E8A33D;border-bottom:2px solid var(--fr-choc)}',
 '[data-brand="coffee"] #tickerTrack,[data-brand="coffee"] #ticker{background:#123A6B;color:#BBD7F2;border-bottom:1px solid rgba(62,143,208,.25)}',
 '[data-brand="delivery"] #tickerTrack span::after{color:#C03B2A}',
 '[data-brand="coffee"] #panel,[data-brand="coffee"] .panel{background:var(--panel)}',

 '@media(min-width:1181px){body.is-cashier .panel{display:none}body.is-cashier .wrap{grid-template-columns:1fr}.topbar > :last-child{margin-left:0!important}#profileTopBtn{margin-left:auto;width:46px;height:46px;font-size:18px}}',
 '@media(max-width:640px){#modeSeg button,.modes button,.seg button{padding:6px 7px;font-size:10px}#profileTopBtn{width:44px!important;height:44px!important;min-width:44px!important;flex:0 0 44px!important}.chat{right:8px}.mh-right{margin-left:0;width:100%}}',
 '@media (max-width: 600px) { .topbar { padding: calc(env(safe-area-inset-top, 0px) + 6px) 12px 8px !important; min-height: calc(52px + env(safe-area-inset-top, 0px)) !important; gap: 6px; } .topbar .brand { font-size: 18px !important; } .topbar .brand small { font-size: 10px !important; } }',
'[data-brand="delivery"] #deliveryView .menu-head { margin: 4px 0 12px; width: 100%; background: linear-gradient(135deg, #FFFDF9 0%, #F6EEE1 100%); border: 2px solid var(--fr-tan, #D9C7AD); box-shadow: 3px 3px 0 rgba(58,42,28,0.08); }',
 '[data-brand="delivery"] #deliveryView .menu-head h1 { font: 900 clamp(20px, 3vw, 28px)/1.15 "Unbounded", sans-serif; color: #3a2a1c; margin: 0; }',
 '[data-brand="delivery"] #deliveryView .menu-head h1 em { display: inline-flex; align-items: center; font: 700 11px/1.2 "Golos Text", sans-serif; text-transform: uppercase; letter-spacing: 0.06em; color: var(--flame, #C03B2A); background: rgba(192,59,42,0.1); border: 1px solid rgba(192,59,42,0.25); border-radius: 999px; padding: 4px 10px; margin-left: 0; max-width: 100%; white-space: normal; box-sizing: border-box; vertical-align: middle; }', '[data-brand="delivery"] .brand b { font: 900 18px "Unbounded", sans-serif ; color: #3a2a1c ; }',
  '[data-brand="delivery"] .brand small { color: #3a2a1c; }',
 '[data-brand="delivery"] .subchip{border:2px solid var(--fr-tan);background:var(--fr-paper);color:var(--fr-choc)}',
 '[data-brand="delivery"] .subchip.on{background:var(--flame);border-color:var(--fr-choc);box-shadow:2px 2px 0 var(--fr-choc);color:#fff}',
 '@media(min-width:0){body.is-cashier .ticker,body.is-admin .ticker{display:none}}'
];
css.textContent = rules.join('\n');
document.head.appendChild(css);

/* ========== 2. DOM-инъекции стафф-панелей ========== */

(function () {
  var ov = document.getElementById('ordersView');
  if (ov && !document.getElementById('pendingBoxD')) {
    var d = document.createElement('div');
    d.className = 'cash-card';
    d.style.marginTop = '16px';
    d.innerHTML = '<h3 style="margin:0 0 8px">🆕 Активация гостей</h3><div id="pendingBoxD"></div>';
    var cashierWrap = ov.querySelector('.cashier');
    if (cashierWrap) cashierWrap.appendChild(d);
  }
  if (ov && !document.getElementById('chatsToggleD')) {
    var top = ov.querySelector('.cash-top');
    var b = document.createElement('button');
    b.id = 'chatsToggleD';
    b.className = 'btn ghost';
    b.textContent = '💬 Чаты гостей';
    b.onclick = function () {
      if (typeof window.openStaffChat === 'function') window.openStaffChat('delivery');
    };
    var ref = document.getElementById('ordersRefresh');
    if (top && ref) top.insertBefore(b, ref);
  }
})();

(function () {
  var cp = document.getElementById('cartPanel');
  var ci = document.getElementById('cartItems');
  if (cp && ci && !document.getElementById('cartAddons')) {
    var d = document.createElement('div');
    d.id = 'cartAddons';
    d.style.margin = '0 0 10px';
    (ci.parentNode || cp).insertBefore(d, ci);
  }
})();

/* ========== 3. Виды и режимы ========== */
var _lastCfabState = '';

function syncBrandChromeState(bName, isDel) {
  document.documentElement.setAttribute('data-brand', bName);
  document.body.setAttribute('data-brand', bName);
  var seg = document.getElementById('brandSeg');
  if (seg) {
    var cBtn = seg.querySelector('[data-brand="coffee"]');
    var dBtn = seg.querySelector('[data-brand="delivery"]');
    if (cBtn) cBtn.classList.toggle('on', bName === 'coffee');
    if (dBtn) dBtn.classList.toggle('on', bName === 'delivery');
    seg.classList.toggle('is-delivery', isDel);
  }
  if (window.__ensureVenueToggle) window.__ensureVenueToggle();
  if (window.__labelVenueToggle) window.__labelVenueToggle();
  var mark = document.getElementById('brandMark') || document.querySelector('.brand .mark');
  if (mark) mark.classList.toggle('is-delivery', isDel);
  var op = document.querySelector('.chat-h .op, .chatHead .op');
  if (op) {
    if (!op.hasAttribute('data-orig')) op.setAttribute('data-orig', op.innerHTML);
    op.innerHTML = isDel ? '🍕' : (op.getAttribute('data-orig') || '');
  }
  var bTitle = document.getElementById('brandTitle');
  var bSub = document.getElementById('brandSub');
  if (bTitle) bTitle.textContent = isDel ? 'Пятница' : '…и кофе';
  if (bSub) bSub.textContent = isDel ? 'доставка пиццы и роллов' : 'кофейня на берегу моря';
}

function syncViewsVisibility(showCoffee, showDeliv) {
  var mv = document.getElementById('menuView');
  var dv = document.getElementById('deliveryView');
  var rl = document.getElementById('rail');
  var dr = document.getElementById('deliveryRail');
  if (mv) { mv.hidden = !showCoffee; mv.style.display = showCoffee ? '' : 'none'; }
  if (dv) { dv.hidden = false; dv.style.display = showDeliv ? 'block' : 'none'; }
  if (rl) rl.style.display = showCoffee ? '' : 'none';
  if (dr) dr.style.display = showDeliv ? '' : 'none';
}

function syncStaffAndGuestControls(bName2) {
  var et = document.getElementById('editToggle');
  if (et) et.hidden = (typeof mode === 'undefined' || mode !== 'admin');
  var ab = document.getElementById('adminBar');
  if (ab) ab.hidden = (typeof mode === 'undefined' || mode !== 'admin');
  var ms = document.getElementById('modeSeg');
  var isStaff = !!(typeof me !== 'undefined' && me && (me.role === 'admin' || me.role === 'cashier' || me.role === 'dispatch'));
  if (ms) ms.hidden = !isStaff;
  if (typeof renderModes === 'function') renderModes();
  var mb = document.getElementById('mbonusBtn');
  if (mb) mb.style.display = (typeof mode !== 'undefined' && mode === 'guest' && bName2 === 'coffee') ? '' : 'none';
  var bb = document.getElementById('bonusBox');
  if (bb) bb.style.display = (typeof me !== 'undefined' && me) ? '' : 'none';
  var bt = document.querySelector('.tabs button[data-tab="bonus"]');
  if (bt) bt.style.display = (bName2 === 'delivery') ? 'none' : '';
  if (bName2 === 'delivery' && typeof setTab === 'function') setTab('profile');
  if (typeof me !== 'undefined' && me && typeof renderProfile === 'function') renderProfile();
}

function syncChatFab(staff, bName2) {
  var cfab = document.getElementById('chatFab');
  if (!cfab) return;
  cfab.style.display = staff ? 'none' : '';
  if (staff) {
    var p = document.getElementById('chatPanel');
    if (p) p.classList.remove('open');
    return;
  }
  var cp = document.getElementById('chatPanel');
  var isOpen = !!(cp && cp.classList.contains('open'));
  var curState = (isOpen ? 'open' : (bName2 === 'delivery' ? 'deliv' : 'coffee'));
  if (_lastCfabState === curState) return;
  _lastCfabState = curState;
  var badge = document.getElementById('chatBadge');
  var badgeHtml = badge ? badge.outerHTML : '<span class="ub" id="chatBadge" hidden></span>';
  if (isOpen) {
    cfab.innerHTML = '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="#fff"/></svg>' + badgeHtml;
  } else if (bName2 === 'delivery') {
    cfab.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 2C8.43 2 5.23 3.54 3.01 6L12 22l8.99-16C18.78 3.55 15.57 2 12 2zM7.5 7c.83 0 1.5.67 1.5 1.5S8.33 10 7.5 10 6 9.33 6 8.5 6.67 7 7.5 7zm4.5 7c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-4.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5-1.5-.67-1.5-1.5z" fill="#fff"/></svg>' + badgeHtml;
  } else {
    cfab.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 3H4v10c0 2.21 1.79 4 4 4h6c2.21 0 4-1.79 4-4v-3h2c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 5h-2V5h2v3zM4 19h16v2H4z" fill="#fff"/></svg>' + badgeHtml;
  }
}

function sv() {
  var bName = (typeof brand !== 'undefined' && (brand === 'delivery' || brand === 'test')) ? brand : 'coffee';
  var isDel = (bName === 'delivery');
  try {
    syncBrandChromeState(bName, isDel);
  } catch (e) {}

  var showGuest = (typeof mode !== 'undefined' && (mode === 'guest' || mode === 'admin'));
  var showCoffee = showGuest && bName === 'coffee';
  var showDeliv = showGuest && bName === 'delivery';

  syncViewsVisibility(showCoffee, showDeliv);
  syncStaffAndGuestControls(bName);

  var staff = (typeof mode !== 'undefined' && (mode === 'cashier' || mode === 'orders'));
  syncChatFab(staff, bName);

  var showScan = (typeof mode !== 'undefined' && mode === 'cashier');
  document.querySelectorAll('#scanBtn,#scanFab,#qrFab,#scanToggle,.fab-scan').forEach(function (b) {
    b.style.display = showScan ? '' : 'none';
  });

  if (typeof cartFabShow === 'function') cartFabShow();
  if (showDeliv && typeof window.DMENU !== 'undefined' && !window.DMENU.length &&
      typeof window.loadDelivery === 'function' && !window.__dlReq) {
    window.__dlReq = 1;
    window.loadDelivery();
  }
  if (typeof applyBrandChrome === 'function') {
    applyBrandChrome();
  } else if (typeof window.applyBrandChrome === 'function') {
    window.applyBrandChrome();
  }

  // Обновление кнопки скролла через bus с безопасным фолбэком
  if (window.ztBus) {
    window.ztBus.emit('ui:update-scrolltop');
  } else if (typeof window.updateScrollTop === 'function') {
    window.updateScrollTop();
  }
}

window.sv = sv;
window.syncBrandViews = function() {
  sv();
};

window.setMode = function (m) {
  var role = (typeof me !== 'undefined' && me) ? me.role : 'guest';
  if (m === 'cashier' && role !== 'cashier' && role !== 'admin') return;
  if (m === 'orders' && role !== 'dispatch' && role !== 'cashier' && role !== 'admin') return;
  if (m === 'admin' && role !== 'admin') return;
  window.mode = m;
  document.body.classList.toggle('is-cashier', m === 'cashier' || m === 'orders');
  document.body.classList.toggle('is-admin', m === 'admin');
  var cv = document.getElementById('cashierView');
  if (cv) { cv.hidden = (m !== 'cashier'); cv.style.display = ''; }
  var ov = document.getElementById('ordersView');
  if (ov) ov.hidden = (m !== 'orders');
  sv();
  var pt = document.getElementById('promoToggle'); if (pt) pt.hidden = (m !== 'admin');
  var dt = document.getElementById('dashToggle'); if (dt) dt.hidden = (m !== 'admin');
  var ct = document.getElementById('chatsToggle2');
  if (ct) ct.hidden = !(typeof me !== 'undefined' && me && (me.role === 'admin' || me.role === 'cashier' || me.role === 'dispatch'));
  var bd = document.getElementById('adminBadge'); if (bd) bd.hidden = (m !== 'admin');
  if (m !== 'admin' && typeof exitEdit === 'function') exitEdit();
  if (m === 'cashier' && typeof window.loadPending === 'function') window.loadPending();
  if (m === 'cashier' && typeof renderLog === 'function') renderLog();
  if (m === 'orders') {
    if (typeof renderOrders === 'function') renderOrders();
    if (typeof ordersPoll === 'undefined' || !ordersPoll) {
      window.ordersPoll = setInterval(function () {
        if (mode === 'orders' && typeof renderOrders === 'function') renderOrders(true);
      }, 8000);
    }
  }
  if (m === 'admin' && typeof loadMenu === 'function') loadMenu();
  if ((m === 'guest' || m === 'admin') && brand === 'delivery' && (typeof DMENU === 'undefined' || !DMENU.length) && typeof loadDelivery === 'function') {
    loadDelivery();
  }
  if (typeof renderModes === 'function') renderModes();
  if (typeof toast === 'function') {
    toast(
      m === 'admin' ? 'Режим администратора активен' : m === 'cashier' ? 'Смена кассира активна' : m === 'orders' ? 'Панель диспетчера' : 'Режим гостя',
      m === 'admin' ? '🔓' : m === 'cashier' ? '🧾' : m === 'orders' ? '🍕' : ''
    );
  }
};

var brandSegEl = document.getElementById('brandSeg');
if (brandSegEl) {
  brandSegEl.addEventListener('click', function (e) {
    var b = e.target.closest('[data-brand]');
    if (!b) return;
    brand = b.dataset.brand;
    try { localStorage.setItem('zt_brand', brand); } catch (err) {}
    document.documentElement.setAttribute('data-brand', brand);
    document.body.setAttribute('data-brand', brand);
    if (typeof mode !== 'undefined' && (mode === 'cashier' || mode === 'orders')) {
      if (typeof setMode === 'function') setMode('guest');
    }
    brandSegEl.querySelectorAll('button').forEach(function (x) {
      x.classList.toggle('on', x.dataset.brand === brand);
    });
    brandSegEl.classList.remove('open');
    brandSegEl.style.display = 'none';
    var vtg = document.getElementById('venueToggle');
    if (vtg) vtg.setAttribute('aria-expanded', 'false');
    window.__dlReq = 0;
    sv();
    if (brand === 'delivery' && (typeof DMENU === 'undefined' || !DMENU.length) && typeof loadDelivery === 'function') {
      loadDelivery();
    }
    if (typeof supportPending !== 'undefined' && !supportPending && typeof chatCtx !== 'undefined' && chatCtx !== brand) {
      chatCtx = brand;
      try { localStorage.setItem('zt_chatctx', chatCtx); } catch (err) {}
      if (typeof setBotName === 'function') setBotName();
    }
    var cp = document.getElementById('chatPanel');
    if (cp && cp.classList.contains('open')) {
      setTimeout(function () {
        if (typeof reloadChatThread === 'function') reloadChatThread();
      }, 80);
    }
  });
}

sv();

/* ========== Ф3.26: создание #venueToggle один раз без дублирования ========== */
(function () {
  function ensure() {
    var seg = document.getElementById('brandSeg');
    if (!seg || document.getElementById('venueToggle')) return;
    var vw = document.createElement('div'); vw.className = 'venueWrap';
    seg.parentNode.insertBefore(vw, seg);
    var vt = document.createElement('button');
    vt.id = 'venueToggle'; vt.type = 'button'; vt.className = 'venueToggle';
    vt.setAttribute('aria-haspopup', 'listbox'); vt.setAttribute('aria-expanded', 'false');
    vw.appendChild(vt); vw.appendChild(seg);
    vt.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = seg.classList.toggle('open');
      seg.style.display = open ? 'flex' : 'none';
      vt.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('click', function (e) {
      if (!vw.contains(e.target)) { seg.classList.remove('open'); seg.style.display = 'none'; vt.setAttribute('aria-expanded', 'false'); }
    });
    label();
  }

  function label() {
    var vt = document.getElementById('venueToggle');
    if (!vt) return;
    var curBrand = (typeof brand !== 'undefined' && brand) || document.documentElement.getAttribute('data-brand') || 'coffee';
    var isDel = (curBrand === 'delivery');
    vt.setAttribute('data-active-brand', curBrand);
    vt.innerHTML = '<span class="vt-label">Сменить заведение</span> <span class="vt-icon">' + (isDel ? '🍕' : '🌊') + '</span> <span class="vt-arrow">▾</span>';
  }
  window.__syncHeaderCluster = function () {};
  window.__ensureVenueToggle = ensure;
  window.__labelVenueToggle = function () { 
    label(); 
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensure, { once: true });
  } else {
    ensure();
  }
})();

/* ========== Пуш-баббл «Включите пуши» ========== */
(function () {
  function findPush() {
    return document.getElementById('pushHint') ||
           document.getElementById('pushBubble') ||
           document.querySelector('.pushHint, .push-bubble, .pushBubble');
  }

  var placeScheduled = false;
  function schedulePlace() {
    if (placeScheduled) return;
    placeScheduled = true;
    requestAnimationFrame(function () {
      placeScheduled = false;
      place();
    });
  }

  function place() {
    var b = findPush();
    var av = document.getElementById('profileTopBtn');
    if (!b || !av || b.style.display === 'none') return;
    var r = av.getBoundingClientRect();
    b.style.position = 'fixed';
    b.style.top = r.bottom + 10 + 'px';
    b.style.right = Math.max(8, window.innerWidth - r.right) + 'px';
    if (window.innerWidth >= 821) { b.style.left = 'auto'; } else { b.style.left = ""; b.style.width = ""; b.style.minWidth = ""; b.style.maxWidth = ""; }
    b.style.margin = '0';
    b.style.zIndex = '1200';
  }

  function refresh() {
    var p = document.getElementById('panel');
    var open = p && p.classList.contains('open');
    document.body.classList.toggle('panel-open', !!open);
    var b = findPush();
    if (b) {
      b.style.display = open ? 'none' : '';
      if (!open) schedulePlace();
    }
    pulsePushBtn(open);
  }

  function pushBtnEl() {
    var byId = document.getElementById('pushBtn');
    if (byId) return byId;
    var all = document.querySelectorAll('#profileBox button, .panel button');
    for (let i = 0; i < all.length; i++) {
      if (/Включить уведомления/.test(all[i].textContent || '')) return all[i];
    }
    return null;
  }

  function pulsePushBtn(open) {
    var btn = pushBtnEl();
    if (!btn) return;
    var need = !!open && /Включить уведомления/.test(btn.textContent || '');
    if (need && !btn.classList.contains('pulse')) {
      requestAnimationFrame(function() {
        btn.classList.add('pulse');
      });
    } else if (!need) {
      btn.classList.remove('pulse');
    }
  }

  var panelEl = document.getElementById('panel');
  if (panelEl && typeof MutationObserver !== 'undefined') {
    new MutationObserver(refresh).observe(panelEl, {
      attributes: true,
      attributeFilter: ['class', 'hidden', 'style'],
    });
  }

  window.addEventListener('resize', schedulePlace, { passive: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', refresh, { once: true });
  } else {
    refresh();
  }
})();

/* ── Ф3.49: кнопка authPrompt через делегирование (переживает перерендеры) ── */
document.addEventListener('click', function (e) {
  var b = e.target.closest('#authPrompt button, #authPrompt [data-auth]');
  if (!b) return;
  e.preventDefault();
  if (typeof openAuth === 'function') { openAuth(); return; }
  var m = document.getElementById('authModal');
  if (m) { m.classList.add('open'); m.style.display = 'flex'; }
});

/* ── Ф5.38: fitSearch — сброс принудительной 100% ширины поиска ── */
(function () {
  function fitSearch() {
    var mhRights = document.querySelectorAll('.mh-top .mh-right, .menu-head .mh-right');
    for (var i = 0; i < mhRights.length; i++) {
      mhRights[i].style.width = '';
      mhRights[i].style.maxWidth = '';
    }
  }
  window.__fitSearch = fitSearch;
})();
})();