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
  var isIos = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isStandalone && isIos) {
    document.documentElement.classList.add('is-ios-standalone');
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
  if (ov0) { 
    ov0.style.display = 'flex'; 
    ov0.style.zIndex = '10002'; 
  }
}

/* ========== 1. CSS (СЛОЙ 2: layout + брендовые переопределения) ========== */
var css = document.createElement('style');
var rules = [
 'html[data-brand="delivery"] a, html[data-brand="delivery"] a:visited, html[data-brand="delivery"] a:hover, html[data-brand="delivery"] a:active, html[data-brand="delivery"] a:focus { text-decoration: none; }',
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
'@media(max-width:690px){[data-brand="coffee"] .topbar .brand small,[data-brand="coffee"] .topbar .brand .brand-text{display:none!important}[data-brand="coffee"] .topbar .brand .mark{width:52px!important;height:52px!important;min-width:52px!important;max-height:52px!important}[data-brand="coffee"] .topbar .brand > div:not(.mark){overflow:visible!important;padding-right:4px}}',
'[data-brand="coffee"] .topbar .brand b#brandTitle .bean{display:inline-block;width:.8em;height:.8em;margin:0 .03em;vertical-align:-.04em;color:#2F95F5}',
'[data-brand="coffee"] .topbar .brand b#brandTitle .bean svg{display:block;width:100%;height:100%;overflow:visible}',
'@media(max-width:690px){[data-brand="delivery"] .topbar .brand .mark{width:196px!important;max-width:min(60vw,210px)!important;height:48px!important;max-height:48px!important}}', '[data-brand="delivery"] .topbar .brand .mark{width:var(--mark-w,160px);height:var(--mark-h,40px);max-height:var(--mark-h,40px);max-width:min(60vw,420px);flex:0 1 auto;border-radius:8px}',
 '[data-brand="delivery"] .topbar .brand .mark img,[data-brand="delivery"] .topbar .brand .mark svg{width:100%;height:100%;max-width:100%;max-height:100%;object-fit:contain}',
 '@media(min-width:821px) and (max-width:1180px){.wrap{grid-template-columns:92px minmax(0,1fr);gap:18px;padding:18px}.wrap > .rail{grid-column:1}.wrap > section{grid-column:2;min-width:0}.wrap > .panel{position:fixed;top:0;right:0;bottom:0;z-index:120;width:min(400px,100%);max-height:none;border-radius:22px 0 0 22px;transform:translateX(105%);transition:.35s cubic-bezier(.2,1,.3,1)}.wrap > .panel.open{transform:none}.tabs .btn-back{display:none}}', '@media(min-width:821px){#mbonusBtn{flex-direction:row;align-items:center;white-space:nowrap;overflow:hidden}}',
 '@media(max-width:820px){.wrap{grid-template-columns:80px minmax(0,1fr);gap:10px;padding:10px 12px 28px 8px}.panel{position:fixed;top:0;right:0;bottom:0;z-index:120;width:min(400px,100%);max-height:none;border-radius:22px 0 0 22px;transform:translateX(105%);transition:.35s cubic-bezier(.2,1,.3,1);padding-top:calc(env(safe-area-inset-top) + 6px)}.panel.open{transform:none}.tabs{order:99;margin-top:auto;background:var(--panel);border-top:1px solid var(--line);padding:8px 12px calc(8px + env(safe-area-inset-bottom))}.tabs button{padding:13px 6px;font-size:14px}.mbonus.near-footer{opacity:0;pointer-events:none;transform:translateY(8px)} .scan{grid-template-columns:1fr;justify-items:center;text-align:center}body.is-cashier .wrap{grid-template-columns:1fr!important;max-width:900px;padding:14px 16px 40px}body.is-cashier .wrap > .rail,body.is-cashier .wrap > #deliveryRail{display:none!important}}',
 '[data-brand="delivery"] .venueToggle{border:2px solid var(--fr-choc);background:var(--fr-paper);color:var(--fr-choc);box-shadow:2px 2px 0 var(--fr-choc)}',
 '[data-brand="delivery"] .venueToggle:hover{background:#EFE6D8;box-shadow:3px 3px 0 var(--fr-choc);transform:translate(-1px,-1px)}',
 '[data-brand="delivery"] .venueWrap #brandSeg{background:#FFFDF9;border:1px solid #C99E6E;box-shadow:0 10px 25px rgba(58,42,28,0.18);border-radius:14px}',
 '[data-brand="delivery"] .venueWrap #brandSeg button:hover{background:#F6EEE1;transform:none}',
 '[data-brand="delivery"] .venueWrap #brandSeg button.on{background:#8B2B20;border:none;box-shadow:none;border-radius:9px;color:#fff}',
 '[data-brand="delivery"] .authPrompt{background:linear-gradient(135deg,#F6EEE1,#EFE6D8);border:2px dashed var(--fr-choc);color:var(--fr-choc)}',
 '[data-brand="delivery"] .authPrompt button{background:var(--flame);border:2px solid var(--fr-choc);box-shadow:2px 2px 0 var(--fr-choc);color:#fff}',
 '@media(max-width:820px){#panel.open{position:fixed;top:0;left:0;right:0;bottom:0;width:100%;height:100%;max-height:100%;border-radius:0;margin:0;transform:none;z-index:320}#panel .tabs{padding-bottom:calc(env(safe-area-inset-bottom,0px) + 10px)}}', '#chatPanel [class="chip"],#chatPanel #chips,#chatPanel .chips{display:none}',
 '#supportChooseOverlay .ctxPick,#chatPanel .ctxPick{display:flex;gap:8px;margin:8px 0}',
 '#supportChooseOverlay .ctxPick button,#chatPanel .ctxPick button{flex:1;padding:10px;border-radius:14px;font-size:14px;font-weight:700;border:1.5px solid var(--line);background:#fff;cursor:pointer}',
 '#supportChooseOverlay .ctxPick .cpD,#chatPanel .ctxPick .cpD{border-color:#F2D9A5;background:#FFF6E5;color:#6B4E0E}',
 '#supportChooseOverlay .ctxPick .cpC,#chatPanel .ctxPick .cpC{color:var(--ink)}',
 'body.support-pending .hintsWrap{display:none}',
 '#supportChooseOverlay{position:fixed;inset:0;z-index:10002;background:var(--paper);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center}',
 '#supportChooseOverlay .scTitle{font:400 22px Prata, "Golos Text", serif}',
 '#supportChooseOverlay .scSub{color:var(--soft);font-size:13px}',
 '#supportChooseOverlay .scBtns{width:100%;max-width:340px}',
 '.card .tag{position:absolute;top:8px;left:8px;z-index:2;pointer-events:none;max-width:calc(100% - 16px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
 '#iosHint,#installBanner{top:auto;bottom:calc(96px + env(safe-area-inset-bottom))}',
 '#deliveryRail button{transition:transform .15s,box-shadow .15s,background .15s}',
 '#deliveryRail button:hover{transform:translateY(-1px)}',
 '#deliveryRail button.on:hover{transform:none}',
 '[data-brand="delivery"] #deliveryRail{background:transparent}',
 '[data-brand="delivery"] #rail button,[data-brand="delivery"] #deliveryRail button{background:var(--fr-paper);border:2px solid var(--fr-tan);color:var(--fr-choc)}',
 '[data-brand="delivery"] .panel .btn.fire,[data-brand="delivery"] #profileBox .btn.fire,[data-brand="delivery"] .authBtn{background:var(--flame);border:2px solid var(--fr-choc);box-shadow:3px 3px 0 var(--fr-choc);color:#fff}',
 'html[data-brand="delivery"] body{background-color:#F3EDE6;background-image:radial-gradient(rgba(58,42,28,.1) 1px,transparent 1.5px);background-size:12px 12px}',
 '[data-brand="delivery"] h1,[data-brand="delivery"] h2,[data-brand="delivery"] h3,[data-brand="delivery"] .cbody h3{font-family:Unbounded, "Golos Text", sans-serif;color:var(--fr-choc)}',
 '[data-brand="delivery"] #deliveryRail button.on{background:#8B2B20;border:2px solid var(--fr-choc);box-shadow:2px 2px 0 var(--fr-choc);color:#fff;font:700 13px Unbounded, "Golos Text", sans-serif}',
 '[data-brand="delivery"] #brandSeg,[data-brand="delivery"] #modeSeg{background:var(--esp)}',
 '[data-brand="delivery"] #brandSeg button.on,[data-brand="delivery"] #modeSeg button.on{background:#8B2B20;color:#fff}',
 '[data-brand="delivery"] #cartFab,[data-brand="delivery"] .chat-fab{background:var(--flame);border:2px solid var(--fr-choc);box-shadow:3px 3px 0 var(--fr-choc)}',
 '[data-brand="delivery"] #cartPanel,[data-brand="delivery"] .cartPanel{background:var(--fr-rice);border:3px solid var(--fr-choc);border-bottom:none}',
 '[data-brand="delivery"] .cartPanel .cartItem{border-bottom:1.5px dashed rgba(58,42,28,.3);color:#3A2A1C;font-weight:600}',
  '[data-brand="delivery"] #scrollTopBtn{background:var(--fr-paper,#F6EEE1);border:1.5px solid #3a2a1c}',
 /* База .desc (clamp 2 строки + резерв высоты) и прижатие футера/кнопки к низу живут в theme/20-cards.css — дубли здесь запрещены (css-architecture: «один селектор — одно место»). */
 '[data-brand="delivery"] .chatHead .op{background:#F6EEE1;border:0;display:flex;align-items:center;justify-content:center;font-size:20px}',
 '[data-brand="delivery"] .chat-fab::before{border-color:#C03B2A}',
 '[data-brand="delivery"] .chatHead .av{background:var(--fr-paper);background-image:none;color:var(--fr-choc)}',
 '[data-brand="delivery"] .mo-new,[data-brand="delivery"] .mo-accept,[data-brand="delivery"] .mo-way{background:var(--fr-rice);color:var(--flame)}',

 '[data-brand="coffee"] #panel,[data-brand="coffee"] .panel{background:var(--panel)}',
  '[data-brand="coffee"] #modeSeg button.on{background:#BBD7F2;color:#123A6B;box-shadow:0 2px 7px rgba(18,58,107,.16)}',
  '@media(max-width:820px){[data-brand="coffee"] .menu-head .menu-controls-row > .mode-seg-slot > #modeSeg{box-sizing:border-box;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));flex:0 0 clamp(190px,62vw,244px);width:clamp(190px,62vw,244px);min-width:clamp(190px,62vw,244px);max-width:clamp(190px,62vw,244px);justify-content:stretch;gap:0;overflow:hidden}[data-brand="coffee"] .menu-head .menu-controls-row > .mode-seg-slot > #modeSeg button{box-sizing:border-box;display:flex;flex:1 1 0;width:auto;min-width:0;max-width:none;padding:0 3px;font-size:9px;text-align:center;justify-content:center;white-space:nowrap}}',
  '@media(max-width:820px){html body :is(#menuView,#deliveryView) .menu-head .mh-top{grid-template-rows:32px 44px;height:80px;overflow:visible}html body :is(#menuView,#deliveryView) .menu-head .mh-top > .mh-right{height:44px;min-height:44px;max-height:44px;overflow:visible;align-items:center}html body :is(#menuView,#deliveryView) .menu-head .mh-top > .mh-right > #supportLauncherHost{display:flex;flex:0 0 44px;width:44px;min-width:44px;max-width:44px;height:44px;min-height:44px;max-height:44px;overflow:visible}html body :is(#menuView,#deliveryView) .menu-head .mh-top > .mh-right > #supportLauncherHost > #chatFab.chat-fab{flex:0 0 44px;width:44px;min-width:44px;max-width:44px;height:44px;min-height:44px;max-height:44px}}',
 

 '@media(min-width:1181px){body.is-cashier .panel{display:none}body.is-cashier .wrap{grid-template-columns:1fr}.topbar > :last-child{margin-left:0!important}#profileTopBtn{margin-left:auto;}}',
 '@media(max-width:640px){#modeSeg button,.modes button,.seg button{padding:6px 7px;font-size:10px}.chat{right:8px}.mh-right{margin-left:0;width:100%}}',
 '@media (max-width: 600px) { html:not(.is-ios-standalone[data-staff-role]) .topbar { padding: calc(env(safe-area-inset-top, 0px) + 6px) 12px 0 !important; min-height: 0 !important; gap: 0 8px !important; } .topbar .brand { font-size: 18px !important; } .topbar .brand small { font-size: 10px !important; } }',
'[data-brand="delivery"] #deliveryView .menu-head { margin: 4px 0 12px; width: 100%; background: linear-gradient(135deg, #FFFDF9 0%, #F6EEE1 100%); border: 2px solid var(--fr-tan, #D9C7AD); box-shadow: 3px 3px 0 rgba(58,42,28,0.08); }',
 '[data-brand="delivery"] #deliveryView .menu-head h1 { font: 900 clamp(20px, 3vw, 28px)/1.15 "Unbounded", "Golos Text", sans-serif; color: #3a2a1c; margin: 0; }',
 '[data-brand="delivery"] #deliveryView .menu-head h1 em { display: inline-flex; align-items: center; font: 700 11px/1.2 "Golos Text", sans-serif; text-transform: uppercase; letter-spacing: 0.06em; color: #742116; background: rgba(192,59,42,0.1); border: 1px solid rgba(192,59,42,0.25); border-radius: 999px; padding: 4px 10px; margin-left: 0; max-width: 100%; white-space: normal; box-sizing: border-box; vertical-align: middle; }', '[data-brand="delivery"] .brand b { font: 900 18px "Unbounded", "Golos Text", sans-serif ; color: #3a2a1c ; }',
  '[data-brand="delivery"] .brand small { color: #3a2a1c; }',
 '[data-brand="delivery"] .subchip{border:2px solid var(--fr-tan);background:var(--fr-paper);color:var(--fr-choc)}',
 '[data-brand="delivery"] .subchip.on{background:var(--flame);border-color:var(--fr-choc);box-shadow:2px 2px 0 var(--fr-choc);color:#fff}',
 '@media(min-width:0){body.is-cashier .ticker,body.is-admin .ticker{display:none}}',
  '[data-brand="delivery"] #modeSeg button:not(.on){color:#F3EDE6}'
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

function syncBrandUrl(bName) {
  try {
    var isPwa = (navigator.standalone === true) || matchMedia('(display-mode: standalone)').matches;
    var splashActive = !sessionStorage.getItem('splashDone') && !document.documentElement.classList.contains('no-splash');
    if (!IN_TG && !isPwa && !splashActive) {
      var u = new URL(location.href);
      if (u.searchParams.get('brand') !== bName) {
        u.searchParams.set('brand', bName);
        history.replaceState(history.state, '', u.pathname + u.search + u.hash);
      }
    }
  } catch (e) {}
}

function syncBrandSelector(bName, isDel) {
  var seg = document.getElementById('brandSeg');
  if (!seg) return;
  var cBtn = seg.querySelector('[data-brand="coffee"]');
  var dBtn = seg.querySelector('[data-brand="delivery"]');
  if (cBtn) cBtn.classList.toggle('on', bName === 'coffee');
  if (dBtn) dBtn.classList.toggle('on', isDel);
  seg.classList.toggle('is-delivery', isDel);
}

function syncBrandMarkAndChatIcon(isDel) {
  if (window.__ensureVenueToggle) window.__ensureVenueToggle();
  if (window.__labelVenueToggle) window.__labelVenueToggle();
  var mark = document.getElementById('brandMark') || document.querySelector('.brand .mark');
  if (mark) mark.classList.toggle('is-delivery', isDel);
  var op = document.querySelector('.chat-h .op, .chatHead .op');
  if (!op) return;
  if (!op.hasAttribute('data-orig')) op.setAttribute('data-orig', op.innerHTML);
  op.innerHTML = isDel ? '🍕' : (op.getAttribute('data-orig') || '');
}

function syncBrandTitle(isDel) {
  var bTitle = document.getElementById('brandTitle');
  var bSub = document.getElementById('brandSub');
  if (bTitle) {
    if (isDel) {
      bTitle.textContent = 'Пятница';
      bTitle.removeAttribute('aria-label');
    } else {
      bTitle.setAttribute('aria-label', '…и кофе');
      bTitle.innerHTML = '…и к<span class="bean" aria-hidden="true"><svg viewBox="3.5 1.5 21 24"><g transform="translate(3 3)"><g transform="rotate(-24 12 12)"><ellipse cx="12" cy="12" rx="7.7" ry="9.8" fill="#23272C"/></g></g><g transform="translate(2 2)"><g transform="rotate(-24 12 12)"><ellipse cx="12" cy="12" rx="7.7" ry="9.8" fill="#2E3238"/></g></g><g transform="translate(1 1)"><g transform="rotate(-24 12 12)"><ellipse cx="12" cy="12" rx="7.7" ry="9.8" fill="#2E3238"/></g></g><g transform="rotate(-24 12 12)"><ellipse cx="12" cy="12" rx="7.7" ry="9.8" fill="currentColor"/><path d="M12 3.6C8.4 7.8 15.6 16.2 12 20.4" fill="none" stroke="rgba(255,255,255,.9)" stroke-width="1.5" stroke-linecap="round"/><ellipse cx="9.2" cy="8.2" rx="1.6" ry="2.8" fill="rgba(255,255,255,.25)"/></g></svg></span>фе';
    }
  }
  if (bSub) bSub.textContent = isDel ? 'доставка пиццы и роллов' : 'кофейня на берегу моря';
}

function syncBrandChromeState(bName, isDel) {
  document.documentElement.setAttribute('data-brand', bName);
  document.body.setAttribute('data-brand', bName);
  /* Цвет полосы браузера (safe area): Safari перекрашивает только новый элемент meta */
  (function () {
    var color = isDel ? '#C99E6E' : '#FFFFFF';
    document.querySelectorAll('meta[name="theme-color"]').forEach(function (old) { old.remove(); });
    var m = document.createElement('meta');
    m.name = 'theme-color';
    m.content = color;
    document.head.appendChild(m);
  })();
  syncBrandUrl(bName);
  syncBrandSelector(bName, isDel);
  syncBrandMarkAndChatIcon(isDel);
  syncBrandTitle(isDel);
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
  var canEdit = (typeof canStopMenu === 'function') && canStopMenu(bName2);
  var currentMode = typeof window.mode === 'string' ? window.mode : (typeof mode !== 'undefined' ? mode : 'guest');
  var activeView = document.getElementById(bName2 === 'delivery' ? 'deliveryView' : 'menuView');
  var menuHead = activeView && activeView.querySelector('.menu-head');
  var menuRow = menuHead && menuHead.querySelector('.menu-controls-row');
  var titleHost = menuHead && menuHead.querySelector('.mh-top > div:first-child');
  var title = titleHost && titleHost.querySelector('h1');
  var topbar = document.querySelector('header.topbar');
  var adminBar = document.getElementById('adminBar');
  var editToggle = document.getElementById('editToggle');
  var modeSeg = document.getElementById('modeSeg');
  var root = document.documentElement;
  var roleHint = root.getAttribute('data-staff-role');
  var staffReady = root.hasAttribute('data-staff-ready');
  var validStaffRoles = ['admin', 'cashier', 'dispatch'];
  var isStaff = validStaffRoles.indexOf(roleHint) !== -1;
  var confirmedStaff = !!(typeof me !== 'undefined' && me &&
    validStaffRoles.indexOf(me.role) !== -1);
  var menuIsVisible = !!(menuHead && titleHost && activeView &&
    !activeView.hidden && getComputedStyle(activeView).display !== 'none');
  var menuPlacement = !!(isStaff && menuIsVisible);

  // The role switcher belongs to the visible "Меню" block in guest and admin modes.
  if (menuPlacement && titleHost) {
    if (!menuRow) {
      menuRow = document.createElement('div');
      menuRow.className = 'menu-controls-row';
      titleHost.insertBefore(menuRow, title);
    }
    if (menuRow.parentElement !== titleHost) titleHost.insertBefore(menuRow, title);
    if (title && title.parentElement !== menuRow) menuRow.appendChild(title);
    var modeSlot = menuRow.querySelector('.mode-seg-slot');
    if (!modeSlot) {
      modeSlot = document.createElement('div');
      modeSlot.className = 'mode-seg-slot';
      menuRow.appendChild(modeSlot);
    }
    if (modeSeg && modeSeg.parentElement !== modeSlot) modeSlot.appendChild(modeSeg);
    if (editToggle && editToggle.parentElement !== menuRow) menuRow.appendChild(editToggle);
  } else {
    if (title && menuRow && menuRow.parentElement && title.parentElement !== menuRow) {
      menuRow.parentElement.insertBefore(title, menuRow);
    }
    if (menuRow && menuRow.parentElement) menuRow.remove();
    if (modeSeg && topbar && modeSeg.parentElement !== topbar) topbar.appendChild(modeSeg);
    if (editToggle && adminBar && editToggle.parentElement !== adminBar) {
      adminBar.insertBefore(editToggle, adminBar.firstChild);
    }
  }

  if (editToggle) {
    editToggle.hidden = !canEdit || !staffReady;
    editToggle.setAttribute('aria-label', 'Редактировать меню');
    editToggle.title = 'Редактировать меню';
  }
  if (modeSeg) {
    modeSeg.hidden = !isStaff || !staffReady;
    if (topbar) {
      topbar.classList.toggle('has-mode-switcher', !!isStaff && !menuPlacement);
      topbar.classList.toggle('has-menu-role-switcher', menuPlacement);
    }
  }
  if (typeof renderModes === 'function') renderModes();
  if (modeSeg) modeSeg.hidden = !isStaff || !staffReady;

  if (adminBar) {
    var hasAdminActions = Array.prototype.some.call(
      adminBar.querySelectorAll(':scope > button:not(#editToggle)'),
      function (button) { return !button.hidden; }
    );
    adminBar.hidden = !staffReady || !((confirmedStaff && me.role === 'admin') || canEdit || hasAdminActions);
    adminBar.style.removeProperty('display');
  }

  var mb = document.getElementById('mbonusBtn');
  if (mb) mb.style.display = (currentMode === 'guest' && bName2 === 'coffee') ? '' : 'none';
  var bb = document.getElementById('bonusBox');
  if (bb) bb.style.display = (typeof me !== 'undefined' && me) ? '' : 'none';
  var bt = document.querySelector('.tabs button[data-tab="bonus"]');
  if (bt) bt.style.display = (bName2 === 'delivery') ? 'none' : '';
  if (confirmedStaff && typeof renderProfile === 'function') renderProfile();
  if (menuPlacement && typeof window.alignRailWithCard === 'function') {
    window.alignRailWithCard();
  }
}
function syncChatFab(staff, bName2) {
  var cfab = document.getElementById('chatFab');
  var supportHost = document.getElementById('supportLauncherHost');
  if (!cfab || !supportHost) return;
  var activeView = document.getElementById(bName2 === 'delivery' ? 'deliveryView' : 'menuView');
  var mobileViewport = window.matchMedia && window.matchMedia('(max-width: 820px)').matches;
  var supportTarget = mobileViewport && activeView
    ? activeView.querySelector('.mh-right')
    : document.body;
  if (supportTarget && supportTarget !== supportHost &&
      supportHost.parentElement !== supportTarget && !supportHost.contains(supportTarget)) {
    if (typeof supportTarget.moveBefore === 'function') supportTarget.moveBefore(supportHost, null);
    else supportTarget.appendChild(supportHost);
  }
  var cartPanel = document.getElementById('cartPanel');
  var cartOpen = !!(cartPanel && cartPanel.classList.contains('open'));
  cfab.style.display = (staff || cartOpen) ? 'none' : '';
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
    window.__dlPromise = window.loadDelivery();
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
var supportViewport = window.matchMedia && window.matchMedia('(max-width: 820px)');
if (supportViewport) {
  var refreshSupportPlacement = function () {
    if (typeof window.sv === 'function') window.sv();
  };
  if (supportViewport.addEventListener) {
    supportViewport.addEventListener('change', refreshSupportPlacement);
  } else if (supportViewport.addListener) {
    supportViewport.addListener(refreshSupportPlacement);
  }
}
window.syncBrandViews = function() {
  sv();
};

function canEnterMode(modeName, role) {
  if (modeName === 'cashier' && role !== 'cashier' && role !== 'admin') return false;
  if (modeName === 'orders' && role !== 'dispatch' && role !== 'cashier' && role !== 'admin') return false;
  if (modeName === 'admin' && role !== 'admin') return false;
  return true;
}

function syncModeVisibility(modeName) {
  document.body.classList.toggle('is-cashier', modeName === 'cashier' || modeName === 'orders');
  document.body.classList.toggle('is-admin', modeName === 'admin');
  var cv = document.getElementById('cashierView');
  if (cv) { cv.hidden = (modeName !== 'cashier'); cv.style.display = ''; }
  var ov = document.getElementById('ordersView');
  if (ov) ov.hidden = (modeName !== 'orders');
  sv();
}

function syncModeControls(modeName) {
  var isAdmin = modeName === 'admin';
  var pt = document.getElementById('promoToggle');
  if (pt) pt.hidden = !isAdmin;
  var dt = document.getElementById('dashToggle');
  if (dt) dt.hidden = !isAdmin;
  var ct = document.getElementById('chatsToggle2');
  if (ct) ct.hidden = !isAdmin;
  var bd = document.getElementById('adminBadge');
  if (bd) bd.hidden = !isAdmin;
}

function startModeServices(modeName) {
  if (modeName !== 'admin' && typeof exitEdit === 'function') exitEdit();
  if (modeName === 'cashier' && typeof window.loadPending === 'function') window.loadPending();
  if (modeName === 'cashier' && typeof renderLog === 'function') renderLog();
  if (modeName === 'orders') {
    if (typeof renderOrders === 'function') renderOrders();
    if (typeof ordersPoll === 'undefined' || !ordersPoll) {
      window.ordersPoll = setInterval(function () {
        if (mode === 'orders' && typeof renderOrders === 'function') renderOrders(true);
      }, 8000);
    }
  }
  if (modeName === 'admin' && brand !== 'delivery' && typeof loadMenu === 'function') loadMenu();
}

function notifyModeActivated(modeName) {
  if (typeof toast !== 'function') return;
  toast(
    modeName === 'admin' ? 'Режим администратора активен' : modeName === 'cashier' ? 'Смена кассира активна' : modeName === 'orders' ? 'Панель диспетчера' : 'Режим гостя',
    modeName === 'admin' ? '🔓' : modeName === 'cashier' ? '🧾' : modeName === 'orders' ? '🍕' : ''
  );
}

window.setMode = function (m) {
  var role = (typeof me !== 'undefined' && me) ? me.role : 'guest';
  if (!canEnterMode(m, role)) return;
  window.mode = m;
  syncModeVisibility(m);
  syncModeControls(m);
  startModeServices(m);
  if (typeof renderModes === 'function') renderModes();
  // syncModeVisibility() calls sv() before the new mode controls are rendered.
  // Run one final sync so controls moved into the active menu head reflect the new mode.
  if (typeof window.syncBrandViews === 'function') window.syncBrandViews();
  notifyModeActivated(m);
};

var brandSegEl = document.getElementById('brandSeg');
function applyBrandSelection(bName) {
  brand = bName;
  try { localStorage.setItem('zt_brand', brand); } catch (err) {}
  document.documentElement.setAttribute('data-brand', brand);
  document.body.setAttribute('data-brand', brand);
  if (typeof mode !== 'undefined' && (mode === 'cashier' || mode === 'orders')) {
    if (typeof setMode === 'function') setMode('guest');
  }
}

function syncBrandDropdown(bName) {
  brandSegEl.querySelectorAll('button').forEach(function (button) {
    button.classList.toggle('on', button.dataset.brand === bName);
  });
  brandSegEl.classList.remove('open');
  brandSegEl.style.display = 'none';
  var toggle = document.getElementById('venueToggle');
  if (toggle) toggle.setAttribute('aria-expanded', 'false');
}

function loadCoffeeMenuOnBrandSwitch(bName) {
  if (bName !== 'coffee') return;
  if ((!window.MENU || !window.MENU.length) && typeof loadMenu === 'function') {
    loadMenu().then(function () {
      if (typeof renderRail === 'function') renderRail();
    }).catch(function () {});
    return;
  }
  if (typeof renderRail === 'function') renderRail();
  if (typeof renderMenu === 'function') renderMenu();
}

function syncChatContextOnBrandSwitch(bName) {
  if (typeof supportPending === 'undefined' || supportPending ||
      typeof chatCtx === 'undefined' || chatCtx === bName) return;
  chatCtx = bName;
  try { localStorage.setItem('zt_chatctx', chatCtx); } catch (err) {}
  if (typeof setBotName === 'function') setBotName();
}

function reloadOpenChatForBrandSwitch() {
  var chatPanel = document.getElementById('chatPanel');
  if (chatPanel && chatPanel.classList.contains('open')) {
    setTimeout(function () {
      if (typeof reloadChatThread === 'function') reloadChatThread();
    }, 80);
  }
}

function handleBrandSegmentClick(e) {
  var button = e.target.closest('[data-brand]');
  if (!button) return;
  applyBrandSelection(button.dataset.brand);
  syncBrandDropdown(brand);
  window.__dlReq = 0;
  window.__dlPromise = null;
  sv();
  loadCoffeeMenuOnBrandSwitch(brand);
  syncChatContextOnBrandSwitch(brand);
  reloadOpenChatForBrandSwitch();
}

if (brandSegEl) brandSegEl.addEventListener('click', handleBrandSegmentClick);
sv();

/* ========== Ф3.26: создание #venueToggle один раз без дублирования ========== */
(function () {
  function ensure() {
    var seg = document.getElementById('brandSeg');
    var header = document.querySelector('header.topbar');
    if (!seg || !header) return;

    var venue = document.getElementById('venueToggle');
    var wrap = seg.closest('.venueWrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'venueWrap';
      seg.parentNode.insertBefore(wrap, seg);
      wrap.appendChild(seg);
    }
    if (!venue) {
      venue = document.createElement('button');
      venue.id = 'venueToggle';
      venue.type = 'button';
      venue.className = 'venueToggle';
      venue.setAttribute('aria-haspopup', 'listbox');
      venue.setAttribute('aria-expanded', 'false');
      wrap.insertBefore(venue, seg);
      venue.addEventListener('click', function (event) {
        event.stopPropagation();
        var open = seg.classList.toggle('open');
        seg.style.display = open ? 'flex' : 'none';
        venue.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      document.addEventListener('click', function (event) {
        if (!wrap.contains(event.target)) {
          seg.classList.remove('open');
          seg.style.display = 'none';
          venue.setAttribute('aria-expanded', 'false');
        }
      });
    } else if (venue.parentElement !== wrap) {
      wrap.insertBefore(venue, seg);
    }

    var headerControls = document.getElementById('topbar-actions');
    if (!headerControls) {
      headerControls = document.createElement('div');
      headerControls.id = 'topbar-actions';
      headerControls.className = 'topbar-actions';
      header.appendChild(headerControls);
    }
    ['mbonusBtn', 'profileTopBtn'].forEach(function (id) {
      var control = document.getElementById(id);
      if (control && control.parentElement !== headerControls) headerControls.appendChild(control);
    });

    if (wrap.parentElement !== header) header.insertBefore(wrap, header.firstChild);
    if (headerControls.parentElement !== header) header.appendChild(headerControls);
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
  window.__syncHeaderCluster = ensure;
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
  var cartPanelEl = document.getElementById('cartPanel');
  if ((panelEl || cartPanelEl) && typeof MutationObserver !== 'undefined') {
    var viewObserver = new MutationObserver(function () {
      refresh();
      var currentBrand = (typeof brand !== 'undefined' && (brand === 'delivery' || brand === 'test')) ? brand : 'coffee';
      var staff = typeof mode !== 'undefined' && (mode === 'cashier' || mode === 'orders');
      syncChatFab(staff, currentBrand);
    });
    if (panelEl) {
      viewObserver.observe(panelEl, {
        attributes: true,
        attributeFilter: ['class', 'hidden', 'style'],
      });
    }
    if (cartPanelEl) {
      viewObserver.observe(cartPanelEl, {
        attributes: true,
        attributeFilter: ['class'],
      });
    }
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
  if (typeof openAuth === 'function') openAuth();
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