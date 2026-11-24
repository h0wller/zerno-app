/* Ф3.4: перенесено из fix-views.js (поиск в Пятнице) */
(function(){
  var dQuery='';
  function applyDFilter(){
    var productsById = new Map();
    (window.DMENU || []).forEach(function(product){
      // DOM data attributes are strings; retain the first string-ID match as Array.find did.
      if (product && typeof product.id === 'string' && !productsById.has(product.id)) {
        productsById.set(product.id, product);
      }
    });

    document.querySelectorAll('#deliveryGrid .card').forEach(function(card){
      var add=card.querySelector('[data-add]');var id=add&&add.getAttribute('data-add');
      var p=id&&productsById.get(id);
      if(!p){card.style.display='';return;}
      card.style.display=(!dQuery||getSearchText(p).includes(dQuery))?'':'none';
    });
  }

  if (window.ztBus && typeof window.ztBus.on === 'function') {
    window.ztBus.on('delivery:menu-rendered', applyDFilter);
  }
  
  function getSearchText(item){
    var composition=Array.isArray(item.comp)?item.comp:[];
    if(typeof item.comp==='string'){
      try{
        var parsed=JSON.parse(item.comp);
        if(Array.isArray(parsed))composition=parsed;
      }catch(e){}
    }
    return [item.name,item.desc].concat(composition).filter(Boolean).join(' ').toLowerCase();
  }

  (function(){
    var dv=document.getElementById('deliveryView');
    if(!dv)return;

    var input=dv.querySelector('#dSearch');
    if(!input){
      var mh=dv.querySelector('.mh-top');
      if(!mh)return;
      /* fix-shared-brands: .search внутри .mh-right, иначе __fitSearch()
         не находит контейнер и поиск разрастается на мобиле. */
      var right=mh.querySelector('.mh-right');
      if(!right){
        right=document.createElement('div');
        right.className='mh-right';
        mh.appendChild(right);
      }
      var wrap=document.createElement('div');
      wrap.className='search';
      wrap.innerHTML='🔍 <input id="dSearch" placeholder="Найти в меню…">';
      right.appendChild(wrap);
      input=wrap.querySelector('#dSearch');
    }

    // The markup already contains #dSearch on the current page; bind it instead of
    // returning early before registering the input handler.
    if(!input||input.dataset.deliverySearchBound==='1')return;
    input.dataset.deliverySearchBound='1';
    input.addEventListener('input',function(e){
      dQuery=e.target.value.trim().toLowerCase();
      applyDFilter();
    });
  })();
})();