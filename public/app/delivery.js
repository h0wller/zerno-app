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
    
    // Генерируем чипсы опций. Первый вариант (i === 0) по умолчанию выбран (.sel).
    // ВАЖНО: оборачиваем текст в .ol и .op, чтобы CSS из views.js корректно красил веса/цены.
    const optsHTML = opts.length
      ? `<div class="opts">
          
          ${opts.map((o, i) => {
            // Без автоподсветки: .sel вешается только тапом пользователя
            // (или кнопкой «Добавить» как обратная связь)
            return `<button type="button" data-id="${p.id}" data-oi="${i}">
              <span class="ol">${esc(o.l)}</span> <span class="op">${esc(o.w)} · ${fmt(o.p)}</span>
            </button>`;
          }).join('')}

        </div>`
      : '';

    return `<article class="card" data-product-id="${p.id}">
      <div class="media" style="--tint:#F3E2CE"><span class="em">${p.e || '🍕'}</span></div>
      <div class="cbody">
        <h3>${esc(p.name)}</h3>
        ${p.desc ? `<div class="desc">${esc(p.desc)}</div>` : ''}
        ${optsHTML}
        <button class="cta" data-add="${p.id}">Добавить</button>
      </div>
    </article>`;
  }).join('');

  if (typeof editMode !== 'undefined' && editMode) {
    html += `<article class="card add-card" id="addDelivCard">
      <div style="font-size:32px">➕</div>
      <div>Добавить позицию в доставку</div>
    </article>`;
  }

  if (list.length === 0 && (typeof editMode === 'undefined' || !editMode)) {
    html += '<div class="gempty">В этой категории пока пусто</div>';
  }

   $('#deliveryGrid').innerHTML = html;
  patchDeliveryCards(list);

  const addCard = document.getElementById('addDelivCard');
  if (addCard) {
    addCard.onclick = () => openEditor(null, 'delivery');
  }
}

/* ── состояния карточек: стоп-лист + кнопка «Добавить» (вынесены на верхний уровень) ── */
function patchDeliveryCards(list) {
  const cards = $('#deliveryGrid').querySelectorAll('.card');
  const editing = (typeof editMode !== 'undefined' && editMode);
  cards.forEach((card, i) => {
    const p = list[i]; if (!p) return;
    card.classList.toggle('stopped', !p.on);
    const media = card.querySelector('.media');
    if (media) {
      let sb = media.querySelector('.stopbadge');
      if (!p.on && !sb) { sb = document.createElement('span'); sb.className = 'stopbadge'; sb.textContent = 'СТОП'; media.appendChild(sb); }
      if (p.on && sb) sb.remove();
      /* Ф3.28: фото позиции в карточке (было fix-views v62) */
      if (p.img && !media.querySelector('img')) {
        const em = media.querySelector('.em'); if (em) em.remove();
        const im = document.createElement('img');
        im.src = p.img; im.alt = p.name || ''; im.loading = 'lazy';
        media.appendChild(im);
      }
    }
    const add = card.querySelector('[data-add]');
    if (add) {
      if (!p.on) { add.disabled = true; add.classList.remove('incart', 'added'); add.textContent = 'СТОП — недоступно'; }
      else if (add.disabled) { add.disabled = false; }
    }
    /* Ф3.28: карандаш и тумблер «в меню» только в режиме правки (было fix-views v62) */
    if (editing) {
      if (!card.querySelector('.edBtn')) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'edBtn'; b.dataset.ed = p.id; b.textContent = '✏️';
        card.appendChild(b);
      }
      let lab = card.querySelector('.donoff');
      if (!lab) {
        lab = document.createElement('label'); lab.className = 'donoff';
        lab.innerHTML = '<input type="checkbox" data-onoff="' + p.id + '">в меню';
        card.appendChild(lab);
      }
      const inp = lab.querySelector('input'); if (inp) inp.checked = !!p.on;
    } else {
      const d2 = card.querySelector('.donoff'); if (d2) d2.remove();
      const e2 = card.querySelector('.edBtn'); if (e2) e2.remove();
    }
  });
  syncAddButtons();
}

/* Кнопка подсвечена ТОЛЬКО когда позиция уже в корзине */
function syncAddButtons() {
  document.querySelectorAll('#deliveryGrid [data-add]').forEach(b => {
    if (b.disabled) return;
    const n = cart.reduce((a, c) => a + (String(c.id) === String(b.dataset.add) ? c.qty : 0), 0);
    b.classList.toggle('incart', n > 0);
    if (!b.classList.contains('added')) b.textContent = n > 0 ? ('В корзине · ' + n) : 'Добавить';
  });
}

