/* public/app/cart.js — Ф3.9: корзина доставки (состояние, промо, итоги, аддоны, checkout).
   База рендера (renderCart/orderCard) остаётся в index.html; здесь — состояние и дополнения.
   Обёртки — паттерн растворения: финальное слияние с базой в Ф3.15–Ф3.16. */
(function(){
'use strict';

/* ── состояние промо ── */
var cartPromoCode=localStorage.getItem('zt_cartpromo')||'';
var promoInfo=null;
var promoTimer=null;

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

function cartFabShow(){
var cf=document.getElementById('cartFab');
if(cf)cf.style.display=((mode==='guest'||mode==='admin')&&brand==='delivery')?'':'none';
}

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

function clearPromo(){
cartPromoCode='';promoInfo=null;localStorage.removeItem('zt_cartpromo');
var line=document.getElementById('cartPromoLine');if(line)line.textContent='';
paintTotals();
}

/* глобалы для delivery.js (updateCartFab), sv() из fix-views и будущих модулей */
window.totalsNow=totalsNow;
window.paintTotals=paintTotals;
window.cartFabShow=cartFabShow;
window.clearPromo=clearPromo;

/* ── обёртки рендера (база — index.html) ── */
renderCart=(function(_rc){return function(){
var r=_rc();renderAddons();paintTotals();
var sum=cart.reduce(function(a,c){return a+c.price*c.qty;},0);refreshPromoLine(sum);
return r;};})(renderCart);

orderCard=(function(_oc){return function(o){
var h=_oc(o);
if(o.promo)h=h.replace('<div class="ocTotal">','<div class="ocItems">🎟 Промокод '+esc(o.promo)+': −'+fmt(o.promodiscount||0)+'</div><div class="ocTotal">');
return h;};})(orderCard);

/* ── обработчики ── */
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
function repaintCart(){renderCart();}
document.getElementById('checkoutPlace').addEventListener('change',repaintCart);
document.getElementById('checkoutMethod').addEventListener('change',repaintCart);

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
/* чат-FAB: не поверх корзины — скрыт чисто CSS, пока шторка открыта (без JS-гонок) */
(function(){
var s=document.createElement('style');
s.textContent='body:has(#cartPanel.open) #chatFab{display:none!important}';
document.head.appendChild(s);
})();
/* повторный тап по выбранному размеру убирает позицию из заказа */
document.getElementById('deliveryGrid').addEventListener('click',function(e){
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
}
},true);

})();