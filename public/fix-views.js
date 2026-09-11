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

sv();
console.log('fix-views v64 готов');
})();