$('#deliveryGrid').addEventListener('click', e => {
  // 0. Тап по карточке (мимо чипсов и кнопок) — режим выбора размера
  const card = e.target.closest('#deliveryGrid .card');
  if (card && !e.target.closest('.opts button') && !e.target.closest('[data-add]') && !e.target.closest('.edBtn') && !e.target.closest('.donoff')) {
    const optsBox = card.querySelector('.opts');
    const addBtn = card.querySelector('[data-add]');
    const p = DMENU.find(x => String(x.id) === String(addBtn && addBtn.dataset.add));
    if (p && (p.opts || []).length && optsBox) {
      if (!optsBox.querySelector('.sel')) {
        optsBox.classList.remove('shake'); void optsBox.offsetWidth; optsBox.classList.add('shake');
        optsBox.scrollIntoView({ block: 'center', behavior: 'smooth' });
        if (typeof toast === 'function') toast('Выберите размер и тесто 🍕', '');
      }
    } else if (p && addBtn) {
      addBtn.click(); // без размеров (соусы) — сразу в корзину
    }
    return;
  }
  // 1. Клик по чипсу размера/теста
  const optBtn = e.target.closest('.opts button');
  if (optBtn) {
    const group = optBtn.closest('.opts');
    const wasSel = optBtn.classList.contains('sel');
    group.querySelectorAll('button').forEach(b => b.classList.remove('sel'));
    // Повторный клик по выбранному чипсу отменяет выбор
    if (!wasSel) optBtn.classList.add('sel');
    return;
  }

  // 2. Клик по кнопке «Добавить»
  const addBtn = e.target.closest('[data-add]');
  if (addBtn) {
    const id = addBtn.dataset.add;
    const p = DMENU.find(x => String(x.id) === String(id));
    if (!p) return;
    
    const opts = p.opts || [];
    const cardBody = addBtn.closest('.cbody');
    
    // Ищем выбранный вариант. 
    // Fallback: если пользователь ничего не нажал (или .sel слетел), принудительно берем первый.
    let selOpt = cardBody ? cardBody.querySelector('.opts button.sel') : null;
if (!selOpt && opts.length > 0) {
const optsBox = (cardBody && cardBody.querySelector('.opts')) || null;
if (optsBox) {
optsBox.classList.remove('shake'); void optsBox.offsetWidth; optsBox.classList.add('shake');
optsBox.scrollIntoView({ block: 'center', behavior: 'smooth' });
}
if (typeof toast === 'function') toast('Выберите размер и тесто 🍕', '');
return;
}
const oi = selOpt ? parseInt(selOpt.dataset.oi, 10) : -1;
    
    if (opts.length > 0 && oi === -1) {
      if (typeof toast === 'function') toast('Выберите размер и тесто', '⚠️');
      return;
    }

    const price = (oi >= 0 && opts[oi]) ? Number(opts[oi].p) : (Number(p.price) || 0);
    if (price <= 0) {
      if (typeof toast === 'function') toast('Ошибка цены', '⚠️');
      return;
    }

    const optLabel = (oi >= 0 && opts[oi]) ? opts[oi].l : null;
    const key = id + (oi >= 0 ? '_' + oi : '');
    
    const existing = cart.find(c => String(c.key) === String(key));

    if (existing) {
      existing.qty++;
    } else {
      cart.push({
        key: key,
        id: id,
        oi: oi,
        name: p.name,
        opt: optLabel,
        price: price,
        sz: (oi >= 0 && opts[oi]) ? (Number(opts[oi].sz) || 0) : 0,
        qty: 1
      });
    }
    
    localStorage.setItem('zt_cart', JSON.stringify(cart));
    
    /* Обратная связь: CSS-вспышка без смены текста → без reflow/CLS */
    if (typeof syncAddButtons === 'function') syncAddButtons();
    addBtn.classList.add('added');
    setTimeout(() => addBtn.classList.remove('added'), 700);
    
    if (typeof updateCartFab === 'function') updateCartFab();
    if (typeof toast === 'function') toast('Добавлено в корзину', '🛒');
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
  if (typeof updateCartFab === 'function') updateCartFab();
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

function skelCards(n){
var c='<div class="card skeleton-card"><div class="media skeleton-shimmer"></div><div class="cbody"><div class="skeleton-line" style="width:65%;height:14px"></div><div class="skeleton-line" style="width:85%;height:12px"></div><div class="skeleton-line" style="width:45%;height:12px;margin-top:auto"></div></div></div>';
var out='';for(var i=0;i<n;i++)out+=c;return out;
}
window.loadDelivery = async function(){
try {
var g=document.getElementById('deliveryGrid');
if(g && !DMENU.length){ g.innerHTML=skelCards(6); }
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
  var pm = typeof window.preorderMode === 'function' ? window.preorderMode() : null;
  var sel = document.getElementById('checkoutSlot');
  var prev = sel ? sel.value : '';
  var days = {};
  var dFrom = pm === 'tomorrow' ? 1 : 0;
  var dTo = pm === 'today' ? 1 : 2;

  // Список занятых слотов с бэкенда
  var busyList = (deliveryInfo && Array.isArray(deliveryInfo.busySlots)) ? deliveryInfo.busySlots : [];

  for (var d = dFrom; d < dTo; d++) {
    var items = [];
    // Стартуем с 11:30 (690 мин), шагаем по 30 мин до 22:00 (1320 мин)
    for (var m = 690; m < 1320; m += 30) {
      var t = new Date(now);
      t.setDate(t.getDate() + d);
      t.setHours(Math.floor(m / 60), m % 60, 0, 0);

      var tEnd = new Date(t.getTime() + 30 * 60 * 1000);

      // Если слот на сегодня наступает меньше чем через 45 минут — пропускаем
      if (d === 0 && (t.getTime() - now.getTime() < 45 * 60 * 1000)) continue;

      var datePart = pad(t.getDate()) + '.' + pad(t.getMonth() + 1);
      var startPart = pad(t.getHours()) + ':' + pad(t.getMinutes());
      var endPart = pad(tEnd.getHours()) + ':' + pad(tEnd.getMinutes());

      // Значение слота: 26.09 | 11:30–12:00
      var slotVal = datePart + ' | ' + startPart + '–' + endPart;
      var slotLabel = startPart + ' – ' + endPart;
      var isBusy = busyList.indexOf(slotVal) > -1;

      items.push({ 
        v: slotVal, 
        l: slotLabel + (isBusy ? ' (мест нет)' : ''),
        disabled: isBusy 
      });
    }

    if (items.length) {
      var dt = new Date(now); dt.setDate(dt.getDate() + d);
      days[d] = { 
        label: (d === 0 ? 'Сегодня' : 'Завтра') + ' (' + pad(dt.getDate()) + '.' + pad(dt.getMonth() + 1) + ')', 
        items: items 
      };
    }
  }

  var html = '';
  if (pm) html += '<option value="" disabled selected>⏰ Выберите интервал доставки…</option>';
  else html += '<option value="asap">Как можно скорее (~45 мин)</option>';

  Object.keys(days).forEach(function (k) {
    html += '<optgroup label="' + days[k].label + '">' + 
      days[k].items.map(function (s) { 
        return '<option value="' + s.v + '"' + (s.disabled ? ' disabled style="color:#8E9AA5;background:#F0F4F8"' : '') + '>' + s.l + '</option>'; 
      }).join('') + 
    '</optgroup>';
  });

  if (sel) {
    sel.innerHTML = html;
    if (prev) {
      for (var i = 0; i < sel.options.length; i++) {
        if (sel.options[i].value === prev && !sel.options[i].disabled) { 
          sel.value = prev; 
          break; 
        }
      }
    }
    sel.classList.toggle('need-slot', !!pm && !sel.value);
  }
};
/* ── Ф3.60: подсветка селекта времени в режиме предзаказа ── */
(function(){
var s = document.createElement('style');
s.textContent = '#checkoutSlot.need-slot{border:2px solid var(--flame);background:#FFF6E5;font-weight:700}';
document.head.appendChild(s);
})();

window.updateCartFab = function(){
  var t = totalsNow();
  var fab = document.getElementById('cartFab');
  if (fab) fab.hidden = (t.sum === 0);
  paintTotals();
  if (typeof syncAddButtons === 'function') syncAddButtons();
  cartFabShow();
  var cb = document.getElementById('checkoutBtn');
if (cb) {
var pm = typeof window.preorderMode === 'function' ? window.preorderMode() : null;
}
}


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

/* ── Рабочие часы: единая проверка для всех обработчиков оформления ── */
/* Ф3.59: режимы предзаказа: 'today' — до открытия (<11:00), 'tomorrow' — после закрытия (>=22:00), null — работаем */
window.preorderMode = function () {
var h = new Date().getHours();
if (h >= 22) return 'tomorrow';
if (h < 11) return 'today';
return null;
};
window.assertServiceOpen = function () { return window.preorderMode() === null; };
window.preorderSlot = function () { return ''; }; // deprecated: слот берём из select

/* ── Ф3.28: стоп-лист и редактор карточек доставки (было fix-views v62) ── */
$('#deliveryGrid').addEventListener('change', async function (e) {
  const t = e.target.closest('.donoff [data-onoff]'); if (!t) return;
  e.stopPropagation();
  const p = DMENU.find(x => String(x.id) === String(t.dataset.onoff)); if (!p) return;
  p.on = t.checked ? 1 : 0;
try {
await api('/menu/' + p.id, { method: 'PUT', body: p });
renderDeliveryMenu();   // локальный рендер из обновлённого DMENU — без stale-рефетча
toast(t.checked ? '«' + esc(p.name) + '» снова в меню' : '«' + esc(p.name) + '» → стоп-лист', t.checked ? '✅' : '⛔');
} catch (err) { toast(err.message, '⚠️'); await loadDelivery(); }
}, true);

$('#deliveryGrid').addEventListener('click', function (e) {
  const b = e.target.closest('.edBtn[data-ed]'); if (!b) return;
  e.stopPropagation(); e.preventDefault();
  if (typeof openEditor === 'function') openEditor(b.dataset.ed);
}, true);