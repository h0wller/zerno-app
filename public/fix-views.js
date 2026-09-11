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

/* ========== 4. Корзина ========== */
var cartPromoCode=localStorage.getItem('zt_cartpromo')||'';
var promoInfo=null;
function promoDisc(sum,info){return info.kind==='percent'?Math.round(sum*Math.min(90,info.value)/100):Math.min(info.value||0,sum);}
function totalsNow(){
  var sum=cart.reduce(function(a,c){return a+c.price*c.qty;},0);
  var method=document.getElementById('checkoutMethod').value;
  var pickup=method==='pickup'?Math.round(sum*0.10):0;
  var fee=0;
  if(method==='delivery'&&deliveryInfo){
    var z=deliveryInfo.zones.find(function(z){return z.places.includes(document.getElementById('checkoutPlace').value);});
    fee=z?z.fee:0;
  }
  var pd=promoInfo?promoDisc(sum,promoInfo):0;
  return {sum:sum,pickup:pickup,fee:fee,pd:pd,total:sum-pickup-pd+fee};
}
function paintTotals(){
  var t=totalsNow();
  var el=document.getElementById('cartTotal');if(el)el.textContent=fmt(t.total);
  var s=document.getElementById('cartSum');
  var cnt=cart.reduce(function(a,c){return a+c.qty;},0);
  if(s)s.textContent=cnt+' поз · '+Number(t.total).toLocaleString('ru-RU');
}
updateCartFab=function(){
  var t=totalsNow();
  var fab=document.getElementById('cartFab');
  if(fab)fab.hidden=(t.sum===0);
  paintTotals();
  cartFabShow();
};
async function refreshPromoLine(sum){
  var line=document.getElementById('cartPromoLine');if(!line)return;
  if(!cartPromoCode){promoInfo=null;line.textContent='';paintTotals();return;}
  try{
    var r=await fetch(API_BASE+'/api/promo/info?code='+encodeURIComponent(cartPromoCode)).then(function(x){return x.json();});
    if(r.ok){promoInfo=r;localStorage.setItem('zt_cartpromo',cartPromoCode);
      line.textContent='🎟 '+r.code+': −'+fmt(promoDisc(sum,r));line.style.color='var(--green)';}
    else{promoInfo=null;localStorage.removeItem('zt_cartpromo');cartPromoCode='';
      var typed=(document.getElementById('cartPromo')||{}).value||'';
      if(typed.trim()){line.textContent='⚠️ '+(r.error||'Код не найден');line.style.color='#B3372B';}
      else line.textContent='';}
  }catch(e){}
  paintTotals();
}
function renderAddons(){
  var host=document.getElementById('cartAddons');if(!host)return;
  var list=DMENU.filter(function(p){return p.cat==='sauces'&&p.on;});
  if(!list.length){host.innerHTML='';return;}
  host.innerHTML='<div style="font-size:12px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#8B98A5;margin:0 0 6px">Добавить к заказу</div>'+
    list.map(function(p){
      var inCart=cart.find(function(c){return c.id===p.id;});
      return '<button class="addonChip" data-addon="'+p.id+'">'+(inCart?'<b>×'+inCart.qty+'</b> ':'')+esc(p.name)+' · '+fmt(parseInt(p.price)||0)+'</button>';
    }).join('');
}
renderCart=(function(_rc){return function(){
  var r=_rc();renderAddons();paintTotals();
  var sum=cart.reduce(function(a,c){return a+c.price*c.qty;},0);refreshPromoLine(sum);
  return r;};})(renderCart);
var promoTimer=null;
function clearPromo(){
  cartPromoCode='';promoInfo=null;localStorage.removeItem('zt_cartpromo');
  var line=document.getElementById('cartPromoLine');if(line)line.textContent='';
  paintTotals();
}
var promoInput=document.getElementById('cartPromo');
if(promoInput){
  promoInput.addEventListener('input',function(){
    var v=promoInput.value.trim().toUpperCase();
    if(!v){clearPromo();return;}
    clearTimeout(promoTimer);
    promoTimer=setTimeout(function(){cartPromoCode=v;refreshPromoLine(totalsNow().sum);},400);
  });
}
var promoBtn=document.getElementById('cartPromoBtn');
if(promoBtn)promoBtn.onclick=function(){
  var v=(promoInput?promoInput.value:'').trim().toUpperCase();
  if(!v){clearPromo();return;}
  cartPromoCode=v;refreshPromoLine(totalsNow().sum);
};
document.getElementById('checkoutPlace').addEventListener('change',paintTotals);
document.getElementById('cartPanel').addEventListener('click',function(e){
  var ch=e.target.closest('[data-addon]');if(!ch)return;
  var p=DMENU.find(function(x){return x.id===ch.dataset.addon;});if(!p)return;
  var ex=cart.find(function(c){return c.id===p.id;});
  if(ex)ex.qty++;else cart.push({key:p.id,id:p.id,oi:-1,name:p.name,opt:null,price:parseInt(p.price)||0,sz:0,qty:1});
  localStorage.setItem('zt_cart',JSON.stringify(cart));
  updateCartFab();renderCart();
});
document.getElementById('checkoutBtn').onclick=async function(){
  if(!me){toast('Сначала войдите по номеру','👤');openAuth();return;}
  var method=document.getElementById('checkoutMethod').value;
  if(method==='delivery'){
    if(!document.getElementById('checkoutPlace').value)return toast('Выберите населённый пункт','📍');
    if(!document.getElementById('checkoutAddr').value.trim())return toast('Укажите адрес','🏠');
  }
  var body={method:method,place:document.getElementById('checkoutPlace').value,addr:document.getElementById('checkoutAddr').value.trim(),
    slot:document.getElementById('checkoutSlot').value,pay:document.getElementById('checkoutPay').value,
    comment:document.getElementById('checkoutComment').value.trim(),
    items:cart.map(function(c){return {id:c.id,oi:c.oi,qty:c.qty};})};
  if(cartPromoCode)body.promo=cartPromoCode;
  try{
    var r=await api('/orders',{method:'POST',body:body});
    toast('Заказ #'+r.order.no+' оформлен!','🎉');
    cart=[];localStorage.setItem('zt_cart','[]');
    clearPromo();
    var pi=document.getElementById('cartPromo');if(pi)pi.value='';
    updateCartFab();renderCart();
    document.getElementById('cartPanel').classList.remove('open');
  }catch(e){toast(e.message,'⚠️');}
};
orderCard=(function(_oc){return function(o){
  var h=_oc(o);
  if(o.promo)h=h.replace('<div class="ocTotal">','<div class="ocItems">🎟 Промокод '+esc(o.promo)+': −'+fmt(o.promodiscount||0)+'</div><div class="ocTotal">');
  return h;};})(orderCard);

