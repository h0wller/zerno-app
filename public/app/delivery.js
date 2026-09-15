/* public/app/delivery.js — F2.5: доставка — state, рендер меню и корзины.
   ВАЖНО: без IIFE — fix-views.js оборачивает renderCart (231), renderDeliveryMenu
   (331/1362/1482), renderDeliveryRail (328).
   loadDelivery / populateSlots / updateCartFab остаются в index.html:
   fix-views полностью их перезаписывает (см. docs/frontend-todo.md). */

var DMENU = [];
var cart = JSON.parse(localStorage.getItem('zt_cart') || '[]');
var deliveryInfo = null;
var promoInfo = null;
var cartPromoCode = localStorage.getItem('zt_cartpromo') || '';

const DCATS = [{ id: 'pizza', e: '🍕', l: 'Пиццы' }, { id: 'rolls', e: '🍣', l: 'Роллы' }, { id: 'sets', e: '🍱', l: 'Сеты' }, { id: 'sauces', e: '🥫', l: 'Соусы' }];
var dcat = 'pizza';

/* ── рейл категорий ── */
function renderDeliveryRail() {
  $('#deliveryRail').innerHTML = DCATS.map(c =>
    `<button data-dcat="${c.id}" class="${c.id === dcat ? 'on' : ''}"><span class="re">${c.e}</span>${c.l}</button>`
  ).join('');
}
$('#deliveryRail').addEventListener('click', e => {
  const b = e.target.closest('[data-dcat]');
  if (b) { dcat = b.dataset.dcat; renderDeliveryRail(); renderDeliveryMenu(); }
});

/* ── сетка блюд ── */
function renderDeliveryMenu() {
  const list = DMENU.filter(p => p.cat === dcat);
  $('#deliveryGrid').innerHTML = list.map(p => {
    const opts = p.opts || [];
    const optsHTML = opts.length
      ?  `<div class="opts">${opts.map((o, i) =>` <button data-id= "${p.id} " data-oi= "${i} " >${o.l} · ${o.w} · ${fmt(o.p)} </button > `).join('')}</div>` 
: '';
    return `<article class="card" style="--d:0">
      <div class="media" style="--tint:#F3E2CE"><span class="em">${p.e || '🍕'}</span></div>
      <div class="cbody">
        <h3>${esc(p.name)}</h3>
        ${p.desc ? `<div class="desc">${esc(p.desc)}</div>` : ''}
        ${optsHTML}
        <button class="cta" data-add="${p.id}" style="margin-top:auto">Добавить</button>
      </div>
    </article>`;
  }).join('') || '<div class="gempty">В этой категории пока пусто</div>';
}

$('#deliveryGrid').addEventListener('click', e => {
  const opt = e.target.closest('.opts button');
  if (opt) {
    const group = opt.closest('.opts');
    group.querySelectorAll('button').forEach(b => b.classList.remove('sel'));
    opt.classList.add('sel');
    return;
  }
  const add = e.target.closest('[data-add]');
  if (add) {
    const id = add.dataset.add;
    const p = DMENU.find(x => x.id === id);
    const opts = p.opts || [];
    const selOpt = add.closest('.cbody').querySelector('.opts button.sel');
    const oi = selOpt ? +selOpt.dataset.oi : -1;
    const key = id + (oi >= 0 ? '_' + oi : '');
    const existing = cart.find(c => c.key === key);
    if (existing) existing.qty++;
    else cart.push({ key, id, oi, name: p.name, opt: oi >= 0 ? opts[oi].l : null, price: oi >= 0 ? opts[oi].p : (+p.price || 0), sz: oi >= 0 ? (opts[oi].sz || 0) : 0, qty: 1 });
    localStorage.setItem('zt_cart', JSON.stringify(cart));
    updateCartFab();
    toast('Добавлено в корзину', '🛒');
  }
});

/* ── корзина ── */
$('#cartFab').onclick = () => { $('#cartPanel').classList.add('open'); };
$('#cartClose').onclick = () => { $('#cartPanel').classList.remove('open'); };

