/* fix-views.js — ЕДИНАЯ сборка v61. Грузится ПОСЛЕ основного скрипта. */
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
window.__fvChatState={
  getChatCtx:function(){return chatCtx;},
  setChatCtx:function(v){chatCtx=v;try{localStorage.setItem('zt_chatctx',v);}catch(e){}},
  getSupportPending:function(){return supportPending;},
  setSupportPending:function(v){supportPending=v;},
  getChosenSupportCtx:function(){return chosenSupportCtx;},
  setChosenSupportCtx:function(v){chosenSupportCtx=v;try{sessionStorage.setItem('zt_support_ctx',v);}catch(e){}}
};
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
/* FIX: z-index для теста и UI, чтобы глобальный #overlay не перекрывал */
'.chat-fab{z-index:10001!important}'+
'#supportChooseOverlay{position:fixed;inset:0;z-index:10002!important;background:var(--paper);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center}'+
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
/* cartFabShow: Ф3.9 → public/app/cart.js */

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

/* ========== 4. Корзина ========== Ф3.9: перенесено в public/app/cart.js ========== */
/* Ф3.7: promoInfo и cartPromoCode объявлены в public/app/delivery.js */
/* Ф3.7: перенесено в public/app/delivery.js */
/* Ф3.6: DCATSL, editorFields, openEditor, exitEdit и их обработчики перенесены в public/app/menu-editor.js */
renderDeliveryRail=(function(_rr){return function(){_rr();
  var b=document.querySelector('#deliveryRail [data-dcat="sauces"]');if(b)b.remove();
};})(renderDeliveryRail);
renderDeliveryMenu=(function(_rm){return function(){_rm();
  var list=DMENU.filter(function(p){return p.cat===dcat;});
  var cards=document.querySelectorAll('#deliveryGrid .card');
  cards.forEach(function(card,i){
    var p=list[i]; if(!p) return;
    card.classList.toggle('stopped', !p.on);
    var media=card.querySelector('.media');
    if(!media) return;
    var sb=media.querySelector('.stopbadge');
    if(!p.on && !sb){ sb=document.createElement('span'); sb.className='stopbadge'; sb.textContent='СТОП'; media.appendChild(sb); }
    if(p.on && sb) sb.remove();
  });
  document.querySelectorAll('#deliveryGrid .opts button').forEach(function(b){
    if(b.querySelector('.ol'))return;
    var parts=b.textContent.split(' · ');
    if(parts.length<3)return;
    b.innerHTML='<span class="ol">'+parts[0]+'</span><span class="op">'+parts[1]+' · '+parts[2]+'</span>';
  });
  document.querySelectorAll('#deliveryGrid .opts button.sel').forEach(function(b){b.classList.remove('sel');});
};})(renderDeliveryMenu);
document.getElementById('deliveryGrid').addEventListener('click',function(e){
  var ed=e.target.closest('[data-ed]');
  if(ed){openEditor(ed.dataset.ed);return;}
  var ob=e.target.closest('.opts button');
  if(ob&&ob.classList.contains('sel')){
    e.stopPropagation();
    ob.classList.remove('sel');
    var id=ob.dataset.id,oi=+ob.dataset.oi;
    var before=cart.length;
    cart=cart.filter(function(c){return !(c.id===id&&c.oi===oi);});
    if(cart.length!==before){
      localStorage.setItem('zt_cart',JSON.stringify(cart));
      updateCartFab();renderCart();
      toast('Убрали из заказа','🗑');
    }
    return;
  }
  var add=e.target.closest('[data-add]');
  if(add){
    var body=add.closest('.cbody');var optsBox=body&&body.querySelector('.opts');
    if(optsBox&&!optsBox.querySelector('.sel')){
      e.stopPropagation();
      toast('Выберите размер пиццы 🍕','');
      optsBox.classList.remove('shake');void optsBox.offsetWidth;optsBox.classList.add('shake');
    }
  }
},true);
document.addEventListener('animationend',function(e){
  if(e.target&&e.target.classList&&e.target.classList.contains('shake'))e.target.classList.remove('shake');
},true);
document.getElementById('deliveryGrid').addEventListener('change',async function(e){
  var t=e.target.closest('[data-onoff]');if(!t)return;
  var p=DMENU.find(function(x){return x.id===t.dataset.onoff;});if(!p)return;
  p.on=t.checked?1:0;renderDeliveryMenu();
  try{await api('/menu/'+p.id,{method:'PUT',body:p});await loadDelivery();
    toast(t.checked?'«'+esc(p.name)+'» снова в меню':'«'+esc(p.name)+'» → стоп-лист',t.checked?'✅':'⛔');}
  catch(err){toast(err.message,'⚠️');loadDelivery();}
});

loadPromos=async function(){try{var r=await api('/promos');
  document.getElementById('pmList').innerHTML=r.promos.map(function(p){
    var exp=p.expires?new Date(p.expires).toLocaleDateString('ru-RU'):'бессрочно';
    var dead=p.expires&&new Date(p.expires)<new Date();
    var kind=p.kind==='stamp'?'+'+p.value+' штамп(а) 🌊':p.kind==='free'?'+'+p.value+' кофе 🌊':p.kind==='percent'?'−'+p.value+'% 🍕':'−'+p.value+' ₽ 🍕';
    return '<div class="logrow" style="align-items:center;gap:8px;flex-wrap:wrap">'+
      '<span class="lt">'+esc(p.code)+'</span>'+
      '<span style="flex:1;min-width:150px">'+kind+' · '+(dead?'истёк':'до '+exp)+' · лимит '+(p.maxuses||'∞')+' · исп. '+p.uses+'</span>'+
      '<button class="btn ghost" data-pt="'+p.id+'">'+(p.active?'Выкл':'Вкл')+'</button>'+
      '<button class="btn ghost danger" data-pd="'+p.id+'">🗑</button></div>';}).join('')
  ||'<div class="hmini">Пока пусто — создайте первый код</div>';}catch(e){}};