/* ========== 5. Доставка: меню, редактор, слоты ========== */
loadDelivery=async function(){
  try{
    var r;
    if(me&&me.role==='admin'){
      var all=await api('/menu/all');
      r={items:(all.items||[]).filter(function(p){return p.section==='delivery';})};
    }else{
      r=await api('/dmenu');
    }
    DMENU=r.items||[];
    deliveryInfo=await fetch(API_BASE+'/api/delivery/info').then(function(x){return x.json();});
    var wp=deliveryInfo.weekPromo,pm=deliveryInfo.pizzaMonth;
    var bEl=document.getElementById('deliveryBanner');
    if(bEl)bEl.innerHTML=(wp?'<div class="deliveryBanner">🎁 '+esc(wp.text)+'</div>':'')+
      (pm?'<div class="deliveryBanner">🍕 2 пиццы 35 см → «'+esc(pm.name)+'» в подарок!</div>':'');
    populatePlaces();populateSlots();
    renderDeliveryRail();renderDeliveryMenu();updateCartFab();
  }catch(e){console.log('delivery load err',e);}
};
populateSlots=function(){
  var now=new Date();
  var pad=function(n){return String(n).padStart(2,'0');};
  var slots=[{v:'asap',l:'Как можно скорее (~45 мин)'}];
  for(var d=0;d<2;d++){
    for(var m=660;m<1320;m+=30){
      var t=new Date(now);t.setDate(t.getDate()+d);t.setHours(Math.floor(m/60),m%60,0,0);
      if(t<=now)continue;
      var label=pad(t.getDate())+'-'+pad(t.getMonth()+1)+' | '+pad(t.getHours())+'-'+pad(t.getMinutes());
      slots.push({v:label,l:label});
    }
  }
  var sel=document.getElementById('checkoutSlot');
  if(sel)sel.innerHTML=slots.map(function(s){return '<option value="'+s.v+'">'+s.l+'</option>';}).join('');
};
var DCATSL=[{id:'pizza',e:'🍕',l:'Пиццы'},{id:'rolls',e:'🍣',l:'Роллы'},{id:'sets',e:'🍱',l:'Сеты'},{id:'sauces',e:'🥫',l:'Соусы'}];
renderDeliveryRail=(function(_rr){return function(){_rr();
  var b=document.querySelector('#deliveryRail [data-dcat="sauces"]');if(b)b.remove();
};})(renderDeliveryRail);
renderDeliveryMenu=(function(_rm){return function(){_rm();
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
function editorFields(){
  var isDeliv=(brand==='delivery');
  var isPizza=isDeliv&&edit&&edit.cat==='pizza';
  var pL=document.getElementById('emPrice').closest('label');
  var vL=document.getElementById('emVol').closest('label');
  var cL=document.getElementById('emCoffee').closest('label');
  if(pL)pL.style.display=isPizza?'none':'';
  if(vL)vL.style.display=isPizza?'none':'';
  if(cL)cL.style.display=isDeliv?'none':'';
  var ob=document.getElementById('emOptsBox');if(ob)ob.hidden=!isPizza;
}
openEditor=function(id){
  if(mode!=='admin'||!me||me.role!=='admin')return;
  var pool=(brand==='delivery')?DMENU:MENU;
  var src=id?pool.find(function(x){return x.id===id;}):null;
  edit=src?clone(src):{cat:brand==='delivery'?'pizza':'coffee',e:brand==='delivery'?'🍕':'☕',name:'',desc:'',comp:[],vol:'',price:0,tag:'',coffee:0,on:1,img:null,section:brand==='delivery'?'delivery':'coffee',opts:[]};
  document.getElementById('emTitle').textContent=src?'Редактировать позицию':'Новая позиция';
  document.getElementById('emCat').innerHTML=(brand==='delivery'?DCATSL:CATS).map(function(c){return '<option value="'+c.id+'">'+c.e+' '+c.l+'</option>';}).join('');
  document.getElementById('emName').value=edit.name;
  document.getElementById('emCat').value=edit.cat;
  document.getElementById('emPrice').value=edit.price||'';
  document.getElementById('emVol').value=edit.vol||'';
  document.getElementById('emDesc').value=edit.desc||'';
  document.getElementById('emComp').value=(edit.comp||[]).join(', ');
  document.getElementById('emTag').value=edit.tag||'';
  document.getElementById('emEmoji').value=edit.e||'';
  document.getElementById('emCoffee').checked=!!edit.coffee;
  document.getElementById('emOn').checked=!!edit.on;
  document.getElementById('emDel').style.display=src?'':'none';
  document.getElementById('emDup').style.display=src?'':'none';
  var os=edit.opts||[];
  for(var i=0;i<4;i++){
    var w=document.getElementById('emOpt'+i+'w'),pp=document.getElementById('emOpt'+i+'p');
    if(w)w.value=os[i]?os[i].w.replace(' г',''):'';
    if(pp)pp.value=os[i]?os[i].p:'';
  }
  editorFields();
  renderZone();
  document.getElementById('emModal').classList.add('show');syncOverlay();
  setTimeout(function(){document.getElementById('emName').focus();},150);
};
document.getElementById('emCat').addEventListener('change',function(){if(edit)edit.cat=this.value;editorFields();});
document.getElementById('emSave').onclick=async function(){
  edit.name=document.getElementById('emName').value.trim()||'Без названия';
  edit.vol=document.getElementById('emVol').value.trim();
  edit.desc=document.getElementById('emDesc').value.trim();
  edit.comp=document.getElementById('emComp').value.split(',').map(function(s){return s.trim();}).filter(Boolean);
  edit.tag=document.getElementById('emTag').value;
  edit.e=document.getElementById('emEmoji').value.trim()||(brand==='delivery'?'🍕':'☕');
  edit.coffee=document.getElementById('emCoffee').checked?1:0;
  edit.on=document.getElementById('emOn').checked?1:0;
  edit.cat=document.getElementById('emCat').value;
  if(brand==='delivery'){
    edit.section='delivery';
    if(edit.cat==='pizza'){
      var defs=[['25 см, пышное',25],['35 см, пышное',35],['25 см, тонкое',25],['35 см, тонкое',35]];
      edit.opts=defs.map(function(dd,i){
        var w=document.getElementById('emOpt'+i+'w').value.trim()||'0';
        var p=+document.getElementById('emOpt'+i+'p').value||0;
        return {l:dd[0],w:w+' г',p:p,sz:dd[1]};
      });
      edit.price='0';
    }else{edit.opts=[];edit.price=String(+document.getElementById('emPrice').value||0);}
    try{
      if(edit.id)await api('/menu/'+edit.id,{method:'PUT',body:edit});
      else await api('/menu',{method:'POST',body:edit});
      dcat=edit.cat;
      await loadDelivery();closeEditor();
      toast('«'+esc(edit.name)+'» сохранено · меню доставки обновлено','✅');
    }catch(err){toast(err.message,'⚠️');}
    return;
  }
  var priceRaw=document.getElementById('emPrice').value.trim();
  edit.price=priceRaw.includes('/')?priceRaw:String(Math.max(0,Math.round(Number(priceRaw)||0)));
  edit.section='coffee';
  try{
    if(edit.id)await api('/menu/'+edit.id,{method:'PUT',body:edit});
    else await api('/menu',{method:'POST',body:edit});
    cat=edit.cat;query='';document.getElementById('searchInput').value='';renderRail();
    await loadMenu();closeEditor();
    toast('«'+esc(edit.name)+'» сохранено · меню обновлено для гостей','✅');
  }catch(err){toast(err.message,'⚠️');}
};
document.getElementById('editToggle').onclick=function(){
  editMode=!editMode;
  document.body.classList.toggle('editing',editMode);
  var b=document.getElementById('editToggle');
  b.textContent=editMode?'✔ Готово':'✏️ Редактировать';
  b.classList.toggle('on',editMode);
  if(brand==='delivery')renderDeliveryMenu();else renderMenu();
  if(editMode)toast('Режим редактирования: ✏️ на карточке или тумблер «в меню»','✏️');
};
exitEdit=function(){
  if(!editMode)return;
  editMode=false;document.body.classList.remove('editing');
  var b=document.getElementById('editToggle');
  b.textContent='✏️ Редактировать';b.classList.remove('on');
  if(brand==='delivery')renderDeliveryMenu();else renderMenu();
};
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
loadMyOrders=async function(){
  var host=document.getElementById('myOrders');if(!host||!me)return;
  try{
    var r=await api('/orders/mine');
    var ST={new:['🆕','mo-new','Новый'],accept:['✅','mo-accept','Подтверждён'],cook:['👨🍳','mo-cook','Готовится'],way:['🛵','mo-way','Курьер в пути'],done:['🏁','mo-done','Выполнен'],cancel:['❌','mo-cancel','Отменён']};
    host.innerHTML=r.orders.length?r.orders.slice(0,8).map(function(o){
      var s=ST[o.status]||['•','mo-new',o.status];
      var items=o.items.slice(0,3).map(function(i){return i.qty+'× '+i.name;}).join(', ')+(o.items.length>3?'…':'');
      return '<div class="myOrderCard"><div class="moTop"><span>Заказ #'+o.no+'</span><span class="moSt '+s[1]+'">'+s[0]+' '+s[2]+'</span></div>'+
        '<div class="moSum">'+fmt(o.total)+' · '+new Date(o.created).toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'2-digit'})+'</div>'+
        (items?'<div class="moItems">'+esc(items)+'</div>':'')+
        ((o.gifts&&o.gifts.length)?'<div class="moGifts">🎁 '+o.gifts.map(function(g){return esc(g.name)+' ×'+g.qty;}).join(', ')+'</div>':'')+
        '</div>';
    }).join(''):'<div class="hmini">Заказов пока нет — самое время выбрать пиццу 🍕</div>';
  }catch(e){}
};
renderProfile=(function(_rp){return function(){var r=_rp();
  var deliv=(brand==='delivery');
  var q=document.getElementById('qrMain');var qb=q&&q.closest('.qrbox');
  if(qb)qb.style.display=deliv?'none':'';
  var st=document.querySelector('#profileBox .stats');
  if(st)st.style.display=deliv?'none':'';
  if(me)loadMyOrders();
  return r;};})(renderProfile);

/* ========== 7. Сотрудники: активации и журнал ========== */
loadPending=async function(){
  try{
    var r=await api('/staff/pending');
    var html=r.pending.length?r.pending.map(function(p){
      return '<div class="hmini"><b>'+esc(p.name)+'</b> · '+esc(p.phone)+' · код: <b style="font-size:15px">'+p.actcode+'</b> <button class="btn fire" data-actg="'+p.id+'" style="margin-left:6px;padding:4px 10px;font-size:11px">Активировать</button></div>';
    }).join(''):'<div class="hmini">Все гости активированы ✅</div>';
    var a=document.getElementById('pendingBox');if(a)a.innerHTML=html;
    var b=document.getElementById('pendingBoxD');if(b)b.innerHTML=html;
  }catch(e){}
};
renderOrders=(function(_ro){return async function(s){var r=await _ro(s);loadPending();return r;};})(renderOrders);
document.addEventListener('click',async function(e){
  var b=e.target.closest('[data-actg]');if(!b)return;
  try{await api('/staff/activate-guest',{method:'POST',body:{id:b.dataset.actg}});toast('Гость активирован','✅');loadPending();}
  catch(e2){toast(e2.message,'⚠️');}
});

/* ========== 8. Сплэш бренда ========== */
(function(){
  if(sessionStorage.getItem('splashDone')||DEEP||IN_TG)return;
  var sp=document.createElement('div');sp.id='brandSplash';
  sp.innerHTML='<div class="spInner">'+
    '<div class="spTitle">«Пятница» & …и кофе</div>'+
    '<div class="spSub">Выберите, куда вы сегодня</div>'+
    '<div class="spBtns">'+
    '<button class="spBtn spPizza" data-go="delivery">🍕<br><br>«Пятница»<small>доставка пиццы и роллов</small></button>'+
    '<button class="spBtn spCoffee" data-go="coffee">🌊<br><br>Кофейня<small>меню, штампы и бонусы</small></button>'+
    '</div></div>';
  document.body.appendChild(sp);
  sp.addEventListener('click',function(e){
    var b=e.target.closest('[data-go]');if(!b)return;
    brand=b.dataset.go;
    sessionStorage.setItem('splashDone','1');
    sp.remove();
    if(mode==='cashier'||mode==='orders')setMode('guest');
    document.querySelectorAll('#brandSeg button').forEach(function(x){x.classList.toggle('on',x.dataset.brand===brand);});
    chatCtx=brand;try{localStorage.setItem('zt_chatctx',chatCtx);}catch(err){}
    sv();
    if(brand==='delivery'&&!DMENU.length)loadDelivery();
  });
})();

/* ========== 9. Чат: ядро ========== */
chatKey=(function(_ck){return function(){return _ck()+(chatCtx==='delivery'?':d':':c');};})(chatKey);
(function(){var _f=window.fetch;window.fetch=function(u,o){
  try{
    if(o&&o.body&&typeof o.body==='string'&&String(u).indexOf('/api/chat/send')>-1){
      var b=JSON.parse(o.body);b.ctx=chatCtx||'coffee';o=Object.assign({},o,{body:JSON.stringify(b)});
    }
  }catch(e){}
  var pr=_f.call(this,u,o);
  try{
    if(o&&o.method==='POST'&&String(u).indexOf('/api/push/send')>-1){
      pr.then(function(r){return r.clone().json();}).then(function(j){
        setTimeout(function(){toast('Доставлено: '+j.delivered+' · Ошибок: '+j.failed+((j.errors&&j.errors.length)?' ('+j.errors.join(', ')+')':''),'📬');},300);
      }).catch(function(){});
    }
  }catch(e){}
  return pr;};})();
(function(){var _t=window.toast;var last=0;
  window.toast=function(msg,icon){
    if(typeof msg==='string'&&/Доставлено:/.test(msg)){var n=Date.now();if(n-last<1500)return;last=n;}
    return _t(msg,icon);};})();
function setBotName(){
  var head=document.querySelector('#chatPanel .chatHead')||document.getElementById('chatPanel');
  var name=supportPending?'Ника · поддержка':(chatCtx==='delivery'?'Ника · 🍕 доставка':'Ника · ☕ кофейня');
  if(head){
    var nodes=head.querySelectorAll('div,span,b');
    for(var i=0;i<nodes.length;i++){var el=nodes[i];
      if(el.children.length===0&&/Ника/.test(el.textContent||'')){el.textContent=name;break;}}
  }
  var b=document.getElementById('ctxSwitch');
  if(b)b.textContent=(chatCtx==='delivery'?'🍕':'')+' ▾';
}
function dinfoP(){if(window.__dinfo)return Promise.resolve(window.__dinfo);
  window.__dinfoP=window.__dinfoP||fetch(API_BASE+'/api/delivery/info').then(function(r){return r.json();}).then(function(x){window.__dinfo=x;return x;});
  return window.__dinfoP;}
async function kbAnswer(q,ctx){
  q=(q||'').toLowerCase();
  if(ctx==='delivery'){
    var d=null;try{d=await dinfoP();}catch(e){}
    if(/зон|стоимость достав|сколько стоит достав/.test(q)&&d)return 'Доставка: '+d.zones.map(function(z){return z.places.join(', ')+' — '+z.fee+' ₽';}).join('; ')+'. Самовывоз — бесплатно и −10%.';
    if(/самовывоз/.test(q))return 'Самовывоз: пгт Янтарный, ул. Советская, 38А — и скидка −10% на весь заказ.';
    if(/сколько ждать|время достав|когда привез|часы|до скольки/.test(q))return 'Работаем ежедневно 11:00–22:00, доставка в среднем ~45 минут. При оформлении можно выбрать слот «ко времени».';
    if(/акци|подарок|пив|маргарит|бесплатн/.test(q)&&d){var s=[];if(d.weekPromo)s.push(d.weekPromo.text);if(d.pizzaMonth)s.push('2 пиццы 35 см → «'+d.pizzaMonth.name+'» в подарок');return s.length?'Сейчас у нас: '+s.join('; '):'Акции обновляются по пятницам — следите за баннером 🍕';}
    if(/оплат|карт|наличн/.test(q))return 'Оплата при получении: наличными или картой. Предоплаты нет.';
    if(/где.*заказ|статус.*заказ|мой заказ/.test(q))return 'Статус заказа виден в профиле → «Мои заказы». Если срочное — нажмите «💬 Позвать сотрудника».';
    if(/промокод/.test(q))return 'Промокод доставки вводится в корзине в поле «Промокод» — скидка применится сразу.';
    return null;
  }
  if(/где вы|адрес|до скольки|часы работы|во сколько/.test(q))return 'Мы у моря: п. Янтарный, Советская ул., 70г. Ежедневно май–сен 8:00–21:00, окт–апр 8:00–20:00 🌊';
  if(/штамп|бонус|карта гостя|10-й|десят/.test(q))return 'Каждый 10-й кофе — бесплатно: покажите кассиру QR из профиля, он начислит штамп. На 10-м штампе кофе в подарок 🎁';
  if(/промокод/.test(q))return 'Промокод вводится в «Бонусах» → «Есть промокод?» — штампы или подарок начислятся сразу.';
  return null;
}
if(typeof botReply==='function'){var _br=botReply;botReply=async function(q){var a=await kbAnswer(q,chatCtx||'coffee');return a||_br(q);};}
function showHints(){
  var msgs=document.getElementById('chatMsgs');if(!msgs)return;
  if(supportPending)return;
  var old=msgs.querySelector('.hintsWrap');if(old)old.remove();
  var wrap=document.createElement('div');wrap.className='hintsWrap';wrap.style.cssText='padding:4px 0 8px';
  var list=(chatCtx==='delivery'?DHINTS:CHINTS).slice();
  if(!(typeof staffIn!=='undefined'&&staffIn))list.push(CALL_HINT);
  list.forEach(function(h){
    var b=document.createElement('button');b.className='chatHint';b.textContent=h;b.dataset.hint=h;wrap.appendChild(b);
  });
  msgs.appendChild(wrap);msgs.scrollTop=1e6;
}
addMsg=(function(_am){return function(who,text){
  if(supportPending&&who==='bot')return;
  if(who==='bot'&&typeof text==='string'){
    if(chatCtx==='delivery'&&/поддержка «…и кофе»/.test(text))text=GREET_D;
    if(chatCtx==='coffee'&&/поддержка доставки/.test(text))text=GREET_C;
  }
  var r=_am(who,text);
  if(who==='system'&&!supportPending)setTimeout(showHints,60);
  return r;};})(addMsg);
async function mySend(q){
  var inp=document.getElementById('chatInput');if(inp)inp.value='';
  var msgs=document.getElementById('chatMsgs');
  var hw=msgs&&msgs.querySelector('.hintsWrap');if(hw)hw.remove();
  addMsg('me',q);
  var isHuman=/позвать/i.test(q);
  try{
    await fetch(API_BASE+'/api/chat/send',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({key:chatKey(),text:q,human:isHuman?1:0,ctx:chatCtx||'coffee'})});
  }catch(e){console.log('chat send err',e);}
  if(isHuman){
    addMsg('bot',chatCtx==='delivery'?'Зову диспетчера доставки 🍕 Он получит уведомление и ответит прямо сюда.':'Зову сотрудника кофейни ☕ Он получит уведомление и ответит сюда.');
    return;
  }
  var a=null;
  try{a=await kbAnswer(q,chatCtx||'coffee');}catch(e){}
  if(!a&&typeof _br==='function'){try{a=await _br(q);}catch(e){}}
  addMsg('bot',a||'Хм, не знаю ответа 🤔 Попробуйте иначе или позовите сотрудника.');
  try{fetch(API_BASE+'/api/chat/botlog',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:chatKey(),text:a||''})});}catch(e){}
  showHints();
}
sendChat=function(text,human){return mySend(text,human);};
async function reloadChatThread(){
  var msgs=document.getElementById('chatMsgs');if(!msgs)return;
  msgs.innerHTML='';lastChatId=0;historyLoaded=false;
  try{if(typeof loadHistory==='function')await loadHistory();}catch(e){}
  if(!supportPending&&!msgs.children.length)addMsg('bot',chatCtx==='delivery'?GREET_D:GREET_C);
  showHints();
}
/* подсказки + вызов с подтверждением (два тапа) */
document.getElementById('chatMsgs').addEventListener('click',function(e){
  var h=e.target.closest('.chatHint');if(!h)return;
  e.stopPropagation();e.preventDefault();
  if(h.dataset.hint===CALL_HINT||h.dataset.arm==='1'){
    if(h.dataset.arm==='1'){
      h.dataset.arm='';h.textContent=CALL_HINT;h.style.background='';h.style.borderColor='';
      mySend(CALL_HINT);
    }else{
      h.dataset.arm='1';h.textContent='✅ Точно позвать сотрудника? (нажмите ещё раз)';
      h.style.background='#FDE8E8';h.style.borderColor='#B3372B';
      setTimeout(function(){if(h.dataset.arm==='1'){h.dataset.arm='';h.textContent=CALL_HINT;h.style.background='';h.style.borderColor='';}},4000);
    }
    return;
  }
  mySend(h.dataset.hint||h.textContent);
},true);
/* пилюля смены заведения (обычное использование) */
function showCtxSwitch(){
  var msgs=document.getElementById('chatMsgs');if(!msgs)return;
  var old=msgs.querySelector('.ctxSwitchWrap');if(old)old.remove();
  var wrap=document.createElement('div');wrap.className='ctxSwitchWrap msg bot';wrap.style.cssText='max-width:92%;padding:10px';
  wrap.innerHTML='<div style="font-size:12px;color:var(--soft);margin-bottom:6px">Сменить заведение:</div>'+
    '<div class="ctxPick"><button class="cpD" data-ctxsw="delivery">🍕 Пятница</button><button class="cpC" data-ctxsw="coffee">☕ Кофейня</button></div>';
  msgs.appendChild(wrap);msgs.scrollTop=1e6;
}
(function(){
  var head=document.querySelector('#chatPanel .chatHead');
  if(head&&!document.getElementById('ctxSwitch')){
    var b=document.createElement('button');b.id='ctxSwitch';b.textContent=(chatCtx==='delivery'?'🍕':'')+' ▾';
    b.onclick=showCtxSwitch;head.appendChild(b);
  }
})();
document.getElementById('chatPanel').addEventListener('click',function(e){
  if(e.target.closest('[data-ctxsw]'))setTimeout(function(){reloadChatThread();},80);
});
/* открытие чата: контекст следует за брендом, если не ждём выбор темы */
(function(){
  var f=document.getElementById('chatFab');if(!f||f.__fvWrap)return;
  var old=f.onclick;f.__fvWrap=1;
  f.onclick=async function(e){
    if(typeof old==='function'){try{await old.call(this,e);}catch(err){}}
    var p=document.getElementById('chatPanel');
    if(!p||!p.classList.contains('open'))return;
    if(supportPending){setBotName();showSupportOverlay();return;}
    if(chatCtx!==brand){chatCtx=brand;try{localStorage.setItem('zt_chatctx',chatCtx);}catch(err){}}
    setBotName();
    if(!document.querySelector('#chatMsgs .hintsWrap'))showHints();
  };
})();
loadScList=async function(){try{var r=await api('/chat/list'+(scClosedView?'?closed=1':''));
  document.getElementById('scShowClosed').textContent=scClosedView?'← Активные чаты':'Показать закрытые';
  document.getElementById('scList').innerHTML=r.threads.map(function(t){
    return '<div class="hmini" style="cursor:pointer" data-sck="'+esc(t.key)+'">'+
      '<b>'+esc(t.name)+'</b> '+(t.ctx==='delivery'?'🍕':'☕')+(t.human&&!scClosedView?'<span class="tag hit" style="position:static;margin-left:6px">нужен ответ</span>':'')+
      '<span style="float:right">'+(t.unread?'новое: '+t.unread:'')+'</span></div>';}).join('')
  ||'<div class="hmini">'+(scClosedView?'Закрытых чатов нет':'Пока тихо')+'</div>';}catch(e){}};