function renderCart() {
  $('#cartItems').innerHTML = cart.map((c, i) => `<div class="cartItem">
    <div style="flex:1"><b>${esc(c.name)}</b>${c.opt ? `<div style="font-size:12px;color:var(--soft)">${esc(c.opt)}</div>` : ''}</div>
    <div class="qty"><button data-ci="${i}" data-act="-">−</button><span>${c.qty}</span><button data-ci="${i}" data-act="+">+</button></div>
    <div style="font-weight:700">${fmt(c.price * c.qty)}</div>
  </div>`).join('') || '<div style="color:var(--soft);text-align:center;padding:20px">Корзина пуста</div>';
  const sum = cart.reduce((a, c) => a + c.price * c.qty, 0);
  const method = $('#checkoutMethod').value;
  const discount = method === 'pickup' ? Math.round(sum * 0.10) : 0;
  const fee = method === 'delivery' && deliveryInfo ? (deliveryInfo.zones.find(z => z.places.includes($('#checkoutPlace').value))?.fee || 0) : 0;
  $('#cartTotal').textContent = fmt(sum - discount + fee);
  $('#cartDiscount').textContent = discount ? `−10% самовывоз: −${fmt(discount)}` : '';
  $('#cartFee').textContent = fee ? `Доставка: ${fmt(fee)}` : '';
  const gifts = [];
  const wp2 = deliveryInfo && deliveryInfo.weekPromo;
  if (wp2 && wp2.gift && sum > 0) { const q = wp2.threshold > 0 ? Math.floor(sum / wp2.threshold) : 1; if (q > 0) gifts.push(`🎁 ${wp2.gift} ×${q}`); }
  const pm2 = deliveryInfo && deliveryInfo.pizzaMonth;
  if (pm2) { const big = cart.reduce((a, c) => a + ((c.sz === 35) ? c.qty : 0), 0); if (big >= 2) gifts.push(`🎁 ${pm2.name} — подарок`); }
  $('#cartGifts').innerHTML = gifts.join('<br>');
}

$('#cartItems').addEventListener('click', e => {
  const b = e.target.closest('[data-ci]');
  if (!b) return;
  const i = +b.dataset.ci;
  if (b.dataset.act === '+') cart[i].qty++;
  else if (cart[i].qty > 1) cart[i].qty--;
  else cart.splice(i, 1);
  localStorage.setItem('zt_cart', JSON.stringify(cart));
  updateCartFab();
  renderCart();
});

$('#checkoutMethod').onchange = () => {
  const pickup = $('#checkoutMethod').value === 'pickup';
  $('#checkoutPlaceLabel').hidden = pickup;
  $('#checkoutAddrLabel').hidden = pickup;
  renderCart();
};

$('#cartFab').onclick = () => { renderCart(); $('#cartPanel').classList.add('open'); };

/* ── оформление ── */
function populatePlaces() {
  if (!deliveryInfo) return;
  const places = deliveryInfo.zones.flatMap(z => z.places);
  $('#checkoutPlace').innerHTML = places.map(p => `<option>${p}</option>`).join('');
}

$('#checkoutBtn').onclick = async () => {
  if (!me) { toast('Сначала войдите в профиль', '👤'); openAuth(); return; }
  const method = $('#checkoutMethod').value;
  if (method === 'delivery') {
    if (!$('#checkoutPlace').value) return toast('Выберите населённый пункт', '📍');
    if (!$('#checkoutAddr').value.trim()) return toast('Укажите адрес', '🏠');
  }
  const body = {
    method,
    place: $('#checkoutPlace').value,
    addr: $('#checkoutAddr').value.trim(),
    slot: $('#checkoutSlot').value,
    pay: $('#checkoutPay').value,
    comment: $('#checkoutComment').value.trim(),
    items: cart.map(c => ({ id: c.id, oi: c.oi, qty: c.qty }))
  };
  try {
    const r = await api('/orders', { method: 'POST', body });
    toast(`Заказ #${r.order.no} оформлен!`, '🎉');
    cart = [];
    localStorage.setItem('zt_cart', '[]');
    updateCartFab();
    $('#cartPanel').classList.remove('open');
  } catch (e) { toast(e.message, '⚠️'); }
};
/* ══ Ф3.7: loadDelivery, populateSlots, updateCartFab ══ */
/* Перенесено из fix-views.js и мёртвого кода index.html */

window.loadDelivery = async function(){
  try {
    var r;
    if (me && me.role === 'admin') {
      var all = await api('/menu/all');
      r = { items: (all.items || []).filter(function(p){ return p.section === 'delivery'; }) };
    } else {
      r = await api('/dmenu');
    }
    
    DMENU = r.items || [];
    deliveryInfo = await fetch(API_BASE + '/api/delivery/info').then(function(x){ return x.json(); });
    
    var wp = deliveryInfo.weekPromo, pm = deliveryInfo.pizzaMonth;
    var bEl = document.getElementById('deliveryBanner');
    if (bEl) {
      bEl.innerHTML = (wp ? '<div class="deliveryBanner">🎁 ' + esc(wp.text) + '</div>' : '') +
                      (pm ? '<div class="deliveryBanner">🍕 2 пиццы 35 см → «' + esc(pm.name) + '» в подарок!</div>' : '');
    }
    
    populatePlaces();
    populateSlots();
    renderDeliveryRail();
    renderDeliveryMenu();
    updateCartFab();
  } catch(e) {
    console.log('delivery load err', e);
  }
};

