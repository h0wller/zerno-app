/* Ф3.4: перенесено из fix-views.js (журнал кассира) */
(function(){
  function filterCashLog(){
    document.querySelectorAll('#cashLog .logrow').forEach(function(r){
      var la=r.querySelector('.la');if(!la)return;
      var t=la.textContent||'';
      r.style.display=/заказ|задерж|доставк|Пятниц|курьер|пуш всем/i.test(t)?'none':'';
    });
  }
  
  setMode=(function(_sm){return function(m){var r=_sm.apply(this,arguments);
    setTimeout(function(){
      var cl=document.getElementById('cashLog');
      if(cl){var card=cl.closest('.cash-card');if(card)card.style.display='';filterCashLog();}
    },60);
    return r;};})(setMode);
    
  new MutationObserver(function(){filterCashLog();})
  .observe(document.getElementById('cashLog')||document.body,{childList:true,subtree:true});

  function unhideCashLog(){
    var cl=document.getElementById('cashLog');if(!cl)return;
    var card=cl.closest('.cash-card');
    if(card&&card.style.display==='none')card.style.display='';
  }
  function filterCashRows(){
    document.querySelectorAll('#cashLog .logrow').forEach(function(r){
      var la=r.querySelector('.la');if(!la)return;
      var t=la.textContent||'';
      r.style.display=/заказ|задерж|доставк|Пятниц|курьер|пуш всем/i.test(t)?'none':'';
    });
  }
  new MutationObserver(function(){if(window.__clRaf)return;window.__clRaf=requestAnimationFrame(function(){window.__clRaf=0;unhideCashLog();filterCashRows();});}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
  setTimeout(function(){unhideCashLog();filterCashRows();},300);
})();