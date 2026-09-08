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
  sv();
  console.log('fix-views v4 готов');
})();