window.populateSlots = function(){
  var now = new Date();
  var pad = function(n){ return String(n).padStart(2, '0'); };
  var slots = [{ v: 'asap', l: 'Как можно скорее (~45 мин)' }];
  
  for (var d = 0; d < 2; d++) {
    for (var m = 660; m < 1320; m += 30) {
      var t = new Date(now);
      t.setDate(t.getDate() + d);
      t.setHours(Math.floor(m / 60), m % 60, 0, 0);
      if (t <= now) continue;
      
      var label = pad(t.getDate()) + '-' + pad(t.getMonth() + 1) + ' | ' + pad(t.getHours()) + '-' + pad(t.getMinutes());
      slots.push({ v: label, l: label });
    }
  }
  
  var sel = document.getElementById('checkoutSlot');
  if (sel) {
    sel.innerHTML = slots.map(function(s){ 
      return '<option value="' + s.v + '">' + s.l + '</option>'; 
    }).join('');
  }
};

window.updateCartFab = function(){
  var t = totalsNow();
  var fab = document.getElementById('cartFab');
  if (fab) fab.hidden = (t.sum === 0);
  paintTotals();
  cartFabShow();
};
/* ══ Ф3.7: totalsNow, paintTotals, cartFabShow (зависимости updateCartFab) ═ */
window.totalsNow = function(){
  var sum = cart.reduce(function(a,c){ return a + c.price * c.qty; }, 0);
  var method = document.getElementById('checkoutMethod').value;
  var pickup = method === 'pickup' ? Math.round(sum * 0.10) : 0;
  var fee = 0;
  if (method === 'delivery' && deliveryInfo) {
    var z = deliveryInfo.zones.find(function(z){ 
      return z.places.includes(document.getElementById('checkoutPlace').value); 
    });
    fee = z ? z.fee : 0;
  }
  var pd = promoInfo ? promoDisc(sum, promoInfo) : 0;
  return { sum: sum, pickup: pickup, fee: fee, pd: pd, total: sum - pickup - pd + fee };
};

window.paintTotals = function(){
  var t = totalsNow();
  var el = document.getElementById('cartTotal');
  if (el) el.textContent = fmt(t.total);
  var s = document.getElementById('cartSum');
  var cnt = cart.reduce(function(a,c){ return a + c.qty; }, 0);
  if (s) s.textContent = cnt + ' поз · ' + Number(t.total).toLocaleString('ru-RU');
};

window.cartFabShow = function(){
  var cf = document.getElementById('cartFab');
  if (cf) cf.style.display = ((mode === 'guest' || mode === 'admin') && brand === 'delivery') ? '' : 'none';
};