if(typeof renderMenu==='function'){renderMenu=(function(_rm){return function(){
  if(typeof MENU==='undefined'||!Array.isArray(MENU))return;
  return _rm.apply(this,arguments);};})(renderMenu);}
if(typeof renderRail==='function'){renderRail=(function(_rr){return function(){
  if(typeof MENU==='undefined'||!Array.isArray(MENU))return;
  return _rr.apply(this,arguments);};})(renderRail);}
if(typeof loadMenu==='function'){loadMenu=(function(_lm){return async function(){
  var r=await _lm.apply(this,arguments);
  try{if(brand==='coffee'){renderRail();renderMenu();}}catch(e){}
  return r;};})(loadMenu);}

/* ========== 6. Профиль и бонусы ========== */
function relink(){document.querySelectorAll('a[href*="t.me/and_coffee_bot"]').forEach(function(a){a.href='https://t.me/'+(window.TG_USERNAME||'and_coffee_bot');});}
renderVerifyNote=function(){
  var host=document.getElementById('bonusBox');
  var n=document.getElementById('verifyNote');
  if(!n&&host){n=document.createElement('div');n.id='verifyNote';host.insertBefore(n,host.firstChild);}
  if(!n)return;
  if(!me){n.hidden=true;return;}
  var html='<small style="color:#5B6B7A;background:#EDF2F6;border-radius:12px;padding:8px 12px;display:block;margin-bottom:8px">Как устроены бонусы:<br>🫘 штампы — кассир начисляет по вашему QR<br>🎁 +1 штамп — привязка Telegram<br>🧾 активация профиля — код из 4 цифр на кассе</small>';
  if(!me.verified)html+='<small style="color:#8A4B2A;background:#FFF6F0;border:1.5px dashed #E4B49A;border-radius:12px;padding:8px 12px;display:block;margin-bottom:8px">🧾 Кассир назовёт 4 цифры кода активации — введите их:</small><div style="display:flex;gap:8px"><input id="actCode" inputmode="numeric" maxlength="4" placeholder="Код" style="flex:1"><button class="btn fire" id="actBtn">Активировать</button></div>';
  if(!me.welcome&&!me.tg)html+='<small style="color:#163B6B;background:#EAF1F9;border:1.5px dashed #B9CDE4;border-radius:12px;padding:8px 12px;display:block;margin-top:8px">🎁 <b>+1 штамп</b> за привязку в <a href="https://t.me/and_coffee_bot" style="color:#1F4E8C;font-weight:800">Telegram</a>: откройте бота и нажмите «Поделиться номером»</small>';
  n.hidden=(brand==='delivery');
  n.innerHTML=html;
  relink();
  var ab=document.getElementById('actBtn');
  if(ab)ab.onclick=async function(){try{var r=await api('/auth/activate-guest',{method:'POST',body:{code:document.getElementById('actCode').value.trim()}});me=r.customer;toast('Профиль активирован! А +1 штамп ждёт в Telegram 🎁','');renderAll();}catch(e){toast(e.message,'⚠️');}};
};
renderProfile=(function(_rp){return function(){var r=_rp();
  var deliv=(brand==='delivery');
  var q=document.getElementById('qrMain');var qb=q&&q.closest('.qrbox');
  if(qb)qb.style.display=deliv?'none':'';
  var st=document.querySelector('#profileBox .stats');
  if(st)st.style.display=deliv?'none':'';
  if(me)loadMyOrders();
  return r;};})(renderProfile);

/* ========== 7. Сотрудники: активации и журнал ========== Ф3.13b: перенесено в public/app/orders.js ========== */
/* ========== 8. Сплэш бренда ========== Ф3.13a: перенесено в public/app/core/splash.js ========== */
/* ========== 9. Чат: ядро ========== Ф3.11: перенесено в public/app/chat-core.js ========== */
/* ========== 10. Поддержка: оверлей выбора темы ========== Ф3.12: перенесено в public/app/chat-core.js ========== */
/* ========== 11. Пуши: самовосстановление подписки ========== Ф3.14a: перенесено в public/app/core/push.js ========== */
/* ========== 12. Живые обновления ========== Ф3.14b: перенесено в public/app/live.js ========== */
/* ========== 13. Диплинки и Telegram Mini App (надёжная версия) ========== */
(function(){
var bP=QS.get('brand'),tab=QS.get('tab');
if(!bP&&!tab)return;
function openOrdersView(){
try{
if(brand!=='delivery'){
brand='delivery';
document.querySelectorAll('#brandSeg button').forEach(function(x){x.classList.toggle('on',x.dataset.brand===brand);});
sv();
if(!DMENU.length)loadDelivery();
}
openPanel('profile');
setTab('profile');
try{renderProfile();}catch(e){}
try{loadMyOrders();}catch(e){}
/* страховка от пустой шторки */
setTimeout(function(){
var pv=document.getElementById('pvProfile');
if(pv&&!pv.hidden){
var nu=document.getElementById('profileNoUser'),pb=document.getElementById('profileBox');
if(nu&&nu.hidden&&pb&&pb.hidden){try{renderProfile();}catch(e){}}
}
},600);
}catch(e){}
}
function apply(){
try{
if(bP&&bP!==brand){
brand=bP;
document.querySelectorAll('#brandSeg button').forEach(function(x){x.classList.toggle('on',x.dataset.brand===brand);});
sv();
if(brand==='delivery'&&!DMENU.length)loadDelivery();
}
if(tab==='orders'){
if(me){openOrdersView();}
else{window.__ztPendingDeep='orders';openAuth();}
}
if(tab==='bonus'){
if(me){openPanel('profile');setTab('bonus');}
else{window.__ztPendingDeep='bonus';openAuth();}
}
if(tab==='chat'){/* поддержку разбирает секция 10 */}
}catch(e){}
}
/* ждём бут: me либо однозначное "не залогинен" */
var t0=Date.now(),iv=setInterval(function(){
var ready=(typeof me!=='undefined'&&(me||!localStorage.getItem('zt_user')));
if(ready||Date.now()-t0>4000){clearInterval(iv);apply();}
},150);
/* после успешного логина продолжаем диплинк автоматически */
if(typeof setUser==='function'&&!setUser.__deepWrap){
setUser=(function(_su){return function(t,c){
var r=_su.apply(this,arguments);
var pend=window.__ztPendingDeep;window.__ztPendingDeep=null;
if(pend==='orders')setTimeout(openOrdersView,150);
if(pend==='bonus')setTimeout(function(){openPanel('profile');setTab('bonus');},150);
return r;};})(setUser);
setUser.__deepWrap=1;
}
history.replaceState(null,'',location.pathname);
})();
/* ========== 14. Конфиг: ссылки на бота → public/app/core/config.js (Ф3.10b) ========== */

