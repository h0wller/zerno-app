/* public/app/delivery.js — F2.5: доставка — state, рендер меню и корзины.
   ВАЖНО: без IIFE — fix-views.js оборачивает renderCart (231), renderDeliveryMenu
   (331/1362/1482), renderDeliveryRail (328).
   loadDelivery / populateSlots / updateCartFab остаются в index.html:
   fix-views полностью их перезаписывает (см. docs/frontend-todo.md). */

var DMENU = [];
var cart = JSON.parse(localStorage.getItem('zt_cart') || '[]');
var deliveryInfo = null;
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
      ? `<div class="opts">${opts.map((o, i) => `<button data-id="${p.id}" data-oi="${i}" class="${i === 0 ? 'sel' : ''}">${o.l} · ${o.w} · ${fmt(o.p)}</button>`).join('')}</div>`
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