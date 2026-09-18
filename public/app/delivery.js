/* public/app/delivery.js — F2.5: доставка — state, рендер меню и корзины. */

var DMENU = [];
var cart = JSON.parse(localStorage.getItem('zt_cart') || '[]');

// Очистка корзины от битых позиций с нулевой или отрицательной ценой
cart = cart.filter(c => c.price > 0);
localStorage.setItem('zt_cart', JSON.stringify(cart));

var deliveryInfo = null;
var promoInfo = null;
var cartPromoCode = localStorage.getItem('zt_cartpromo') || '';

const DCATS = [{ id: 'pizza', e: '🍕', l: 'Пиццы' }, { id: 'rolls', e: '🍣', l: 'Роллы' }, { id: 'sets', e: '🍱', l: 'Сеты' }, { id: 'sauces', e: '🥫', l: 'Соусы' }];
var dcat = 'pizza';

function renderDeliveryRail() {
  $('#deliveryRail').innerHTML = DCATS.map(c =>
    `<button data-dcat="${c.id}" class="${c.id === dcat ? 'on' : ''}"><span class="re">${c.e}</span>${c.l}</button>`
  ).join('');
}
$('#deliveryRail').addEventListener('click', e => {
  const b = e.target.closest('[data-dcat]');
  if (b) { dcat = b.dataset.dcat; renderDeliveryRail(); renderDeliveryMenu(); }
});

function renderDeliveryMenu() {
  const list = DMENU.filter(p => p.cat === dcat);
  let html = list.map(p => {
    const opts = p.opts || [];
    const optsHTML = opts.length
      ? `<div class="opts">${opts.map((o, i) => `<button data-id="${p.id}" data-oi="${i}">${o.l} · ${o.w} ·${fmt(o.p)}</button>`).join('')}</div>`
      : '';
    return `<article class="card">
      <div class="media" style="--tint:#F3E2CE"><span class="em">${p.e || '🍕'}</span></div>
      <div class="cbody">
        <h3>${esc(p.name)}</h3>
        ${p.desc ? `<div class="desc">${esc(p.desc)}</div>` : ''}
        ${optsHTML}
        <button class="cta" data-add="${p.id}" style="margin-top:auto">Добавить</button>
      </div>
    </article>`;
  }).join('');

  if (typeof editMode !== 'undefined' && editMode) {
    html += `<article class="card add-card" id="addDelivCard">
      <div style="font-size:32px">➕</div>
      <div>Добавить позицию в доставку</div>
    </article>`;
  }

  if (list.length === 0 && (!typeof editMode !== 'undefined' || !editMode)) {
    html += '<div class="gempty">В этой категории пока пусто</div>';
  }

  $('#deliveryGrid').innerHTML = html;

  const addCard = document.getElementById('addDelivCard');
  if (addCard) {
    addCard.onclick = () => openEditor(null, 'delivery');
  }
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
    
    // Строгая проверка: если у товара есть опции (размеры), требуем их выбора
    const selOpt = add.closest('.cbody').querySelector('.opts button.sel');
    if (opts.length > 0 && !selOpt) {
      toast('Выберите размер и тесто', '⚠️');
      return;
    }

    const oi = selOpt ? +selOpt.dataset.oi : -1;
    const price = oi >= 0 ? opts[oi].p : (+p.price || 0);

    if (price <= 0) {
      toast('Выберите размер', '⚠️');
      return;
    }

    const key = id + (oi >= 0 ? '_' + oi : '');
    const existing = cart.find(c => c.key === key);
    if (existing) existing.qty++;
    else cart.push({ key, id, oi, name: p.name, opt: oi >= 0 ? opts[oi].l : null, price: price, sz: oi >= 0 ? (opts[oi].sz || 0) : 0, qty: 1 });
    
    localStorage.setItem('zt_cart', JSON.stringify(cart));
    updateCartFab();
    toast('Добавлено в корзину', '🛒');
  }
});

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
    populatePlaces();
    populateSlots();
    renderDeliveryRail();
    renderDeliveryMenu();
    updateCartFab();
  } catch(e) {}
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
    sel.innerHTML = slots.map(function(s){ return '<option value="' + s.v + '">' + s.l + '</option>'; }).join('');
  }
};

window.updateCartFab = function(){
  var t = totalsNow();
  var fab = document.getElementById('cartFab');
  if (fab) fab.hidden = (t.sum === 0);
  paintTotals();
  cartFabShow();
};

window.totalsNow = function(){
  var sum = cart.reduce(function(a,c){ return a + c.price * c.qty; }, 0);
  var method = document.getElementById('checkoutMethod').value;
  var pickup = method === 'pickup' ? Math.round(sum * 0.10) : 0;
  var fee = 0;
  if (method === 'delivery' && deliveryInfo) {
    var z = deliveryInfo.zones.find(function(z){ return z.places.includes(document.getElementById('checkoutPlace').value); });
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