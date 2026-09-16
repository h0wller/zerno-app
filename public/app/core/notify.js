/* public/app/core/notify.js — Ф3.21: каналы уведомлений — syncNotifyAll/applyNotify/syncNotifyUI
+ инжект #notifyDetails + слушатели открытия профиля.
Было fix-views.js: v61 notify-кластер + R3. */
(function(){
'use strict';
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
function syncNotifyUI(){
if(!me)return;
var t=document.getElementById('ntTg'),w=document.getElementById('ntWeb');
if(t)t.checked=me.notify_tg!==0;
if(w)w.checked=me.notify_web!==0;
}
window.syncNotifyUI=syncNotifyUI;
(function(){
var pb=document.getElementById('profileBox');if(!pb||document.getElementById('notifyDetails'))return;
var d=document.createElement('details');d.id='notifyDetails';
d.innerHTML='<summary>🔔 Каналы уведомлений</summary>'+
'<div style="display:flex;gap:16px;margin-top:8px;flex-wrap:wrap">'+
'<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="ntTg"> 🤖 Telegram</label>'+
'<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="ntWeb"> 🔔 Пуши браузера</label></div>';
pb.appendChild(d);
d.addEventListener('change',function(){window.applyNotify(document.getElementById('ntTg').checked,document.getElementById('ntWeb').checked);});
})();
['profileTopBtn','mbonusBtn'].forEach(function(id){
var b=document.getElementById(id);if(b)b.addEventListener('click',function(){setTimeout(syncNotifyUI,120);});
});
})();