updateStaffBadge=async function(){
  if(!me||!['admin','cashier','dispatch'].includes(me.role))return;
  try{var r=await api('/chat/list');
    var un=r.threads.reduce(function(a,t){return a+(+t.unread||0);},0);
    var c1=document.getElementById('chatsToggle'),c2=document.getElementById('chatsToggle2'),c3=document.getElementById('chatsToggleD');
    if(c1)c1.textContent=un?'💬 Чаты гостей · '+un:'💬 Чаты гостей';
    if(c2)c2.textContent=un?'💬 '+un:'💬';
    if(c3)c3.textContent=un?'💬 Чаты гостей · '+un:'💬 Чаты гостей';
  }catch(e){}
};

/* ========== 10. Поддержка: оверлей выбора темы ========== */
function showSupportOverlay(){
  if(document.getElementById('supportChooseOverlay'))return;
  var d=document.createElement('div');d.id='supportChooseOverlay';
  d.innerHTML='<div class="scTitle">У вас вопрос по кофе или доставке?</div>'+
    '<div class="scSub">Выберите тему — откроется нужная Ника, а вызов сотрудника уйдёт правильной команде.</div>'+
    '<div class="ctxPick scBtns">'+
    '<button type="button" class="cpD" data-support-topic="delivery">🍕<br>Доставка<br><small>Пятница</small></button>'+
    '<button type="button" class="cpC" data-support-topic="coffee">☕<br>Кофейня<br><small>…и кофе</small></button></div>';
  document.body.appendChild(d);
  setBotName();
}
function hideSupportOverlay(){var o=document.getElementById('supportChooseOverlay');if(o)o.remove();}
if(SUPPORT_ENTRY&&!chosenSupportCtx){
  document.body.classList.add('support-pending');
  var supTries=0;
  var supIv=setInterval(function(){
    supTries++;
    var am=document.getElementById('authModal');
    if(am&&am.classList.contains('show')){am.classList.remove('show');try{syncOverlay();}catch(e){}}
    var p=document.getElementById('chatPanel');
    if(p&&!p.classList.contains('open')){var f=document.getElementById('chatFab');if(f)f.click();}
    else if(p&&p.classList.contains('open')){showSupportOverlay();}
    if(document.getElementById('supportChooseOverlay')||supTries>40)clearInterval(supIv);
  },250);
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
  setBotName();
  setTimeout(setBotName,50);
  setTimeout(setBotName,300);
  setTimeout(setBotName,900);
  reloadChatThread();
},true);

