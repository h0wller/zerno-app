/* public/app/core/views.js — Ф3.22/Ф3.41/Ф3.55: флаги и state-мост чата, CSS-инъекция (СЛОЙ 2),
DOM-переезды, виды/режимы (sv/setMode/brandSeg), дропдаун заведений, пуш-баббл.
Ф3.55: финальная сборка шапки — база в одном блоке, delivery max-width:70% только ≤820px,
центрирование логотипа гридом ≥821px без конфликтов специфичности.
База компонентов — theme-v2.css (СЛОЙ 1). Правила: docs/css-architecture.md */
(function () {
'use strict';
/* ========== 0. Флаги и state-мост чата ========== */
var QS = new URLSearchParams(location.search);
var IN_TG = /Telegram/i.test(navigator.userAgent);
if (IN_TG) document.body.classList.add('in-tg');
/* Ф3.56: safe-area фолбэк: если iOS standalone отдаёт env()=0 (нет viewport-fit), ставим --sat */
(function () {
function setSat() {
var probe = document.createElement('div');
probe.style.cssText = 'position:fixed;top:0;left:0;height:var(--sat, env(safe-area-inset-top,0px));visibility:hidden';
document.body.appendChild(probe);
var inset = probe.getBoundingClientRect().height;
probe.remove();
var standalone = (navigator.standalone === true) || matchMedia('(display-mode: standalone)').matches;
var ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
document.documentElement.style.setProperty('--sat', (inset > 0 ? inset : (standalone && ios ? 47 : 0)) + 'px');
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setSat);
else setSat();
})();
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
setChosenSupportCtx: function (v) { chosenSupportCtx = v; try { sessionStorage.setItem('zt_support_ctx', v); } catch (e) {} }
};
if (supportPending) {
document.body.classList.add('support-pending');
var ov0 = document.getElementById('supportChooseOverlay');
if (ov0) { ov0.style.display = 'flex'; ov0.style.zIndex = '10002'; }
}
/* Ф3.56: safe-area фолбэк — если iOS standalone отдаёт inset 0 (баг env), ставим константу */
(function () {
  var probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;top:0;left:0;height:var(--sat, env(safe-area-inset-top,0px));visibility:hidden';
  document.body.appendChild(probe);
  var inset = probe.getBoundingClientRect().height;
  probe.remove();
  var standalone = (navigator.standalone === true) || matchMedia('(display-mode: standalone)').matches;
  var ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  var sat = inset > 0 ? inset : (standalone && ios ? 47 : 0);
  document.documentElement.style.setProperty('--sat', sat + 'px');
})();
/* ========== 1. CSS (СЛОЙ 2: layout + брендовые переопределения) ========== */
var css = document.createElement('style');
var rules = [
/* --- Layout: сетка wrap + safe-area --- */
'@media(min-width:1181px){body:not(.is-cashier) .wrap > .rail{grid-column:1}body:not(.is-cashier) .wrap > section{grid-column:2}body:not(.is-cashier) .wrap > .panel{grid-column:3}}',
'html,body{overflow-x:hidden;max-width:100%}',
'img,canvas,svg,video{max-width:100%}',
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
/* --- FAB корзины + addons --- */
'#cartFab{background:var(--flame);box-shadow:0 12px 30px -8px rgba(58,42,28,.45);bottom:calc(84px + env(safe-area-inset-bottom))}',
'.addonChip{border:1.5px solid var(--line);background:#fff;border-radius:999px;padding:6px 12px;font-size:12px;font-weight:600;margin:0 6px 6px 0}',
'.addonChip b{color:var(--flame)}',
/* --- ШАПКА: база (единственный блок, Ф3.55) --- */
'.topbar{position:relative;display:flex;align-items:center;flex-wrap:wrap;gap:8px;height:calc(var(--topbar-h,64px) + var(--sat, env(safe-area-inset-top,0px)));padding:var(--sat, env(safe-area-inset-top,0px)) 12px 0;box-sizing:border-box}',
'.topbar .venueWrap{position:relative;order:1;flex:0 0 auto;min-width:0;display:flex;justify-content:flex-start}',
'.topbar .brand{order:2;flex:1 1 0;min-width:0;display:flex;align-items:center;justify-content:center;gap:10px;position:static;transform:none}',
'.topbar .brand .mark{display:flex;align-items:center;justify-content:center;width:calc(var(--topbar-h,64px) - 20px);height:calc(var(--topbar-h,64px) - 20px);flex:0 0 auto;overflow:hidden;border-radius:12px;background:transparent}',
'.topbar .brand .mark img,.topbar .brand .mark svg{display:block;width:100%;height:100%;object-fit:contain}',
'.topbar #profileTopBtn{order:3;flex:0 0 auto;margin-left:auto;width:calc(var(--topbar-h,64px) - 20px);height:calc(var(--topbar-h,64px) - 20px);font-size:calc(var(--topbar-h,64px) * 0.28)}',
'.topbar #modeSeg{order:10;flex:1 1 100%}',
'.topbar #clock{display:none!important}',
'.venueToggle{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1.5px solid var(--line);background:var(--card,#fff);border-radius:999px;padding:0 12px;height:calc(var(--topbar-h,64px) - 20px);font:700 calc(var(--topbar-h,64px) * 0.22) "Golos Text",system-ui,sans-serif;color:var(--ink);cursor:pointer;transition:all .2s;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
'.venueToggle:hover{background:#F5F5F5;transform:translateY(-1px)}',
'.venueToggle .vt-arrow{font-size:9px;opacity:.7;transition:transform .2s}',
'.venueToggle[aria-expanded="true"] .vt-arrow{transform:rotate(180deg)}',
'.venueWrap #brandSeg{display:none;position:absolute;left:0;top:calc(100% + 8px);z-index:80;flex-direction:column;gap:2px;width:max-content;min-width:max(180px,100%);max-width:calc(100vw - 24px);border:1.5px solid var(--line);border-radius:14px;background:var(--card,#fff);box-shadow:var(--sh);padding:6px;overflow:visible;animation:fadeIn .2s ease}',
'.venueWrap #brandSeg.open{display:flex}',
'.venueWrap #brandSeg button{flex:0 0 auto;width:100%;border:0;border-radius:10px;padding:10px 12px;font:700 14px "Golos Text",sans-serif;background:transparent;color:var(--ink);text-align:left;box-shadow:none;display:flex;align-items:center;gap:8px;transition:all .15s;cursor:pointer}',
'.venueWrap #brandSeg button:hover{background:rgba(0,0,0,.06);transform:translateX(2px)}',
'.venueWrap #brandSeg button .re,.venueWrap #brandSeg button span{background:transparent!important;border:0!important;box-shadow:none!important;padding:0!important;border-radius:0!important;font-size:16px}',
'.venueWrap #brandSeg button.on{background:var(--flame);color:#fff}',
'.venueWrap #brandSeg button.on span{color:#fff!important}',
'@keyframes fadeIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}',
/* --- Шапка: адаптив --- */
'@media(max-width:820px){#brandSeg{overflow-x:auto;scrollbar-width:none}#modeSeg{overflow-x:auto;scrollbar-width:none}#brandSeg::-webkit-scrollbar,#modeSeg::-webkit-scrollbar{display:none}#brandSeg button,#modeSeg button{flex:0 0 auto}}',
'@media(max-width:400px){#brandSeg button,#modeSeg button{font-size:12px;padding:6px 12px}}',
'@media(max-width:690px){.venueToggle .vt-label{display:none}.venueToggle{padding:0 10px;gap:4px}}',
/* delivery ≤1023px: только лого, прячем текст и его обёртку (иначе пустой div в gap уводит лого влево) */
'@media(max-width:1023px){[data-brand="delivery"] .topbar .brand b,[data-brand="delivery"] .topbar .brand small,[data-brand="delivery"] .topbar .brand > div:not(.mark){display:none!important}}',
/* coffee ≤600px: убираем длинную подпись «кофейня на берегу моря» */
'@media(max-width:600px){[data-brand="coffee"] .topbar .brand small{display:none!important}}',
/* coffee ≤480px: компактно, но текст «…и кофе» остаётся */
'@media(max-width:480px){[data-brand="coffee"] .topbar .brand{gap:6px!important}[data-brand="coffee"] .topbar .brand b{font-size:16px!important}}',
/* ≥821px (1024, 1440): кнопки по краям компактные, не гигантские */
'@media(min-width:821px){.topbar #profileTopBtn{width:56px!important;height:56px!important;font-size:22px!important}.topbar .venueToggle{height:52px!important;font-size:15px!important;padding:0 18px!important;gap:8px!important}}',
/* --- Шапка: марки брендов (70% ТОЛЬКО внутри ≤820px — не бьёт грид) --- */
'[data-brand="delivery"] .topbar .brand .mark{width:auto;height:calc(var(--topbar-h,64px) - 8px);max-height:calc(var(--topbar-h,64px) - 8px);max-width:min(60vw,420px);border-radius:8px}',
'[data-brand="delivery"] .topbar .brand .mark img,[data-brand="delivery"] .topbar .brand .mark svg{width:100%;height:100%;max-width:100%;max-height:100%;object-fit:contain}','@media(max-width:360px){[data-brand="coffee"] .topbar .brand .mark{width:32px;height:32px}}',
/* --- Шапка: грид-центрирование ≥821px (после всех brand-правил) --- */
'@media(min-width:821px){.topbar{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;align-content:center;gap:8px}.topbar .venueWrap{grid-column:1;grid-row:1;justify-self:start;order:0;min-width:0}.topbar .brand{grid-column:2;grid-row:1;justify-self:center;order:0;flex:none;max-width:100%}.topbar #profileTopBtn{grid-column:3;grid-row:1;justify-self:end;order:0;margin-left:0}.topbar #modeSeg{grid-column:1/-1;grid-row:2}}','[data-brand="delivery"] .venueToggle{border:2px solid var(--fr-choc);background:var(--fr-paper);color:var(--fr-choc);box-shadow:2px 2px 0 var(--fr-choc)}',
'[data-brand="delivery"] .venueToggle:hover{background:#EFE6D8;box-shadow:3px 3px 0 var(--fr-choc);transform:translate(-1px,-1px)}',
'[data-brand="delivery"] .venueWrap #brandSeg{background:#F6EEE1;border:2px solid #3A2A1C;box-shadow:3px 3px 0 #3A2A1C;border-radius:12px}',
'[data-brand="delivery"] .venueWrap #brandSeg button:hover{background:#EFE6D8;transform:translateX(3px)}',
'[data-brand="delivery"] .venueWrap #brandSeg button.on{background:#C03B2A;border:2px solid #3A2A1C;box-shadow:2px 2px 0 #3A2A1C;color:#fff}',
'[data-brand="delivery"] .authPrompt{background:linear-gradient(135deg,#F6EEE1,#EFE6D8);border:2px dashed var(--fr-choc);color:var(--fr-choc)}',
'[data-brand="delivery"] .authPrompt button{background:var(--flame);border:2px solid var(--fr-choc);box-shadow:2px 2px 0 var(--fr-choc);color:#fff}',
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
'#brandSplashStatic .spInner{width:100%;max-width:560px;text-align:center}',
'#brandSplashStatic .spTitle{font:400 clamp(20px,5.5vw,30px)/1.25 Prata,serif;margin-bottom:6px;overflow-wrap:break-word}',
'#brandSplashStatic .spSub{color:var(--soft);font-size:14px;margin-bottom:22px}',
'#brandSplashStatic .spBtns{display:grid;grid-template-columns:1fr;gap:12px}',
'#brandSplashStatic .spBtn{border-radius:22px;padding:22px 16px;font:700 16px Unbounded,sans-serif;box-shadow:var(--sh);width:100%}',
'#brandSplashStatic .spBtn small{display:block;font:400 12px Golos Text,sans-serif;margin-top:6px}',
'#brandSplashStatic .spPizza{border:2px solid #F2D9A5;background:#FFF6E5;color:#6B4E0E}',
'#brandSplashStatic .spPizza small{color:#8A6D3B}',
'#brandSplashStatic .spCoffee{border:2px solid var(--line);background:#fff;color:var(--ink)}',
'#brandSplashStatic .spCoffee small{color:var(--soft)}',
'@media(min-width:560px){#brandSplash .spBtns,#brandSplashStatic .spBtns{grid-template-columns:1fr 1fr}}',
'#brandSplash,#brandSplashStatic{background:#FFFFFF}',
'#brandSplash .spBtn .em,#brandSplashStatic .spBtn .em{display:block;font-size:30px;line-height:1;margin-bottom:10px}',
'#brandSplash .spBtn .bt,#brandSplashStatic .spBtn .bt{display:block;font:700 16px Unbounded,sans-serif}',
/* --- Чат --- */
'#chatPanel [class="chip"],#chatPanel #chips,#chatPanel .chips{display:none}',
'#supportChooseOverlay .ctxPick,#chatPanel .ctxPick{display:flex;gap:8px;margin:8px 0}',
'#supportChooseOverlay .ctxPick button,#chatPanel .ctxPick button{flex:1;padding:10px;border-radius:14px;font-size:14px;font-weight:700;border:1.5px solid var(--line);background:#fff;cursor:pointer}',
'#supportChooseOverlay .ctxPick .cpD,#chatPanel .ctxPick .cpD{border-color:#F2D9A5;background:#FFF6E5;color:#6B4E0E}',
'#supportChooseOverlay .ctxPick .cpC,#chatPanel .ctxPick .cpC{color:var(--ink)}',
'.chat-fab{z-index:10001}',
/* --- Заказы в профиле --- */
'#myOrders{display:flex;flex-direction:column;gap:8px;margin:6px 0 4px}',
'#myOrders .hmini{margin:0;background:#fff;border:1.5px solid var(--line);border-radius:14px;padding:10px 12px;font-size:14px;font-weight:600}',
'.myOrderCard{background:#fff;border:1.5px solid var(--line);border-radius:16px;padding:12px 14px;box-shadow:var(--sh)}',
'.myOrderCard .moTop{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:15px;font-weight:800}',
'.moSt{font:800 11px/1 Unbounded,sans-serif;padding:4px 10px;border-radius:999px;background:#EDF2F6;color:#33507A;white-space:nowrap}',
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
/* --- Карточки: метки, CTA, стоп-лист --- */
'.card .tag{position:absolute;top:8px;left:8px;z-index:2;pointer-events:none;max-width:calc(100% - 16px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
'#deliveryGrid .cta{background:#fff;border:1.5px solid var(--line);color:var(--ink);border-radius:12px;padding:12px;min-height:44px;font:700 14px "Golos Text",system-ui,sans-serif;cursor:pointer;box-shadow:none;transition:background .15s,border-color .15s,color .15s}',
'#deliveryGrid .cta:active{transform:translateY(1px)}',
'#deliveryGrid .cta:disabled{background:#EDF2F6;border-color:var(--line);color:#8B98A5;cursor:not-allowed;transform:none}',
'#deliveryGrid .cta.incart{border-color:var(--flame);color:var(--flame)}',
'#deliveryGrid .cta.added{background:var(--flame);border-color:var(--flame);color:#fff}',
'.card .media{position:relative}',
'.card .stopbadge{position:absolute;top:10px;right:10px;left:auto;z-index:2;background:#D63939;color:#fff;font:800 10px "Golos Text",sans-serif;letter-spacing:.06em;border-radius:8px;padding:3px 8px}',
'body.editing .card .stopbadge{right:52px}',
'.card.stopped{opacity:.75}',
'#iosHint,#installBanner{top:auto;bottom:calc(96px + env(safe-area-inset-bottom))}',
/* --- Рейл --- */
'.rail,#deliveryRail{padding:8px 6px 16px;margin:-8px -6px -16px;overflow-x:auto;overflow-y:hidden}',
'@media(min-width:1181px){.rail{overflow:visible;padding:0;margin:0}}',
'#deliveryRail button{transition:transform .15s,box-shadow .15s,background .15s}',
'#deliveryRail button:hover{transform:translateY(-1px)}',
'#deliveryRail button.on:hover{transform:none}',
'[data-brand="delivery"] #deliveryRail{background:transparent}',
'[data-brand="delivery"] #deliveryRail button{background:var(--panel);border:1.5px solid var(--line);color:var(--ink)}',
'[data-brand="delivery"] #rail button,[data-brand="delivery"] #deliveryRail button{background:var(--fr-paper);border:2px solid var(--fr-tan);color:var(--fr-choc)}',
'[data-brand="delivery"] .panel,[data-brand="delivery"] .placebox{background:var(--fr-rice);border-color:var(--fr-choc);color:var(--fr-choc)}',
'[data-brand="delivery"] .panel .btn.fire,[data-brand="delivery"] #profileBox .btn.fire,[data-brand="delivery"] .authBtn{background:var(--flame);border:2px solid var(--fr-choc);box-shadow:3px 3px 0 var(--fr-choc);color:#fff}',
/* ══ БРЕНД: Пятница — терракотовый стикер-арт по гайдлайну ══ */
'html[data-brand="delivery"],body[data-brand="delivery"]{--flame:#C03B2A;--flame-d:#8E3716;--esp:#3A2A1C;--esp2:#241812;--fr-choc:#3A2A1C;--fr-tan:#C99E6E;--fr-rice:#EFE6D8;--fr-paper:#F6EEE1;--paper:#F3EDE6;--tint-cool:#F3E2CE;--tint-warm:#F3E2CE}',
'html[data-brand="delivery"] body{background-color:#F3EDE6;background-image:radial-gradient(rgba(58,42,28,.1) 1px,transparent 1.5px);background-size:12px 12px}',
'[data-brand="delivery"] h1,[data-brand="delivery"] h2,[data-brand="delivery"] h3,[data-brand="delivery"] .cbody h3{font-family:Unbounded,sans-serif;color:var(--fr-choc)}',
'[data-brand="delivery"] .card{border:2px solid var(--fr-choc);box-shadow:2px 2px 0 var(--fr-choc);background:var(--fr-paper)}',
'[data-brand="delivery"] .cta,[data-brand="delivery"] #checkoutBtn,[data-brand="delivery"] .btn.fire{border:2px solid var(--fr-choc);box-shadow:3px 3px 0 var(--fr-choc);background:var(--flame);color:#fff}',
'[data-brand="delivery"] .price{color:var(--flame)}',
'[data-brand="delivery"] .tag{background:var(--flame)}',
'[data-brand="delivery"] .tag.hit{background:var(--flame-d)}',
'[data-brand="delivery"] .comp i{background:var(--fr-rice);border-color:var(--fr-tan);color:var(--fr-choc)}',
'[data-brand="delivery"] #deliveryGrid .opts button{border:2px solid var(--fr-tan);background:#fff}',
'[data-brand="delivery"] #deliveryGrid .opts button.sel{background:var(--fr-tan);border-color:var(--fr-choc);box-shadow:2px 2px 0 var(--fr-choc);color:var(--fr-choc)}',
'[data-brand="delivery"] #deliveryGrid .opts button.sel .op{color:var(--fr-choc)}',
'[data-brand="delivery"] #deliveryRail button.on{background:var(--flame);border:2px solid var(--fr-choc);box-shadow:2px 2px 0 var(--fr-choc);color:#fff;font:700 13px Unbounded,sans-serif}',
'[data-brand="delivery"] #brandSeg,[data-brand="delivery"] #modeSeg{background:var(--esp)}',
'[data-brand="delivery"] #brandSeg button.on,[data-brand="delivery"] #modeSeg button.on{background:var(--flame);color:#fff}',
'[data-brand="delivery"] #cartFab,[data-brand="delivery"] .chat-fab{background:var(--flame);border:2px solid var(--fr-choc);box-shadow:3px 3px 0 var(--fr-choc)}',
'[data-brand="delivery"] .addonChip b{color:var(--flame)}',
'[data-brand="delivery"] #cartPanel,[data-brand="delivery"] .cartPanel{background:var(--fr-rice);border:3px solid var(--fr-choc);border-bottom:none}',
'[data-brand="delivery"] .cartPanel .qty button{background:#C99E6E!important;border:1.5px solid #3A2A1C!important;color:#3A2A1C!important}',
'[data-brand="delivery"] .cartPanel .cartItem{border-bottom:1.5px dashed rgba(58,42,28,.3);color:#3A2A1C;font-weight:600}',
'#deliveryGrid .cbody .desc{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:2.75em}',
'#deliveryGrid .cbody .opts{margin-top:auto}',
'[data-brand="delivery"] .chatHead .op{background:#F6EEE1!important;border:0!important;display:flex;align-items:center;justify-content:center;font-size:20px}',
'[data-brand="delivery"] .chat-fab::before{border-color:#C03B2A!important}',
'[data-brand="delivery"] #chatPanel .chatHead{background:var(--fr-choc);color:#fff}',
'[data-brand="delivery"] .chatHead .av{background:var(--fr-paper);background-image:none;color:var(--fr-choc)}',
'[data-brand="delivery"] #chatMsgs{background:var(--fr-paper)}',
'[data-brand="delivery"] #chatMsgs .msg.me,[data-brand="delivery"] #chatMsgs .me{background:var(--flame);border:2px solid var(--fr-choc);box-shadow:2px 2px 0 var(--fr-choc);color:#fff}',
'[data-brand="delivery"] #chatMsgs .chatHint{background:var(--fr-rice);border-color:var(--fr-tan);color:var(--fr-choc)}',
'[data-brand="delivery"] #chatSend{background:var(--flame);border:2px solid var(--fr-choc);color:#fff}',
'[data-brand="delivery"] .mo-new,[data-brand="delivery"] .mo-accept,[data-brand="delivery"] .mo-way{background:var(--fr-rice);color:var(--flame)}',
/* --- Тикер: брендовые цвета (база — theme-v2) --- */
'[data-brand="delivery"] #tickerTrack,[data-brand="delivery"] #ticker{background:var(--fr-choc);color:#E8A33D;border-bottom:2px solid var(--fr-choc)}',
'[data-brand="coffee"] #tickerTrack,[data-brand="coffee"] #ticker{background:#123A6B;color:#BBD7F2;border-bottom:1px solid rgba(62,143,208,.25)}',
'[data-brand="delivery"] #tickerTrack span::after{color:#C03B2A}',
/* --- Панели --- */
'[data-brand="coffee"] #panel,[data-brand="coffee"] .panel{background:var(--panel)}',
'[data-brand="delivery"] #panel,[data-brand="delivery"] .panel{background:var(--fr-paper);border:2px solid var(--fr-choc);box-shadow:2px 2px 0 var(--fr-choc)}',
/* ── Ф3.57: профиль без двойного скролла ── */
'#panel .pv{overscroll-behavior:contain}',
'@media(max-width:1180px){body.panel-open{overflow:hidden}}',
/* ── Ф3.58: кнопка «вверх» — брендовые стили ── */
'[data-brand="coffee"] #scrollTopBtn{background:#fff;border:1.5px solid var(--line);color:var(--flame);box-shadow:0 10px 26px -10px rgba(18,58,107,.45)}',
'[data-brand="delivery"] #scrollTopBtn{background:var(--fr-paper);border:2px solid var(--fr-choc);color:var(--fr-choc);box-shadow:2px 2px 0 var(--fr-choc)}',
/* ── Ф5.7 чанк 2: брендовые модалки (было inline <style> index.html) ── */
'[data-brand="delivery"] .modal-card{background-color:#EFE6D8!important;background-image:radial-gradient(rgba(58,42,28,.08) 1px,transparent 1.5px)!important;background-size:10px 10px!important;border:3px solid #3A2A1C!important;border-radius:18px!important;box-shadow:6px 6px 0 #3A2A1C,0 20px 50px rgba(0,0,0,.35)!important}',
'[data-brand="delivery"] .mclose{background:#C99E6E!important;border:2px solid #3A2A1C!important;box-shadow:2px 2px 0 #3A2A1C!important;color:#3A2A1C!important}',
'[data-brand="delivery"] .modal-card h3{font:900 20px Unbounded,sans-serif!important;color:#3A2A1C!important}',
'[data-brand="delivery"] .modal-card input:not([type="checkbox"]),[data-brand="delivery"] .modal-card select,[data-brand="delivery"] .modal-card textarea{background:#fff!important;border:2px solid #3A2A1C!important;color:#3A2A1C!important;font-weight:600!important}',
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
var isDel = (bName === 'delivery');
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
/* Ф3.25: mark.innerHTML владеет admin-extra.js (applyBrandChrome) — здесь не трогаем */
if (window.__ensureVenueToggle) window.__ensureVenueToggle();
if (window.__labelVenueToggle) window.__labelVenueToggle();
var mark = document.getElementById('brandMark') || document.querySelector('.brand .mark');
if (mark) mark.classList.toggle('is-delivery', isDel);
/* Страховка: снимаем инлайновые размеры/aspect-ratio с логотипа и марки */
stripLogoInlineStyles();
var op = document.querySelector('.chat-h .op, .chatHead .op');
if (op) {
if (!op.hasAttribute('data-orig')) op.setAttribute('data-orig', op.innerHTML);
op.innerHTML = isDel ? '🍕' : (op.getAttribute('data-orig') || '');
}
var bTitle = document.getElementById('brandTitle');
var bSub = document.getElementById('brandSub');
if (bTitle) bTitle.textContent = isDel ? 'Пятница' : '…и кофе';
if (bSub) bSub.textContent = isDel ? 'доставка пиццы и роллов' : 'кофейня на берегу моря';
/* Дропдаун заведений: создаётся один раз (гарант — IIFE ниже) */
var seg2 = document.getElementById('brandSeg');
if (seg2 && !document.getElementById('venueToggle')) {
var vw = document.createElement('div'); vw.className = 'venueWrap';
seg2.parentNode.insertBefore(vw, seg2);
var vt = document.createElement('button');
vt.id = 'venueToggle'; vt.type = 'button'; vt.className = 'venueToggle';
vt.setAttribute('aria-haspopup', 'listbox'); vt.setAttribute('aria-expanded', 'false');
vw.appendChild(vt); vw.appendChild(seg2);
vt.addEventListener('click', function (e) {
e.stopPropagation();
var open = seg2.classList.toggle('open');
seg2.style.display = open ? 'flex' : 'none';
vt.setAttribute('aria-expanded', open ? 'true' : 'false');
});
document.addEventListener('click', function (e) {
if (!vw.contains(e.target)) { seg2.classList.remove('open'); seg2.style.display = 'none'; vt.setAttribute('aria-expanded', 'false'); }
});
}
var vt2 = document.getElementById('venueToggle');
if (vt2) vt2.innerHTML = '<span class="vt-label">Сменить заведение</span> ' + (isDel ? '🍕' : '🌊') + ' <span class="vt-arrow">▾</span>';
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
/* Ф3.48: первичная загрузка доставки — бут зовёт sv() без setMode() */
if (showDeliv && typeof window.DMENU !== 'undefined' && !window.DMENU.length &&
typeof window.loadDelivery === 'function' && !window.__dlReq) {
window.__dlReq = 1;
window.loadDelivery();
}
/* Ф3.25: синхронизируем брендовый хром (тикер + логотип) прямым вызовом владельца */
if (typeof window.applyBrandChrome === 'function') window.applyBrandChrome();
}
window.syncBrandViews = sv;
/* ── Ф3.57: снятие инлайн-стилей, которые admin-extra ставит на логотип.
   !important перебивает aspect-ratio:1/1 и width:100%, которые admin-extra 
   навешивает на <img> при каждой смене бренда. MutationObserver ловит 
   повторные инъекции после sv(). */
function stripLogoInlineStyles() {
  var wrap = document.querySelector('.topbar .brand .mark');
  var img  = document.querySelector('.topbar .brand .mark img, .topbar .brand .mark svg');
  if (img) {
    img.style.setProperty('width', '100%', 'important');
    img.style.setProperty('height', '100%', 'important');
    img.style.setProperty('max-width', '100%', 'important');
    img.style.setProperty('max-height', '100%', 'important');
    img.style.setProperty('aspect-ratio', 'auto', 'important');
    img.style.setProperty('object-fit', 'contain', 'important');
    img.style.removeProperty('position');
    img.style.removeProperty('inset');
    img.removeAttribute('width');
    img.removeAttribute('height');
  }
  if (wrap) {
    wrap.style.setProperty('aspect-ratio', 'auto', 'important');
    wrap.style.setProperty('max-height', 'calc(var(--topbar-h,64px) - 8px)', 'important');
    wrap.style.removeProperty('width');
    wrap.style.removeProperty('height');
  }
}
window.stripLogoInlineStyles = stripLogoInlineStyles;

(function () {
  function observe() {
    var target = document.querySelector('.topbar .brand');
    if (!target || !window.MutationObserver) { stripLogoInlineStyles(); return; }
    new MutationObserver(function () {
      stripLogoInlineStyles();
    }).observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style']
    });
    stripLogoInlineStyles();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observe);
  else observe();
  setTimeout(stripLogoInlineStyles, 500);
  setTimeout(stripLogoInlineStyles, 1500);
})();
window.setMode = function (m) {
var role = (typeof me !== 'undefined' && me) ? me.role : 'guest';
if (m === 'cashier' && role !== 'cashier' && role !== 'admin') return;
if (m === 'orders' && role !== 'dispatch' && role !== 'cashier' && role !== 'admin') return;
if (m === 'admin' && role !== 'admin') return;
window.mode = m;
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
/* Первичная инициализация видов */
sv();
/* ========== Ф3.26: гарантия #venueToggle (создание вне sv(), с ретраями) ========== */
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
vt.innerHTML = '<span class="vt-label">Сменить заведение</span> ' + (isDel ? '🍕' : '🌊') + ' <span class="vt-arrow">▾</span>';
}
window.__ensureVenueToggle = ensure;
window.__labelVenueToggle = label;
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensure);
else ensure();
setTimeout(ensure, 300);
setTimeout(ensure, 1200);
})();
/* ========== Пуш-баббл «Включите пуши» ========== */
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
attributeFilter: ['class', 'hidden', 'style']
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
/* ── Ф3.49: кнопка authPrompt через делегирование (переживает перерендеры) ── */
document.addEventListener('click', function (e) {
var b = e.target.closest('#authPrompt button, #authPrompt [data-auth]');
if (!b) return;
e.preventDefault();
if (typeof openAuth === 'function') { openAuth(); return; }
var m = document.getElementById('authModal');
if (m) { m.classList.add('open'); m.style.display = 'flex'; }
});