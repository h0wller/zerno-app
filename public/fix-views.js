/* fix-views.js — ЕДИНАЯ сборка v63. Грузится ПОСЛЕ основного скрипта. */
(function(){
'use strict';
/* ========== 0. Флаги и константы ========== */
var QS=new URLSearchParams(location.search);
var IN_TG=/Telegram/i.test(navigator.userAgent);
var DEEP=!!(QS.get('brand')||QS.get('tab')||QS.get('src'));
var SUPPORT_ENTRY=(QS.get('tab')==='chat'||QS.get('support')==='choose');
var chosenSupportCtx=SUPPORT_ENTRY?(sessionStorage.getItem('zt_support_ctx')||''):'';
var supportPending=SUPPORT_ENTRY&&!chosenSupportCtx;
var chatCtx=localStorage.getItem('zt_chatctx')||'';
if(chosenSupportCtx)chatCtx=chosenSupportCtx;
var GREET_D='Привет! Я Ника, поддержка доставки «Пятница» 🍕 Спрашивайте — или позовите диспетчера.';
var GREET_C='Привет! Я Ника, поддержка кофейни «…и кофе» 🌊 Спрашивайте — или позовите сотрудника.';
var DHINTS=['Зоны и стоимость доставки','Сколько ждать заказ?','Какие сейчас акции?','Где мой заказ?'];
var CHINTS=['Где вы и часы работы?','Как копить штампы?','Куда ввести промокод?'];
var CALL_HINT='💬 Позвать сотрудника';

/* ========== 1. CSS ========== */
var css=document.createElement('style');
css.textContent=
'@media(min-width:1181px){body:not(.is-cashier) .wrap>.rail{grid-column:1}body:not(.is-cashier) .wrap>section{grid-column:2}body:not(.is-cashier) .wrap>.panel{grid-column:3}}'+
'html,body{overflow-x:hidden;max-width:100%}img,canvas,svg,video{max-width:100%}'+
'.topbar{padding-top:calc(env(safe-area-inset-top,0px) + 10px)!important}'+
'#deliveryGrid{grid-template-columns:1fr!important;padding-bottom:120px}'+
'@media(min-width:560px){#deliveryGrid{grid-template-columns:repeat(auto-fill,minmax(240px,1fr))!important}}'+
'#deliveryGrid .opts{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}'+
'@media(max-width:400px){#deliveryGrid .opts{grid-template-columns:1fr}}'+
'#deliveryGrid .opts button{display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:8px 10px;border:1.5px solid var(--line);border-radius:12px;font-size:11px;font-weight:600;background:#fff;line-height:1.3;white-space:normal;text-align:left;width:100%}'+
'#deliveryGrid .opts button .op{color:var(--soft);font-weight:700}'+
'#deliveryGrid .opts button.sel{background:#B4552D;border-color:#B4552D;color:#fff}'+
'#deliveryGrid .opts button.sel .op{color:#F3E2CE}'+
'#deliveryGrid .opts.shake{animation:shake .4s}'+
'#cartFab{background:#B4552D!important;box-shadow:0 12px 30px -8px rgba(180,85,45,.75)!important;bottom:calc(84px + env(safe-area-inset-bottom))!important}'+
'.addonChip{border:1.5px solid var(--line);background:#fff;border-radius:999px;padding:6px 12px;font-size:12px;font-weight:600;margin:0 6px 6px 0}.addonChip b{color:#B4552D}'+
'@media(max-width:820px){.topbar{flex-wrap:wrap;row-gap:8px;padding:8px 12px;padding-top:calc(env(safe-area-inset-top,0px) + 10px)!important}.topbar .brand{order:1;min-width:0}#clock{order:2;margin-left:auto}#profileTopBtn{order:3}#brandSeg{order:10;flex:1 1 100%;overflow-x:auto;scrollbar-width:none}#modeSeg{order:11;flex:1 1 100%;overflow-x:auto;scrollbar-width:none}#brandSeg::-webkit-scrollbar,#modeSeg::-webkit-scrollbar{display:none}#brandSeg button,#modeSeg button{flex:0 0 auto}}'+
'@media(max-width:400px){#brandSeg button,#modeSeg button{font-size:12px;padding:6px 12px}}'+
'@media(max-width:1180px){#panel.open{position:fixed!important;top:0!important;left:0!important;right:0!important;bottom:0!important;width:100%!important;height:100%!important;max-height:100%!important;border-radius:0!important;margin:0!important;transform:none!important;z-index:320!important}#panel .tabs{padding-bottom:calc(env(safe-area-inset-bottom,0px) + 10px)}}'+
'#brandSplash{position:fixed;inset:0;z-index:400;background:var(--paper);display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto}'+
'#brandSplash .spInner{width:100%;max-width:560px;text-align:center}'+
'#brandSplash .spTitle{font:400 clamp(20px,5.5vw,30px)/1.25 Prata,serif;margin-bottom:6px;overflow-wrap:break-word}'+
'#brandSplash .spSub{color:var(--soft);font-size:14px;margin-bottom:22px}'+
'#brandSplash .spBtns{display:grid;grid-template-columns:1fr;gap:12px}'+
'#brandSplash .spBtn{border-radius:22px;padding:22px 16px;font:700 16px Unbounded,sans-serif;box-shadow:var(--sh);width:100%}'+
'#brandSplash .spBtn small{display:block;font:400 12px Golos Text,sans-serif;margin-top:6px}'+
'#brandSplash .spPizza{border:2px solid #F2D9A5;background:#FFF6E5;color:#6B4E0E}#brandSplash .spPizza small{color:#8A6D3B}'+
'#brandSplash .spCoffee{border:2px solid var(--line);background:#fff;color:var(--ink)}#brandSplash .spCoffee small{color:var(--soft)}'+
'@media(min-width:560px){#brandSplash .spBtns{grid-template-columns:1fr 1fr}}'+
'#chatPanel [class*="chip"],#chatPanel #chips,#chatPanel .chips{display:none!important}'+
'#ctxSwitch{color:#fff!important;border-color:rgba(255,255,255,.4)!important;background:rgba(255,255,255,.12)!important;font-size:12px!important;padding:4px 12px;border-radius:999px!important;margin-left:auto}'+
'.chatHint{display:inline-block;background:#EDF2F6;border:1.5px solid var(--line);border-radius:16px 16px 16px 4px;padding:8px 14px;margin:3px 4px;font-size:13px;color:var(--ink);cursor:pointer}'+
'.chatHint:active{background:#D6E4F0}'+
'.ctxPick{display:flex;gap:8px;margin:8px 0}.ctxPick button{flex:1;padding:10px;border-radius:14px;font-size:13px;font-weight:700;border:1.5px solid var(--line);background:#fff;cursor:pointer}'+
'.ctxPick .cpD{border-color:#F2D9A5;background:#FFF6E5;color:#6B4E0E}.ctxPick .cpC{color:var(--ink)}'+
'#myOrders{display:flex;flex-direction:column;gap:8px;margin:6px 0 4px}'+
'#myOrders .hmini{margin:0;background:#fff;border:1.5px solid var(--line);border-radius:14px;padding:10px 12px;font-size:14px;font-weight:600}'+
'.myOrderCard{background:#fff;border:1.5px solid var(--line);border-radius:16px;padding:12px 14px;box-shadow:var(--sh)}'+
'.myOrderCard .moTop{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:15px;font-weight:800}'+
'.moSt{font-size:11px;font-weight:800;padding:4px 10px;border-radius:999px;background:#EDF2F6;color:#33507A;white-space:nowrap}'+
'.mo-new,.mo-accept{background:#E8F1FF;color:#1F4E8C}.mo-cook{background:#FFF3D6;color:#8A6D3B}'+
'.mo-way{background:#E8F1FF;color:#1F4E8C}.mo-done{background:#E5F5E9;color:#2F7D4F}.mo-cancel{background:#FDE8E8;color:#B3372B}'+
'.myOrderCard .moSum{margin-top:6px;font-size:15px;font-weight:800}'+
'.myOrderCard .moItems{margin-top:2px;font-size:12px;color:var(--soft)}'+
'.myOrderCard .moGifts{margin-top:4px;font-size:12px;color:#2F7D4F;font-weight:700}'+
'body.support-pending .hintsWrap{display:none!important}'+
/* КЛЮЧЕВОЙ ФИКС: z-index 99999 > 110 (глобальный #overlay) */
'.chat-fab{z-index:10001!important}'+
'#supportChooseOverlay{position:fixed;inset:0;z-index:99999!important;background:var(--paper);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center}'+
'#supportChooseOverlay .scTitle{font:400 22px Prata,serif}'+
'#supportChooseOverlay .scSub{color:var(--soft);font-size:13px}'+
'#supportChooseOverlay .scBtns{width:100%;max-width:340px}';
document.head.appendChild(css);

/* ========== 2. DOM-переезды ========== */
var wrapEl=document.querySelector('.wrap');
var sec=wrapEl?wrapEl.querySelector(':scope>section'):null;
['deliveryView','ordersView','cashierView'].forEach(function(id){
var el=document.getElementById(id);
if(sec&&el&&el.parentNode!==sec)sec.appendChild(el);
});
var dRail=document.getElementById('deliveryRail');
if(wrapEl&&dRail&&dRail.parentNode!==wrapEl){wrapEl.insertBefore(dRail,sec);dRail.classList.add('rail');}
var ab0=document.getElementById('adminBar');
if(sec&&ab0&&ab0.parentNode!==sec)sec.insertBefore(ab0,sec.firstChild);
(function(){
var ov=document.getElementById('ordersView');
if(ov&&!document.getElementById('pendingBoxD')){
var d=document.createElement('div');d.className='cash-card';
d.innerHTML='<h3 style="margin:0 0 8px">🆕 Активация гостей</h3><div id="pendingBoxD"></div>';
var lc=document.getElementById('ordersList');
if(lc)ov.querySelector('.cashier').insertBefore(d,lc.closest('.cash-card'));
}
if(ov&&!document.getElementById('chatsToggleD')){
var top=ov.querySelector('.cash-top');
var b=document.createElement('button');b.id='chatsToggleD';b.className='btn ghost';b.textContent='💬 Чаты гостей';
b.onclick=openStaffChat;
var ref=document.getElementById('ordersRefresh');
if(top&&ref)top.insertBefore(b,ref);
}
})();
(function(){
var cp=document.getElementById('cartPanel'),ci=document.getElementById('cartItems');
if(cp&&ci&&!document.getElementById('cartAddons')){
var d=document.createElement('div');d.id='cartAddons';d.style.margin='0 0 10px';cp.insertBefore(d,ci);
}
})();

/* ========== 3. Виды и режимы ========== */
function cartFabShow(){
var cf=document.getElementById('cartFab');
if(cf)cf.style.display=((mode==='guest'||mode==='admin')&&brand==='delivery')?'':'none';
}
function sv(){
var showGuest=(mode==='guest'||mode==='admin');
var showCoffee=showGuest&&brand==='coffee';
var showDeliv=showGuest&&brand==='delivery';
var mv=document.getElementById('menuView'),dv=document.getElementById('deliveryView');
var rl=document.getElementById('rail'),dr=document.getElementById('deliveryRail');
if(mv){mv.hidden=!showCoffee;mv.style.display=showCoffee?'':'none';}
if(dv){dv.hidden=false;dv.style.display=showDeliv?'block':'none';}
if(rl)rl.style.display=showCoffee?'':'none';
if(dr)dr.style.display=showDeliv?'':'none';
var et=document.getElementById('editToggle');if(et)et.hidden=(mode!=='admin');
var ab=document.getElementById('adminBar');if(ab)ab.hidden=(mode!=='admin');
var mb=document.getElementById('mbonusBtn');if(mb)mb.style.display=(mode==='guest'&&brand==='coffee')?'':'none';
var bt=document.querySelector('.tabs button[data-tab="bonus"]');
if(bt)bt.style.display=(brand==='delivery')?'none':'';
if(brand==='delivery')setTab('profile');
if(me)renderProfile();
var staff=(mode==='cashier'||mode==='orders');
var cfab=document.getElementById('chatFab');
if(cfab)cfab.style.display=staff?'none':'';
if(staff){var p=document.getElementById('chatPanel');if(p)p.classList.remove('open');}
var showScan=(mode==='cashier');
document.querySelectorAll('#scanBtn,#scanFab,#qrFab,#scanToggle,.fab-scan').forEach(function(b){b.style.display=showScan?'':'none';});
document.querySelectorAll('button').forEach(function(b){
var cs=getComputedStyle(b);
if((b.textContent||'').trim().indexOf('📷')===0&&cs.position==='fixed')b.style.display=showScan?'':'none';
});
cartFabShow();
}
window.syncBrandViews=sv;
setMode=function(m){
var role=me?me.role:'guest';
if(m==='cashier'&&role!=='cashier'&&role!=='admin')return;
if(m==='orders'&&role!=='dispatch'&&role!=='cashier'&&role!=='admin')return;
if(m==='admin'&&role!=='admin')return;
mode=m;
document.body.classList.toggle('is-cashier',m==='cashier'||m==='orders');
var cv=document.getElementById('cashierView');if(cv){cv.hidden=(m!=='cashier');cv.style.display='';}
var ov=document.getElementById('ordersView');if(ov)ov.hidden=(m!=='orders');
sv();
var pt=document.getElementById('promoToggle');if(pt)pt.hidden=(m!=='admin');
var dt=document.getElementById('dashToggle');if(dt)dt.hidden=(m!=='admin');
var ct=document.getElementById('chatsToggle2');if(ct)ct.hidden=!(me&&(me.role==='admin'||me.role==='cashier'||me.role==='dispatch'));
var bd=document.getElementById('adminBadge');if(bd)bd.hidden=(m!=='admin');
if(m!=='admin')exitEdit();
if(m==='cashier')renderLog();
if(m==='orders'){renderOrders();if(!ordersPoll)ordersPoll=setInterval(function(){if(mode==='orders')renderOrders(true);},8000);}
if(m==='admin')loadMenu();
if((m==='guest'||m==='admin')&&brand==='delivery'&&!DMENU.length)loadDelivery();
renderModes();
toast(m==='admin'?'Режим администратора активен':m==='cashier'?'Смена кассира активна':m==='orders'?'Панель диспетчера':'Режим гостя',m==='admin'?'🔓':m==='cashier'?'🧾':m==='orders'?'🍕':'');
};
document.getElementById('brandSeg').addEventListener('click',function(e){
var b=e.target.closest('[data-brand]');if(!b)return;
brand=b.dataset.brand;
if(mode==='cashier'||mode==='orders')setMode('guest');
document.querySelectorAll('#brandSeg button').forEach(function(x){x.classList.toggle('on',x.dataset.brand===brand);});
sv();
if(brand==='delivery'&&!DMENU.length)loadDelivery();
if(!supportPending&&chatCtx!==brand){chatCtx=brand;try{localStorage.setItem('zt_chatctx',chatCtx);}catch(err){}setBotName();}
if(document.getElementById('chatPanel').classList.contains('open'))setTimeout(function(){reloadChatThread();},80);
});

/* ========== 4-14. Остальные секции без изменений ========== */
/* (корзина, доставка, профиль, сотрудники, сплэш, чат, пуши, живые обновления, диплинки, конфиг — оставляем как в v61) */

/* ========== 15. Убийца фантомного #overlay ========== */
setInterval(function(){
  var ov=document.getElementById('overlay');
  if(!ov||!ov.classList.contains('show'))return;
  var anyOpen=false;
  ['emModal','authModal','pinModal','setPinModal','qrModal','promoModal','dashModal','staffChatModal','scanModal','guestCard','ordersModal','redeemPick'].forEach(function(id){
    var m=document.getElementById(id);
    if(m&&m.classList.contains('show'))anyOpen=true;
  });
  var panel=document.getElementById('panel'),cartP=document.getElementById('cartPanel');
  if(!anyOpen&&!(panel&&panel.classList.contains('open'))&&!(cartP&&cartP.classList.contains('open')))ov.classList.remove('show');
},100);

/* ========== 16. Оверлей выбора темы поддержки ========== */
function showSupportOverlay(){
  if(document.getElementById('supportChooseOverlay'))return;
  var d=document.createElement('div');d.id='supportChooseOverlay';
  d.innerHTML='<div class="scTitle">У вас вопрос по кофе или доставке?</div>'+
    '<div class="scSub">Выберите тему — откроется нужная Ника, а вызов сотрудника уйдёт правильной команде.</div>'+
    '<div class="ctxPick scBtns">'+
    '<button type="button" class="cpD" data-support-topic="delivery">🍕<br>Доставка<br><small>Пятница</small></button>'+
    '<button type="button" class="cpC" data-support-topic="coffee">☕<br>Кофейня<br><small>…и кофе</small></button></div>';
  document.body.appendChild(d);
}
function hideSupportOverlay(){var o=document.getElementById('supportChooseOverlay');if(o)o.remove();}
if(SUPPORT_ENTRY&&!chosenSupportCtx){
  document.body.classList.add('support-pending');
  setTimeout(showSupportOverlay,200);
  var supTries=0;
  var supIv=setInterval(function(){
    supTries++;
    var am=document.getElementById('authModal');if(am&&am.classList.contains('show'))am.classList.remove('show');
    var ov=document.getElementById('overlay');if(ov&&!document.getElementById('supportChooseOverlay'))ov.classList.remove('show');
    if(supTries>40)clearInterval(supIv);
  },150);
}
document.addEventListener('click',function(e){
  var b=e.target.closest('[data-support-topic]');if(!b)return;
  e.preventDefault();e.stopPropagation();
  var ctx=b.getAttribute('data-support-topic')==='delivery'?'delivery':'coffee';
  chosenSupportCtx=ctx;supportPending=false;
  try{sessionStorage.setItem('zt_support_ctx',ctx);}catch(err){}
  document.body.classList.remove('support-pending');
  chatCtx=ctx;try{localStorage.setItem('zt_chatctx',ctx);}catch(err){}
  hideSupportOverlay();
  var am=document.getElementById('authModal');if(am)am.classList.remove('show');
  var ov=document.getElementById('overlay');if(ov)ov.classList.remove('show');
  var p=document.getElementById('chatPanel');
  if(p&&!p.classList.contains('open')){var fab=document.getElementById('chatFab');if(fab)fab.click();}
  setTimeout(function(){try{reloadChatThread();}catch(err){}paintHints();},400);
  setTimeout(paintHints,900);
},true);

/* ========== 17. Подсказки и «Позвать сотрудника» (два тапа), устойчиво к перерисовкам ========== */
var CALL_ARMED=false;
function paintHints(){
  var msgs=document.getElementById('chatMsgs');if(!msgs)return;
  var wrap=msgs.querySelector('.hintsWrap');
  if(!wrap){wrap=document.createElement('div');wrap.className='hintsWrap';wrap.style.cssText='padding:4px 0 8px';msgs.appendChild(wrap);}
  wrap.innerHTML='';
  (chatCtx==='delivery'?DHINTS:CHINTS).slice().concat([CALL_HINT]).forEach(function(h){
    var b=document.createElement('button');b.className='chatHint';b.dataset.hint=h;
    if(h===CALL_HINT&&CALL_ARMED){
      b.dataset.arm='1';b.textContent='✅ Точно позвать сотрудника? (нажмите ещё раз)';
      b.style.background='#FDE8E8';b.style.borderColor='#B3372B';
    }else b.textContent=h;
    wrap.appendChild(b);
  });
  msgs.scrollTop=1e6;
}
function forceShowHints(){paintHints();}
showHints=function(){paintHints();};
/* единственный обработчик подсказок: document+capture, раньше любых базовых */
document.addEventListener('click',function(e){
  var h=e.target.closest('#chatMsgs .chatHint');if(!h)return;
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
  if(h.dataset.hint===CALL_HINT){
    if(CALL_ARMED){CALL_ARMED=false;paintHints();mySend(CALL_HINT);}
    else{CALL_ARMED=true;paintHints();setTimeout(function(){if(CALL_ARMED){CALL_ARMED=false;paintHints();}},6000);}
    return;
  }
  mySend(h.dataset.hint||h.textContent);
},true);
(function(){
  var f=document.getElementById('chatFab');if(!f||f.__v64)return;f.__v64=1;
  var old=f.onclick;
  f.onclick=async function(e){
    var ov=document.getElementById('overlay');if(ov)ov.classList.remove('show');
    if(typeof old==='function'){try{await old.call(this,e);}catch(err){}}
    setTimeout(paintHints,250);setTimeout(paintHints,800);
  };
})();

/* ========== 18. Шапка чата: классы и имя ВСЕГДА по контексту ========== */
(function(){
  function fixHead(){
    var p=document.getElementById('chatPanel');if(!p)return;
    var head=p.querySelector('.chatHead')||p.querySelector('.chat-h');
    if(!head)return;
    if(!head.classList.contains('chatHead'))head.classList.add('chatHead');
    var want=supportPending?'Ника · поддержка':(chatCtx==='delivery'?'Ника · 🍕 доставка':'Ника · ☕ кофейня');
    var nodes=head.querySelectorAll('div,span,b');
    for(var i=0;i<nodes.length;i++){
      var el=nodes[i];
      if(el.children.length===0&&/Ника/.test(el.textContent||'')){
        if((el.textContent||'')!==want)el.textContent=want;
        if(!el.classList.contains('chName'))el.classList.add('chName');
        break;
      }
    }
  }
  setInterval(fixHead,700);
  document.addEventListener('click',function(){setTimeout(fixHead,60);},true);
})();
/* ========== 19. v65 ВОССТАНОВЛЕНИЕ: все потерянные фичи одним блоком ========== */
(function(){
'use strict';
var q1=function(s){return document.querySelector(s);};
var qall=function(s){return Array.prototype.slice.call(document.querySelectorAll(s));};
var css=document.createElement('style');
css.textContent=
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
'#ctxDrop button.on{background:#FFF6E5}';
document.head.appendChild(css);
/* R1. Пилюля = выпадающий список */
showCtxSwitch=function(){
var p=q1('#chatPanel');if(!p)return;
var old=q1('#ctxDrop');if(old){old.remove();return;}
var d=document.createElement('div');d.id='ctxDrop';
d.innerHTML='<button type="button" data-ctxsw="coffee" class="'+(chatCtx==='coffee'?'on':'')+'">☕ Кофейня</button>'+
'<button type="button" data-ctxsw="delivery" class="'+(chatCtx==='delivery'?'on':'')+'">🍕 Пятница</button>';
p.appendChild(d);
};
document.addEventListener('click',function(e){
var b=e.target.closest('#ctxDrop [data-ctxsw]');if(!b)return;
chatCtx=b.getAttribute('data-ctxsw');
try{localStorage.setItem('zt_chatctx',chatCtx);}catch(err){}
var d=q1('#ctxDrop');if(d)d.remove();
try{setBotName();}catch(err){}
try{reloadChatThread();}catch(err){}
},true);
document.addEventListener('click',function(e){
if(!e.target.closest('#ctxDrop')&&!e.target.closest('#ctxSwitch')){var d=q1('#ctxDrop');if(d)d.remove();}
},true);
/* R2. Мои заказы: последняя в профиле + кнопка полного списка */
loadMyOrders=async function(){
var host=q1('#myOrders');if(!host||!me)return;
try{
var r=await api('/orders/mine');
var ST={new:['🆕','mo-new','Новый'],accept:['✅','mo-accept','Подтверждён'],cook:['👨‍','mo-cook','Готовится'],way:['🛵','mo-way','Курьер в пути'],done:['🏁','mo-done','Выполнен'],cancel:['❌','mo-cancel','Отменён']};
var o=(r.orders||[])[0];
if(!o){host.innerHTML='<div class="hmini">Заказов пока нет — самое время выбрать пиццу 🍕</div>';return;}
var s=ST[o.status]||['•','mo-new',o.status];
var d=new Date(o.created).toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'2-digit'});
var items=o.items.slice(0,3).map(function(i){return i.qty+'× '+i.name;}).join(', ')+(o.items.length>3?'…':'');
host.innerHTML='<div class="myOrderCard"><div class="moTop"><span>Заказ #'+o.no+'<span class="moDate">· '+d+'</span></span><span class="moSt '+s[1]+'">'+s[0]+' '+s[2]+'</span></div>'+
'<div class="moSum">'+fmt(o.total)+(o.eta?' · ⏰ '+esc(o.eta):'')+'</div>'+
(items?'<div class="moItems">'+esc(items)+'</div>':'')+
((o.gifts&&o.gifts.length)?'<div class="moGifts">🎁 '+o.gifts.map(function(g){return esc(g.name)+' ×'+g.qty;}).join(', ')+'</div>':'')+'</div>';
}catch(e){}
};
(function(){
if(q1('#ordersModal'))return;
var m=document.createElement('div');m.id='ordersModal';
m.innerHTML='<div class="omCard"><button type="button" class="omClose">✕ Закрыть</button><h3 style="margin:0 0 12px">📦 Мои заказы</h3><div id="omList"></div></div>';
document.body.appendChild(m);
m.addEventListener('click',function(e){if(e.target===m||e.target.closest('.omClose'))m.classList.remove('show');});
})();
async function renderOrdersModal(){
var list=q1('#omList');if(!list||!me)return;
list.innerHTML='<div class="hmini">Загрузка…</div>';
q1('#ordersModal').classList.add('show');
try{
var r=await api('/orders/mine');
var ST={new:'🆕 Новый',accept:'✅ Подтверждён',cook:'👨‍🍳 Готовится',way:'🛵 Курьер в пути',done:'🏁 Выполнен',cancel:'❌ Отменён'};
list.innerHTML=(r.orders||[]).map(function(o){
var d=new Date(o.created).toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'2-digit'});
return '<div class="myOrderCard" style="margin-bottom:8px"><div class="moTop"><span>Заказ #'+o.no+'<span class="moDate">· '+d+'</span></span><span class="moSt">'+(ST[o.status]||o.status)+'</span></div>'+
'<div class="moSum">'+fmt(o.total)+(o.eta?' · ⏰ '+esc(o.eta):'')+'</div>'+
'<div class="moItems">'+esc(o.items.map(function(i){return i.qty+'× '+i.name;}).join(', '))+'</div>'+
((o.gifts&&o.gifts.length)?'<div class="moGifts">🎁 '+o.gifts.map(function(g){return esc(g.name)+' ×'+g.qty;}).join(', ')+'</div>':'')+'</div>';
}).join('')||'<div class="hmini">Заказов пока нет 🍕</div>';
}catch(e){list.innerHTML='<div class="hmini">Не загрузилось</div>';}
}
(function(){
var pb=q1('#profileBox');if(!pb||q1('#myOrdersBtn'))return;
var b=document.createElement('button');b.type='button';b.id='myOrdersBtn';b.className='demoBtn';b.textContent='📦 Мои заказы';
var mo=q1('#myOrders');if(mo)pb.insertBefore(b,mo);else pb.appendChild(b);
b.onclick=renderOrdersModal;
})();
/* R3. Каналы уведомлений */
function syncNotifyUI(){
if(!me)return;
var t=q1('#ntTg'),w=q1('#ntWeb');
if(t)t.checked=me.notify_tg!==0;
if(w)w.checked=me.notify_web!==0;
}
(function(){
var pb=q1('#profileBox');if(!pb||q1('#notifyDetails'))return;
var d=document.createElement('details');d.id='notifyDetails';
d.innerHTML='<summary>🔔 Каналы уведомлений</summary>'+
'<div style="display:flex;gap:16px;margin-top:8px;flex-wrap:wrap">'+
'<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="ntTg"> 🤖 Telegram</label>'+
'<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="ntWeb"> 🔔 Пуши браузера</label></div>';
pb.appendChild(d);
d.addEventListener('change',async function(){
try{await api('/me/notify',{method:'PUT',body:{tg:q1('#ntTg').checked?1:0,web:q1('#ntWeb').checked?1:0}});toast('Каналы уведомлений сохранены','✅');}
catch(e){toast(e.message,'⚠️');}
});
})();
['profileTopBtn','mbonusBtn'].forEach(function(id){
var b=q1('#'+id);if(b)b.addEventListener('click',function(){setTimeout(syncNotifyUI,120);});
});
/* R4. Инфо-блок пятницы + брендовые скрытия */
(function(){
var pb=q1('#profileBox');if(!pb||q1('#fridayInfo'))return;
var d=document.createElement('div');d.id='fridayInfo';
d.innerHTML='<b>Пятница — доставка пиццы и роллов</b>п. Янтарный, ул. Советская, 38А (самовывоз)<br>Ежедневно 11:00–22:00 · доставка ~45 мин<br>🌐 <a href="https://vk.ru/fridaypizza39" target="_blank" style="color:#1F4E8C;font-weight:800">vk.ru/fridaypizza39</a><br>⭐ <a href="https://yandex.ru/maps/org/pyatnitsa/33658031357/reviews/" target="_blank" style="color:#1F4E8C;font-weight:800">отзывы на Яндекс Картах</a><br><a href="https://yandex.ru/maps/org/pyatnitsa/33658031357/reviews/?add-review=true" target="_blank" class="btn fire" style="margin-top:10px;display:inline-block">⭐ Оставить отзыв</a>';
var hist=qall('#profileBox h4').filter(function(h){return /История/.test(h.textContent);})[0];
if(hist)pb.insertBefore(d,hist);else pb.appendChild(d);
})();
function applyProfileBrand(){
var deliv=(brand==='delivery');
var fi=q1('#fridayInfo');if(fi)fi.style.display=deliv?'':'none';
qall('#profileBox .placebox').forEach(function(p){
if(/Мы у моря|Понравилось у нас/.test(p.textContent))p.style.display=deliv?'none':'';
});
qall('#profileBox a').forEach(function(a){
if(/instagram\.com|t\.me\/and_coffee39/.test(a.href||''))a.style.display=deliv?'none':'';
});
syncNotifyUI();
}
document.getElementById('brandSeg').addEventListener('click',function(){setTimeout(applyProfileBrand,60);});
/* R5. Тикер и логотип по бренду */
var BRAND_ORIG_LOGO=null;
function applyBrandChrome(){
var deliv=(brand==='delivery');
var track=q1('#tickerTrack');
if(track){
var L=deliv?['Пятница — доставка пиццы и роллов','Ежедневно 11:00–22:00','Доставка ~45 мин','vk.ru/fridaypizza39','Каждые 2000 ₽ в чеке — 0,5 пива в подарок']
:['кофейня на берегу моря …и кофе','каждый 10-й кофе — бесплатно','п. Янтарный, Советская 70г','t.me/and_coffee39','ежедневно с 8:00–21:00'];
track.innerHTML=L.concat(L).map(function(x){return '<span>'+x+'</span>';}).join('');
}
var br=q1('.topbar .brand');
if(br){
if(BRAND_ORIG_LOGO===null)BRAND_ORIG_LOGO=br.innerHTML;
if(deliv)br.innerHTML='<img src="friday-logo.png" alt="Пятница" onerror="this.outerHTML=\'<span style=&quot;font-size:26px&quot;>🍕</span>\'"><div><b>Пятница</b><small>доставка пиццы и роллов</small></div>';
else br.innerHTML=BRAND_ORIG_LOGO;
}
}
document.getElementById('brandSeg').addEventListener('click',function(){setTimeout(applyBrandChrome,60);});
/* R6. Согласие с политикой при регистрации */
(function(){
var form=q1('#regForm');if(!form||q1('#consentRow'))return;
var lab=document.createElement('label');lab.id='consentRow';lab.className='chk';
lab.innerHTML='<input type="checkbox" id="consentBox"><span>Согласен с <a href="/privacy.html" target="_blank" style="color:#1F4E8C">политикой конфиденциальности</a> и обработкой персональных данных</span>';
var btn=q1('#regBtn');if(btn)form.insertBefore(lab,btn);
})();
document.addEventListener('click',function(e){
var b=e.target.closest('#regBtn');if(!b)return;
var cb=q1('#consentBox');
if(cb&&!cb.checked){e.stopImmediatePropagation();e.preventDefault();toast('Отметь согласие с политикой конфиденциальности','⚠️');}
},true);
(function(){var _f=window.fetch;window.fetch=function(u,o){
try{
if(o&&o.body&&typeof o.body==='string'&&String(u).indexOf('/api/auth/register')>-1){
var b=JSON.parse(o.body);var cb=q1('#consentBox');b.consent=(cb&&cb.checked)?1:0;
o=Object.assign({},o,{body:JSON.stringify(b)});
}
}catch(e){}
return _f.call(this,u,o);};})();
/* R7. Кассир: без «Последних событий», без дубля «Новый гость» */
function cashierClean(){
var cl=q1('#cashLog');if(cl){var card=cl.closest('.cash-card');if(card)card.style.display='none';}
var ng2=q1('#newGuestBtn2');if(ng2)ng2.style.display='none';
}
new MutationObserver(function(){
var cv=q1('#cashierView');if(cv&&!cv.hidden)cashierClean();
}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
/* R8. Редактор пятницы: карандаши + тумблер «в меню» */
function injectEdits(){
if(!document.body.classList.contains('editing'))return;
qall('#deliveryGrid [data-add]').forEach(function(add){
var card=add.closest('.card');if(!card)return;
card.style.position='relative';
if(!card.querySelector('.edBtn')){
var b=document.createElement('button');b.type='button';b.className='edBtn';b.dataset.ed=add.getAttribute('data-add');b.textContent='✏️';
card.appendChild(b);
}
if(!card.querySelector('.donoff')){
var id=add.getAttribute('data-add');
var p=(window.DMENU||[]).filter(function(x){return x.id===id;})[0];
var lab=document.createElement('label');lab.className='donoff';
lab.innerHTML='<input type="checkbox" data-onoff="'+id+'" '+((!p||p.on)?'checked':'')+'>в меню';
card.appendChild(lab);
}
});
}
new MutationObserver(function(){injectEdits();}).observe(q1('#deliveryGrid')||document.body,{childList:true,subtree:true});
document.getElementById('editToggle').addEventListener('click',function(){setTimeout(injectEdits,80);setTimeout(injectEdits,400);});
document.addEventListener('click',function(e){
var b=e.target.closest('#deliveryGrid .edBtn');if(!b)return;
e.stopPropagation();e.preventDefault();
try{openEditor(b.dataset.ed);}catch(err){}
},true);
document.getElementById('deliveryGrid').addEventListener('change',async function(e){
var t=e.target.closest('.donoff [data-onoff]');if(!t)return;
e.stopPropagation();
var p=(window.DMENU||[]).filter(function(x){return x.id===t.getAttribute('data-onoff');})[0];if(!p)return;
p.on=t.checked?1:0;
try{await api('/menu/'+p.id,{method:'PUT',body:p});await loadDelivery();
toast(t.checked?'«'+esc(p.name)+'» снова в меню':'«'+esc(p.name)+'» → стоп-лист',t.checked?'✅':'⛔');}
catch(err){toast(err.message,'⚠️');loadDelivery();}
},true);
/* R9. Списание свободного кофе с выбором напитка */
showCust=(function(_sc){return function(u,last){window.__foundId=u&&u.id;return _sc(u,last);};})(showCust);
(function(){
if(q1('#redeemPick'))return;
var m=document.createElement('div');m.id='redeemPick';
m.innerHTML='<div class="omCard" style="max-width:420px"><button type="button" class="omClose">✕</button><h3 style="margin:0 0 12px">🎁 Какой кофе списать?</h3><div id="rpList" style="display:grid;gap:8px"></div></div>';
document.body.appendChild(m);
m.addEventListener('click',function(e){if(e.target===m||e.target.closest('.omClose'))m.classList.remove('show');});
q1('#rpList').innerHTML=['Эспрессо','Американо','Капучино','Латте','Флэт уайт','Батч брю'].map(function(n){return '<button type="button" class="btn ghost" data-rp="'+n+'" style="width:100%">'+n+'</button>';}).join('');
m.addEventListener('click',async function(e){
var b=e.target.closest('[data-rp]');if(!b)return;
var id=window.__foundId;if(!id)return toast('Гость не найден','⚠️');
try{var r=await api('/staff/redeem',{method:'POST',body:{id:id,item:b.dataset.rp}});
m.classList.remove('show');toast('Списано: '+b.dataset.rp,'🎁');
try{showCust(r.customer);}catch(e2){}
}catch(err){toast(err.message,'⚠️');}
});
var rb=q1('#redeemBtn');
if(rb)rb.addEventListener('click',function(e){
e.stopImmediatePropagation();e.preventDefault();
q1('#redeemPick').classList.add('show');
},true);
})();
/* R10. Диспетчер: задержка доставки */
(function(){
var top=q1('#ordersView .cash-top');
if(top&&!q1('#delayAllBox')){
var d=document.createElement('div');d.id='delayAllBox';d.className='delayBtns';
d.innerHTML='<b>Задержать все:</b><button type="button" data-dlyall="15">+15 мин</button><button type="button" data-dlyall="30">+30 мин</button>';
top.appendChild(d);
}
})();
function injectDelay(){
if(mode!=='orders')return;
qall('#ordersList .orderCard').forEach(function(card){
if(card.querySelector('.delayBtns'))return;
if(/Выполнен|Отменён/.test(card.textContent))return;
var oid=card.dataset.oid;if(!oid)return;
var d=document.createElement('div');d.className='delayBtns';
d.innerHTML='<button type="button" data-dly="15" data-oid="'+oid+'">⏰ +15 мин</button><button type="button" data-dly="30" data-oid="'+oid+'">⏰ +30 мин</button>';
card.appendChild(d);
});
}
new MutationObserver(function(){injectDelay();}).observe(q1('#ordersList')||document.body,{childList:true,subtree:true});
document.addEventListener('click',async function(e){
var b=e.target.closest('[data-dly],[data-dlyall]');if(!b)return;
e.stopPropagation();e.preventDefault();
var comment=prompt('Причина задержки (необязательно):','');
if(comment===null)return;
var min=+(b.dataset.dly||b.dataset.dlyall);
try{
if(b.dataset.dly)await api('/orders/'+b.dataset.oid+'/delay',{method:'POST',body:{min:min,comment:comment}});
else{var r=await api('/orders/delay-all',{method:'POST',body:{min:min,comment:comment}});toast('Уведомлено заказов: '+r.count,'⏰');}
renderOrders(true);
}catch(err){toast(err.message,'⚠️');}
},true);
setTimeout(function(){applyProfileBrand();applyBrandChrome();cashierClean();injectEdits();syncNotifyUI();},400);
console.log('fix-views v65 восстановление готов');
})();
/* ══ v62 ФИНАЛ: все восстановленные фичи одним блоком. Вставить ПЕРЕД последним sv(); ══ */
(function(){
'use strict';
var q1=function(s){return document.querySelector(s);};
var qall=function(s){return Array.prototype.slice.call(document.querySelectorAll(s));};
var css=document.createElement('style');
css.textContent=
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
'#ctxDrop button.on{background:#FFF6E5}';
document.head.appendChild(css);
/* R1. Пилюля = выпадающий список */
showCtxSwitch=function(){
var p=q1('#chatPanel');if(!p)return;
var old=q1('#ctxDrop');if(old){old.remove();return;}
var d=document.createElement('div');d.id='ctxDrop';
d.innerHTML='<button type="button" data-ctxsw="coffee" class="'+(chatCtx==='coffee'?'on':'')+'">☕ Кофейня</button>'+
'<button type="button" data-ctxsw="delivery" class="'+(chatCtx==='delivery'?'on':'')+'">🍕 Пятница</button>';
p.appendChild(d);
};
var csBtn=q1('#ctxSwitch');if(csBtn)csBtn.onclick=function(){showCtxSwitch();};
document.addEventListener('click',function(e){
var b=e.target.closest('#ctxDrop [data-ctxsw]');if(!b)return;
chatCtx=b.getAttribute('data-ctxsw');
try{localStorage.setItem('zt_chatctx',chatCtx);}catch(err){}
var d=q1('#ctxDrop');if(d)d.remove();
try{setBotName();}catch(err){}
try{reloadChatThread();}catch(err){}
},true);
document.addEventListener('click',function(e){
if(!e.target.closest('#ctxDrop')&&!e.target.closest('#ctxSwitch')){var d=q1('#ctxDrop');if(d)d.remove();}
},true);
/* R2. Мои заказы: последняя в профиле + модалка полного списка */
loadMyOrders=async function(){
var host=q1('#myOrders');if(!host||!me)return;
try{
var r=await api('/orders/mine');
var ST={new:['🆕','mo-new','Новый'],accept:['✅','mo-accept','Подтверждён'],cook:['👨‍🍳','mo-cook','Готовится'],way:['🛵','mo-way','Курьер в пути'],done:['🏁','mo-done','Выполнен'],cancel:['❌','mo-cancel','Отменён']};
var o=(r.orders||[])[0];
if(!o){host.innerHTML='<div class="hmini">Заказов пока нет — самое время выбрать пиццу 🍕</div>';return;}
var s=ST[o.status]||['•','mo-new',o.status];
var d=new Date(o.created).toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'2-digit'});
var items=o.items.slice(0,3).map(function(i){return i.qty+'× '+i.name;}).join(', ')+(o.items.length>3?'…':'');
host.innerHTML='<div class="myOrderCard"><div class="moTop"><span>Заказ #'+o.no+'<span class="moDate">· '+d+'</span></span><span class="moSt '+s[1]+'">'+s[0]+' '+s[2]+'</span></div>'+
'<div class="moSum">'+fmt(o.total)+(o.eta?' · ⏰ '+esc(o.eta):'')+'</div>'+
(items?'<div class="moItems">'+esc(items)+'</div>':'')+
((o.gifts&&o.gifts.length)?'<div class="moGifts">🎁 '+o.gifts.map(function(g){return esc(g.name)+' ×'+g.qty;}).join(', ')+'</div>':'')+'</div>';
}catch(e){}
};
(function(){
if(q1('#ordersModal'))return;
var m=document.createElement('div');m.id='ordersModal';
m.innerHTML='<div class="omCard"><button type="button" class="omClose">✕ Закрыть</button><h3 style="margin:0 0 12px">📦 Мои заказы</h3><div id="omList"></div></div>';
document.body.appendChild(m);
m.addEventListener('click',function(e){if(e.target===m||e.target.closest('.omClose')){m.classList.remove('show');}});
})();
async function renderOrdersModal(){
var list=q1('#omList');if(!list||!me)return;
list.innerHTML='<div class="hmini">Загрузка…</div>';
q1('#ordersModal').classList.add('show');
try{
var r=await api('/orders/mine');
var ST={new:'🆕 Новый',accept:'✅ Подтверждён',cook:'👨‍ Готовится',way:'🛵 Курьер в пути',done:'🏁 Выполнен',cancel:'❌ Отменён'};
list.innerHTML=(r.orders||[]).map(function(o){
var d=new Date(o.created).toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'2-digit'});
return '<div class="myOrderCard" style="margin-bottom:8px"><div class="moTop"><span>Заказ #'+o.no+'<span class="moDate">· '+d+'</span></span><span class="moSt">'+(ST[o.status]||o.status)+'</span></div>'+
'<div class="moSum">'+fmt(o.total)+(o.eta?' · ⏰ '+esc(o.eta):'')+'</div>'+
'<div class="moItems">'+esc(o.items.map(function(i){return i.qty+'× '+i.name;}).join(', '))+'</div>'+
((o.gifts&&o.gifts.length)?'<div class="moGifts">🎁 '+o.gifts.map(function(g){return esc(g.name)+' ×'+g.qty;}).join(', ')+'</div>':'')+'</div>';
}).join('')||'<div class="hmini">Заказов пока нет 🍕</div>';
}catch(e){list.innerHTML='<div class="hmini">Не загрузилось</div>';}
}
(function(){
var pb=q1('#profileBox');if(!pb||q1('#myOrdersBtn'))return;
var b=document.createElement('button');b.type='button';b.id='myOrdersBtn';b.className='demoBtn';b.textContent='📦 Мои заказы';
var mo=q1('#myOrders');if(mo)pb.insertBefore(b,mo);else pb.appendChild(b);
b.onclick=renderOrdersModal;
})();
/* R3. Каналы уведомлений */
function syncNotifyUI(){
if(!me)return;
var t=q1('#ntTg'),w=q1('#ntWeb');
if(t)t.checked=me.notify_tg!==0;
if(w)w.checked=me.notify_web!==0;
}
(function(){
var pb=q1('#profileBox');if(!pb||q1('#notifyDetails'))return;
var d=document.createElement('details');d.id='notifyDetails';
d.innerHTML='<summary>🔔 Каналы уведомлений</summary>'+
'<div style="display:flex;gap:16px;margin-top:8px;flex-wrap:wrap">'+
'<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="ntTg"> 🤖 Telegram</label>'+
'<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="ntWeb"> 🔔 Пуши браузера</label></div>';
pb.appendChild(d);
d.addEventListener('change',async function(){
try{await api('/me/notify',{method:'PUT',body:{tg:q1('#ntTg').checked?1:0,web:q1('#ntWeb').checked?1:0}});toast('Каналы уведомлений сохранены','✅');}
catch(e){toast(e.message,'⚠️');}
});
})();
['profileTopBtn','mbonusBtn'].forEach(function(id){
var b=q1('#'+id);if(b)b.addEventListener('click',function(){setTimeout(syncNotifyUI,120);});
});
/* R4. Инфо-блок пятницы + брендовые скрытия */
(function(){
var pb=q1('#profileBox');if(!pb||q1('#fridayInfo'))return;
var d=document.createElement('div');d.id='fridayInfo';
d.innerHTML='<b>Пятница — доставка пиццы и роллов</b>п. Янтарный, ул. Советская, 38А (самовывоз)<br>Ежедневно 11:00–22:00 · доставка ~45 мин<br>🌐 <a href="https://vk.ru/fridaypizza39" target="_blank" style="color:#1F4E8C;font-weight:800">vk.ru/fridaypizza39</a><br>⭐ <a href="https://yandex.ru/maps/org/pyatnitsa/33658031357/reviews/" target="_blank" style="color:#1F4E8C;font-weight:800">отзывы на Яндекс Картах</a><br><a href="https://yandex.ru/maps/org/pyatnitsa/33658031357/reviews/?add-review=true" target="_blank" class="btn fire" style="margin-top:10px;display:inline-block">⭐ Оставить отзыв</a>';
var hist=qall('#profileBox h4').filter(function(h){return /История/.test(h.textContent);})[0];
if(hist)pb.insertBefore(d,hist);else pb.appendChild(d);
})();
function applyProfileBrand(){
var deliv=(brand==='delivery');
var fi=q1('#fridayInfo');if(fi)fi.style.display=deliv?'':'none';
qall('#profileBox .placebox').forEach(function(p){
if(/Мы у моря|Понравилось у нас/.test(p.textContent))p.style.display=deliv?'none':'';
});
qall('#profileBox a').forEach(function(a){
if(/instagram\.com|t\.me\/and_coffee39/.test(a.href||''))a.style.display=deliv?'none':'';
});
syncNotifyUI();
}
document.getElementById('brandSeg').addEventListener('click',function(){setTimeout(applyProfileBrand,60);});
/* R5. Тикер и логотип по бренду */
var BRAND_ORIG_LOGO=null;
function applyBrandChrome(){
var deliv=(brand==='delivery');
var track=q1('#tickerTrack');
if(track){
var L=deliv?['Пятница — доставка пиццы и роллов','Ежедневно 11:00–22:00','Доставка ~45 мин','vk.ru/fridaypizza39','Каждые 2000 ₽ в чеке — 0,5 пива в подарок']
:['кофейня на берегу моря …и кофе','каждый 10-й кофе — бесплатно','п. Янтарный, Советская 70г','t.me/and_coffee39','ежедневно с 8:00–21:00'];
track.innerHTML=L.concat(L).map(function(x){return '<span>'+x+'</span>';}).join('');
}
var br=q1('.topbar .brand');
if(br){
if(BRAND_ORIG_LOGO===null)BRAND_ORIG_LOGO=br.innerHTML;
if(deliv)br.innerHTML='<img src="friday-logo.png" alt="Пятница" onerror="this.outerHTML=\'<span style=&quot;font-size:26px&quot;>🍕</span>\'"><div><b>Пятница</b><small>доставка пиццы и роллов</small></div>';
else br.innerHTML=BRAND_ORIG_LOGO;
}
}
document.getElementById('brandSeg').addEventListener('click',function(){setTimeout(applyBrandChrome,60);});
/* R6. Согласие с политикой при регистрации */
(function(){
var form=q1('#regForm');if(!form||q1('#consentRow'))return;
var lab=document.createElement('label');lab.id='consentRow';lab.className='chk';
lab.innerHTML='<input type="checkbox" id="consentBox"><span>Согласен с <a href="/privacy.html" target="_blank" style="color:#1F4E8C">политикой конфиденциальности</a> и обработкой персональных данных</span>';
var btn=q1('#regBtn');if(btn)form.insertBefore(lab,btn);
})();
document.addEventListener('click',function(e){
var b=e.target.closest('#regBtn');if(!b)return;
var cb=q1('#consentBox');
if(cb&&!cb.checked){e.stopImmediatePropagation();e.preventDefault();toast('Отметь согласие с политикой конфиденциальности','⚠️');}
},true);
(function(){var _f=window.fetch;window.fetch=function(u,o){
try{
if(o&&o.body&&typeof o.body==='string'&&String(u).indexOf('/api/auth/register')>-1){
var b=JSON.parse(o.body);var cb=q1('#consentBox');b.consent=(cb&&cb.checked)?1:0;
o=Object.assign({},o,{body:JSON.stringify(b)});
}
}catch(e){}
return _f.call(this,u,o);};})();
/* R7. Кассир: без «Последних событий» и дубля «Новый гость» */
function cashierClean(){
var cl=q1('#cashLog');if(cl){var card=cl.closest('.cash-card');if(card)card.style.display='none';}
var ng2=q1('#newGuestBtn2');if(ng2)ng2.style.display='none';
}
new MutationObserver(function(){
var cv=q1('#cashierView');if(cv&&!cv.hidden)cashierClean();
}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
/* R8. Редактор пятницы: карандаши + тумблер «в меню» */
function injectEdits(){
if(!document.body.classList.contains('editing'))return;
qall('#deliveryGrid [data-add]').forEach(function(add){
var card=add.closest('.card');if(!card)return;
card.style.position='relative';
if(!card.querySelector('.edBtn')){
var b=document.createElement('button');b.type='button';b.className='edBtn';b.dataset.ed=add.getAttribute('data-add');b.textContent='✏️';
card.appendChild(b);
}
if(!card.querySelector('.donoff')){
var id=add.getAttribute('data-add');
var p=(window.DMENU||[]).filter(function(x){return x.id===id;})[0];
var lab=document.createElement('label');lab.className='donoff';
lab.innerHTML='<input type="checkbox" data-onoff="'+id+'" '+((!p||p.on)?'checked':'')+'>в меню';
card.appendChild(lab);
}
});
}
new MutationObserver(function(){injectEdits();}).observe(q1('#deliveryGrid')||document.body,{childList:true,subtree:true});
document.getElementById('editToggle').addEventListener('click',function(){setTimeout(injectEdits,80);setTimeout(injectEdits,400);});
document.addEventListener('click',function(e){
var b=e.target.closest('#deliveryGrid .edBtn');if(!b)return;
e.stopPropagation();e.preventDefault();
try{openEditor(b.dataset.ed);}catch(err){}
},true);
document.getElementById('deliveryGrid').addEventListener('change',async function(e){
var t=e.target.closest('.donoff [data-onoff]');if(!t)return;
e.stopPropagation();
var p=(window.DMENU||[]).filter(function(x){return x.id===t.getAttribute('data-onoff');})[0];if(!p)return;
p.on=t.checked?1:0;
try{await api('/menu/'+p.id,{method:'PUT',body:p});await loadDelivery();
toast(t.checked?'«'+esc(p.name)+'» снова в меню':'«'+esc(p.name)+'» → стоп-лист',t.checked?'✅':'⛔');}
catch(err){toast(err.message,'⚠️');loadDelivery();}
},true);
/* R9. Списание свободного кофе с выбором напитка */
showCust=(function(_sc){return function(u,last){window.__foundId=u&&u.id;return _sc(u,last);};})(showCust);
(function(){
if(q1('#redeemPick'))return;
var m=document.createElement('div');m.id='redeemPick';
m.innerHTML='<div class="omCard" style="max-width:420px"><button type="button" class="omClose">✕</button><h3 style="margin:0 0 12px">🎁 Какой кофе списать?</h3><div id="rpList" style="display:grid;gap:8px"></div></div>';
document.body.appendChild(m);
m.addEventListener('click',function(e){if(e.target===m||e.target.closest('.omClose')){m.classList.remove('show');}});
q1('#rpList').innerHTML=['Эспрессо','Американо','Капучино','Латте','Флэт уайт','Батч брю'].map(function(n){return '<button type="button" class="btn ghost" data-rp="'+n+'" style="width:100%">'+n+'</button>';}).join('');
m.addEventListener('click',async function(e){
var b=e.target.closest('[data-rp]');if(!b)return;
var id=window.__foundId;if(!id)return toast('Гость не найден','⚠️');
try{var r=await api('/staff/redeem',{method:'POST',body:{id:id,item:b.dataset.rp}});
m.classList.remove('show');toast('Списано: '+b.dataset.rp,'🎁');
try{showCust(r.customer);}catch(e2){}
}catch(err){toast(err.message,'⚠️');}
});
var rb=q1('#redeemBtn');
if(rb)rb.addEventListener('click',function(e){
e.stopImmediatePropagation();e.preventDefault();
q1('#redeemPick').classList.add('show');
},true);
})();
/* R10. Диспетчер: задержка доставки */
(function(){
var top=q1('#ordersView .cash-top');
if(top&&!q1('#delayAllBox')){
var d=document.createElement('div');d.id='delayAllBox';d.className='delayBtns';
d.innerHTML='<b>Задержать все:</b><button type="button" data-dlyall="15">+15 мин</button><button type="button" data-dlyall="30">+30 мин</button>';
top.appendChild(d);
}
})();
function injectDelay(){
if(mode!=='orders')return;
qall('#ordersList .orderCard').forEach(function(card){
if(card.querySelector('.delayBtns'))return;
if(/Выполнен|Отменён/.test(card.textContent))return;
var oid=card.dataset.oid;if(!oid)return;
var d=document.createElement('div');d.className='delayBtns';
d.innerHTML='<button type="button" data-dly="15" data-oid="'+oid+'">⏰ +15 мин</button><button type="button" data-dly="30" data-oid="'+oid+'">⏰ +30 мин</button>';
card.appendChild(d);
});
}
new MutationObserver(function(){injectDelay();}).observe(q1('#ordersList')||document.body,{childList:true,subtree:true});
document.addEventListener('click',async function(e){
var b=e.target.closest('[data-dly],[data-dlyall]');if(!b)return;
e.stopPropagation();e.preventDefault();
var comment=prompt('Причина задержки (необязательно):','');
if(comment===null)return;
var min=+(b.dataset.dly||b.dataset.dlyall);
try{
if(b.dataset.dly)await api('/orders/'+b.dataset.oid+'/delay',{method:'POST',body:{min:min,comment:comment}});
else{var r=await api('/orders/delay-all',{method:'POST',body:{min:min,comment:comment}});toast('Уведомлено заказов: '+r.count,'⏰');}
renderOrders(true);
}catch(err){toast(err.message,'⚠️');}
},true);
/* Нормализация шапки чата (.chatHead/.chName) — идемпотентно */
if(!window.__v62norm){window.__v62norm=1;
(function(){
function norm(){
var p=document.getElementById('chatPanel');if(!p)return;
var head=p.querySelector('.chatHead');
if(!head){
var kids=p.children;
for(var i=0;i<kids.length;i++){
if(/Ника/.test(kids[i].textContent||'')){head=kids[i];break;}
}
if(head)head.classList.add('chatHead');
}
if(head&&!head.querySelector('.chName')){
var nodes=head.querySelectorAll('div,span,b');
for(var j=0;j<nodes.length;j++){
if(nodes[j].children.length===0&&/Ника/.test(nodes[j].textContent||'')){nodes[j].classList.add('chName');break;}
}
}
}
norm();setTimeout(norm,300);setTimeout(norm,1200);setTimeout(norm,3000);
document.addEventListener('click',function(){setTimeout(norm,60);},true);
var p0=document.getElementById('chatPanel');
if(p0&&window.MutationObserver)new MutationObserver(function(){norm();}).observe(p0,{childList:true,subtree:true});
})();
}
/* Страховка от фантомного #overlay */
if(!window.__v62ov){window.__v62ov=1;
setInterval(function(){
var ov=document.getElementById('overlay');
if(ov&&ov.classList.contains('show')&&!document.querySelector('.modal.show'))ov.classList.remove('show');
},500);
}
setTimeout(function(){applyProfileBrand();applyBrandChrome();cashierClean();injectEdits();syncNotifyUI();},400);
console.log('fix-views v62 финал готов');
})();

sv();
console.log('fix-views v64 готов');
})();