/* ========== 11. Пуши: самовосстановление подписки ========== */
function b64urlToU8(s){s=s.replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';var b=atob(s);var u=new Uint8Array(b.length);for(var i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u;}
function u8ToB64url(u){var s='';for(var i=0;i<u.length;i++)s+=String.fromCharCode(u[i]);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
async function ensurePush(verbose){
  try{
    if(!('serviceWorker' in navigator)||!('PushManager' in window)){if(verbose)toast('Пуши не поддерживаются устройством','⚠️');return false;}
    if(!me){if(verbose)toast('Сначала войдите по номеру','👤');return false;}
    var perm=Notification.permission;
    if(perm==='default')perm=await Notification.requestPermission();
    if(perm!=='granted'){if(verbose)toast('Уведомления запрещены в настройках браузера','⚠️');return false;}
    var reg=await navigator.serviceWorker.ready;
    var vap=await fetch(API_BASE+'/api/vapid').then(function(r){return r.json();});
    var sub=await reg.pushManager.getSubscription();
    if(sub){
      var cur=u8ToB64url(new Uint8Array(sub.options.applicationServerKey));
      if(cur!==vap.publicKey){try{await sub.unsubscribe();}catch(e){}sub=null;}
    }
    if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64urlToU8(vap.publicKey)});
    await api('/push/subscribe',{method:'POST',body:{sub:sub.toJSON()}});
    if(verbose)toast('Уведомления подключены 🔔','✅');
    return true;
  }catch(e){if(verbose)toast('Не вышло подключить: '+e.message,'⚠️');return false;}
}
window.ensurePush=ensurePush;
document.addEventListener('click',function(e){
  var b=e.target.closest('button');
  if(b&&/уведомлени/i.test(b.textContent||''))setTimeout(function(){ensurePush(true);},50);
});
(function(){
  if(sessionStorage.getItem('pushHealed'))return;
  setTimeout(async function(){
    if(me&&('Notification' in window)&&Notification.permission==='granted'){
      sessionStorage.setItem('pushHealed','1');
      await ensurePush(false);
    }
  },4000);
})();

