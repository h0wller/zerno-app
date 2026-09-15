/* public/app/core/overlay.js — Ф3.17: единый контроллер оверлея + тап по фону + сброс.
Было fix-views.js: setInterval (овлей над шторкой), v66, v67. */
(function(){
'use strict';
/* оверлей: поднимать над шторкой, когда открыта модалка; убирать залипший show */
setInterval(function(){
  var ov=document.getElementById('overlay');if(!ov)return;
  var modalOpen=!!document.querySelector('.modal.show');
  var panelOpen=document.getElementById('panel').classList.contains('open');
  if(ov.classList.contains('show')&&!modalOpen&&!panelOpen)ov.classList.remove('show');
  ov.classList.toggle('ov-high',modalOpen);
},400);
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
/* ══ v67: тап по фону закрывает только верхнюю модалку; сброс только в шестерёнке ══ */
(function(){
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
var rb=document.getElementById('resetBtn');
if(rb){
rb.style.display='none';
rb.onclick=function(){
if(!confirm('Выйти из профиля и очистить кэш на этом устройстве?\nШтаммы, заказы и подарки останутся на сервере.'))return;
localStorage.clear();location.reload();
};
}
var rg=document.getElementById('resetGo2');
if(rg){
var row=rg.closest('.set-row');
if(row){var sp=row.querySelector('span');if(sp)sp.textContent='🚪 Выйти и очистить данные этого устройства';}
}
})();
})();