/* ── v51: стабильные классы шапки чата → public/app/core/chat-head.js (Ф3.10a) ── */
/* ══ v61 ВОССТАНОВЛЕНИЕ: один блок, одна реализация на фичу. Фаза 2 — свернём в app.js ══ */
(function(){
'use strict';
var $=function(s){return document.querySelector(s);};
var $$=function(s){return Array.prototype.slice.call(document.querySelectorAll(s));};

/* R0. CSS */
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
'#redeemStats{margin:12px 0;padding:14px;background:#fff;border:1.5px solid var(--line);border-radius:14px}'+
'#redeemStats h4{margin:0 0 10px;font-size:14px}'+
'#redeemStats .rsRow{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px dashed var(--line);font-size:13px}'+
'#redeemStats .rsRow:last-child{border-bottom:none}'+
'#redeemStats b{color:var(--flame)}'+
'#ctxDrop button.on{background:#FFF6E5}';
document.head.appendChild(css);

/* R1. Пилюля смены заведения: удалено (Ф3.11-cleanup) */

/* ══ каналы уведомлений: единое применение без перезагрузок ══ */
function syncNotifyAll(){
if(!me)return;
[['ntTg','ntWeb'],['ntTg2','ntWeb2']].forEach(function(pr){
var t=document.getElementById(pr[0]),w=document.getElementById(pr[1]);
if(t)t.checked=me.notify_tg!==0;
if(w)w.checked=me.notify_web!==0;
});
}
window.syncNotifyAll=syncNotifyAll;
window.applyNotify=async function(tg,web){
try{
var r=await api('/me/notify',{method:'PUT',body:{tg:tg?1:0,web:web?1:0}});
if(r&&r.customer&&me){me.notify_tg=r.customer.notify_tg;me.notify_web=r.customer.notify_web;}
syncNotifyAll();
var where=(tg&&web)?'Пуши придут в оба канала':(tg?'Пуши придут только в Telegram':(web?'Пуши придут только в браузер':'Пуши выключены — верни каналы в любой момент'));
toast('✅ Сохранено: Telegram — '+(tg?'вкл':'выкл')+', браузер — '+(web?'вкл':'выкл')+'. '+where,'🔔');
}catch(e){toast(e.message,'⚠️');syncNotifyAll();}
};

/* R3. Каналы уведомлений */
function syncNotifyUI(){
  if(!me)return;
  var t=$('#ntTg'),w=$('#ntWeb');
  if(t)t.checked=me.notify_tg!==0;
  if(w)w.checked=me.notify_web!==0;
}
(function(){
  var pb=$('#profileBox');if(!pb||$('#notifyDetails'))return;
  var d=document.createElement('details');d.id='notifyDetails';
  d.innerHTML='<summary>🔔 Каналы уведомлений</summary>'+
    '<div style="display:flex;gap:16px;margin-top:8px;flex-wrap:wrap">'+
    '<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="ntTg"> 🤖 Telegram</label>'+
    '<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="ntWeb"> 🔔 Пуши браузера</label></div>';
  pb.appendChild(d);
  d.addEventListener('change',function(){window.applyNotify($('#ntTg').checked,$('#ntWeb').checked);});
})();
['profileTopBtn','mbonusBtn'].forEach(function(id){
  var b=$('#'+id);if(b)b.addEventListener('click',function(){setTimeout(syncNotifyUI,120);});
});

/* R4. Профиль: инфо-блок пятницы + брендовые скрытия */
(function(){
  var pb=$('#profileBox');if(!pb||$('#fridayInfo'))return;
  var d=document.createElement('div');d.id='fridayInfo';
  d.innerHTML='<b>Пятница — доставка пиццы и роллов</b>п. Янтарный, ул. Советская, 38А (самовывоз)<br>Ежедневно 11:00–22:00 · доставка ~45 мин<br>🌐 <a href="https://vk.ru/fridaypizza39" target="_blank" style="color:#1F4E8C;font-weight:800">vk.ru/fridaypizza39</a><br>⭐ <a href="https://yandex.ru/maps/org/pyatnitsa/33658031357/reviews/" target="_blank" style="color:#1F4E8C;font-weight:800">отзывы на Яндекс Картах</a><br><a href="https://yandex.ru/maps/org/pyatnitsa/33658031357/reviews/?add-review=true" target="_blank" class="btn fire" style="margin-top:10px;display:inline-block">⭐ Оставить отзыв</a>';
  var hist=$$('#profileBox h4').filter(function(h){return /История/.test(h.textContent);})[0];
  if(hist)pb.insertBefore(d,hist);else pb.appendChild(d);
})();
function applyProfileBrand(){
  var deliv=(brand==='delivery');
  var fi=$('#fridayInfo');if(fi)fi.style.display=deliv?'':'none';
  $$('#profileBox .placebox').forEach(function(p){
    if(/Мы у моря|Понравилось у нас/.test(p.textContent))p.style.display=deliv?'none':'';
  });
  $$('#profileBox a').forEach(function(a){
    if(/instagram\.com|t\.me\/and_coffee39/.test(a.href||''))a.style.display=deliv?'none':'';
  });
  syncNotifyUI();
}
document.getElementById('brandSeg').addEventListener('click',function(){setTimeout(applyProfileBrand,60);});

/* R5. Тикер и логотип по бренду */
var BRAND_ORIG_LOGO=null;
function applyBrandChrome(){
  var deliv=(brand==='delivery');
  var track=$('#tickerTrack');
  if(track){
    var L=deliv?['Пятница — доставка пиццы и роллов','Ежедневно 11:00–22:00','Доставка ~45 мин','vk.ru/fridaypizza39','Каждые 2000 ₽ в чеке — 0,5 пива в подарок']
               :['кофейня на берегу моря …и кофе','каждый 10-й кофе — бесплатно','п. Янтарный, Советская 70г','t.me/and_coffee39','ежедневно с 8:00–21:00'];
    track.innerHTML=L.concat(L).map(function(x){return '<span>'+x+'</span>';}).join('');
  }
  var br=document.querySelector('.topbar .brand');
  if(br){
    if(BRAND_ORIG_LOGO===null)BRAND_ORIG_LOGO=br.innerHTML;
    if(deliv)br.innerHTML='<img src="friday-logo.png" alt="Пятница" onerror="this.outerHTML=\'<span style=&quot;font-size:26px&quot;>🍕</span>\'"><div><b>Пятница</b><small>доставка пиццы и роллов</small></div>';
    else br.innerHTML=BRAND_ORIG_LOGO;
  }
}
document.getElementById('brandSeg').addEventListener('click',function(){setTimeout(applyBrandChrome,60);});

/* R6. Согласие с политикой при регистрации */
(function(){
  var form=$('#regForm');if(!form||$('#consentRow'))return;
  var lab=document.createElement('label');lab.id='consentRow';lab.className='chk';
  lab.innerHTML='<input type="checkbox" id="consentBox"><span>Согласен с <a href="/privacy.html" target="_blank" style="color:#1F4E8C">политикой конфиденциальности</a> и обработкой персональных данных</span>';
  var btn=$('#regBtn');if(btn)form.insertBefore(lab,btn);
})();
document.addEventListener('click',function(e){
  var b=e.target.closest('#regBtn');if(!b)return;
  var cb=$('#consentBox');
  if(cb&&!cb.checked){e.stopImmediatePropagation();e.preventDefault();toast('Отметь согласие с политикой конфиденциальности','⚠️');}
},true);
(function(){var _f=window.fetch;window.fetch=function(u,o){ /* слой consent поверх fetch-патча v50 */
  try{
    if(o&&o.body&&typeof o.body==='string'&&String(u).indexOf('/api/auth/register')>-1){
      var b=JSON.parse(o.body);var cb=$('#consentBox');b.consent=(cb&&cb.checked)?1:0;
      o=Object.assign({},o,{body:JSON.stringify(b)});
    }
  }catch(e){}
  return _f.call(this,u,o);};})();

/* R7. Кассир: без «Последних событий», без дубля «Новый гость» */
function cashierClean(){
  var cl=$('#cashLog');if(cl){var card=cl.closest('.cash-card');if(card)card.style.display='none';}
  var ng2=$('#newGuestBtn2');if(ng2)ng2.style.display='none';
}
new MutationObserver(function(){
  var cv=$('#cashierView');if(cv&&!cv.hidden)cashierClean();
}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});

/* R8. Редактор пятницы: карандаши + тумблер «в меню» */
function injectEdits(){
  if(!document.body.classList.contains('editing'))return;
  $$('#deliveryGrid [data-add]').forEach(function(add){
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
new MutationObserver(function(){injectEdits();}).observe($('#deliveryGrid')||document.body,{childList:true,subtree:true});
document.getElementById('editToggle').addEventListener('click',function(){setTimeout(injectEdits,80);setTimeout(injectEdits,400);});
document.addEventListener('click',function(e){
  var b=e.target.closest('#deliveryGrid .edBtn');if(!b)return;
  e.stopPropagation();e.preventDefault();
  var id=b.getAttribute('data-ed');
  if(id&&typeof openEditor==='function'){
    openEditor(id);
  }
},true);
document.getElementById('deliveryGrid').addEventListener('change',async function(e){
  var t=e.target.closest('.donoff [data-onoff]');if(!t)return;
  e.stopPropagation();
  var id=t.getAttribute('data-onoff');
  var p=(window.DMENU||[]).find(function(x){return x.id===id;});
  if(!p)return;
  p.on=t.checked?1:0;
  try{
    await api('/menu/'+p.id,{method:'PUT',body:p});
    await loadDelivery();
    toast(t.checked?'«'+esc(p.name)+'» снова в меню':'«'+esc(p.name)+'» → стоп-лист',t.checked?'✅':'⛔');
  }catch(err){
    toast(err.message,'⚠️');
    loadDelivery();
  }
},true);

/* R9. Списание свободного кофе с выбором напитка */
showCust=(function(_sc){return function(u,last){window.__foundId=u&&u.id;return _sc(u,last);};})(showCust);
(function(){
  if($('#redeemPick'))return;
  var m=document.createElement('div');m.id='redeemPick';
  m.innerHTML='<div class="omCard" style="max-width:420px"><button type="button" class="omClose">✕</button><h3 style="margin:0 0 12px">🎁 Какой кофе списать?</h3><div id="rpList" style="display:grid;gap:8px"></div></div>';
  document.body.appendChild(m);
  m.addEventListener('click',function(e){if(e.target===m||e.target.closest('.omClose'))m.classList.remove('show');});
  $('#rpList').innerHTML=['Эспрессо','Американо','Капучино','Латте','Флэт уайт','Батч брю'].map(function(n){return '<button type="button" class="btn ghost" data-rp="'+n+'" style="width:100%">'+n+'</button>';}).join('');
  m.addEventListener('click',async function(e){
    var b=e.target.closest('[data-rp]');if(!b)return;
    var id=window.__foundId;if(!id)return toast('Гость не найден','⚠️');
    try{var r=await api('/staff/redeem',{method:'POST',body:{id:id,item:b.dataset.rp}});
      m.classList.remove('show');toast('Списано: '+b.dataset.rp,'🎁');
      try{showCust(r.customer);}catch(e2){}
    }catch(err){toast(err.message,'⚠️');}
  });
  var rb=$('#redeemBtn');
  if(rb)rb.addEventListener('click',function(e){
    e.stopImmediatePropagation();e.preventDefault();
    $('#redeemPick').classList.add('show');
  },true);
})();

/* R10. Диспетчер: задержка доставки */
(function(){
  var top=document.querySelector('#ordersView .cash-top');
  if(top&&!$('#delayAllBox')){
    var d=document.createElement('div');d.id='delayAllBox';d.className='delayBtns';
    d.innerHTML='<b>Задержать все:</b><button type="button" data-dlyall="15">+15 мин</button><button type="button" data-dlyall="30">+30 мин</button>';
    top.appendChild(d);
  }
  /* статистика списаний — в дашборде, разбивкой по напиткам */
document.getElementById('dashToggle').addEventListener('click', function(){
  setTimeout(async function(){
    try{
      var r = await api('/stats/redeems');
      var host = $('#dashMore'); if(!host) return;
      var old = document.getElementById('dashRedeems'); if(old) old.remove();
      var items = Object.entries(r.byItem || {}).sort(function(a,b){return b[1]-a[1];});
      var d = document.createElement('div'); d.id='dashRedeems';
      d.innerHTML = '<div class="hmini" style="margin-top:8px">🎁 Списано бесплатных кофе за 30 дней: <b>'+r.total+'</b>'+
        (items.length ? ' · '+items.map(function(e){return esc(e[0])+' ×'+e[1];}).join(', ') : '')+'</div>';
      host.appendChild(d);
    }catch(e){}
  }, 700);
});
})();
function injectDelay(){
  if(mode!=='orders')return;
  $$('#ordersList .orderCard').forEach(function(card){
    if(card.querySelector('.delayBtns'))return;
    if(/Выполнен|Отменён/.test(card.textContent))return;
    var oid=card.dataset.oid;if(!oid)return;
    var d=document.createElement('div');d.className='delayBtns';
    d.innerHTML='<button type="button" data-dly="15" data-oid="'+oid+'">⏰ +15 мин</button><button type="button" data-dly="30" data-oid="'+oid+'">⏰ +30 мин</button>';
    card.appendChild(d);
  });
}
new MutationObserver(function(){injectDelay();}).observe($('#ordersList')||document.body,{childList:true,subtree:true});
document.addEventListener('click',async function(e){
  var b=e.target.closest('[data-dly],[data-dlyall]');if(!b)return;
  e.stopPropagation();e.preventDefault();
  var comment=prompt('Причина задержки (необязательно):','');
  if(comment===null)return;               // отмена = без пуша
  var min=+(b.dataset.dly||b.dataset.dlyall);
  try{
    if(b.dataset.dly)await api('/orders/'+b.dataset.oid+'/delay',{method:'POST',body:{min:min,comment:comment}});
    else{var r=await api('/orders/delay-all',{method:'POST',body:{min:min,comment:comment}});toast('Уведомлено заказов: '+r.count,'⏰');}
    renderOrders(true);
  }catch(err){toast(err.message,'⚠️');}
},true);

setTimeout(function(){applyProfileBrand();applyBrandChrome();cashierClean();injectEdits();syncNotifyUI();},400);
console.log('fix-views v61 восстановление готов');
})();
/* ══ v62: стоп-лист/фото/тумблер/тикер/заказы в профиле — один блок ══ */
(function(){
var css=document.createElement('style');
css.textContent=
'#deliveryGrid .card .media img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;display:block}';
document.head.appendChild(css);

function patchCards(){
var list=(typeof DMENU!=='undefined'?DMENU:[]).filter(function(p){return p.cat===(typeof dcat!=='undefined'?dcat:'pizza');});
var cards=document.querySelectorAll('#deliveryGrid .card');
var editing=document.body.classList.contains('editing');
cards.forEach(function(card,i){
var p=list[i];if(!p)return;
/* вид СТОП */
card.classList.toggle('stopped',!p.on);
var media=card.querySelector('.media');
if(media){
var sb=media.querySelector('.stopbadge');
if(!p.on&&!sb){sb=document.createElement('span');sb.className='stopbadge';sb.textContent='СТОП';media.appendChild(sb);}
if(p.on&&sb)sb.remove();
/* фото в карточке */
if(p.img&&!media.querySelector('img')){var em=media.querySelector('.em');if(em)em.remove();
var im=document.createElement('img');im.src=p.img;im.alt=p.name||'';media.appendChild(im);}
}
/* стоп не добавить в корзину */
var add=card.querySelector('[data-add]');
if(add){
if(!p.on){add.disabled=true;add.style.opacity='.45';add.style.pointerEvents='none';add.textContent='СТОП — недоступно';}
else if(add.disabled){add.disabled=false;add.style.opacity='';add.style.pointerEvents='';add.textContent='Добавить';}
}
/* карандаш + тумблер в режиме правки, с реальным состоянием */
if(editing){
card.style.position='relative';
if(!card.querySelector('.edBtn')){var b=document.createElement('button');b.type='button';b.className='edBtn';b.dataset.ed=p.id;b.textContent='✏️';card.appendChild(b);}
var lab=card.querySelector('.donoff');
if(!lab){lab=document.createElement('label');lab.className='donoff';lab.innerHTML='<input type="checkbox" data-onoff="'+p.id+'">в меню';card.appendChild(lab);}
lab.querySelector('input').checked=!!p.on;
}else{
var d2=card.querySelector('.donoff');if(d2)d2.remove();
var e2=card.querySelector('.edBtn');if(e2)e2.remove();
}
});
}
renderDeliveryMenu=(function(_rm){return function(){var r=_rm();try{patchCards();}catch(e){}return r;};})(renderDeliveryMenu);

/* тумблер: capture-обработчик на реальном DMENU (window.DMENU не существует) */
document.getElementById('deliveryGrid').addEventListener('change',async function(e){
var t=e.target.closest('.donoff [data-onoff]');if(!t)return;
e.stopPropagation();
var p=(typeof DMENU!=='undefined'?DMENU:[]).find(function(x){return x.id===t.getAttribute('data-onoff');});if(!p)return;
p.on=t.checked?1:0;
try{await api('/menu/'+p.id,{method:'PUT',body:p});await loadDelivery();
toast(t.checked?'«'+esc(p.name)+'» снова в меню':'«'+esc(p.name)+'» → стоп-лист',t.checked?'✅':'⛔');}
catch(err){toast(err.message,'⚠️');loadDelivery();}
},true);

/* страховка: клик «Добавить» по стоп-позиции */
document.getElementById('deliveryGrid').addEventListener('click',function(e){
var add=e.target.closest('[data-add]');if(!add)return;
var p=(typeof DMENU!=='undefined'?DMENU:[]).find(function(x){return x.id===add.getAttribute('data-add');});
if(p&&!p.on){e.stopPropagation();e.preventDefault();toast('Позиция в стоп-листе — недоступна для заказа','⛔');}
},true);

/* профиль кофейни: без «Мои заказы» и последней карточки заказа */
renderProfile=(function(_rp){return function(){var r=_rp();
var show=(typeof brand!=='undefined'&&brand==='delivery');
var mo=document.getElementById('myOrders');if(mo)mo.style.display=show?'':'none';
var mb=document.getElementById('myOrdersBtn');if(mb)mb.style.display=show?'':'none';
return r;};})(renderProfile);

setTimeout(patchCards,300);
})();
/* ══ v62: FAB/модалки/z, настройки-шестерёнка, поиск в Пятнице, журнал кассира (кофе), закрытие карточки гостя, статичный сплэш ══ */
(function(){
/* статичный сплэш: обработчик + удаление после выбора */
/* Ф3.4: перенесено в public/app/ui/settings.js */
/* Ф3.4: перенесено в public/app/ui/delivery-search.js */
/* Ф3.4: перенесено в public/app/ui/cashier-log.js */
/* Ф3.4: перенесено в public/app/ui/cashier-card.js */
/* выход из карточки гостя (закрыть режим начисления) */
(function(){
var acts=document.querySelector('#custCard .acts');
if(!acts||document.getElementById('custClose'))return;
var b=document.createElement('button');b.id='custClose';b.className='btn ghost';b.textContent='✕ Закрыть карточку';
b.onclick=function(){document.getElementById('custCard').classList.remove('show');try{found=null;}catch(e){}};
acts.appendChild(b);
})();
})();
/* оверлей: поднимать над шторкой, когда открыта модалка; убирать залипший show */
setInterval(function(){
  var ov=document.getElementById('overlay');if(!ov)return;
  var modalOpen=!!document.querySelector('.modal.show');
  var panelOpen=document.getElementById('panel').classList.contains('open');
  if(ov.classList.contains('show')&&!modalOpen&&!panelOpen)ov.classList.remove('show');
  ov.classList.toggle('ov-high',modalOpen);
},400);
/* Ф3.4: перенесено в public/app/ui/settings.js */
/* Ф3.4: перенесено в public/app/ui/cashier-log.js */
/* ══ v64: профиль окончательно — брендовые правила + шестерёнка/настройки на мобильных ══ */
(function(){
var $=function(s){return document.querySelector(s);};
var $$=function(s){return Array.prototype.slice.call(document.querySelectorAll(s));};
function histH4(){return $$('#profileBox h4').filter(function(h){return /История/i.test(h.textContent);})[0]||null;}
function profileBrandRules(){
  var deliv=(typeof brand!=='undefined'&&brand==='delivery');
  var mo=$('#myOrders'),mb=$('#myOrdersBtn'),fi=$('#fridayInfo');
  if(mo)mo.style.display=deliv?'':'none';
  if(mb)mb.style.display=deliv?'':'none';
  $$('#profileBox .placebox').forEach(function(p){
    var t=p.textContent||'';
    if(/Мы у моря/i.test(t))p.style.display=deliv?'none':'';
    if(/Понравилось у нас/i.test(t))p.style.display=deliv?'none':'';
  });
  $$('#profileBox a').forEach(function(a){
    if(/instagram\.com|t\.me\/and_coffee39/i.test(a.href||''))a.style.display=deliv?'none':'';
  });
  if(fi){
    fi.style.display=deliv?'':'none';
    if(deliv){var h=histH4();if(h&&fi!==h.previousSibling)h.parentNode.insertBefore(fi,h);}
  }
}
renderProfile=(function(_rp){return function(){var r=_rp.apply(this,arguments);profileBrandRules();return r;};})(renderProfile);
document.getElementById('brandSeg').addEventListener('click',function(){setTimeout(profileBrandRules,80);});
new MutationObserver(function(){profileBrandRules();}).observe($('#myOrders')||document.body,{childList:true,subtree:true});
/* Ф3.4: перенесено в public/app/ui/settings.js */
setTimeout(profileBrandRules,300);
})();
/* ══ v66: ЕДИНЫЙ контроллер оверлея (модалка 340 / корзина 120 / шторка 320) ══ */
(function(){
var css=document.createElement('style');
css.textContent=
'.modal{z-index:340!important}'+
'#settingsModal,#ordersModal,#redeemPick{z-index:345!important}'+
'#panel.open{z-index:320!important}'+
'.cartPanel{z-index:120!important}';
document.head.appendChild(css);
var histPushed66=false;
function state(){
var modal=document.querySelector('.modal.show');
var cart=document.getElementById('cartPanel');
var panel=document.getElementById('panel');
return {modal:modal,
cartOpen:!!(cart&&cart.classList.contains('open')),
panelOpen:!!(panel&&panel.classList.contains('open'))};
}
function apply(){
var ov=document.getElementById('overlay');if(!ov)return;
var s=state();
var on=!!s.modal||s.cartOpen||s.panelOpen;
ov.classList.toggle('show',on);
ov.style.pointerEvents=on?'auto':'none';
ov.style.zIndex=s.modal?330:(s.cartOpen?110:310);
if(on&&!histPushed66){histPushed66=true;try{history.pushState({zerno:1},'');}catch(e){}}
else if(!on&&histPushed66){histPushed66=false;try{history.back();}catch(e){}}
}
window.syncOverlay=apply;
var ov=document.getElementById('overlay');
if(ov){var oldClick=ov.onclick;
ov.onclick=function(e){
var s=state();
if(s.cartOpen&&!s.modal&&!s.panelOpen)document.getElementById('cartPanel').classList.remove('open');
if(typeof oldClick==='function')oldClick.call(this,e);
apply();
};}
new MutationObserver(apply).observe(document.body,{subtree:true,attributes:true,attributeFilter:['class']});
apply();
})();
/* ══ v67: тап по фону закрывает только верхнюю модалку; сброс только в шестерёнке; свайп вправо закрывает профиль ══ */
(function(){
/* 1) оверлей: закрываем только верхнюю модалку, профиль не трогаем */
var ov=document.getElementById('overlay');
if(ov){
var prev=ov.onclick;
var CLOSE={emModal:'closeEditor',authModal:'closeAuth',pinModal:'closePin',setPinModal:'closeSetPin',qrModal:'closeQRFull',promoModal:'closePromo',dashModal:'closeDash',staffChatModal:'closeStaffChat'};
ov.onclick=function(e){
var m=document.querySelector('.modal.show');
if(m){
if(m.id==='settingsModal'){m.classList.remove('show');}
else{var fn=CLOSE[m.id];if(typeof window[fn]==='function')window[fn]();else m.classList.remove('show');}
if(typeof window.syncOverlay==='function')window.syncOverlay();
return;
}
if(typeof prev==='function')return prev.call(this,e);
};
}
/* 2) сброс: убираем дубль внизу профиля, в шестерёнке — понятное имя */
var rb=document.getElementById('resetBtn');
if(rb){
rb.style.display='none';
rb.onclick=function(){
if(!confirm('Выйти из профиля и очистить кэш на этом устройстве?\nШтампы, заказы и подарки останутся на сервере.'))return;
localStorage.clear();location.reload();
};
}
var rg=document.getElementById('resetGo2');
if(rg){
var row=rg.closest('.set-row');
if(row){var sp=row.querySelector('span');if(sp)sp.textContent='🚪 Выйти и очистить данные этого устройства';}
}
})();
/* ══ v68: свайп как на iOS — панель идёт за пальцем, отпускание решает ══ */
(function(){
var css=document.createElement('style');
css.textContent=
'@media(max-width:1180px){'+
'#panel.open.swipe-hint{animation:panelNudge 1.1s cubic-bezier(.3,1.4,.4,1) 1}'+
'@keyframes panelNudge{0%{transform:none}30%{transform:translateX(-18px)}60%{transform:translateX(6px)}100%{transform:none}}'+
'.swipeHintChip{position:fixed;left:10px;top:50%;z-index:330;background:rgba(16,20,24,.78);color:#fff;border-radius:999px;padding:8px 12px;font-size:12px;font-weight:700;pointer-events:none;animation:hintFade 1.6s forwards}'+
'@keyframes hintFade{0%{opacity:0;transform:translateY(-50%) translateX(-8px)}20%{opacity:1;transform:translateY(-50%)}80%{opacity:1;transform:translateY(-50%)}100%{opacity:0;transform:translateY(-50%) translateX(-8px)}}'+
'}';
document.head.appendChild(css);
var p=document.getElementById('panel');if(!p)return;
var ov=document.getElementById('overlay');
var W=function(){return p.getBoundingClientRect().width||innerWidth;};
var sx=0,sy=0,dx=0,dy=0,axis=null,tracking=false,active=false,lastX=0,lastT=0,vel=0;
function setT(x){p.style.setProperty('transform','translateX('+x+'px)','important');}
function setOv(op){if(ov){ov.style.transition='none';ov.style.opacity=String(op);}}
function cleanup(){p.style.removeProperty('transform');p.style.transition='';if(ov){ov.style.transition='';ov.style.opacity='';}}
p.addEventListener('touchstart',function(e){
if(window.innerWidth>1180||!p.classList.contains('open'))return;
if(e.touches.length!==1)return;
var t=e.touches[0];sx=t.clientX;sy=t.clientY;lastX=sx;lastT=Date.now();
dx=0;dy=0;axis=null;active=false;tracking=true;vel=0;
},{passive:true});
p.addEventListener('touchmove',function(e){
if(!tracking)return;
var t=e.touches[0];dx=t.clientX-sx;dy=t.clientY-sy;
if(!axis){
if(Math.abs(dx)<7&&Math.abs(dy)<7)return;
axis=Math.abs(dx)>Math.abs(dy)?'x':'y';
if(axis==='y'){tracking=false;return;}   // вертикаль — не мешаем скроллу
active=true;p.style.transition='none';
}
if(!active)return;
if(dx<0)dx=0;
var w=W();if(dx>w)dx=w;
setT(dx);
setOv(1-dx/w);                          // подложка гаснет за пальцем
var now=Date.now(),dt=now-lastT;
if(dt>0)vel=0.8*vel+0.2*((t.clientX-lastX)/dt);
lastX=t.clientX;lastT=now;
if(e.cancelable)e.preventDefault();
},{passive:false});
p.addEventListener('touchend',function(){
if(!tracking)return;
tracking=false;
if(!active)return;
active=false;
var w=W();
var shouldClose=dx>Math.min(120,w*0.35)||vel>0.5;   // длина ИЛИ резкость
p.style.transition='transform .32s cubic-bezier(.2,1,.3,1)';
if(ov)ov.style.transition='opacity .32s';
if(shouldClose){
setT(w+24);setOv(0);
setTimeout(function(){
p.classList.remove('open');
if(typeof syncOverlay==='function')syncOverlay();
cleanup();
},330);
}else{
setT(0);setOv(1);
setTimeout(cleanup,330);
}
},{passive:true});
/* одноразовая подсказка «свайп есть» */
function hint(){
if(window.innerWidth>1180)return;
if(sessionStorage.getItem('zt_swipehint'))return;
sessionStorage.setItem('zt_swipehint','1');
p.classList.add('swipe-hint');
var c=document.createElement('div');c.className='swipeHintChip';c.textContent='← свайп закроет профиль';
document.body.appendChild(c);
setTimeout(function(){c.remove();},1700);
p.addEventListener('animationend',function h(){p.classList.remove('swipe-hint');p.removeEventListener('animationend',h);});
}
new MutationObserver(function(){if(p.classList.contains('open'))setTimeout(hint,350);})
.observe(p,{attributes:true,attributeFilter:['class']});
})();
(function(){var s=document.createElement('style');
s.textContent='@media(max-width:1180px){#panel{touch-action:pan-y}}';
document.head.appendChild(s);
})();
/* ══ v68: финальный полиш — a11y, reduced-motion, lazy-img ══ */
/* ══ v69: диплинк заказов: «мой заказ» → фокус на заказе, «мои заказы» → история ══ */
(function(){
var css=document.createElement('style');
css.textContent='.myOrderCard.flash{outline:3px solid rgba(31,78,140,.55);outline-offset:2px;animation:oflash 2.4s}'+
'@keyframes oflash{0%{background:#EAF1F9}100%{background:#fff}}';
document.head.appendChild(css);
if(QS.get('tab')!=='orders')return;
var no=QS.get('no');
var done=false;
function focusCard(){
var cards=document.querySelectorAll('#myOrders .myOrderCard');
if(!cards.length)return false;
var target=null;
if(no){for(var i=0;i<cards.length;i++){if(cards[i].textContent.indexOf('#'+no)>-1){target=cards[i];break;}}}
if(!target)target=cards[0];           /* нет номера — фокус на последнем */
try{target.scrollIntoView({block:'center',behavior:'smooth'});}catch(e){}
target.classList.add('flash');
setTimeout(function(){target.classList.remove('flash');},2400);
return true;
}
function apply(){
if(done||!me)return;
done=true;
if(no){
/* «мой заказ»: профиль + фокус на заказе (с повторами, пока карточки рендерятся) */
setTimeout(function(){if(!focusCard()){setTimeout(focusCard,600);setTimeout(focusCard,1400);}},500);
}else{
/* «мои заказы»: модалка с историей */
setTimeout(function(){if(typeof renderOrdersModal==='function')renderOrdersModal();},500);
}
}
/* ждём: сессия + открытая шторка (в т.ч. после логина по диплинку) */
var iv=setInterval(function(){
if(me&&document.getElementById('panel').classList.contains('open')){clearInterval(iv);apply();}
},250);
setTimeout(function(){clearInterval(iv);},300000);
})();
sv();
})();