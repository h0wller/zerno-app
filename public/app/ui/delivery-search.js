/* Ф3.4: перенесено из fix-views.js (поиск в Пятнице) */
(function(){
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
      if (window.ztBus && typeof window.ztBus.emit === 'function') {
        window.ztBus.emit('delivery:search-changed', { query: e.target.value });
      }
    });
  })();
})();