/* ========== 12. Живые обновления ========== */
var lastStaffSig='',lastMineSig='',lastProfileSig='';
async function refreshOrdersLive(){
  if(document.visibilityState!=='visible')return;
  try{
    if(mode==='orders'&&me&&['cashier','admin','dispatch'].includes(me.role)){
      var r=await api('/orders');
      var sig=r.orders.map(function(o){return o.no+':'+o.status;}).join(',');
      if(sig!==lastStaffSig){lastStaffSig=sig;renderOrders(true);}
    }
    if(me&&mode!=='cashier'&&mode!=='orders'){
      var m=await api('/orders/mine');
      var msig=m.orders.map(function(o){return o.no+':'+o.status;}).join(',');
      if(msig!==lastMineSig){lastMineSig=msig;loadMyOrders();}
    }
  }catch(e){}
}
async function refreshProfileLive(){
  if(!me||document.visibilityState!=='visible')return;
  try{
    var r=await api('/me');if(!r||!r.customer)return;
    var sig=r.customer.stamps+':'+r.customer.free+':'+r.customer.welcome+':'+r.customer.tg;
    if(sig!==lastProfileSig){
      lastProfileSig=sig;
      me=r.customer;
      if(typeof renderProfile==='function')renderProfile();
      if(typeof renderVerifyNote==='function')renderVerifyNote();
    }
  }catch(e){}
}
if(window.ordersPoll){clearInterval(ordersPoll);ordersPoll=null;}
ordersPoll=setInterval(refreshOrdersLive,6000);
setInterval(refreshProfileLive,5000);
document.addEventListener('visibilitychange',function(){refreshOrdersLive();refreshProfileLive();});
addEventListener('focus',function(){refreshOrdersLive();refreshProfileLive();});
if(navigator.serviceWorker)navigator.serviceWorker.addEventListener('message',function(e){
  if(e.data&&e.data.type==='zpush'){refreshOrdersLive();refreshProfileLive();}
});

