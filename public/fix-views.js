/* Внешний патч переключения видов v3: грузится ПОСЛЕ основного скрипта */
(function(){
  /* 0. Страховка: вытаскиваем виды в правильное место DOM */
  var sec=document.querySelector('.wrap > section');
  ['deliveryView','ordersView','cashierView'].forEach(function(id){
    var el=document.getElementById(id);
    if(sec&&el&&el.parentNode!==sec)sec.appendChild(el);
  });
  var ab0=document.getElementById('adminBar');
  if(sec&&ab0&&ab0.parentNode!==sec)sec.insertBefore(ab0,sec.firstChild);

   function cartFabShow(){
    var cf=document.getElementById('cartFab');
    if(cf)cf.style.display=((mode==='guest'||mode==='admin')&&brand==='delivery')?'':'none';
  }
  function sv(){
    var showGuest=(mode==='guest'||mode==='admin');
    var showCoffee=showGuest&&brand==='coffee';
    var showDeliv=showGuest&&brand==='delivery';
    var mv=document.getElementById('menuView'), dv=document.getElementById('deliveryView'), rl=document.getElementById('rail');
    if(mv){mv.hidden=!showCoffee; mv.style.display=showCoffee?'':'none';}
    if(dv){dv.hidden=false; dv.style.display=showDeliv?'block':'none';}
    if(rl){rl.style.display=showCoffee?'':'none';}
    var et=document.getElementById('editToggle'); if(et)et.hidden=!(mode==='admin'&&brand==='coffee');
    var ab=document.getElementById('adminBar'); if(ab)ab.hidden=(mode!=='admin');
    cartFabShow();
  }
  window.syncBrandViews=sv;
  /* корзина без двойного рубля и только в гость+Пятница */
  updateCartFab=function(){
    var sum=cart.reduce(function(a,c){return a+c.price*c.qty},0);
    var fab=document.getElementById('cartFab');
    if(fab)fab.hidden=!sum;
    var s=document.getElementById('cartSum'); if(s)s.textContent=Number(sum).toLocaleString('ru-RU');
    cartFabShow();
  };
  setMode=function(m){
    var role=me?me.role:'guest';
    if(m==='cashier'&&role!=='cashier'&&role!=='admin')return;
    if(m==='orders'&&role!=='dispatch'&&role!=='cashier'&&role!=='admin')return;
    if(m==='admin'&&role!=='admin')return;
    mode=m;
    document.body.classList.toggle('is-cashier', m==='cashier'||m==='orders');
    var cv=document.getElementById('cashierView'); if(cv){cv.hidden=(m!=='cashier'); cv.style.display='';}
    var ov=document.getElementById('ordersView'); if(ov)ov.hidden=(m!=='orders');
    sv();
    var pt=document.getElementById('promoToggle'); if(pt)pt.hidden=(m!=='admin');
    var dt=document.getElementById('dashToggle'); if(dt)dt.hidden=(m!=='admin');
    var ct=document.getElementById('chatsToggle2'); if(ct)ct.hidden=!(me&&(me.role==='admin'||me.role==='cashier'));
    var bd=document.getElementById('adminBadge'); if(bd)bd.hidden=(m!=='admin');
    if(m!=='admin')exitEdit();
    var mb=document.getElementById('mbonusBtn'); if(mb)mb.style.display=(m==='cashier'||m==='orders')?'none':'';
    if(m==='cashier')renderLog();
    if(m==='orders'){renderOrders();if(!ordersPoll)ordersPoll=setInterval(function(){if(mode==='orders')renderOrders(true)},8000);}
    if(m==='admin')loadMenu();
    if((mode==='guest'||mode==='admin')&&brand==='delivery'&&!DMENU.length)loadDelivery();
    renderModes();
    toast(m==='admin'?'Режим администратора активен':m==='cashier'?'Смена кассира активна':m==='orders'?'Панель диспетчера':'Режим гостя',
          m==='admin'?'🔓':m==='cashier'?'🧾':m==='orders'?'🍕':'');
  };
  document.getElementById('brandSeg').addEventListener('click',function(e){
    var b=e.target.closest('[data-brand]');if(!b)return;
    brand=b.dataset.brand;
    if(mode==='cashier'||mode==='orders')setMode('guest');
    document.querySelectorAll('#brandSeg button').forEach(function(x){x.classList.toggle('on',x.dataset.brand===brand)});
    sv();
    if(brand==='delivery'&&!DMENU.length)loadDelivery();
  });
  sv();
  console.log('fix-views v3 готов');
})();