/* public/app/core/push.js — Ф3.14a: пуши — ensurePush, VAPID-утилиты, самовосстановление.
Было fix-views.js секция 11. */
(function(){
'use strict';
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
})();