function promoDisc(sum, info){
  return info.kind === 'percent' ? Math.round(sum * Math.min(90, info.value) / 100) : Math.min(info.value || 0, sum);
}
/* ── Ф3.18: пост-обработка карточек доставки (стоп-лист, фото, карандаши, тумблеры, размеры).
Слияние секции 4 + R8 + v62 fix-views в одну реализацию.
Повторный тап по размеру НЕ здесь — он в cart.js (Ф3.9). ── */
(function(){
'use strict';
var css=document.createElement('style');
css.textContent='#deliveryGrid .card .media img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;display:block}';
document.head.appendChild(css);
function patchCards(){
var list=(typeof DMENU!=='undefined'?DMENU:[]).filter(function(p){return p.cat===(typeof dcat!=='undefined'?dcat:'pizza');});
var cards=document.querySelectorAll('#deliveryGrid .card');
var editing=document.body.classList.contains('editing');
cards.forEach(function(card,i){
var p=list[i];if(!p)return;
card.classList.toggle('stopped',!p.on);
var media=card.querySelector('.media');
if(media){
var sb=media.querySelector('.stopbadge');
if(!p.on&&!sb){sb=document.createElement('span');sb.className='stopbadge';sb.textContent='СТОП';media.appendChild(sb);}
if(p.on&&sb)sb.remove();
if(p.img&&!media.querySelector('img')){var em=media.querySelector('.em');if(em)em.remove();
var im=document.createElement('img');im.src=p.img;im.alt=p.name||'';media.appendChild(im);}
}
var add=card.querySelector('[data-add]');
if(add){
if(!p.on){add.disabled=true;add.style.opacity='.45';add.style.pointerEvents='none';add.textContent='СТОП — недоступно';}
else if(add.disabled){add.disabled=false;add.style.opacity='';add.style.pointerEvents='';add.textContent='Добавить';}
}
card.querySelectorAll('.opts button').forEach(function(b){
if(b.querySelector('.ol'))return;
var parts=b.textContent.split(' · ');
if(parts.length<3)return;
b.innerHTML='<span class="ol">'+parts[0]+'</span><span class="op">'+parts[1]+' · '+parts[2]+'</span>';
});
card.querySelectorAll('.opts button.sel').forEach(function(b){b.classList.remove('sel');});
if(editing){
card.style.position='relative';
if(!card.querySelector('.edBtn')){var b=document.createElement('button');b.type='button';b.className='edBtn';b.dataset.ed=p.id;b.textContent='✏️';card.appendChild(b);}
var lab=card.querySelector('.donoff');
if(!lab){lab=document.createElement('label');lab.className='donoff';lab.innerHTML='<input type="checkbox" data-onoff="'+p.id+'">в меню';card.appendChild(lab);}
lab.querySelector('input').checked=!!p.on;
}else{
var d2=card.querySelector('.donoff');if(d2)d2.remove();
var e2=card.querySelector('.edBtn');if(e2)e2.remove();
}
});
}
window.patchCards=patchCards;
/* соусы не нужны в рейле */
renderDeliveryRail=(function(_rr){return function(){var r=_rr.apply(this,arguments);
var b=document.querySelector('#deliveryRail [data-dcat="sauces"]');if(b)b.remove();
return r;};})(renderDeliveryRail);
/* единственная пост-обработка при рендере меню */
renderDeliveryMenu=(function(_rm){return function(){var r=_rm.apply(this,arguments);
try{patchCards();}catch(e){}
return r;};})(renderDeliveryMenu);
/* карандаш → редактор */
document.addEventListener('click',function(e){
var b=e.target.closest('#deliveryGrid .edBtn');if(!b)return;
e.stopPropagation();e.preventDefault();
var id=b.getAttribute('data-ed');
if(id&&typeof openEditor==='function')openEditor(id);
},true);
/* стоп-гард клика + шейк «выбери размер» */
document.getElementById('deliveryGrid').addEventListener('click',function(e){
var add=e.target.closest('[data-add]');if(!add)return;
var p=(typeof DMENU!=='undefined'?DMENU:[]).find(function(x){return x.id===add.getAttribute('data-add');});
if(p&&!p.on){e.stopPropagation();e.preventDefault();toast('Позиция в стоп-листе — недоступна для заказа','⛔');return;}
var body=add.closest('.cbody');var optsBox=body&&body.querySelector('.opts');
if(optsBox&&!optsBox.querySelector('.sel')){
e.stopPropagation();
toast('Выберите размер пиццы 🍕','');
optsBox.classList.remove('shake');void optsBox.offsetWidth;optsBox.classList.add('shake');
}
},true);
/* снятие шейка */
document.addEventListener('animationend',function(e){
if(e.target&&e.target.classList&&e.target.classList.contains('shake'))e.target.classList.remove('shake');
},true);
/* ЕДИНСТВЕННЫЙ обработчик тумблера стоп-листа */
document.getElementById('deliveryGrid').addEventListener('change',async function(e){
var t=e.target.closest('.donoff [data-onoff]');if(!t)return;
e.stopPropagation();
var p=(typeof DMENU!=='undefined'?DMENU:[]).find(function(x){return x.id===t.getAttribute('data-onoff');});
if(!p)return;
p.on=t.checked?1:0;
try{
await api('/menu/'+p.id,{method:'PUT',body:p});
await loadDelivery();
toast(t.checked?'«'+esc(p.name)+'» снова в меню':'«'+esc(p.name)+'» → стоп-лист',t.checked?'✅':'⛔');
}catch(err){
toast(err.message,'⚠️');
loadDelivery();
}
},true);
/* вход/выход из режима правки + живые перерисовки сетки */
document.getElementById('editToggle').addEventListener('click',function(){setTimeout(patchCards,80);setTimeout(patchCards,400);});
new MutationObserver(function(){if(document.body.classList.contains('editing'))patchCards();}).observe(document.getElementById('deliveryGrid')||document.body,{childList:true,subtree:true});
setTimeout(patchCards,300);
})();