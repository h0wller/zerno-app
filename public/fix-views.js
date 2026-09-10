/* fix-views.js — ФИНАЛЬНАЯ сборка патча доставки. Грузится ПОСЛЕ основного скрипта. */
(function(){
'use strict';
/* ========== 0. CSS ========== */
var css=document.createElement('style');
css.textContent=
'@media(min-width:1181px){body:not(.is-cashier) .wrap>.rail{grid-column:1}body:not(.is-cashier) .wrap>section{grid-column:2}body:not(.is-cashier) .wrap>.panel{grid-column:3}}'+
'html,body{overflow-x:hidden;max-width:100%}img,canvas,svg,video{max-width:100%}'+
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
'@media(max-width:820px){.topbar{flex-wrap:wrap;row-gap:8px;padding:8px 12px}.topbar .brand{order:1;min-width:0}#clock{order:2;margin-left:auto}#profileTopBtn{order:3}#brandSeg{order:10;flex:1 1 100%;overflow-x:auto;scrollbar-width:none}#modeSeg{order:11;flex:1 1 100%;overflow-x:auto;scrollbar-width:none}#brandSeg::-webkit-scrollbar,#modeSeg::-webkit-scrollbar{display:none}#brandSeg button,#modeSeg button{flex:0 0 auto}}'+
'@media(max-width:400px){#brandSeg button,#modeSeg button{font-size:12px;padding:6px 12px}}'+
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
'.ctxPick .cpD{border-color:#F2D9A5;background:#FFF6E5;color:#6B4E0E}.ctxPick .cpC{color:var(--ink)}';
document.head.appendChild(css);

/* ========== 1. DOM ========== */
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
})();
(function(){
  var cp=document.getElementById('cartPanel'),ci=document.getElementById('cartItems');
  if(cp&&ci&&!document.getElementById('cartAddons')){
    var d=document.createElement('div');d.id='cartAddons';d.style.margin='0 0 10px';cp.insertBefore(d,ci);
  }
})();

/* ========== 2. Виды и режимы ========== */
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
});

/* ========== 3. Корзина ========== */
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

/* ========== 4. Доставка: меню, редактор, слоты ========== */
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

/* ========== 5. Профиль и бонусы ========== */
renderVerifyNote=function(){
  var host=document.getElementById('bonusBox');
  var n=document.getElementById('verifyNote');
  if(!n&&host){n=document.createElement('div');n.id='verifyNote';host.insertBefore(n,host.firstChild);}
  if(!n)return;
  if(!me){n.hidden=true;return;}
  var html='<small style="color:#5B6B7A;background:#EDF2F6;border-radius:12px;padding:8px 12px;display:block;margin-bottom:8px">Как устроены бонусы:<br>🫘 штампы — кассир начисляет по вашему QR<br>🎁 +1 штамп — привязка Telegram<br>🧾 активация профиля — код из 4 цифр на кассе</small>';
  if(!me.verified)html+='<small style="color:#8A4B2A;background:#FFF6F0;border:1.5px dashed #E4B49A;border-radius:12px;padding:8px 12px;display:block;margin-bottom:8px">🧾 Кассир назовёт 4 цифры кода активации — введите их:</small><div style="display:flex;gap:8px"><input id="actCode" inputmode="numeric" maxlength="4" placeholder="Код" style="flex:1"><button class="btn fire" id="actBtn">Активировать</button></div>';
  if(!me.welcome&&!me.tg)html+='<small style="color:#163B6B;background:#EAF1F9;border:1.5px dashed #B9CDE4;border-radius:12px;padding:8px 12px;display:block;margin-top:8px">🎁 <b>+1 штамп</b> за привязку в <a href="https://t.me/and_coffee_bot" style="color:#1F4E8C;font-weight:800">Telegram</a>: откройте бота и нажмите «Поделиться номером»</small>';
  n.hidden=false;n.innerHTML=html;
  var ab=document.getElementById('actBtn');
  if(ab)ab.onclick=async function(){try{var r=await api('/auth/activate-guest',{method:'POST',body:{code:document.getElementById('actCode').value.trim()}});me=r.customer;toast('Профиль активирован! А +1 штамп ждёт в Telegram 🎁','');renderAll();}catch(e){toast(e.message,'⚠️');}};
};
renderProfile=(function(_rp){return function(){var r=_rp();
  var deliv=(brand==='delivery');
  var q=document.getElementById('qrMain');var qb=q&&q.closest('.qrbox');
  if(qb)qb.style.display=deliv?'none':'';
  var st=document.querySelector('#profileBox .stats');
  if(st)st.style.display=deliv?'none':'';
  return r;};})(renderProfile);

/* ========== 6. Активация гостей + чаты в заказах ========== */
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
(function(){
  var ov=document.getElementById('ordersView');
  if(ov&&!document.getElementById('chatsToggleD')){
    var top=ov.querySelector('.cash-top');
    var b=document.createElement('button');b.id='chatsToggleD';b.className='btn ghost';b.textContent='💬 Чаты гостей';
    b.onclick=openStaffChat;
    var ref=document.getElementById('ordersRefresh');
    if(top&&ref)top.insertBefore(b,ref);
  }
})();

/* ========== 7. Сплэш ========== */
(function(){
  if(sessionStorage.getItem('splashDone'))return;
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
    sv();
    if(brand==='delivery'&&!DMENU.length)loadDelivery();
  });
})();

