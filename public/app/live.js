/* public/app/live.js — Ф3.14b: живые обновления заказов/профиля (поллинги + zpush).
Было fix-views.js секция 12. */
(function(){
'use strict';
var lastStaffSig='',lastMineSig='',lastProfileSig='';
function authAlive(){return !window.__ztAuthDead&&!!localStorage.getItem('zt_user');}

async function refreshOrdersLive(){
  if(document.visibilityState!=='visible'||!authAlive()||!window.me)return;
  try{
    if(window.mode==='orders'&&window.me&&['cashier','admin','dispatch'].includes(window.me.role)){
      var r=await api('/orders');
      var sig=r.orders.map(function(o){return o.no+':'+o.status;}).join(',');
      if(sig!==lastStaffSig){lastStaffSig=sig;renderOrders(true);}
    }
    var panel = document.getElementById('panel');
    var profileTab = document.getElementById('pvProfile');
    var profileVisible = panel && profileTab && !profileTab.hidden &&
      (window.innerWidth > 1180 || panel.classList.contains('open'));
    if(window.me&&profileVisible&&window.mode!=='cashier'&&window.mode!=='orders'){
      var mineUserKey=String(window.me.id||window.me.phone||'');
      var m=await api('/orders/mine');
      if(!window.me||mineUserKey!==String(window.me.id||window.me.phone||''))return;
      var orders=Array.isArray(m.orders)?m.orders:[];
      var msig=mineUserKey+'|'+orders.map(function(o){return o.no+':'+o.status;}).join(',');
      if(msig!==lastMineSig){
        lastMineSig=msig;
        if(typeof window.updateMyOrdersCache==='function')window.updateMyOrdersCache(orders);
        loadMyOrders();
      }
    }
  }catch(e){}
}

async function refreshProfileLive(){
  if(!authAlive()||!window.me||document.visibilityState!=='visible')return;
  try{
    var r=await api('/me'); /* ← ЗДЕСЬ БЫЛО /window.me, исправлено на /me */
    if(!r||!r.customer)return;
    var sig=r.customer.stamps+':'+r.customer.free+':'+r.customer.welcome+':'+r.customer.tg+':'+r.customer.notify_tg+':'+r.customer.notify_web;
    if(sig!==lastProfileSig){
      lastProfileSig=sig;
      window.me=r.customer;
      if(typeof window.syncNotifyAll==='function')window.syncNotifyAll();
      if(typeof renderProfile==='function')renderProfile();
      if(typeof renderVerifyNote==='function')renderVerifyNote();
    }
  }catch(e){}
}

if(window.ordersPoll){clearInterval(window.ordersPoll);window.ordersPoll=null;}
window.ordersPoll=setInterval(refreshOrdersLive,6000);
setInterval(refreshProfileLive,5000);

document.addEventListener('visibilitychange',function(){refreshOrdersLive();refreshProfileLive();});
addEventListener('focus',function(){refreshOrdersLive();refreshProfileLive();});
addEventListener('pageshow',function(e){
  if(e.persisted){
    refreshOrdersLive();
    refreshProfileLive();
    if(typeof window.syncBrandViews==='function')window.syncBrandViews();
  }
});

if(navigator.serviceWorker)navigator.serviceWorker.addEventListener('message',function(e){
  if(e.data&&e.data.type==='zpush'){refreshOrdersLive();refreshProfileLive();}
});
})();
