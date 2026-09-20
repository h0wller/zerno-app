/* public/app/core/views.js — Ф3.22: флаги и state-мост чата, CSS-инъекция, DOM-переезды,
   виды/режимы (sv/setMode/brandSeg) + первичный sv() с исправленными конфликтами брендинга. */
(function () {
  'use strict';

  /* ========== 0. Флаги и state-мост чата ========== */
  var QS = new URLSearchParams(location.search);
  var IN_TG = /Telegram/i.test(navigator.userAgent);
  var DEEP = !!(QS.get('brand') || QS.get('tab') || QS.get('src'));
  var SUPPORT_ENTRY = (QS.get('tab') === 'chat' || QS.get('support') === 'choose');
  var chosenSupportCtx = SUPPORT_ENTRY ? (sessionStorage.getItem('zt_support_ctx') || '') : '';
  var supportPending = SUPPORT_ENTRY && !chosenSupportCtx;
  var chatCtx = localStorage.getItem('zt_chatctx') || '';
  if (chosenSupportCtx) chatCtx = chosenSupportCtx;

  window.__fvChatState = {
    getChatCtx: function () { return chatCtx; },
    setChatCtx: function (v) { chatCtx = v; try { localStorage.setItem('zt_chatctx', v); } catch (e) {} },
    getSupportPending: function () { return supportPending; },
    setSupportPending: function (v) { supportPending = v; },
    getChosenSupportCtx: function () { return chosenSupportCtx; },
    setChosenSupportCtx: function (v) { chosenSupportCtx = v; try { sessionStorage.setItem('zt_support_ctx', v); } catch (e) {} },
  };

  if (supportPending) {
    document.body.classList.add('support-pending');
    var ov0 = document.getElementById('supportChooseOverlay');
    if (ov0) { ov0.style.display = 'flex'; ov0.style.zIndex = '10002'; }
  }

  /* ========== 1. CSS (СЛОЙ 2: layout + брендовые переопределения) ========== */
  /* Базовые компоненты — в theme-v2.css (СЛОЙ 1). Здесь — только то, чего там нет.
     Правила архитектуры: docs/css-architecture.md */
  var css = document.createElement('style');
  var rules = [
    /* --- Layout: сетка wrap + safe-area --- */
    '@media(min-width:1181px){body:not(.is-cashier) .wrap > .rail{grid-column:1}body:not(.is-cashier) .wrap > section{grid-column:2}body:not(.is-cashier) .wrap > .panel{grid-column:3}}',
    'html,body{overflow-x:hidden;max-width:100%}',
    'img,canvas,svg,video{max-width:100%}',
    '.topbar{padding-top:calc(env(safe-area-inset-top,0px) + 10px)}',

    /* --- Delivery grid + опции --- */
    '#deliveryGrid{grid-template-columns:1fr;padding-bottom:120px}',
    '@media(min-width:560px){#deliveryGrid{grid-template-columns:repeat(auto-fill,minmax(240px,1fr))}}',
    '#deliveryGrid .opts{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}',
    '@media(max-width:400px){#deliveryGrid .opts{grid-template-columns:1fr}}',
  '#deliveryGrid .opts button{display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:8px 10px;border:2px solid var(--line);border-radius:12px;font-size:11px;font-weight:600;background:#fff;line-height:1.3;white-space:normal;text-align:left;width:100%;transition:background .15s,border-color .15s,color .15s,box-shadow .15s}',
  '#deliveryGrid .opts button:active{transform:translateY(1px)}',
    '@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}',
  '#deliveryGrid .opts button .op{color:var(--soft);font-weight:700}',
    '#deliveryGrid .opts button.sel{background:var(--flame);border-color:var(--flame);color:#fff}',
    '#deliveryGrid .opts button.sel .op{color:var(--tint-warm)}',
    '#deliveryGrid .opts.shake{animation:shake .4s}',

    /* --- FAB корзины --- */
    '#cartFab{background:var(--flame);box-shadow:0 12px 30px -8px rgba(58,42,28,.45);bottom:calc(84px + env(safe-area-inset-bottom))}',
    '.addonChip{border:1.5px solid var(--line);background:#fff;border-radius:999px;padding:6px 12px;font-size:12px;font-weight:600;margin:0 6px 6px 0}',
    '.addonChip b{color:var(--flame)}',

    /* --- Мобильная шапка --- */
    '@media(max-width:820px){.topbar{flex-wrap:wrap;row-gap:8px;padding:8px 12px;padding-top:calc(env(safe-area-inset-top,0px) + 10px)}.topbar .brand{order:1;min-width:0}#clock{order:2;margin-left:auto}#profileTopBtn{order:3}#brandSeg{order:10;flex:1 1 100%;overflow-x:auto;scrollbar-width:none}#modeSeg{order:11;flex:1 1 100%;overflow-x:auto;scrollbar-width:none}#brandSeg::-webkit-scrollbar,#modeSeg::-webkit-scrollbar{display:none}#brandSeg button,#modeSeg button{flex:0 0 auto}}',
    '@media(max-width:400px){#brandSeg button,#modeSeg button{font-size:12px;padding:6px 12px}}',

    /* --- Шторка на мобильных --- */
    '@media(max-width:1180px){#panel.open{position:fixed;top:0;left:0;right:0;bottom:0;width:100%;height:100%;max-height:100%;border-radius:0;margin:0;transform:none;z-index:320}#panel .tabs{padding-bottom:calc(env(safe-area-inset-bottom,0px) + 10px)}}',

    /* --- Сплэш бренда --- */
    '#brandSplash{position:fixed;inset:0;z-index:400;background:var(--paper);display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto}',
    '#brandSplash .spInner{width:100%;max-width:560px;text-align:center}',
    '#brandSplash .spTitle{font:400 clamp(20px,5.5vw,30px)/1.25 Prata,serif;margin-bottom:6px;overflow-wrap:break-word}',
    '#brandSplash .spSub{color:var(--soft);font-size:14px;margin-bottom:22px}',
    '#brandSplash .spBtns{display:grid;grid-template-columns:1fr;gap:12px}',
    '#brandSplash .spBtn{border-radius:22px;padding:22px 16px;font:700 16px Unbounded,sans-serif;box-shadow:var(--sh);width:100%}',
    '#brandSplash .spBtn small{display:block;font:400 12px Golos Text,sans-serif;margin-top:6px}',
    '#brandSplash .spPizza{border:2px solid #F2D9A5;background:#FFF6E5;color:#6B4E0E}',
    '#brandSplash .spPizza small{color:#8A6D3B}',
    '#brandSplash .spCoffee{border:2px solid var(--line);background:#fff;color:var(--ink)}',
    '#brandSplash .spCoffee small{color:var(--soft)}',
    '@media(min-width:560px){#brandSplash .spBtns{grid-template-columns:1fr 1fr}}',

    /* --- Чат --- */
    '#chatPanel [class="chip"],#chatPanel #chips,#chatPanel .chips{display:none}',
    '.chatHint{display:inline-block;background:#EDF2F6;border:1.5px solid var(--line);border-radius:16px 16px 16px 4px;padding:8px 14px;margin:3px 4px;font-size:13px;color:var(--ink);cursor:pointer}',
    '.chatHint:active{background:#D6E4F0}',
    '.ctxPick{display:flex;gap:8px;margin:8px 0}',
    '.ctxPick button{flex:1;padding:10px;border-radius:14px;font-size:13px;font-weight:700;border:1.5px solid var(--line);background:#fff;cursor:pointer}',
    '.ctxPick .cpD{border-color:#F2D9A5;background:#FFF6E5;color:#6B4E0E}',
    '.ctxPick .cpC{color:var(--ink)}',
    '.chat-fab{z-index:10001}',

    /* --- Заказы в профиле --- */
    '#myOrders{display:flex;flex-direction:column;gap:8px;margin:6px 0 4px}',
    '#myOrders .hmini{margin:0;background:#fff;border:1.5px solid var(--line);border-radius:14px;padding:10px 12px;font-size:14px;font-weight:600}',
    '.myOrderCard{background:#fff;border:1.5px solid var(--line);border-radius:16px;padding:12px 14px;box-shadow:var(--sh)}',
    '.myOrderCard .moTop{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:15px;font-weight:800}',
    '.moSt{font-size:11px;font-weight:800;padding:4px 10px;border-radius:999px;background:#EDF2F6;color:#33507A;white-space:nowrap}',
    '.mo-new,.mo-accept{background:var(--tint-cool);color:var(--flame)}',
    '.mo-cook{background:var(--status-alert-tint);color:var(--status-alert)}',
    '.mo-way{background:var(--tint-cool);color:var(--flame)}',
    '.mo-done{background:var(--tint-success);color:var(--status-success)}',
    '.mo-cancel{background:var(--tint-danger);color:var(--status-danger)}',
    '.myOrderCard .moSum{margin-top:6px;font-size:15px;font-weight:800}',
    '.myOrderCard .moItems{margin-top:2px;font-size:12px;color:var(--soft)}',
    '.myOrderCard .moGifts{margin-top:4px;font-size:12px;color:#2F7D4F;font-weight:700}',

    /* --- Поддержка: оверлей выбора темы --- */
    'body.support-pending .hintsWrap{display:none}',
    '#supportChooseOverlay{position:fixed;inset:0;z-index:10002;background:var(--paper);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center}',
    '#supportChooseOverlay .scTitle{font:400 22px Prata,serif}',
    '#supportChooseOverlay .scSub{color:var(--soft);font-size:13px}',
    '#supportChooseOverlay .scBtns{width:100%;max-width:340px}',

'/* ── Топбар: адаптив + бренд-тема дропдауна + анимация ── */'+
'.topbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap}'+
'.topbar .venueWrap{position:relative;order:1;flex:0 0 auto}'+
'.topbar .brand{order:2;flex:1 1 auto;display:flex;align-items:center;justify-content:center;gap:10px;min-width:0}'+
'/* Логотип: ОДНО правило, только min/max — без !important и войн специфичности */'+

'.topbar .brand .mark{display:flex;align-items:center;justify-content:center;width:auto;height:auto;min-height:36px;max-height:48px;overflow:hidden;background:transparent;border:0;box-shadow:none;border-radius:12px;flex:0 0 auto}'+
'.topbar .brand .mark img,.topbar .brand .mark svg,.topbar .brand .friday-svg,.topbar .brand .friday-svg svg{display:block;width:auto;height:auto;min-height:28px;max-height:44px;max-width:min(52vw,240px);object-fit:contain;aspect-ratio:auto;flex:0 0 auto}'+
'[data-brand="delivery"] .topbar .brand .mark img,[data-brand="delivery"] .topbar .brand .mark svg{max-height:40px;max-width:min(56vw,260px)}'+
'@media(max-width:820px){.topbar .brand .mark{min-height:32px;max-height:40px}.topbar .brand .mark img,.topbar .brand .mark svg{max-height:34px;max-width:48vw}}'+
'.topbar #clock{order:3;margin-left:auto}'+
'.topbar #profileTopBtn{order:4;flex:0 0 auto}'+
'.topbar #modeSeg{order:10;flex:1 1 100%}'+
'.venueToggle{display:inline-flex;align-items:center;gap:6px;border:1.5px solid var(--line);background:var(--card,#fff);border-radius:999px;padding:7px 12px;font:700 13px "Golos Text",system-ui,sans-serif;color:var(--ink);cursor:pointer;transition:all .2s}'+
'.venueToggle:hover{background:#F5F5F5;transform:translateY(-1px)}'+
'[data-brand="delivery"] .venueToggle{border:2px solid #3A2A1C;background:#F6EEE1;color:#3A2A1C;box-shadow:2px 2px 0 #3A2A1C}'+
'[data-brand="delivery"] .venueToggle:hover{background:#EFE6D8;box-shadow:3px 3px 0 #3A2A1C;transform:translate(-1px,-1px)}'+
'.venueToggle .vt-arrow{font-size:9px;opacity:.7;transition:transform .2s}'+
'.venueToggle[aria-expanded="true"] .vt-arrow{transform:rotate(180deg)}'+
'.venueWrap #brandSeg{display:none;position:absolute;left:0;top:calc(100% + 8px);z-index:80;flex-direction:column;gap:2px;width:max-content;min-width:max(180px,100%);max-width:calc(100vw - 24px);border:1.5px solid var(--line);border-radius:14px;background:var(--card,#fff);box-shadow:var(--sh);padding:6px;overflow:visible;animation:fadeIn .2s ease}'+
'.venueWrap #brandSeg.open{display:flex}'+
'[data-brand="delivery"] .venueWrap #brandSeg{background:#F6EEE1;border:2px solid #3A2A1C;box-shadow:3px 3px 0 #3A2A1C;border-radius:12px}'+
'.venueWrap #brandSeg button{flex:0 0 auto;width:100%;border:0;border-radius:10px;padding:10px 12px;font:700 14px "Golos Text",sans-serif;background:transparent;color:var(--ink);text-align:left;box-shadow:none;display:flex;align-items:center;gap:8px;transition:all .15s;cursor:pointer}'+
'.venueWrap #brandSeg button:hover{background:rgba(0,0,0,.06);transform:translateX(2px)}'+
'[data-brand="delivery"] .venueWrap #brandSeg button:hover{background:#EFE6D8;transform:translateX(3px)}'+
'.venueWrap #brandSeg button .re,.venueWrap #brandSeg button span{background:transparent!important;border:0!important;box-shadow:none!important;padding:0!important;border-radius:0!important;font-size:16px}'+
'.venueWrap #brandSeg button.on{background:var(--flame);color:#fff}'+
'[data-brand="delivery"] .venueWrap #brandSeg button.on{background:#C03B2A;border:2px solid #3A2A1C;box-shadow:2px 2px 0 #3A2A1C;color:#fff}'+
'.venueWrap #brandSeg button.on span{color:#fff!important}'+
'@keyframes fadeIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}'+
'@media(max-width:820px){.topbar #clock{display:none}.topbar .brand .mark{width:40px;height:40px}.topbar .brand b{font-size:19px}[data-brand="delivery"] .topbar .brand .mark{max-width:120px;height:36px}}'+


    /* --- Ф3.7-fix: состояния кнопки «Добавить» в доставке --- */
    '#deliveryGrid .cta{background:#fff;border:1.5px solid var(--line);color:var(--ink);border-radius:12px;padding:12px;font:700 14px "Golos Text",system-ui,sans-serif;cursor:pointer;box-shadow:none;transition:background .15s,border-color .15s,color .15s}',
    '#deliveryGrid .cta:active{transform:translateY(1px)}',
    '#deliveryGrid .cta:disabled{background:#EDF2F6;border-color:var(--line);color:#8B98A5;cursor:not-allowed;transform:none}',
    '#deliveryGrid .cta.incart{border-color:var(--flame);color:var(--flame)}',
    '#deliveryGrid .cta.added{background:var(--flame);border-color:var(--flame);color:#fff}',
    '#deliveryGrid .card .media{position:relative}',
    '#deliveryGrid .card.stopped{opacity:.75}',
    '#deliveryGrid .stopbadge{position:absolute;top:10px;right:10px;left:auto;z-index:2;background:#D63939;color:#fff;font:800 10px "Golos Text",sans-serif;letter-spacing:.06em;border-radius:8px;padding:3px 8px}'+

    /* --- Ф3-фикс: iosHint/installBanner не накрывают шапку --- */
    '#iosHint,#installBanner{top:auto;bottom:calc(96px + env(safe-area-inset-bottom))}',

    '/* ══ БРЕНД: Пятница — терракотовый стикер-арт по гайдлайну ══ */'+
'html[data-brand="delivery"],body[data-brand="delivery"]{--flame:#C03B2A;--flame-d:#8E3716;--esp:#3A2A1C;--esp2:#241812;--fr-choc:#3A2A1C;--fr-tan:#C99E6E;--fr-rice:#EFE6D8;--fr-paper:#F6EEE1;--paper:#F3EDE6;--tint-cool:#F3E2CE;--tint-warm:#F3E2CE}'+
'html[data-brand="delivery"] body{background-color:#F3EDE6;background-image:radial-gradient(rgba(58,42,28,.1) 1px,transparent 1.5px);background-size:12px 12px}'+
'[data-brand="delivery"] h1,[data-brand="delivery"] h2,[data-brand="delivery"] h3,[data-brand="delivery"] .cbody h3{font-family:Unbounded,sans-serif;color:var(--fr-choc)}'+
'[data-brand="delivery"] .card{border:2px solid var(--fr-choc);box-shadow:2px 2px 0 var(--fr-choc);background:var(--fr-paper)}'+
'[data-brand="delivery"] .cta,[data-brand="delivery"] #checkoutBtn,[data-brand="delivery"] .btn.fire{border:2px solid var(--fr-choc);box-shadow:3px 3px 0 var(--fr-choc);background:var(--flame);color:#fff}'+
'[data-brand="delivery"] .price{color:var(--flame)}'+
'[data-brand="delivery"] .tag{background:var(--flame)}'+
'[data-brand="delivery"] .tag.hit{background:var(--flame-d)}'+
'[data-brand="delivery"] .comp i{background:var(--fr-rice);border-color:var(--fr-tan);color:var(--fr-choc)}'+
'[data-brand="delivery"] #deliveryGrid .opts button{border:2px solid var(--fr-tan);background:#fff}',
'[data-brand="delivery"] #deliveryGrid .opts button.sel{background:var(--fr-tan);border-color:var(--fr-choc);box-shadow:2px 2px 0 var(--fr-choc);color:var(--fr-choc)}',
'[data-brand="delivery"] #deliveryGrid .opts button.sel .op{color:var(--fr-choc)}'+
'[data-brand="delivery"] #deliveryRail button.on{background:var(--flame);border:2px solid var(--fr-choc);box-shadow:2px 2px 0 var(--fr-choc);color:#fff;font:700 13px Unbounded,sans-serif}'+
'#deliveryRail button{transition:transform .15s,box-shadow .15s,background .15s}',
'#deliveryRail button:hover{transform:translateY(-1px)}',
'#deliveryRail button.on:hover{transform:none}',
'[data-brand="delivery"] #brandSeg,[data-brand="delivery"] #modeSeg{background:var(--esp)}'+
'[data-brand="delivery"] #brandSeg button.on,[data-brand="delivery"] #modeSeg button.on{background:var(--flame);color:#fff}'+
'[data-brand="delivery"] #cartFab,[data-brand="delivery"] .chat-fab{background:var(--flame);border:2px solid var(--fr-choc);box-shadow:3px 3px 0 var(--fr-choc)}'+
'[data-brand="delivery"] .addonChip b{color:var(--flame)}'+
'[data-brand="delivery"] #cartPanel,[data-brand="delivery"] .cartPanel{background:var(--fr-rice);border:2px solid var(--fr-choc)}'+
'[data-brand="delivery"] .cartPanel .qty button{background:#C99E6E!important;border:1.5px solid #3A2A1C!important;color:#3A2A1C!important}'+
'/* ── Карточки доставки: описание клампим в 2 строки, опции прижимаем к низу — ряды совпадают ── */'+
'#deliveryGrid .cbody .desc{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:2.75em}'+
'#deliveryGrid .cbody .opts{margin-top:auto}'+
'/* ── Ника с иконкой и крафтовое кольцо FAB в доставке ── */'+
'[data-brand="delivery"] .chatHead .op{background:#F6EEE1!important;border:0!important;display:flex;align-items:center;justify-content:center;font-size:20px}'+
'[data-brand="delivery"] .chat-fab::before{border-color:#C03B2A!important}'+
'[data-brand="delivery"] #chatPanel .chatHead{background:var(--fr-choc);color:#fff}'+
'[data-brand="delivery"] .chatHead .av{background:var(--fr-paper);background-image:none;color:var(--fr-choc)}'+
'[data-brand="delivery"] #chatMsgs{background:var(--fr-paper)}'+
'[data-brand="delivery"] #chatMsgs .msg.me,[data-brand="delivery"] #chatMsgs .me{background:var(--flame);border:2px solid var(--fr-choc);box-shadow:2px 2px 0 var(--fr-choc);color:#fff}'+
'[data-brand="delivery"] #chatMsgs .chatHint{background:var(--fr-rice);border-color:var(--fr-tan);color:var(--fr-choc)}'+
'[data-brand="delivery"] #chatSend{background:var(--flame);border:2px solid var(--fr-choc);color:#fff}'+
'[data-brand="delivery"] .mo-new,[data-brand="delivery"] .mo-accept,[data-brand="delivery"] .mo-way{background:var(--fr-rice);color:var(--flame)}'+
'.topbar .brand{flex:1 1 auto;display:flex;align-items:center;justify-content:center;gap:10px;min-width:0}',
'.topbar .brand .mark,.topbar .brand img,.topbar .brand .friday-svg{height:44px;width:auto;max-width:220px;object-fit:contain;flex:0 1 auto}',
'[data-brand="delivery"] .topbar .brand{justify-content:center}',
'[data-brand="delivery"] .topbar .brand .mark,[data-brand="delivery"] .topbar .brand .friday-svg,[data-brand="delivery"] .topbar .brand img{width:100%;max-width:760px;height:64px;object-fit:contain;border-radius:0}',
'@media(max-width:820px){[data-brand="delivery"] .topbar .brand .mark,[data-brand="delivery"] .topbar .brand .friday-svg,[data-brand="delivery"] .topbar .brand img{height:48px;max-width:60vw}}',
'[data-brand="delivery"] .topbar .brand b,[data-brand="delivery"] .topbar .brand small,[data-brand="delivery"] #brandTitle,[data-brand="delivery"] #brandSub{display:none!important}'+
'[data-brand="delivery"] .topbar .brand{justify-content:flex-start}'+
'[data-brand="delivery"] .venueToggle{border-color:var(--fr-tan);background:var(--fr-paper);color:var(--fr-choc)}'+
'[data-brand="delivery"] #tickerTrack,[data-brand="delivery"] #ticker{background:var(--fr-choc);color:#E8A33D}'+
'[data-brand="coffee"] #tickerTrack,[data-brand="coffee"] #ticker{background:#123A6B;color:#BBD7F2}'+
/* ── Тикер: единственный владелец бегущей строки; translate3d = композитинг, не встаёт ── */
'.ticker{overflow:hidden;max-width:100%;height:30px;line-height:30px}',
'#tickerTrack{display:inline-flex;align-items:center;white-space:nowrap;width:max-content;backface-visibility:hidden;animation:zt-marquee 40s linear infinite}',
'#tickerTrack span{flex:0 0 auto;display:inline-flex;align-items:center;gap:.5rem;padding:0 1.2rem;font:600 11px/30px "Unbounded",system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;white-space:nowrap}',
'#tickerTrack span::after{content:"〜";margin-left:1.4rem;color:var(--azure,#3E8FD0)}',
'[data-brand="delivery"] #tickerTrack span::after{color:#C03B2A}',
'@keyframes zt-marquee{from{transform:translate3d(0,0,0)}to{transform:translate3d(-50%,0,0)}}',
'@media(prefers-reduced-motion:reduce){#tickerTrack{animation:none}}',
  ];
  css.textContent = rules.join('\n');
  document.head.appendChild(css);

  /* ========== 2. DOM-переезды ========== */
  var wrapEl = document.querySelector('.wrap');
  var sec = wrapEl ? wrapEl.querySelector(':scope > section') : null;
  ['deliveryView', 'ordersView', 'cashierView'].forEach(function (id) {
    var el = document.getElementById(id);
    if (sec && el && el.parentNode !== sec) sec.appendChild(el);
  });
  var dRail = document.getElementById('deliveryRail');
  if (wrapEl && dRail && dRail.parentNode !== wrapEl) {
    wrapEl.insertBefore(dRail, sec);
    dRail.classList.add('rail');
  }
  var ab0 = document.getElementById('adminBar');
  if (sec && ab0 && ab0.parentNode !== sec) sec.insertBefore(ab0, sec.firstChild);

  (function () {
    var ov = document.getElementById('ordersView');
    if (ov && !document.getElementById('pendingBoxD')) {
      var d = document.createElement('div');
      d.className = 'cash-card';
      d.innerHTML = '<h3 style="margin:0 0 8px">🆕 Активация гостей</h3><div id="pendingBoxD"></div>';
      var lc = document.getElementById('ordersList');
      if (lc) ov.querySelector('.cashier').insertBefore(d, lc.closest('.cash-card'));
    }
    if (ov && !document.getElementById('chatsToggleD')) {
      var top = ov.querySelector('.cash-top');
      var b = document.createElement('button');
      b.id = 'chatsToggleD';
      b.className = 'btn ghost';
      b.textContent = '💬 Чаты гостей';
      b.onclick = typeof openStaffChat === 'function' ? openStaffChat : function () {};
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
      cp.insertBefore(d, ci);
    }
  })();

  /* ========== 3. Виды и режимы ========== */
  function sv() {
    try {
      var bName = (typeof brand !== 'undefined' && brand === 'delivery') ? 'delivery' : 'coffee';
      document.documentElement.setAttribute('data-brand', bName);
      document.body.setAttribute('data-brand', bName);

      var seg = document.getElementById('brandSeg');
      if (seg) {
        var cBtn = seg.querySelector('[data-brand="coffee"]');
        var dBtn = seg.querySelector('[data-brand="delivery"]');
        if (cBtn) cBtn.classList.toggle('on', bName === 'coffee');
        if (dBtn) dBtn.classList.toggle('on', bName === 'delivery');
        seg.classList.toggle('is-delivery', bName === 'delivery');
      }

// Ф3.25: mark.innerHTML владеет admin-extra.js (applyBrandChrome) — здесь не трогаем
      if (window.__ensureVenueToggle) window.__ensureVenueToggle();
      if (window.__labelVenueToggle) window.__labelVenueToggle();
      if (mark) mark.classList.toggle('is-delivery', isDel);
 /* Ф3.24: содержимое марки — ответственность admin-extra.js (applyBrandChrome).
    sv() владеет только классом марки и текстами #brandTitle/#brandSub. */

    // Страховка: снимаем инлайновые width/height/object-fit с логотипа шапки
    // (их вешают сторонние патчи, из-за чего friday-logo.png растягивался на весь экран)
    var bimg = document.querySelector('.topbar .brand img');
    if (bimg) {
      bimg.style.width = '';
   bimg.style.height = '';
   bimg.style.objectFit = '';
   bimg.style.position = '';
   bimg.style.inset = '';
   bimg.style.aspectRatio = '';
    }

    var op = document.querySelector('.chat-h .op, .chatHead .op');
    if (op) {
      if (!op.hasAttribute('data-orig')) op.setAttribute('data-orig', op.innerHTML);
      op.innerHTML = isDel ? '🍕' : (op.getAttribute('data-orig') || '');
    }

      var bTitle = document.getElementById('brandTitle');
      var bSub = document.getElementById('brandSub');
      if (bTitle) bTitle.textContent = isDel ? 'Пятница' : '…и кофе';
      if (bSub) bSub.textContent = isDel ? 'доставка пиццы и роллов' : 'кофейня на берегу моря';

    var seg2 = document.getElementById('brandSeg');
    if (seg2 && !document.getElementById('venueToggle')) {
      var vw = document.createElement('div'); vw.className = 'venueWrap';
      seg2.parentNode.insertBefore(vw, seg2);
      var vt = document.createElement('button');
      vt.id = 'venueToggle'; vt.type = 'button'; vt.className = 'venueToggle';
      vt.setAttribute('aria-haspopup', 'listbox'); vt.setAttribute('aria-expanded', 'false');
      vw.appendChild(vt); vw.appendChild(seg2);   // #brandSeg = список дропдауна (тесты кликают его)
      vt.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = seg2.classList.toggle('open');
        seg2.style.display = open ? 'flex' : 'none';   // inline-гарантия: список рисуется всегда
        vt.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      document.addEventListener('click', function (e) {
        if (!vw.contains(e.target)) { seg2.classList.remove('open'); seg2.style.display = 'none'; vt.setAttribute('aria-expanded', 'false'); }
      });
    }
    // Компактная метка переключателя = текущее заведение (освобождает шапку)
    var vt2 = document.getElementById('venueToggle');
    if (vt2) vt2.innerHTML = (isDel ? '🍕 Пятница' : '🌊 Кофейня') + ' <span class="vt-arrow">▾</span>';

    } catch (e) {}

    var showGuest = (typeof mode !== 'undefined' && (mode === 'guest' || mode === 'admin'));
    var bName2 = (typeof brand !== 'undefined' && brand === 'delivery') ? 'delivery' : 'coffee';
    var showCoffee = showGuest && bName2 === 'coffee';
    var showDeliv = showGuest && bName2 === 'delivery';

    var mv = document.getElementById('menuView');
    var dv = document.getElementById('deliveryView');
    var rl = document.getElementById('rail');
    var dr = document.getElementById('deliveryRail');

    if (mv) { mv.hidden = !showCoffee; mv.style.display = showCoffee ? '' : 'none'; }
    if (dv) { dv.hidden = false; dv.style.display = showDeliv ? 'block' : 'none'; }
    if (rl) rl.style.display = showCoffee ? '' : 'none';
    if (dr) dr.style.display = showDeliv ? '' : 'none';

    var et = document.getElementById('editToggle');
    if (et) et.hidden = (mode !== 'admin');

    var ab = document.getElementById('adminBar');
    if (ab) ab.hidden = (mode !== 'admin');

    var ms = document.getElementById('modeSeg');
    var isStaff = !!(typeof me !== 'undefined' && me && (me.role === 'admin' || me.role === 'cashier' || me.role === 'dispatch'));
    if (ms) ms.hidden = !isStaff;

    if (typeof renderModes === 'function') renderModes();

    var mb = document.getElementById('mbonusBtn');
    if (mb) mb.style.display = (mode === 'guest' && bName2 === 'coffee') ? '' : 'none';

    var bt = document.querySelector('.tabs button[data-tab="bonus"]');
    if (bt) bt.style.display = (bName2 === 'delivery') ? 'none' : '';

    if (bName2 === 'delivery' && typeof setTab === 'function') setTab('profile');
    if (typeof me !== 'undefined' && me && typeof renderProfile === 'function') renderProfile();

    var staff = (typeof mode !== 'undefined' && (mode === 'cashier' || mode === 'orders'));
    var cfab = document.getElementById('chatFab');
    if (cfab) cfab.style.display = staff ? 'none' : '';
    if (staff) {
      var p = document.getElementById('chatPanel');
      if (p) p.classList.remove('open');
    }

    var showScan = (typeof mode !== 'undefined' && mode === 'cashier');
    document.querySelectorAll('#scanBtn,#scanFab,#qrFab,#scanToggle,.fab-scan').forEach(function (b) {
      b.style.display = showScan ? '' : 'none';
    });

    if (typeof cartFabShow === 'function') cartFabShow();
 // Ф3.25: синхронизируем брендовый хром (тикер + логотип) прямым вызовом владельца
 if (typeof window.applyBrandChrome === 'function') window.applyBrandChrome();
}
window.syncBrandViews = sv;

  window.setMode = function (m) {
    var role = (typeof me !== 'undefined' && me) ? me.role : 'guest';
    if (m === 'cashier' && role !== 'cashier' && role !== 'admin') return;
    if (m === 'orders' && role !== 'dispatch' && role !== 'cashier' && role !== 'admin') return;
    if (m === 'admin' && role !== 'admin') return;

    mode = m;
    document.body.classList.toggle('is-cashier', m === 'cashier' || m === 'orders');

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

  /* Единый безопасный обработчик клика по переключателю бренда */
  var brandSegEl = document.getElementById('brandSeg');
  if (brandSegEl) {
    brandSegEl.addEventListener('click', function (e) {
      var b = e.target.closest('[data-brand]');
      if (!b) return;

      brand = b.dataset.brand;
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

/* Первичная инициализация видов */
sv();

/* ── Ф3.26: гарантия #venueToggle (дропдаун заведений) — создание вне sv(), с ретраями ── */
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
    var isDel = (typeof brand !== 'undefined' && brand === 'delivery');
    vt.innerHTML = (isDel ? '🍕 Пятница' : '🌊 Кофейня') + ' <span class="vt-arrow">▾</span>';
  }
  window.__ensureVenueToggle = ensure;
  window.__labelVenueToggle = label;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensure);
  else ensure();
  setTimeout(ensure, 300);
  setTimeout(ensure, 1200);
})();

/* Ф3.24: логотип шапки владеет admin-extra.js (applyBrandChrome);
   наблюдатель-подменщик удалён, официальный svg больше не перезаписывается. */

  /* ── Пуш-баббл «Включите пуши» ── */
  (function () {
    function findPush() {
      var el = document.getElementById('pushHint') || document.getElementById('pushBubble') ||
               document.querySelector('.pushHint, .push-bubble, .pushBubble');
      if (el) return el;
      var all = document.querySelectorAll('body *');
      for (var i = 0; i < all.length; i++) {
        var t = (all[i].textContent || '');
        if (t.indexOf('Включите пуши') > -1 && t.length < 40 && all[i].children.length <= 2) return all[i];
      }
      return null;
    }
    function place() {
      var b = findPush();
      var av = document.getElementById('profileTopBtn');
      if (!b || !av || b.style.display === 'none') return;
      var r = av.getBoundingClientRect();
      b.style.position = 'fixed';
      b.style.top = (r.bottom + 10) + 'px';
      b.style.right = Math.max(8, window.innerWidth - r.right) + 'px';
      b.style.left = 'auto';
      b.style.margin = '0';
      b.style.zIndex = '1200';
    }
    function refresh() {
      var p = document.getElementById('panel');
      var open = p && p.classList.contains('open');
      var b = findPush();
      if (b) {
        b.style.display = open ? 'none' : '';
        if (!open) place();
      }
      pulsePushBtn(open);
    }
    function pushBtnEl() {
      var byId = document.getElementById('pushBtn');
      if (byId) return byId;
      var all = document.querySelectorAll('#profileBox button, .panel button');
      for (var i = 0; i < all.length; i++) {
        if (/Включить уведомления/.test(all[i].textContent || '')) return all[i];
      }
      return null;
    }
    function pulsePushBtn(open) {
      var btn = pushBtnEl();
      if (!btn) return;
      var need = !!open && /Включить уведомления/.test(btn.textContent || '');
      if (need && !btn.classList.contains('pulse')) {
        btn.classList.remove('pulse');
        void btn.offsetWidth;
        btn.classList.add('pulse');
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
    document.addEventListener('click', function () { setTimeout(refresh, 0); });
    window.addEventListener('resize', place);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', refresh);
    } else {
      refresh();
    }
    setTimeout(refresh, 400);
    setTimeout(refresh, 1500);
  })();
})();