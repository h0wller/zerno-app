(function(){
'use strict';
var QS=new URLSearchParams(location.search);
var SUPPORT_ENTRY=(QS.get('tab')==='chat'||QS.get('support')==='choose');
var chosen=SUPPORT_ENTRY?(sessionStorage.getItem('zt_support_ctx')||''):'';
var pending=SUPPORT_ENTRY&&!chosen;
var ctx=localStorage.getItem('zt_chatctx')||'';
if(chosen)ctx=chosen;
var local={
  getChatCtx:function(){return ctx;},
  setChatCtx:function(v){ctx=v;try{localStorage.setItem('zt_chatctx',v);}catch(e){}},
  getSupportPending:function(){return pending;},
  setSupportPending:function(v){pending=v;},
  getChosenSupportCtx:function(){return chosen;},
  setChosenSupportCtx:function(v){chosen=v;try{sessionStorage.setItem('zt_support_ctx',v);}catch(e){}}
};
function src(){return window.__fvChatState||local;}
window.chatState={
  getChatCtx:function(){return src().getChatCtx();},
  setChatCtx:function(v){src().setChatCtx(v);},
  getSupportPending:function(){return src().getSupportPending();},
  setSupportPending:function(v){src().setSupportPending(v);},
  getChosenSupportCtx:function(){return src().getChosenSupportCtx();},
  setChosenSupportCtx:function(v){src().setChosenSupportCtx(v);},
  GREET_D:'Привет! Я Ника, поддержка доставки «Пятница» 🍕 Спрашивайте — или позовите диспетчера.',
  GREET_C:'Привет! Я Ника, поддержка кофейни «…и кофе» 🌊 Спрашивайте — или позовите сотрудника.',
  DHINTS:['Зоны и стоимость доставки','Сколько ждать заказ?','Какие сейчас акции?','Где мой заказ?'],
  CHINTS:['Где вы и часы работы?','Как копить штампы?','Куда ввести промокод?'],
  CALL_HINT:'💬 Позвать сотрудника'
};
})();