/* public/app/core/deeplink.js — Ф3.15: диплинки (brand/tab/no) + Telegram Mini App.
Было fix-views.js: секция 13 + v69. */
(function(){
'use strict';
var QS=new URLSearchParams(location.search);
/* ── v69: диплинк заказов: «мой заказ» → фокус, «мои заказы» → история ── */
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
if(!target)target=cards[0];
try{target.scrollIntoView({block:'center',behavior:'smooth'});}catch(e){}
target.classList.add('flash');
setTimeout(function(){target.classList.remove('flash');},2400);
return true;
}
function apply(){
if(done||!me)return;
done=true;
if(no){
setTimeout(function(){if(!focusCard()){setTimeout(focusCard,600);setTimeout(focusCard,1400);}},500);
}else{
setTimeout(function(){if(typeof renderOrdersModal==='function')renderOrdersModal();},500);
}
}
var iv=setInterval(function(){
if(me&&document.getElementById('panel').classList.contains('open')){clearInterval(iv);apply();}
},250);
setTimeout(function(){clearInterval(iv);},300000);
})();
/* ── секция 13: brand/tab + обёртка setUser ── */
(function(){
var bP=QS.get('brand'),tab=QS.get('tab');
if(!bP&&!tab)return;
function openOrdersView(){
try{
if(brand!=='delivery'){
brand='delivery';
document.querySelectorAll('#brandSeg button').forEach(function(x){x.classList.toggle('on',x.dataset.brand===brand);});
if(typeof window.syncBrandViews==='function')window.syncBrandViews();
if(!DMENU.length)loadDelivery();
}
openPanel('profile');
setTab('profile');
try{renderProfile();}catch(e){}
try{loadMyOrders();}catch(e){}
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
if(typeof window.syncBrandViews==='function')window.syncBrandViews();
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
if(tab==='chat'){/* поддержку разбирает chat-core (Ф3.12) */}
}catch(e){}
}
var t0=Date.now(),iv=setInterval(function(){
var ready=(typeof me!=='undefined'&&(me||!localStorage.getItem('zt_user')));
if(ready||Date.now()-t0>4000){clearInterval(iv);apply();}
},150);
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
})();