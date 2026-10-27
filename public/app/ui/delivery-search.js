/* Ф3.4: перенесено из fix-views.js (поиск в Пятнице) */
(function(){
  var dQuery='';
  function applyDFilter(){
    document.querySelectorAll('#deliveryGrid .card').forEach(function(card){
      var add=card.querySelector('[data-add]');var id=add&&add.getAttribute('data-add');
      var p=id&&DMENU.find(function(x){return x.id===id;});
      if(!p){card.style.display='';return;}
      card.style.display=(!dQuery||((p.name||'')+' '+(p.desc||'')).toLowerCase().includes(dQuery))?'':'none';
    });
  }
  renderDeliveryMenu=(function(_rm){return function(){var r=_rm.apply(this,arguments);applyDFilter();return r;};})(renderDeliveryMenu);
  
  (function(){
    var dv=document.getElementById('deliveryView');if(!dv||dv.querySelector('#dSearch'))return;
    var mh=dv.querySelector('.mh-top');if(!mh)return;
    /* fix-shared-brands: .search внутри .mh-right, иначе __fitSearch()
       не находит контейнер и поиск разрастается на мобиле. */
    var right=document.createElement('div');right.className='mh-right';
    var wrap=document.createElement('div');wrap.className='search';
    wrap.innerHTML='🔍 <input id="dSearch" placeholder="Найти в меню…">';
    right.appendChild(wrap);
    mh.appendChild(right);
    document.getElementById('dSearch').addEventListener('input',function(e){dQuery=e.target.value.trim().toLowerCase();applyDFilter();});
  })();
})();