/* ========== 13. Диплинки и Telegram Mini App ========== */
(function(){
  var bP=QS.get('brand'),tab=QS.get('tab');
  if(!bP&&!tab)return;
  setTimeout(function(){
    try{
      if(bP&&bP!==brand){
        brand=bP;
        document.querySelectorAll('#brandSeg button').forEach(function(x){x.classList.toggle('on',x.dataset.brand===brand);});
        sv();
        if(brand==='delivery'&&!DMENU.length)loadDelivery();
      }
      if(tab==='bonus'||tab==='orders'){
        if(me){openPanel('profile');setTab(tab==='bonus'?'bonus':'profile');}else openAuth();
      }
      history.replaceState(null,'',location.pathname);
    }catch(e){}
  },700);
})();
if(IN_TG&&!window.Telegram){
  var tgs=document.createElement('script');tgs.src='https://telegram.org/js/telegram-web-app.js';
  tgs.onload=function(){try{if(window.Telegram&&window.Telegram.WebApp&&window.Telegram.WebApp.ready)window.Telegram.WebApp.ready();}catch(e){}};
  tgs.onerror=function(){};document.head.appendChild(tgs);
}

/* ========== 14. Конфиг: ссылки на бота ========== */
fetch(API_BASE+'/api/config').then(function(r){return r.json();}).then(function(cfg){
  window.TG_USERNAME=cfg.tgUsername||'and_coffee_bot';
  relink();
  if(typeof renderVerifyNote==='function')renderVerifyNote();
}).catch(function(){});

