/* public/app/live.js — Ф3.14b: живые обновления заказов/профиля (поллинги + zpush).
Было fix-views.js секция 12. */
(function(){
'use strict';
var lastStaffSig='',lastMineSig='',lastProfileSig='';
function authAlive(){return !window.__ztAuthDead&&!!localStorage.getItem('zt_user');}
async function refreshOrdersLive(){
if(document.visibilityState!=='visible'||!authAlive()||!me)return;
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
if(!authAlive()||!me||document.visibilityState!=='visible')return;
try{
var r=await api('/me');if(!r||!r.customer)return;
var sig=r.customer.stamps+':'+r.customer.free+':'+r.customer.welcome+':'+r.customer.tg+':'+r.customer.notify_tg+':'+r.customer.notify_web;
if(sig!==lastProfileSig){
lastProfileSig=sig;
me=r.customer;
if(typeof window.syncNotifyAll==='function')window.syncNotifyAll();
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
})();