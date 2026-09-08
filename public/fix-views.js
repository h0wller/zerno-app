/* Внешний патч v4: виды, рельсы, корзина, редактор доставки */
(function(){
  var fixCss=document.createElement('style');
  fixCss.textContent='@media(min-width:1181px){'+
    'body:not(.is-cashier) .wrap>.rail{grid-column:1}'+
    'body:not(.is-cashier) .wrap>section{grid-column:2}'+
    'body:not(.is-cashier) .wrap>.panel{grid-column:3}}';
  document.head.appendChild(fixCss);

  /* DOM: раскладываем элементы по местам */
  var wrap=document.querySelector('.wrap'), sec=wrap&&wrap.querySelector(':scope>section');
  ['deliveryView','ordersView','cashierView'].forEach(function(id){
    var el=document.getElementById(id);
    if(sec&&el&&el.parentNode!==sec)sec.appendChild(el);
  });
  var dRail=document.getElementById('deliveryRail');
  if(wrap&&dRail&&dRail.parentNode!==wrap){wrap.insertBefore(dRail,sec);dRail.classList.add('rail');}
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
    var mv=document.getElementById('menuView'), dv=document.getElementById('deliveryView');
    var rl=document.getElementById('rail'), dr=document.getElementById('deliveryRail');
    if(mv){mv.hidden=!showCoffee; mv.style.display=showCoffee?'':'none';}
    if(dv){dv.hidden=false; dv.style.display=showDeliv?'block':'none';}
    if(rl)rl.style.display=showCoffee?'':'none';
    if(dr)dr.style.display=showDeliv?'':'none';
    var et=document.getElementById('editToggle'); if(et)et.hidden=(mode!=='admin');
    var ab=document.getElementById('adminBar'); if(ab)ab.hidden=(mode!=='admin');
    var pn=document.getElementById('panel'); if(pn)pn.style.display=(brand==='delivery'&&mode==='guest')?'none':'';
    var mb=document.getElementById('mbonusBtn'); if(mb)mb.style.display=(mode==='guest'&&brand==='coffee')?'':'none';
    cartFabShow();
  }
  window.syncBrandViews=sv;
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
    if(m==='cashier')renderLog();
    if(m==='orders'){renderOrders();if(!ordersPoll)ordersPoll=setInterval(function(){if(mode==='orders')renderOrders(true)},8000);}
    if(m==='admin')loadMenu();
    if((m==='guest'||m==='admin')&&brand==='delivery'&&!DMENU.length)loadDelivery();
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

  /* ── редактор доставки: как у кофейни ── */
  var DCATSL=[{id:'pizza',e:'🍕',l:'Пиццы'},{id:'rolls',e:'🍣',l:'Роллы'},{id:'sets',e:'🍱',l:'Сеты'},{id:'sauces',e:'🥫',l:'Соусы'}];
  renderDeliveryMenu=function(){
    var list=DMENU.filter(function(p){return p.cat===dcat});
    if(!editMode)list=list.filter(function(p){return p.on});
    var html=list.map(function(p,i){
      var opts=p.opts||[];
      var optsHTML=opts.length?'<div class="opts">'+opts.map(function(o,oi){return '<button data-id="'+p.id+'" data-oi="'+oi+'" class="'+(oi===0?'sel':'')+'">'+o.l+' · '+o.w+' · '+fmt(o.p)+'</button>'}).join('')+'</div>':'';
      var media=(p.img?'<img src="'+p.img+'" alt="'+esc(p.name)+'">':'<span class="em">'+(p.e||'🍕')+'</span>');
      if(editMode)media+='<button class="editbtn" data-ed="'+p.id+'" title="Редактировать">✏️</button>';
      if(!p.on)media+='<span class="stopbadge">СТОП</span>';
      var foot=editMode?'<label class="qswitch"><input type="checkbox" data-onoff="'+p.id+'" '+(p.on?'checked':'')+'>в меню</label>':'';
      return '<article class="card '+(p.on?'':'stopped')+'" style="--d:'+(Math.min(i,10)*35)+'ms">'+
        '<div class="media" style="--tint:#F3E2CE">'+media+'</div>'+
        '<div class="cbody"><h3>'+esc(p.name)+'</h3>'+
        (p.desc?'<div class="desc">'+esc(p.desc)+'</div>':'')+
        (editMode?'':optsHTML)+
        (editMode?'':'<button class="cta" data-add="'+p.id+'" style="margin-top:auto">Добавить</button>')+
        '<div class="cfoot"><span class="price">'+(opts.length?fmt(opts[0].p):fmtMulti(p.price))+'</span>'+foot+'</div>'+
        '</div></article>';
    }).join('');
    if(editMode)html+='<button class="addcard" id="addCardD"><span>＋</span>Добавить позицию</button>';
    if(!list.length&&!editMode)html='<div class="gempty" style="grid-column:1/-1">В этой категории пока пусто</div>';
    document.getElementById('deliveryGrid').innerHTML=html;
    var a=document.getElementById('addCardD'); if(a)a.onclick=function(){openEditor(null)};
  };
  document.getElementById('deliveryGrid').addEventListener('click',function(e){
    var ed=e.target.closest('[data-ed]');
    if(ed)openEditor(ed.dataset.ed);
  });
  document.getElementById('deliveryGrid').addEventListener('change',async function(e){
    var t=e.target.closest('[data-onoff]');if(!t)return;
    var p=DMENU.find(function(x){return x.id===t.dataset.onoff});if(!p)return;
    p.on=t.checked?1:0;renderDeliveryMenu();
    try{await api('/menu/'+p.id,{method:'PUT',body:p});await loadDelivery();
      toast(t.checked?'«'+esc(p.name)+'» снова в меню':'«'+esc(p.name)+'» → стоп-лист',t.checked?'✅':'⛔');}
    catch(err){toast(err.message,'⚠️');loadDelivery();}
  });
  openEditor=function(id){
    if(mode!=='admin'||!me||me.role!=='admin')return;
    var pool=(brand==='delivery')?DMENU:MENU;
    var src=id?pool.find(function(x){return x.id===id}):null;
    edit=src?clone(src):{cat:brand==='delivery'?'pizza':'coffee',e:brand==='delivery'?'🍕':'☕',name:'',desc:'',comp:[],vol:'',price:0,tag:'',coffee:0,on:1,img:null,section:brand==='delivery'?'delivery':'coffee',opts:[]};
    document.getElementById('emTitle').textContent=src?'Редактировать позицию':'Новая позиция';
    document.getElementById('emCat').innerHTML=(brand==='delivery'?DCATSL:CATS).map(function(c){return '<option value="'+c.id+'">'+c.e+' '+c.l+'</option>'}).join('');
    document.getElementById('emName').value=edit.name;
    document.getElementById('emCat').value=edit.cat;
    document.getElementById('emPrice').value=edit.price||'';
    document.getElementById('emVol').value=edit.vol||'';
    document.getElementById('emDesc').value=edit.desc||'';
    document.getElementById('emComp').value=(edit.comp||[]).join(', ');
    document.getElementById('emTag').value=edit.tag||'';
    document.getElementById('emEmoji').value=edit.e||'';
    document.getElementById('emCoffee').checked=!!edit.coffee;
    document.getElementById('emOn').checked=!!edit.on;
    document.getElementById('emDel').style.display=src?'':'none';
    document.getElementById('emDup').style.display=src?'':'none';
    var ob=document.getElementById('emOptsBox');
    var showOpts=(brand==='delivery')&&(edit.cat==='pizza');
    if(ob)ob.hidden=!showOpts;
    var os=edit.opts||[];
    for(var i=0;i<4;i++){
      var w=document.getElementById('emOpt'+i+'w'),pp=document.getElementById('emOpt'+i+'p');
      if(w)w.value=os[i]?os[i].w.replace(' г',''):'';
      if(pp)pp.value=os[i]?os[i].p:'';
    }
    renderZone();
    document.getElementById('emModal').classList.add('show');syncOverlay();
    setTimeout(function(){document.getElementById('emName').focus()},150);
  };
  document.getElementById('emSave').onclick=async function(){
    edit.name=document.getElementById('emName').value.trim()||'Без названия';
    edit.vol=document.getElementById('emVol').value.trim();
    edit.desc=document.getElementById('emDesc').value.trim();
    edit.comp=document.getElementById('emComp').value.split(',').map(function(s){return s.trim()}).filter(Boolean);
    edit.tag=document.getElementById('emTag').value;
    edit.e=document.getElementById('emEmoji').value.trim()||(brand==='delivery'?'🍕':'☕');
    edit.coffee=document.getElementById('emCoffee').checked?1:0;
    edit.on=document.getElementById('emOn').checked?1:0;
    edit.cat=document.getElementById('emCat').value;
    if(brand==='delivery'){
      edit.section='delivery';
      if(edit.cat==='pizza'){
        var defs=[['25 см, пышное',25],['35 см, пышное',35],['25 см, тонкое',25],['35 см, тонкое',35]];
        edit.opts=defs.map(function(d,i){
          var w=document.getElementById('emOpt'+i+'w').value.trim()||'0';
          var p=+document.getElementById('emOpt'+i+'p').value||0;
          return {l:d[0],w:w+' г',p:p,sz:d[1]};
        });
        edit.price='0';
      } else { edit.opts=[]; edit.price=String(+document.getElementById('emPrice').value||0); }
      try{
        if(edit.id)await api('/menu/'+edit.id,{method:'PUT',body:edit});
        else await api('/menu',{method:'POST',body:edit});
        dcat=edit.cat;
        await loadDelivery();closeEditor();
        toast('«'+esc(edit.name)+'» сохранено · меню доставки обновлено','✅');
      }catch(err){toast(err.message,'⚠️')}
      return;
    }
    var priceRaw=document.getElementById('emPrice').value.trim();
    edit.price=priceRaw.includes('/')?priceRaw:String(Math.max(0,Math.round(Number(priceRaw)||0)));
    edit.section='coffee';
    try{
      if(edit.id)await api('/menu/'+edit.id,{method:'PUT',body:edit});
      else await api('/menu',{method:'POST',body:edit});
      cat=edit.cat;query='';document.getElementById('searchInput').value='';renderRail();
      await loadMenu();closeEditor();
      toast('«'+esc(edit.name)+'» сохранено · меню обновлено для гостей','✅');
    }catch(err){toast(err.message,'⚠️')}
  };
  document.getElementById('editToggle').onclick=function(){
    editMode=!editMode;
    document.body.classList.toggle('editing',editMode);
    var b=document.getElementById('editToggle');
    b.textContent=editMode?'✔ Готово':'✏️ Редактировать';
    b.classList.toggle('on',editMode);
    if(brand==='delivery')renderDeliveryMenu();else renderMenu();
    if(editMode)toast('Режим редактирования: ✏️ на карточке или тумблер «в меню»','✏️');
  };
  exitEdit=function(){
    if(!editMode)return;
    editMode=false;document.body.classList.remove('editing');
    var b=document.getElementById('editToggle');
    b.textContent='✏️ Редактировать';b.classList.remove('on');
    if(brand==='delivery')renderDeliveryMenu();else renderMenu();
  };
  /* loadDelivery: админу — всё меню (со стоп-листом), гостю — только активное */
  loadDelivery=async function(){
    try{
      var r;
      if(me&&me.role==='admin'){
        var all=await api('/menu/all');
        r={items:(all.items||[]).filter(function(p){return p.section==='delivery'})};
      } else {
        r=await api('/dmenu');
      }
      DMENU=r.items||[];
      deliveryInfo=await fetch(API_BASE+'/api/delivery/info').then(function(x){return x.json()});
      var wp=deliveryInfo.weekPromo, pm=deliveryInfo.pizzaMonth;
      var bEl=document.getElementById('deliveryBanner');
      if(bEl)bEl.innerHTML=(wp?'<div class="deliveryBanner">🎁 '+esc(wp.text)+'</div>':'')+
                           (pm?'<div class="deliveryBanner">🍕 2 пиццы 35 см → «'+esc(pm.name)+'» в подарок!</div>':'');
      populatePlaces();populateSlots();
      renderDeliveryRail();renderDeliveryMenu();updateCartFab();
    }catch(e){console.log('delivery load err',e)}
  };
    /* ── v5: редактор без кофейных артефактов, осознанный выбор размера, корзина-терракота, соусы в корзине ── */
  var css2=document.createElement('style');
  css2.textContent=
    '.opts button.sel{background:#B4552D;border-color:#B4552D;color:#fff}'+
    '#cartFab{background:#B4552D!important;box-shadow:0 12px 30px -8px rgba(180,85,45,.75)!important;bottom:calc(84px + env(safe-area-inset-bottom))!important}'+
    '#deliveryGrid{padding-bottom:120px}'+
    '.addonChip{border:1.5px solid var(--line);background:#fff;border-radius:999px;padding:6px 12px;font-size:12px;font-weight:600;margin:0 6px 6px 0}'+
    '.addonChip b{color:#B4552D}'+
    '.opts.shake{animation:shake .4s}';
  document.head.appendChild(css2);

  /* редактор: скрыть кофейное и лишнее у пиццы */
  function editorFields(){
    var isDeliv=(brand==='delivery');
    var isPizza=isDeliv&&edit&&edit.cat==='pizza';
    var pL=document.getElementById('emPrice').closest('label');
    var vL=document.getElementById('emVol').closest('label');
    var cL=document.getElementById('emCoffee').closest('label');
    if(pL)pL.style.display=isPizza?'none':'';
    if(vL)vL.style.display=isPizza?'none':'';
    if(cL)cL.style.display=isDeliv?'none':'';
    var ob=document.getElementById('emOptsBox'); if(ob)ob.hidden=!isPizza;
  }
  openEditor=(function(_oe){return function(id){var r=_oe(id);editorFields();return r;};})(openEditor);
  document.getElementById('emCat').addEventListener('change',function(){if(edit)edit.cat=this.value;editorFields();});

  /* без преселекта размера: гость выбирает осознанно */
  renderDeliveryMenu=(function(_rm){return function(){_rm();
    document.querySelectorAll('#deliveryGrid .opts button.sel').forEach(function(b){b.classList.remove('sel')});
  };})(renderDeliveryMenu);
  document.getElementById('deliveryGrid').addEventListener('click',function(e){
    var add=e.target.closest('[data-add]');if(!add)return;
    var body=add.closest('.cbody');var ob=body&&body.querySelector('.opts');
    if(ob&&!ob.querySelector('.sel')){
      e.stopPropagation();
      toast('Выберите размер пиццы 🍕','');
      ob.classList.remove('shake');void ob.offsetWidth;ob.classList.add('shake');
    }
  },true);

  /* рельс доставки без соусов */
  renderDeliveryRail=(function(_rr){return function(){_rr();
    var b=document.querySelector('#deliveryRail [data-dcat="sauces"]');if(b)b.remove();
  };})(renderDeliveryRail);

  /* соусы — чипсами в корзине */
  (function(){
    var cp=document.getElementById('cartPanel'),ci=document.getElementById('cartItems');
    if(cp&&ci&&!document.getElementById('cartAddons')){
      var d=document.createElement('div');d.id='cartAddons';d.style.margin='0 0 10px';cp.insertBefore(d,ci);
    }
  })();
  function renderAddons(){
    var host=document.getElementById('cartAddons');if(!host)return;
    var list=DMENU.filter(function(p){return p.cat==='sauces'&&p.on});
    if(!list.length){host.innerHTML='';return;}
    host.innerHTML='<div style="font-size:12px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#8B98A5;margin:0 0 6px">Добавить к заказу</div>'+
      list.map(function(p){
        var inCart=cart.find(function(c){return c.id===p.id});
        return '<button class="addonChip" data-addon="'+p.id+'">'+(inCart?'<b>×'+inCart.qty+'</b> ':'')+esc(p.name)+' · '+fmt(parseInt(p.price)||0)+'</button>';
      }).join('');
  }
  document.getElementById('cartPanel').addEventListener('click',function(e){
    var ch=e.target.closest('[data-addon]');if(!ch)return;
    var p=DMENU.find(function(x){return x.id===ch.dataset.addon});if(!p)return;
    var ex=cart.find(function(c){return c.id===p.id});
    if(ex)ex.qty++;else cart.push({key:p.id,id:p.id,oi:-1,name:p.name,opt:null,price:parseInt(p.price)||0,sz:0,qty:1});
    localStorage.setItem('zt_cart',JSON.stringify(cart));
    updateCartFab();renderCart();
  });
  renderCart=(function(_rc){return function(){var r=_rc();renderAddons();return r;};})(renderCart);

  /* кнопка корзины: терракота + счётчик позиций */
  updateCartFab=function(){
    var sum=cart.reduce(function(a,c){return a+c.price*c.qty},0);
    var cnt=cart.reduce(function(a,c){return a+c.qty},0);
    var fab=document.getElementById('cartFab');
    if(fab)fab.hidden=!sum;
    var s=document.getElementById('cartSum');
    if(s)s.textContent=cnt+' поз · '+Number(sum).toLocaleString('ru-RU');
    if(fab)fab.style.display=((mode==='guest'||mode==='admin')&&brand==='delivery')?'':'none';
  };

    /* ── v6: тап по выбранному размеру убирает из заказа; shake не повторяется ── */
  document.addEventListener('animationend',function(e){
    if(e.target&&e.target.classList&&e.target.classList.contains('shake'))e.target.classList.remove('shake');
  },true);
  document.getElementById('deliveryGrid').addEventListener('click',function(e){
    var ob=e.target.closest('.opts button');
    if(ob&&ob.classList.contains('sel')){
      e.stopPropagation();
      ob.classList.remove('sel');
      var id=ob.dataset.id, oi=+ob.dataset.oi;
      var before=cart.length;
      cart=cart.filter(function(c){return !(c.id===id&&c.oi===oi)});
      if(cart.length!==before){
        localStorage.setItem('zt_cart',JSON.stringify(cart));
        updateCartFab();renderCart();
        toast('Убрали из заказа','🗑');
      }
      return;
    }
  },true);

    /* ── v7: промокоды доставки ── */
  var cartPromoCode=localStorage.getItem('zt_cartpromo')||'';
  function promoDisc(sum,info){return info.kind==='percent'?Math.round(sum*Math.min(90,info.value)/100):Math.min(info.value||0,sum);}
  async function refreshPromoLine(sum){
    var line=document.getElementById('cartPromoLine');if(!line)return;
    if(!cartPromoCode){line.textContent='';return;}
    try{
      var r=await fetch(API_BASE+'/api/promo/info?code='+encodeURIComponent(cartPromoCode)).then(function(x){return x.json()});
      if(r.ok){line.textContent='🎟 '+r.code+': −'+fmt(promoDisc(sum,r));}
      else{cartPromoCode='';localStorage.removeItem('zt_cartpromo');line.textContent='';}
    }catch(e){}
  }
  document.getElementById('cartPromoBtn').onclick=async function(){
    var v=document.getElementById('cartPromo').value.trim().toUpperCase();
    if(!v)return toast('Введите промокод','🎟');
    var r=await fetch(API_BASE+'/api/promo/info?code='+encodeURIComponent(v)).then(function(x){return x.json()}).catch(function(){return null});
    if(r&&r.ok){cartPromoCode=v;localStorage.setItem('zt_cartpromo',v);
      var sum=cart.reduce(function(a,c){return a+c.price*c.qty},0);refreshPromoLine(sum);toast('Промокод применён','🎟');}
    else toast(r&&r.error?r.error:'Такого кода для доставки нет','⚠️');
  };
  renderCart=(function(_rc){return function(){var r=_rc();var sum=cart.reduce(function(a,c){return a+c.price*c.qty},0);refreshPromoLine(sum);return r;};})(renderCart);
  document.getElementById('checkoutBtn').onclick=async function(){
    if(!me){toast('Сначала войдите по номеру','👤');openAuth();return;}
    var method=document.getElementById('checkoutMethod').value;
    if(method==='delivery'){
      if(!document.getElementById('checkoutPlace').value)return toast('Выберите населённый пункт','📍');
      if(!document.getElementById('checkoutAddr').value.trim())return toast('Укажите адрес','🏠');
    }
    var body={method:method,place:document.getElementById('checkoutPlace').value,addr:document.getElementById('checkoutAddr').value.trim(),
      slot:document.getElementById('checkoutSlot').value,pay:document.getElementById('checkoutPay').value,
      comment:document.getElementById('checkoutComment').value.trim(),
      items:cart.map(function(c){return {id:c.id,oi:c.oi,qty:c.qty}})};
    if(cartPromoCode)body.promo=cartPromoCode;
    try{
      var r=await api('/orders',{method:'POST',body:body});
      toast('Заказ #'+r.order.no+' оформлен!','🎉');
      cart=[];localStorage.setItem('zt_cart','[]');
      cartPromoCode='';localStorage.removeItem('zt_cartpromo');
      var pi=document.getElementById('cartPromo');if(pi)pi.value='';
      var pl=document.getElementById('cartPromoLine');if(pl)pl.textContent='';
      updateCartFab();renderCart();
      document.getElementById('cartPanel').classList.remove('open');
    }catch(e){toast(e.message,'⚠️')}
  };
  orderCard=(function(_oc){return function(o){
    var h=_oc(o);
    if(o.promo)h=h.replace('<div class="ocTotal">','<div class="ocItems">🎟 Промокод '+esc(o.promo)+': −'+fmt(o.promodiscount||0)+'</div><div class="ocTotal">');
    return h;};})(orderCard);
  loadPromos=async function(){try{const r=await api('/promos');
    document.getElementById('pmList').innerHTML=r.promos.map(function(p){
      const exp=p.expires?new Date(p.expires).toLocaleDateString('ru-RU'):'бессрочно';
      const dead=p.expires&&new Date(p.expires)<new Date();
      const kind=p.kind==='stamp'?'+'+p.value+' штамп(а) 🌊':p.kind==='free'?'+'+p.value+' кофе 🌊':p.kind==='percent'?'−'+p.value+'% 🍕':'−'+p.value+' ₽ 🍕';
      return '<div class="logrow" style="align-items:center;gap:8px;flex-wrap:wrap">'+
        '<span class="lt">'+esc(p.code)+'</span>'+
        '<span style="flex:1;min-width:150px">'+kind+' · '+(dead?'истёк':'до '+exp)+' · лимит '+(p.maxuses||'∞')+' · исп. '+p.uses+'</span>'+
        '<button class="btn ghost" data-pt="'+p.id+'">'+(p.active?'Выкл':'Вкл')+'</button>'+
        '<button class="btn ghost danger" data-pd="'+p.id+'">🗑</button></div>';}).join('')
      ||'<div class="hmini">Пока пусто — создайте первый код</div>';}catch(e){}};

    /* ── v8: промокод меняет цену мгновенно; очистил поле — цена вернулась ── */
  var promoInfo=null;
  function promoDiscNow(sum){return promoInfo?promoDisc(sum,promoInfo):0;}
  function totalsNow(){
    var sum=cart.reduce(function(a,c){return a+c.price*c.qty},0);
    var method=document.getElementById('checkoutMethod').value;
    var pickup=method==='pickup'?Math.round(sum*0.10):0;
    var fee=0;
    if(method==='delivery'&&deliveryInfo){
      var z=deliveryInfo.zones.find(function(z){return z.places.includes(document.getElementById('checkoutPlace').value)});
      fee=z?z.fee:0;
    }
    return {sum:sum,pd:promoDiscNow(sum),total:sum-pickup-promoDiscNow(sum)+fee};
  }
  function paintTotals(){
    var t=totalsNow();
    var el=document.getElementById('cartTotal');if(el)el.textContent=fmt(t.total);
    var s=document.getElementById('cartSum');
    var cnt=cart.reduce(function(a,c){return a+c.qty},0);
    if(s)s.textContent=cnt+' поз · '+Number(t.total).toLocaleString('ru-RU');
  }
  refreshPromoLine=async function(sum){
    var line=document.getElementById('cartPromoLine');if(!line)return;
    if(!cartPromoCode){promoInfo=null;line.textContent='';paintTotals();return;}
    try{
      var r=await fetch(API_BASE+'/api/promo/info?code='+encodeURIComponent(cartPromoCode)).then(function(x){return x.json()});
      if(r.ok){promoInfo=r;localStorage.setItem('zt_cartpromo',cartPromoCode);
        line.textContent='🎟 '+r.code+': −'+fmt(promoDisc(sum,r));line.style.color='var(--green)';}
      else{promoInfo=null;localStorage.removeItem('zt_cartpromo');cartPromoCode='';
        var typed=(document.getElementById('cartPromo')||{}).value||'';
        if(typed.trim()){line.textContent='⚠️ '+(r.error||'Код не найден');line.style.color='#B3372B';}
        else line.textContent='';}
    }catch(e){}
    paintTotals();
  };
  renderCart=(function(_rc){return function(){var r=_rc();paintTotals();return r;};})(renderCart);
  updateCartFab=(function(_uf){return function(){_uf();paintTotals();};})(updateCartFab);
  var promoInput=document.getElementById('cartPromo'),promoTimer=null;
  function clearPromo(){
    cartPromoCode='';promoInfo=null;localStorage.removeItem('zt_cartpromo');
    var line=document.getElementById('cartPromoLine');if(line)line.textContent='';
    paintTotals();
  }
  if(promoInput){
    promoInput.addEventListener('input',function(){
      var v=promoInput.value.trim().toUpperCase();
      if(!v){clearPromo();return;}
      clearTimeout(promoTimer);
      promoTimer=setTimeout(function(){
        cartPromoCode=v;
        var sum=cart.reduce(function(a,c){return a+c.price*c.qty},0);
        refreshPromoLine(sum);
      },400);
    });
  }
  document.getElementById('cartPromoBtn').onclick=function(){
    var v=(promoInput?promoInput.value:'').trim().toUpperCase();
    if(!v){clearPromo();return;}
    cartPromoCode=v;
    var sum=cart.reduce(function(a,c){return a+c.price*c.qty},0);
    refreshPromoLine(sum);
  };
  document.getElementById('checkoutPlace').addEventListener('change',paintTotals);
  var _co=document.getElementById('checkoutBtn').onclick;
  document.getElementById('checkoutBtn').onclick=async function(e){
    var r=await _co.call(this,e);
    promoInfo=null;paintTotals();
    return r;
  };

    /* ── v9: слоты «ко времени» — шаг 30 мин, формат дд-мм | чч-мм ── */
  populateSlots=function(){
    var now=new Date();
    var pad=function(n){return String(n).padStart(2,'0')};
    var slots=[{v:'asap',l:'Как можно скорее (~45 мин)'}];
    for(var d=0;d<2;d++){
      for(var m=11*60;m<22*60;m+=30){
        var t=new Date(now);
        t.setDate(t.getDate()+d);
        t.setHours(Math.floor(m/60), m%60, 0, 0);
        if(t<=now)continue;
        var label=pad(t.getDate())+'.'+pad(t.getMonth()+1)+' | '+pad(t.getHours())+':'+pad(t.getMinutes());
        slots.push({v:label,l:label});
      }
    }
    var sel=document.getElementById('checkoutSlot');
    if(sel)sel.innerHTML=slots.map(function(s){return '<option value="'+s.v+'">'+s.l+'</option>'}).join('');
  };

    /* ── v10: профиль пятницы без кофейного QR, плюшки в бонусах, активация диспетчером, экран выбора ── */
  renderVerifyNote=function(){
    var host=document.getElementById('bonusBox');
    var n=document.getElementById('verifyNote');
    if(!n&&host){n=document.createElement('div');n.id='verifyNote';host.insertBefore(n,host.firstChild);}
    if(!n)return;
    if(!me){n.hidden=true;return;}
    var html='<small style="color:#5B6B7A;background:#EDF2F6;border-radius:12px;padding:8px 12px;display:block;margin-bottom:8px">Как устроены бонусы:<br>🫘 штампы — кассир начисляет по вашему QR<br>🎁 +1 штамп — привязка Telegram<br>🧾 активация профиля — код из 4 цифр на кассе</small>';
    if(!me.verified)html+='<small style="color:#8A4B2A;background:#FFF6F0;border:1.5px dashed #E4B49A;border-radius:12px;padding:8px 12px;display:block;margin-bottom:8px">🧾 Кассир назовёт 4 цифры кода активации — введите их:</small><div style="display:flex;gap:8px"><input id="actCode" inputmode="numeric" maxlength="4" placeholder="Код" style="flex:1"><button class="btn fire" id="actBtn">Активировать</button></div>';
    if(!me.welcome&&!me.tg)html+='<small style="color:#163B6B;background:#EAF1F9;border:1.5px dashed #B9CDE4;border-radius:12px;padding:8px 12px;display:block;margin-top:8px">🎁 <b>+1 штамп</b> за привязку в <a href="https://t.me/and_coffee_bot" style="color:#1F4E8C;font-weight:800">Telegram</a>: откройте бота и нажмите «Поделиться номером»</small>';
    n.hidden=false;n.innerHTML=html;
    var ab=document.getElementById('actBtn');
    if(ab)ab.onclick=async function(){try{var r=await api('/auth/activate-guest',{method:'POST',body:{code:document.getElementById('actCode').value.trim()}});me=r.customer;toast('Профиль активирован! А +1 штамп ждёт в Telegram 🎁','');renderAll();}catch(e){toast(e.message,'⚠️')}};
  };
  renderProfile=(function(_rp){return function(){var r=_rp();
    var deliv=(brand==='delivery');
    var q=document.getElementById('qrMain');var qb=q&&q.closest('.qrbox');
    if(qb)qb.style.display=deliv?'none':'';
    var st=document.querySelector('#profileBox .stats');
    if(st)st.style.display=deliv?'none':'';
    return r;};})(renderProfile);

  /* активация гостей: блок и в кассе, и у диспетчера */
  (function(){
    var ov=document.getElementById('ordersView');
    if(ov&&!document.getElementById('pendingBoxD')){
      var d=document.createElement('div');d.className='cash-card';
      d.innerHTML='<h3 style="margin:0 0 8px">🆕 Активация гостей</h3><div id="pendingBoxD"></div>';
      var listCard=document.getElementById('ordersList').closest('.cash-card');
      ov.querySelector('.cashier').insertBefore(d,listCard);
    }
  })();
  loadPending=async function(){
    try{
      var r=await api('/staff/pending');
      var html=r.pending.length?r.pending.map(function(p){
        return '<div class="hmini"><b>'+esc(p.name)+'</b> · '+esc(p.phone)+' · код: <b style="font-size:15px">'+p.actcode+'</b> <button class="btn fire" data-actg="'+p.id+'" style="margin-left:6px;padding:4px 10px;font-size:11px">Активировать</button></div>';
      }).join(''):'<div class="hmini">Все гости активированы ✅</div>';
      var a=document.getElementById('pendingBox');if(a)a.innerHTML=html;
      var b=document.getElementById('pendingBoxD');if(b)b.innerHTML=html;
    }catch(e){}
  };
  renderOrders=(function(_ro){return async function(s){var r=await _ro(s);loadPending();return r;};})(renderOrders);
  document.addEventListener('click',async function(e){
    var b=e.target.closest('[data-actg]');if(!b)return;
    try{await api('/staff/activate-guest',{method:'POST',body:{id:b.dataset.actg}});toast('Гость активирован','✅');loadPending();}
    catch(e2){toast(e2.message,'⚠️')}
  });

  /* экран выбора при открытии приложения */
  (function(){
    if(sessionStorage.getItem('splashDone'))return;
    var sp=document.createElement('div');sp.id='brandSplash';
    sp.style.cssText='position:fixed;inset:0;z-index:400;background:var(--paper);display:flex;align-items:center;justify-content:center;padding:20px';
    sp.innerHTML='<div style="max-width:560px;width:100%;text-align:center">'+
      '<div style="font:400 30px Prata,serif;margin-bottom:6px">…и кофе & «Пятница»</div>'+
      '<div style="color:var(--soft);font-size:14px;margin-bottom:26px">Выберите, куда вы сегодня</div>'+
      '<div style="display:flex;gap:14px;flex-wrap:wrap;justify-content:center">'+
      '<button data-go="coffee" style="flex:1;min-width:200px;border:2px solid var(--line);border-radius:22px;background:#fff;padding:26px 18px;font:700 16px Unbounded,sans-serif;color:var(--ink);box-shadow:var(--sh)">🌊<br><br>Кофейня<br><span style="font:400 12px Golos Text,sans-serif;color:var(--soft)">меню, штампы и бонусы</span></button>'+
      '<button data-go="delivery" style="flex:1;min-width:200px;border:2px solid #F2D9A5;border-radius:22px;background:#FFF6E5;padding:26px 18px;font:700 16px Unbounded,sans-serif;color:#6B4E0E;box-shadow:var(--sh)">🍕<br><br>«Пятница»<br><span style="font:400 12px Golos Text,sans-serif;color:#8A6D3B">доставка пиццы и роллов</span></button>'+
      '</div></div>';
    document.body.appendChild(sp);
    sp.addEventListener('click',function(e){
      var b=e.target.closest('[data-go]');if(!b)return;
      brand=b.dataset.go;
      sessionStorage.setItem('splashDone','1');
      sp.remove();
      if(mode==='cashier'||mode==='orders')setMode('guest');
      document.querySelectorAll('#brandSeg button').forEach(function(x){x.classList.toggle('on',x.dataset.brand===brand)});
      sv();
      if(brand==='delivery'&&!DMENU.length)loadDelivery();
    });
  })();

    /* ── v11: профиль в пятнице открывается (без кофейных артефактов), вкладка бонусов там скрыта, сплэш: Пятница первой ── */
  sv=(function(_sv){return function(){
    _sv();
    var pn=document.getElementById('panel');if(pn)pn.style.display='';
    var deliv=(brand==='delivery');
    var bt=document.querySelector('.tabs button[data-tab="bonus"]');
    if(bt)bt.style.display=deliv?'none':'';
    if(deliv)setTab('profile');
  };})(sv);
  renderProfile=(function(_rp){return function(){var r=_rp();
    var rb=document.getElementById('reviewBtn');var box=rb&&rb.closest('.placebox');
    if(box)box.style.display=(brand==='delivery')?'none':'';
    return r;};})(renderProfile);
  (function(){
    var sp=document.getElementById('brandSplash');if(!sp)return;
    var t=sp.querySelector('[style*="Prata"]');
    if(t)t.textContent='«Пятница»  …и кофе';
    var wrapBtns=sp.querySelector('div[style*="justify-content:center"]');
    if(wrapBtns){
      var d=wrapBtns.querySelector('[data-go="delivery"]'),c=wrapBtns.querySelector('[data-go="coffee"]');
      if(d&&c)wrapBtns.insertBefore(d,c);
    }
  })();

    /* ── v12: профиль перерисовывается при смене бренда; в пятнице прячем только QR, отзыв и ссылки остаются ── */
  renderProfile=(function(_rp){return function(){var r=_rp();
    var rb=document.getElementById('reviewBtn');var box=rb&&rb.closest('.placebox');
    if(box)box.style.display='';
    return r;};})(renderProfile);
  sv=(function(_sv){return function(){_sv();if(me)renderProfile();};})(sv);

  sv();
  console.log('fix-views v12 готов');
})();