/* ── v51: стабильные классы шапки чата (.chatHead/.chName) ── */
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

/* ========== 15. Fix: Глобальный оверлей блокирует клики (Playwright & UI) ========== */
setInterval(function(){
  var ov = document.getElementById('overlay');
  if(ov && ov.classList.contains('show')){
    // Если нет ни одной открытой модалки, принудительно скрываем глобальный оверлей
    if(!document.querySelector('.modal.show')){
      ov.classList.remove('show');
    }
  }
}, 500);
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

/* R1. Чат: пилюля = выпадающий список */
showCtxSwitch=function(){
  var p=$('#chatPanel');if(!p)return;
  var old=$('#ctxDrop');if(old){old.remove();return;}
  var d=document.createElement('div');d.id='ctxDrop';
  d.innerHTML='<button type="button" data-ctxsw="coffee" class="'+(chatCtx==='coffee'?'on':'')+'">☕ Кофейня</button>'+
              '<button type="button" data-ctxsw="delivery" class="'+(chatCtx==='delivery'?'on':'')+'">🍕 Пятница</button>';
  p.appendChild(d);
};
document.addEventListener('click',function(e){
  var b=e.target.closest('#ctxDrop [data-ctxsw]');if(!b)return;
  chatCtx=b.getAttribute('data-ctxsw');
  try{localStorage.setItem('zt_chatctx',chatCtx);}catch(err){}
  var d=$('#ctxDrop');if(d)d.remove();
  try{setBotName();}catch(err){}
  try{reloadChatThread();}catch(err){}
},true);
document.addEventListener('click',function(e){
  if(!e.target.closest('#ctxDrop')&&!e.target.closest('#ctxSwitch')){var d=$('#ctxDrop');if(d)d.remove();}
},true);