/* ========== 8. Чат: два независимых треда на гостя (кофе и доставка) ========== */
var chatCtx=localStorage.getItem('zt_chatctx')||'';
chatKey=(function(_ck){return function(){return _ck()+(chatCtx==='delivery'?':d':':c');};})(chatKey);
(function(){var _f=window.fetch;window.fetch=function(u,o){
  try{if(o&&o.body&&typeof o.body==='string'&&String(u).indexOf('/api/chat/send')>-1){
    var b=JSON.parse(o.body);b.ctx=chatCtx||'coffee';o=Object.assign({},o,{body:JSON.stringify(b)});
  }}catch(e){}return _f.call(this,u,o);};})();
function setBotName(){
  var head=document.querySelector('#chatPanel .chatHead')||document.getElementById('chatPanel');
  if(head){
    var nodes=head.querySelectorAll('div,span,b');
    for(var i=0;i<nodes.length;i++){var el=nodes[i];
      if(el.children.length===0&&/Ника/.test(el.textContent||'')){
        el.textContent=chatCtx==='delivery'?'Ника · 🍕 доставка':'Ника · ☕ кофейня';break;}}
  }
  var b=document.getElementById('ctxSwitch');
  if(b)b.textContent=(chatCtx==='delivery'?'🍕':'☕')+' ▾';
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
var DHINTS=['Зоны и стоимость доставки','Сколько ждать заказ?','Какие сейчас акции?','Где мой заказ?'];
var CHINTS=['Где вы и часы работы?','Как копить штампы?','Куда ввести промокод?'];
var CALL_HINT='💬 Позвать сотрудника';
function showHints(){
  var msgs=document.getElementById('chatMsgs');if(!msgs)return;
  var old=msgs.querySelector('.hintsWrap');if(old)old.remove();
  var wrap=document.createElement('div');wrap.className='hintsWrap';wrap.style.cssText='padding:4px 0 8px';
  (chatCtx==='delivery'?DHINTS:CHINTS).concat([CALL_HINT]).forEach(function(h){
    var b=document.createElement('button');b.className='chatHint';b.textContent=h;b.dataset.hint=h;wrap.appendChild(b);
  });
  msgs.appendChild(wrap);msgs.scrollTop=1e6;
}
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
  if(!msgs.children.length)addMsg('bot',chatCtx==='delivery'?'Привет! Я Ника, поддержка доставки «Пятница» 🍕 Спрашивайте — или позовите диспетчера.':'Привет! Я Ника, поддержка кофейни «…и кофе» 🌊 Спрашивайте — или позовите сотрудника.');
  showHints();
}
document.getElementById('chatMsgs').addEventListener('click',function(e){
  var h=e.target.closest('.chatHint');if(h){mySend(h.dataset.hint||h.textContent);return;}
});
document.getElementById('chatPanel').addEventListener('click',function(e){
  if(e.target.closest('[data-ctx]')||e.target.closest('[data-ctxsw]'))setTimeout(function(){reloadChatThread();},80);
});
document.getElementById('brandSeg').addEventListener('click',function(){
  if(chatCtx&&chatCtx!==brand){chatCtx=brand;localStorage.setItem('zt_chatctx',chatCtx);setBotName();}
  if(document.getElementById('chatPanel').classList.contains('open'))setTimeout(function(){reloadChatThread();},80);
});
function ensureGate(){
  var p=document.getElementById('chatPanel');if(!p)return;
  if(document.getElementById('ctxGate'))return;
  var g=document.createElement('div');g.id='ctxGate';
  g.style.cssText='position:absolute;inset:0;z-index:5;background:var(--paper);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:20px;text-align:center';
  g.innerHTML='<div style="font:400 22px Prata,serif">Чем помочь?</div>'+
    '<div style="color:var(--soft);font-size:13px;margin-bottom:6px">Выберите заведение — подскажу и позову нужных людей</div>'+
    '<div class="ctxPick"><button class="cpD" data-ctx="delivery">🍕<br>Пятница</button><button class="cpC" data-ctx="coffee">☕<br>Кофейня</button></div>';
  p.appendChild(g);
  g.addEventListener('click',function(e){
    var b=e.target.closest('[data-ctx]');if(!b)return;
    chatCtx=b.dataset.ctx;localStorage.setItem('zt_chatctx',chatCtx);
    g.remove();setBotName();
  });
}
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
    var b=document.createElement('button');b.id='ctxSwitch';b.textContent='☕ ▾';
    b.onclick=showCtxSwitch;head.appendChild(b);
  }
})();
(function(){
  var f=document.getElementById('chatFab');if(!f||f.__wrappedFV)return;
  var old=f.onclick;f.__wrappedFV=1;
  f.onclick=async function(e){
    if(typeof old==='function'){try{await old.call(this,e);}catch(err){}}
    if(document.getElementById('chatPanel').classList.contains('open')){
      if(chatCtx){setBotName();if(!document.querySelector('#chatMsgs .hintsWrap'))showHints();}
      else ensureGate();
    }
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

  /* ── v24: приветствие по заведению, видимая пилюля, раздельные треды, перезагрузка ленты ── */
  (function(){var css=document.createElement('style');
    css.textContent='#ctxSwitch{color:#fff!important;border-color:rgba(255,255,255,.4)!important;background:rgba(255,255,255,.12)!important;font-size:12px!important;padding:4px 12px;border-radius:999px!important;margin-left:auto}';
    document.head.appendChild(css);})();
  (function(){
    var head=document.querySelector('#chatPanel .chatHead');
    if(head&&!document.getElementById('ctxSwitch')){
      var b=document.createElement('button');b.id='ctxSwitch';b.textContent=(chatCtx==='delivery'?'🍕':'☕')+' ▾';
      b.onclick=showCtxSwitch;head.appendChild(b);
    }
  })();
  addMsg=(function(_am){return function(who,text){
    if(who==='bot'&&typeof text==='string'){
      if(chatCtx==='delivery'&&/поддержка «…и кофе»/.test(text))text='Привет! Я Ника, поддержка доставки «Пятница» 🍕 Спрашивайте — или позовите диспетчера.';
      if(chatCtx==='coffee'&&/поддержка доставки/.test(text))text='Привет! Я Ника, поддержка кофейни «…и кофе» 🌊 Спрашивайте — или позовите сотрудника.';
    }
    return _am(who,text);};})(addMsg);
    if(!mySend.__clr){mySend=(function(_ms){var f=async function(q,h){var i=document.getElementById('chatInput');if(i)i.value='';return _ms(q,h);};f.__clr=1;return f;})(mySend);sendChat=function(t,h){return mySend(t,h);};}
  async function reloadChatThread(){
    var msgs=document.getElementById('chatMsgs');if(!msgs)return;
    msgs.innerHTML='';lastChatId=0;historyLoaded=false;
    try{if(typeof loadHistory==='function')await loadHistory();}catch(e){}
    if(!msgs.children.length)addMsg('bot',chatCtx==='delivery'?'Привет! Я Ника, поддержка доставки «Пятница» 🍕 Спрашивайте — или позовите диспетчера.':'Привет! Я Ника, поддержка кофейни «…и кофе» 🌊 Спрашивайте — или позовите сотрудника.');
    showHints();
  }
  document.getElementById('chatPanel').addEventListener('click',function(e){
    if(e.target.closest('[data-ctx]')||e.target.closest('[data-ctxsw]'))setTimeout(function(){reloadChatThread();},80);
  });
  document.getElementById('brandSeg').addEventListener('click',function(){
    if(chatCtx&&chatCtx!==brand){chatCtx=brand;localStorage.setItem('zt_chatctx',chatCtx);setBotName();
      var b=document.getElementById('ctxSwitch');if(b)b.textContent=(chatCtx==='delivery'?'🍕':'☕')+' ▾';}
    if(document.getElementById('chatPanel').classList.contains('open'))setTimeout(function(){reloadChatThread();},80);
  });
  setBotName=(function(_sb){return function(){_sb();
    var b=document.getElementById('ctxSwitch');if(b)b.textContent=(chatCtx==='delivery'?'🍕':'☕')+' ▾';};})(setBotName);

    /* ── v25: гейт выбора раз за сессию; гостевой чат скрыт в служебных режимах ── */
  (function(){var f=document.getElementById('chatFab');if(!f||f.__wrapped25)return;
    var old=f.onclick;f.__wrapped25=1;
    f.onclick=async function(e){
      if(typeof old==='function'){await old.call(this,e);}
      if(document.getElementById('chatPanel').classList.contains('open')&&!sessionStorage.getItem('chatGateDone'))ensureGate();
    };})();
  document.getElementById('chatPanel').addEventListener('click',function(e){
    if(e.target.closest('[data-ctx]'))sessionStorage.setItem('chatGateDone','1');
  });
  sv=(function(_sv){return function(){
    _sv();
    var staff=(mode==='cashier'||mode==='orders');
    var cfab=document.getElementById('chatFab');
    if(cfab)cfab.style.display=staff?'none':'';
    if(staff){var p=document.getElementById('chatPanel');if(p)p.classList.remove('open');}
  };})(sv);

    /* ── v26: без сплэша в чате (контекст = бренд), вызов с подтверждением, вызов пропадает после подключения сотрудника ── */
  ensureGate=function(){};
  chatCtx=brand||chatCtx;
  localStorage.setItem('zt_chatctx',chatCtx);
  showHints=function(){
    var msgs=document.getElementById('chatMsgs');if(!msgs)return;
    var old=msgs.querySelector('.hintsWrap');if(old)old.remove();
    var wrap=document.createElement('div');wrap.className='hintsWrap';wrap.style.cssText='padding:4px 0 8px';
    var list=(chatCtx==='delivery'?DHINTS:CHINTS).slice();
    if(!(typeof staffIn!=='undefined'&&staffIn))list.push(CALL_HINT);
    list.forEach(function(h){var b=document.createElement('button');b.className='chatHint';b.textContent=h;b.dataset.hint=h;wrap.appendChild(b);});
    msgs.appendChild(wrap);msgs.scrollTop=1e6;
  };
  addMsg=(function(_am){return function(w,t){var r=_am(w,t);if(w==='system')setTimeout(showHints,60);return r;};})(addMsg);
  /* подтверждение вызова: два тапа, защита от случайных нажатий */
  document.getElementById('chatMsgs').addEventListener('click',function(e){
    var h=e.target.closest('.chatHint');if(!h)return;
    if(h.dataset.hint!==CALL_HINT&&h.dataset.arm!=='1')return;
    e.stopPropagation();e.preventDefault();
    if(h.dataset.arm==='1'){
      h.dataset.arm='';h.textContent=CALL_HINT;h.style.background='';h.style.borderColor='';
      mySend(CALL_HINT);
    }else{
      h.dataset.arm='1';h.textContent='✅ Точно позвать сотрудника? (нажмите ещё раз)';
      h.style.background='#FDE8E8';h.style.borderColor='#B3372B';
      setTimeout(function(){if(h.dataset.arm==='1'){h.dataset.arm='';h.textContent=CALL_HINT;h.style.background='';h.style.borderColor='';}},4000);
    }
  },true);
  /* чат следует за брендом: на открытии и при смене вкладки */
  (function(){var f=document.getElementById('chatFab');if(!f||f.__wrapped26)return;
    var old=f.onclick;f.__wrapped26=1;
    f.onclick=async function(e){
      if(typeof old==='function'){try{await old.call(this,e);}catch(err){}}
      if(document.getElementById('chatPanel').classList.contains('open')){
        if(chatCtx!==brand){chatCtx=brand;localStorage.setItem('zt_chatctx',chatCtx);}
        setBotName();
        if(!document.querySelector('#chatMsgs .hintsWrap'))showHints();
      }
    };})();
  document.addEventListener('click',function(e){
    if(e.target.closest('[data-go]'))setTimeout(function(){chatCtx=brand;localStorage.setItem('zt_chatctx',chatCtx);setBotName();},0);
  });
  document.getElementById('brandSeg').addEventListener('click',function(){
    if(chatCtx!==brand){chatCtx=brand;localStorage.setItem('zt_chatctx',chatCtx);setBotName();}
    if(document.getElementById('chatPanel').classList.contains('open'))setTimeout(function(){reloadChatThread();},80);
  });
  /* гостевой чат не мешает сотрудникам */
  sv=(function(_sv){return function(){_sv();
    var staff=(mode==='cashier'||mode==='orders');
    var cfab=document.getElementById('chatFab');if(cfab)cfab.style.display=staff?'none':'';
    if(staff){var p=document.getElementById('chatPanel');if(p)p.classList.remove('open');}
  };})(sv);

    /* ── v27: сканер QR только в режиме кассира ── */
  sv=(function(_sv){return function(){_sv();
    var showScan=(mode==='cashier');
    document.querySelectorAll('#scanBtn,#scanFab,#qrFab,#scanToggle,.fab-scan').forEach(function(b){
      b.style.display=showScan?'':'none';
    });
    document.querySelectorAll('button').forEach(function(b){
      var cs=getComputedStyle(b);
      if((b.textContent||'').trim().indexOf('📷')===0&&cs.position==='fixed')b.style.display=showScan?'':'none';
    });
  };})(sv);

    /* ── v28: «Мои заказы» в профиле — заметные карточки вместо тонких строк ── */
  (function(){var css=document.createElement('style');
    css.textContent=
      '#myOrders{display:flex;flex-direction:column;gap:8px;margin:6px 0 4px}'+
      '#myOrders .hmini{margin:0;background:#fff;border:1.5px solid var(--line);border-radius:14px;padding:10px 12px;font-size:14px;font-weight:600}'+
      '.myOrderCard{background:#fff;border:1.5px solid var(--line);border-radius:16px;padding:12px 14px;box-shadow:var(--sh)}'+
      '.myOrderCard .moTop{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:15px;font-weight:800}'+
      '.moSt{font-size:11px;font-weight:800;padding:4px 10px;border-radius:999px;background:#EDF2F6;color:#33507A;white-space:nowrap}'+
      '.mo-new,.mo-accept{background:#E8F1FF;color:#1F4E8C}.mo-cook{background:#FFF3D6;color:#8A6D3B}'+
      '.mo-way{background:#E8F1FF;color:#1F4E8C}.mo-done{background:#E5F5E9;color:#2F7D4F}.mo-cancel{background:#FDE8E8;color:#B3372B}'+
      '.myOrderCard .moSum{margin-top:6px;font-size:15px;font-weight:800}'+
      '.myOrderCard .moItems{margin-top:2px;font-size:12px;color:var(--soft)}'+
      '.myOrderCard .moGifts{margin-top:4px;font-size:12px;color:#2F7D4F;font-weight:700}';
    document.head.appendChild(css);})();
  loadMyOrders=async function(){
    var host=document.getElementById('myOrders');if(!host||!me)return;
    try{
      var r=await api('/orders/mine');
      var ST={new:['🆕','mo-new','Новый'],accept:['✅','mo-accept','Подтверждён'],cook:['👨🍳','mo-cook','Готовится'],way:['🛵','mo-way','Курьер в пути'],done:['🏁','mo-done','Выполнен'],cancel:['❌','mo-cancel','Отменён']};
      host.innerHTML=r.orders.length?r.orders.slice(0,8).map(function(o){
        var s=ST[o.status]||['•','mo-new',o.status];
        var items=o.items.slice(0,3).map(function(i){return i.qty+'× '+i.name;}).join(', ')+(o.items.length>3?'…':'');
        return '<div class="myOrderCard"><div class="moTop"><span>Заказ #'+o.no+'</span><span class="moSt '+s[1]+'">'+s[0]+' '+s[2]+'</span></div>'+
          '<div class="moSum">'+fmt(o.total)+' ₽ · '+new Date(o.created).toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'2-digit'})+'</div>'+
          (items?'<div class="moItems">'+esc(items)+'</div>':'')+
          ((o.gifts&&o.gifts.length)?'<div class="moGifts">🎁 '+o.gifts.map(function(g){return esc(g.name)+' ×'+g.qty;}).join(', ')+'</div>':'')+
          '</div>';
      }).join(''):'<div class="hmini">Заказов пока нет — самое время выбрать пиццу 🍕</div>';
    }catch(e){}
  };
  renderProfile=(function(_rp){return function(){var r=_rp();if(me)loadMyOrders();return r;};})(renderProfile);

  /* ── v29: бейджи заказов обновляются на лету (пуш мгновенно + опрос 6 сек с диффом) ── */
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
  var lastStaffSig='',lastMineSig='';
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
  if(window.ordersPoll){clearInterval(ordersPoll);ordersPoll=null;}
  ordersPoll=setInterval(refreshOrdersLive,6000);
  document.addEventListener('visibilitychange',refreshOrdersLive);
  addEventListener('focus',refreshOrdersLive);
  if(navigator.serviceWorker)navigator.serviceWorker.addEventListener('message',function(e){
    if(e.data&&e.data.type==='zpush')refreshOrdersLive();
  });

  /* ── v30: пуши-самовосстановление — подписка всегда под текущий VAPID сервера ── */
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
  /* кнопка «🔔 Уведомления» в профиле теперь лечит подписку поверх основного обработчика */
  document.addEventListener('click',function(e){
    var b=e.target.closest('button');
    if(b&&/уведомлени/i.test(b.textContent||''))setTimeout(function(){ensurePush(true);},50);
  });
  /* самовосстановление раз за сессию, если разрешение уже есть */
  (function(){
    if(sessionStorage.getItem('pushHealed'))return;
    setTimeout(async function(){
      if(me&&('Notification' in window)&&Notification.permission==='granted'){
        sessionStorage.setItem('pushHealed','1');
        await ensurePush(false);
      }
    },4000);
  })();

  /* ── v31: честный отчёт пушей + кнопка «Тест-пуш на это устройство» ── */
  (function(){var _f=window.fetch;window.fetch=async function(u,o){
    var r=await _f.call(this,u,o);
    try{
      if(o&&o.method==='POST'&&String(u).indexOf('/api/push/send')>-1){
        var j=await r.clone().json();
        setTimeout(function(){toast('Доставлено: '+j.delivered+' · Ошибок: '+j.failed+((j.errors&&j.errors.length)?' ('+j.errors.join(', ')+')':''),'📬');},300);
      }
    }catch(e){}
    return r;};})();
  (function(){
    var host=document.getElementById('dashModal');if(!host)return;
    var anchor=null;
    host.querySelectorAll('h3,h4,div,b').forEach(function(el){
      if(!anchor&&/Кто подписан на пуши/.test(el.textContent||''))anchor=el;
    });
    if(!anchor)return;
    var b=document.createElement('button');b.className='btn ghost';b.textContent='🔔 Тест-пуш на это устройство';b.style.margin='6px 0';
    anchor.parentNode.insertBefore(b,anchor.nextSibling);
    b.onclick=async function(){
      try{
        var r=await api('/push/test',{method:'POST'});
        if(r.ok>0){toast('Пуш ушёл на это устройство ('+r.ok+')','✅');}
        else{
          toast('Не дошло: '+((r.errors&&r.errors.join(', '))||'нет подписки')+' — переподписываю…','⚠️');
          if(window.ensurePush){await ensurePush(true);
            var r2=await api('/push/test',{method:'POST'});
            toast(r2.ok>0?'После переподписки пуш работает ✅':'Всё ещё не работает: '+((r2.errors||[]).join(', ')||'нет подписки'),'🔔');}
        }
      }catch(e){toast(e.message,'⚠️');}
    };
  })();

   /* ── v32: самовосстановление пушей, честная отчётность, адаптив PWA, скрытие бонусов в пятнице ── */
  
  /* 1) «Как устроены бонусы» только в кофейне */
  renderVerifyNote=(function(_rvn){return function(){
    _rvn();
    var n=document.getElementById('verifyNote');
    if(n&&(brand==='delivery'))n.hidden=true;
  };})(renderVerifyNote);
  
  /* 2) Самовосстановление подписки под текущий VAPID сервера */
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
  
  /* 3) Честная отчётность пушей + тест-эндпоинт (только в дашборде, не поверх всех вкладок) */
  (function(){var _f=window.fetch;window.fetch=async function(u,o){
    var r=await _f.call(this,u,o);
    try{
      if(o&&o.method==='POST'&&String(u).indexOf('/api/push/send')>-1){
        var j=await r.clone().json();
        setTimeout(function(){toast('Доставлено: '+j.delivered+' · Ошибок: '+j.failed+((j.errors&&j.errors.length)?' ('+j.errors.join(', ')+')':''),'📬');},300);
      }
    }catch(e){}
    return r;};})();
  (function(){
    var host=document.getElementById('dashModal');if(!host)return;
    var anchor=null;
    host.querySelectorAll('h3,h4,div,b').forEach(function(el){
      if(!anchor&&/Кто подписан на пуши/.test(el.textContent||''))anchor=el;
    });
    if(!anchor)return;
    var b=document.createElement('button');b.className='btn ghost';b.textContent='🔔 Тест-пуш на это устройство';b.style.margin='6px 0 12px';
    anchor.parentNode.insertBefore(b,anchor.nextSibling);
    b.onclick=async function(){
      try{
        var r=await api('/push/test',{method:'POST'});
        if(r.ok>0){toast('Пуш ушёл на это устройство ('+r.ok+')','✅');}
        else{
          toast('Не дошло: '+((r.errors&&r.errors.join(', '))||'нет подписки')+' — переподписываю…','⚠️');
          if(window.ensurePush){await ensurePush(true);
            var r2=await api('/push/test',{method:'POST'});
            toast(r2.ok>0?'После переподписки пуш работает ✅':'Всё ещё не работает: '+((r2.errors||[]).join(', ')||'нет подписки'),'🔔');}
        }
      }catch(e){toast(e.message,'⚠️');}
    };
  })();
  
  /* 4) Адаптивность PWA на мобильных */
  (function(){var css=document.createElement('style');
    css.textContent=
    '@media(max-width:768px){'+
    '.wrap{grid-template-columns:1fr!important}'+
    '.panel{position:fixed;bottom:0;left:0;right:0;max-height:80vh;overflow-y:auto;border-radius:20px 20px 0 0;z-index:300}'+
    '.topbar{flex-wrap:wrap;gap:6px}'+
    '#brandSeg,#modeSeg{width:100%;overflow-x:auto;scrollbar-width:none}'+
    '#brandSeg::-webkit-scrollbar,#modeSeg::-webkit-scrollbar{display:none}'+
    '.cartPanel{max-height:85vh;overflow-y:auto;border-radius:20px 20px 0 0}'+
    '.modal{max-height:90vh;overflow-y:auto}'+
    '}';
    document.head.appendChild(css);})();

  /* ── v33: одна кнопка тест-пуша (внутри дашборда), без дублей-тостов, шапка вне статус-бара iOS ── */
  (function(){var css=document.createElement('style');
    css.textContent=
      '.topbar{padding-top:calc(env(safe-area-inset-top,0px) + 10px)!important}'+
      '#pushTestBtn{position:static!important;display:inline-block;margin:8px 0 0!important;float:none!important}';
    document.head.appendChild(css);})();
  /* снос всех блуждающих кнопок тест-пуша (в т.ч. вне дашборда) */
  document.querySelectorAll('button').forEach(function(b){
    if((b.textContent||'').trim()==='🔔 Тест-пуш на это устройство')b.remove();
  });
  /* тост-отчёт о доставке пушей — не чаще раза в 1.5 сек (лечит дубли) */
  (function(){var _t=window.toast;var last=0;
    window.toast=function(msg,icon){
      if(typeof msg==='string'&&/Доставлено:/.test(msg)){var n=Date.now();if(n-last<1500)return;last=n;}
      return _t(msg,icon);};})();
  /* единственная кнопка тест-пуша, монтируется при открытии дашборда */
  function mountPushTest(){
    var host=document.getElementById('dashModal');if(!host)return;
    if(document.getElementById('pushTestBtn'))return;
    var anchor=null;
    host.querySelectorAll('h3,h4,div,b').forEach(function(el){
      if(!anchor&&/Кто подписан на пуши/.test(el.textContent||''))anchor=el;});
    if(!anchor)return;
    var b=document.createElement('button');b.id='pushTestBtn';b.className='btn ghost';
    b.textContent='🔔 Тест-пуш на это устройство';
    b.style.cssText='position:static;display:inline-block;margin:8px 0 0';
    anchor.parentNode.insertBefore(b,anchor.nextSibling);
    b.onclick=async function(){
      try{
        var r=await api('/push/test',{method:'POST'});
        if(r.ok>0){toast('Пуш ушёл на это устройство ('+r.ok+')','✅');}
        else{
          toast('Не дошло: '+((r.errors&&r.errors.join(', '))||'нет подписки')+' — переподписываю…','⚠️');
          if(window.ensurePush){await ensurePush(true);
            var r2=await api('/push/test',{method:'POST'});
            toast(r2.ok>0?'После переподписки пуш работает ✅':'Всё ещё не работает: '+((r2.errors||[]).join(', ')||'нет подписки'),'🔔');}
        }
      }catch(e){toast(e.message,'⚠️');}
    };
  }
  (function(){
    var d=document.getElementById('dashToggle');
    if(d)d.addEventListener('click',function(){setTimeout(mountPushTest,120);setTimeout(mountPushTest,450);});
    setTimeout(mountPushTest,300);
  })();

  /* ── v34: кнопка тест-пуша удалена навсегда ── */
  if(typeof mountPushTest==='function'){mountPushTest=function(){};}
  (function(){
    function kill(){
      var b=document.getElementById('pushTestBtn');if(b)b.remove();
      document.querySelectorAll('button').forEach(function(x){
        if((x.textContent||'').indexOf('Тест-пуш')>-1)x.remove();
      });
    }
    kill();setTimeout(kill,200);setTimeout(kill,600);setTimeout(kill,1500);
    var mo=new MutationObserver(function(){kill();});
    mo.observe(document.body,{childList:true,subtree:true});
    document.addEventListener('click',function(){setTimeout(kill,50);},true);
  })();

  /* ── v36: панель (профиль/бонусы) на мобильных — во весь экран, без заблюренной дырки ── */
  (function(){var css=document.createElement('style');
    css.textContent=
      '@media(max-width:1180px){'+
      '#panel.open{position:fixed!important;top:0!important;left:0!important;right:0!important;bottom:0!important;'+
      'width:100%!important;height:100%!important;max-height:100%!important;border-radius:0!important;margin:0!important;'+
      'transform:none!important;z-index:320!important}'+
      '#panel .tabs{padding-bottom:calc(env(safe-area-inset-bottom,0px) + 10px)}'+
      '}';
    document.head.appendChild(css);})();

  /* ── v35: ссылки на TG-бота из конфига сервера (тест-бот на тесте, прод-бот на проде) ── */
  fetch(API_BASE+'/api/config').then(function(r){return r.json();}).then(function(cfg){
    window.TG_USERNAME=cfg.tgUsername||'and_coffee_bot';
    function relink(){document.querySelectorAll('a[href*="t.me/and_coffee_bot"]').forEach(function(a){a.href='https://t.me/'+window.TG_USERNAME;});}
    relink();
    renderVerifyNote=(function(_r){return function(){var r=_r();relink();return r;};})(renderVerifyNote);
  }).catch(function(){});

  /* ── v37: живое обновление профиля (штампы/бонусы) + ссылка на бота из конфига ── */
  var lastProfileSig='';
  async function refreshProfileLive(){
    if(!me||document.visibilityState!=='visible')return;
    try{
      var r=await api('/me');if(!r||!r.customer)return;
      var sig=r.customer.stamps+':'+r.customer.free+':'+r.customer.welcome+':'+r.customer.tg;
      if(sig!==lastProfileSig){
        lastProfileSig=sig;
        me=r.customer;
        if(typeof renderProfile==='function')renderProfile();
        if(typeof renderStamps==='function')renderStamps();
        if(typeof renderVerifyNote==='function')renderVerifyNote();
      }
    }catch(e){}
  }
  setInterval(refreshProfileLive,5000);
  document.addEventListener('visibilitychange',refreshProfileLive);
  addEventListener('focus',refreshProfileLive);
  if(navigator.serviceWorker)navigator.serviceWorker.addEventListener('message',function(e){
    if(e.data&&e.data.type==='zpush')refreshProfileLive();
  });
  /* ссылки на TG-бота из конфига сервера */
  fetch(API_BASE+'/api/config').then(function(r){return r.json();}).then(function(cfg){
    window.TG_USERNAME=cfg.tgUsername||'and_coffee_bot';
    function relink(){document.querySelectorAll('a[href*="t.me/and_coffee_bot"]').forEach(function(a){
      a.href='https://t.me/'+window.TG_USERNAME;
    });}
    relink();
    renderVerifyNote=(function(_r){return function(){var r=_r();relink();return r;};})(renderVerifyNote);
  }).catch(function(){});

  /* ── v38: deep-link из Telegram + Mini App полировка ── */
  (function(){
    var q=new URLSearchParams(location.search);
    var bP=q.get('brand'),tab=q.get('tab');
    if(!bP&&!tab)return;
    setTimeout(function(){
      try{
        if(bP&&bP!==brand){brand=bP;document.querySelectorAll('#brandSeg button').forEach(function(x){x.classList.toggle('on',x.dataset.brand===brand);});sv();if(brand==='delivery'&&!DMENU.length)loadDelivery();}
        if(tab==='bonus'||tab==='orders'){if(me){openPanel('profile');setTab(tab==='bonus'?'bonus':'profile');}else openAuth();}
        if(tab==='chat'){var f=document.getElementById('chatFab');if(f)f.click();}
        history.replaceState(null,'',location.pathname);
      }catch(e){}
    },700);
  })();
  (function(){
    if(!/Telegram/i.test(navigator.userAgent))return;
    var s=document.createElement('script');s.src='https://telegram.org/js/telegram-web-app.js';
    s.onload=function(){try{var t=window.Telegram&&window.Telegram.WebApp;if(t){t.ready();t.expand();}}catch(e){}};
    document.head.appendChild(s);
  })();

  /* ── v39: в Telegram Mini App и по диплинкам сплэш не показываем, бренд применяем сразу ── */
  (function(){
    var q=new URLSearchParams(location.search);
    var deep=!!(q.get('brand')||q.get('tab')||q.get('src'));
    var inTg=/Telegram/i.test(navigator.userAgent);
    if(!deep&&!inTg)return;
    sessionStorage.setItem('splashDone','1');
    var sp=document.getElementById('brandSplash');if(sp)sp.remove();
    var b=q.get('brand');
    if(b&&b!==brand){
      brand=b;
      document.querySelectorAll('#brandSeg button').forEach(function(x){x.classList.toggle('on',x.dataset.brand===brand);});
      sv();
      if(brand==='delivery'&&!DMENU.length)loadDelivery();
    }
  })();

  /* ── v40: из бота «Поддержка» — сначала выбор заведения, потом нужная Ника ── */
  (function(){
    var q=new URLSearchParams(location.search);
    if(q.get('tab')==='chat')sessionStorage.setItem('chatForceGate','1');
  })();
  ensureGate=(function(_eg){return function(){
    _eg();
    var g=document.getElementById('ctxGate');
    if(g){
      var d=g.querySelectorAll('div');
      if(d[0])d[0].textContent='Вопрос по кофе или по доставке?';
      if(d[1])d[1].textContent='Подключу нужную поддержку и покажу свои подсказки';
    }
  };})(ensureGate);
  (function(){var f=document.getElementById('chatFab');if(!f||f.__wrapped40)return;
    var old=f.onclick;f.__wrapped40=1;
    f.onclick=async function(e){
      if(typeof old==='function'){try{await old.call(this,e);}catch(err){}}
      if(sessionStorage.getItem('chatForceGate')&&document.getElementById('chatPanel').classList.contains('open')){
        sessionStorage.removeItem('chatForceGate');
        ensureGate();
      }
    };})();

  /* ── v41: вход в поддержку из бота — всегда начинается с выбора заведения ── */
  ensureGate=(function(_eg){return function(){
    var had=!!document.getElementById('ctxGate');
    var r=_eg();
    var g=document.getElementById('ctxGate');
    if(g&&!had){
      var t=g.children[0];if(t)t.textContent='У вас вопрос по кофе или доставке?';
      var s=g.children[1];if(s)s.textContent='Выберите заведение — откроется нужная Ника и ответят свои сотрудники';
    }
    return r;};})(ensureGate);
  (function(){
    var q=new URLSearchParams(location.search);
    if(q.get('tab')!=='chat')return;
    var tries=0;
    var iv=setInterval(function(){
      tries++;
      var p=document.getElementById('chatPanel');
      if(p&&p.classList.contains('open')){
        clearInterval(iv);
        setTimeout(function(){ensureGate();},200);
      }else if(tries>25){clearInterval(iv);}
    },200);
  })();
  /* после выбора на гейте — перезагрузка ленты в тред нужного заведения */
  document.getElementById('chatPanel').addEventListener('click',function(e){
    if(!e.target.closest('[data-ctx]'))return;
    setTimeout(function(){
      var msgs=document.getElementById('chatMsgs');if(!msgs)return;
      msgs.innerHTML='';lastChatId=0;historyLoaded=false;
      try{if(typeof loadHistory==='function')loadHistory();}catch(err){}
      setTimeout(function(){
        if(!msgs.children.length)addMsg('bot',chatCtx==='delivery'?'Привет! Я Ника, поддержка доставки «Пятница» 🍕 Спрашивайте — или позовите диспетчера.':'Привет! Я Ника, поддержка кофейни «…и кофе» 🌊 Спрашивайте — или позовите сотрудника.');
        showHints();
      },300);
    },120);
  });

  /* ── v42: тема обращения внутри чата — кофе или доставка ── */
  (function(){
    var q0 = new URLSearchParams(location.search);
    var forceSupportChoose =
      q0.get('support') === 'choose' ||
      (q0.get('src') === 'tg' && q0.get('tab') === 'chat');

    if(!document.getElementById('supportTopicCss')){
      var css=document.createElement('style');
      css.id='supportTopicCss';
      css.textContent=
        '.supportTopicCard{max-width:94%!important;padding:12px!important}'+
        '.supportTopicTitle{font-weight:800;margin-bottom:4px}'+
        '.supportTopicSub{font-size:12px;color:var(--soft);margin-bottom:10px;line-height:1.35}'+
        '.supportTopicBtns{display:grid;grid-template-columns:1fr 1fr;gap:8px}'+
        '.supportTopicBtns button{border:1.5px solid var(--line);background:#fff;border-radius:16px;padding:12px 8px;font-weight:800;color:var(--ink)}'+
        '.supportTopicBtns button:active{transform:scale(.98)}';
      document.head.appendChild(css);
    }

    function chatIsOpen(){
      var p=document.getElementById('chatPanel');
      return p && p.classList.contains('open');
    }

    function openChatIfNeeded(){
      if(chatIsOpen())return;
      var f=document.getElementById('chatFab');
      if(f)f.click();
    }

    function showSupportTopicCard(force){
      var msgs=document.getElementById('chatMsgs');
      if(!msgs)return;

      // Если это обычное открытие чата и тема уже выбрана — не мешаем.
      // Если пришли из бота support=choose — показываем всегда.
      if(!force && chatCtx)return;

      var old=msgs.querySelector('.supportTopicCard');
      if(old)old.remove();

      var card=document.createElement('div');
      card.className='msg bot supportTopicCard';
      card.innerHTML=
        '<div class="supportTopicTitle">У вас вопрос по кофе или доставке?</div>'+
        '<div class="supportTopicSub">Выберите тему обращения — откроется нужная Ника, а при вызове сотрудника уведомление уйдёт правильной команде.</div>'+
        '<div class="supportTopicBtns">'+
          '<button type="button" data-support-topic="delivery">🍕<br>Доставка<br><small>Пятница</small></button>'+
          '<button type="button" data-support-topic="coffee">☕<br>Кофейня<br><small>…и кофе</small></button>'+
        '</div>';

      msgs.appendChild(card);
      msgs.scrollTop=1e6;
    }

    // Вход из Telegram по кнопке «Поддержка»:
    // открываем чат и после открытия вставляем карточку выбора темы.
    if(forceSupportChoose){
      var tries=0;
      var iv=setInterval(function(){
        tries++;
        openChatIfNeeded();

        if(chatIsOpen() && document.getElementById('chatMsgs')){
          clearInterval(iv);
          setTimeout(function(){
            showSupportTopicCard(true);
          },250);
        }

        if(tries>35)clearInterval(iv);
      },200);
    }

    // Обычное открытие чата на сайте:
    // если тема ещё не выбрана — показываем карточку внутри чата.
    (function(){
      var f=document.getElementById('chatFab');
      if(!f || f.__supportTopicWrapped)return;
      var old=f.onclick;
      f.__supportTopicWrapped=1;

      f.onclick=async function(e){
        if(typeof old==='function'){
          try{await old.call(this,e);}catch(err){}
        }

        setTimeout(function(){
          if(chatIsOpen())showSupportTopicCard(false);
        },250);
      };
    })();

    // Клик по теме обращения
    document.addEventListener('click',function(e){
      var b=e.target.closest('[data-support-topic]');
      if(!b)return;

      e.preventDefault();
      e.stopPropagation();

      var ctx=b.getAttribute('data-support-topic') === 'delivery' ? 'delivery' : 'coffee';

      chatCtx=ctx;
      localStorage.setItem('zt_chatctx',chatCtx);

      var old=document.querySelector('#chatMsgs .supportTopicCard');
      if(old)old.remove();

      try{if(typeof setBotName==='function')setBotName();}catch(err){}

      // Перезагружаем именно нужный тред: coffee или delivery
      try{
        if(typeof reloadChatThread==='function'){
          Promise.resolve(reloadChatThread()).then(function(){
            try{if(typeof showHints==='function')showHints();}catch(e2){}
          });
          return;
        }
      }catch(err){}

      // Фоллбэк, если reloadChatThread недоступен
      try{
        var msgs=document.getElementById('chatMsgs');
        if(msgs)msgs.innerHTML='';
        if(typeof addMsg==='function'){
          addMsg('bot',ctx==='delivery'
            ? 'Привет! Я Ника, поддержка доставки «Пятница» 🍕 Спрашивайте — или позовите диспетчера.'
            : 'Привет! Я Ника, поддержка кофейни «…и кофе» 🌊 Спрашивайте — или позовите сотрудника.'
          );
        }
        if(typeof showHints==='function')showHints();
      }catch(err){}
    },true);
  })();

  sv();
  console.log('fix-views v42 готов');

})();