/* R2. Мои заказы: последняя в профиле + кнопка полного списка */
loadMyOrders=async function(){
  var host=$('#myOrders');if(!host||!me)return;
  try{
    var r=await api('/orders/mine');
    var ST={new:['🆕','mo-new','Новый'],accept:['✅','mo-accept','Подтверждён'],cook:['👨🍳','mo-cook','Готовится'],way:['🛵','mo-way','Курьер в пути'],done:['🏁','mo-done','Выполнен'],cancel:['❌','mo-cancel','Отменён']};
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
  if($('#ordersModal'))return;
  var m=document.createElement('div');m.id='ordersModal';
  m.innerHTML='<div class="omCard"><button type="button" class="omClose">✕ Закрыть</button><h3 style="margin:0 0 12px">📦 Мои заказы</h3><div id="omList"></div></div>';
  document.body.appendChild(m);
  m.addEventListener('click',function(e){if(e.target===m||e.target.closest('.omClose'))m.classList.remove('show');});
})();
async function renderOrdersModal(){
  var list=$('#omList');if(!list||!me)return;
  list.innerHTML='<div class="hmini">Загрузка…</div>';
  $('#ordersModal').classList.add('show');
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
async function loadRedeemStats(){
  if(!me||me.role!=='admin')return;
  var pb=$('#profileBox');if(!pb||$('#redeemStats'))return;
  try{
    var r=await api('/stats/redeems');
    var d=document.createElement('div');d.id='redeemStats';
    var items=Object.entries(r.byItem||{}).sort(function(a,b){return b[1]-a[1];});
    d.innerHTML='<h4>📊 Статистика списаний кофе</h4>'+
      '<div class="rsRow"><span>Всего списаний:</span><b>'+r.total+'</b></div>'+
      (items.length?items.map(function(e){
        return '<div class="rsRow"><span>'+esc(e[0])+'</span><b>'+e[1]+'</b></div>';
      }).join(''):'<div class="rsRow" style="color:var(--soft)">Пока нет списаний</div>');
    var mo=$('#myOrdersBtn');if(mo)pb.insertBefore(d,mo.nextSibling);else pb.appendChild(d);
  }catch(e){}
}
(function(){
  var pb=$('#profileBox');if(!pb||$('#myOrdersBtn'))return;
  var b=document.createElement('button');b.type='button';b.id='myOrdersBtn';b.className='demoBtn';b.textContent='📦 Мои заказы';
  var mo=$('#myOrders');if(mo)pb.insertBefore(b,mo);else pb.appendChild(b);
  b.onclick=renderOrdersModal;
})();

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
  d.addEventListener('change',async function(){
    try{await api('/me/notify',{method:'PUT',body:{tg:$('#ntTg').checked?1:0,web:$('#ntWeb').checked?1:0}});toast('Каналы уведомлений сохранены','✅');}
    catch(e){toast(e.message,'⚠️');}
  });
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
setTimeout(function(){
  if(me&&me.role==='admin')loadRedeemStats();
},1200);
sv();
})();
