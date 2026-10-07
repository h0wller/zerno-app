function getKaliningradTime() {
  if (typeof window.getKaliningradTime === 'function' && window.getKaliningradTime !== getKaliningradTime) {
    return window.getKaliningradTime();
  }
  var d = new Date();
  var h = (d.getUTCHours() + 2) % 24;
  return { hour: h, minute: d.getUTCMinutes() };
}

function isDeliveryServiceOpen() {
  var t = getKaliningradTime();
  var min = t.hour * 60 + t.minute;
  return min >= 660 && min < 1320;
}

if (typeof window !== 'undefined') {
  window.isDeliveryServiceOpen = isDeliveryServiceOpen;
  window.getKaliningradTime = getKaliningradTime;
}

function _getKaliningradHour() {
  try {
    var str = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Kaliningrad',
      hour: 'numeric',
      hour12: false
    }).format(new Date());
    return parseInt(str, 10);
  } catch (e) {
    var now = new Date();
    return (now.getUTCHours() + 2) % 24;
  }
}

/* public/app/delivery.js — F2.5: доставка — state, рендер меню, субфильтры и корзина */

window.DMENU = [];
window.cart = JSON.parse(localStorage.getItem('zt_cart') || '[]');

// Очистка корзины от битых позиций с нулевой или отрицательной ценой
cart = cart.filter(c => c.price > 0);
localStorage.setItem('zt_cart', JSON.stringify(cart));

window.deliveryInfo = null;
window.promoInfo = null;
window.cartPromoCode = localStorage.getItem('zt_cartpromo') || '';

const DCATS = [
  { id: 'pizza', e: '🍕', l: 'Пиццы' },
  { id: 'rolls', e: '🍣', l: 'Роллы' },
  { id: 'sets', e: '🍱', l: 'Сеты' },
  { id: 'drinks', e: '🥤', l: 'Напитки' },
  { id: 'sauces', e: '🥫', l: 'Допы и соусы' }
];
window.dcat = 'pizza';

/* ── Субфильтрация: состояние и табы ── */
var activeAddonTab = 'all';
var activeIngredient = 'all';

// Только допы: без напитков
var ADDON_TABS = [
  { id: 'all', label: 'Все' },
  { id: 'sauces', label: '🥫 Соусы' },
  { id: 'pizza', label: '🍕 К пицце' },
  { id: 'rolls', label: '🍣 К роллам' }
];

/* Классификатор допов по категориям */
function getSafeAddonType(item) {
  if (!item) return 'sauces';
  var n = ((item.name || '') + ' ' + (item.desc || '')).toLowerCase();
  var c = (item.cat || '').toLowerCase();

  if (c === 'drinks' || /напиток|сок|кола|морс|вода|чай|лимонад|добрый/i.test(n)) return 'drinks';

  if (/васаби|имбир|палочк|к роллам/i.test(n)) return 'rolls';
  if (/соев/i.test(n)) return 'rolls';

  if (/^соус|соус красный|соус розовый|соус чесночный|соус белый|сырный соус|кетчуп|барбекю|майонез|тар-тар|кисло-сладк/i.test(n)) {
    return 'sauces';
  }

  if (/ветчин|пепперони|чеддер|перец|лук|огурец|халапень|куриц|шампиньон|гриб|ананас|моцарелл|тунец|фарш|мяс|помидор|томат|борт|сыр|к пицце/i.test(n)) {
    return 'pizza';
  }

  if (/соус/i.test(n)) return 'sauces';
  return 'pizza';
}

/* Приоритетные категории ингредиентов: мясо/рыба всегда в начале списка */
var INGREDIENT_GROUPS = [
  // 1. Мясо / Птица (высший приоритет)
  { id: 'chicken', label: '🍗 Курица', re: /куриц|цыплен/i, score: 600 },
  { id: 'pepperoni', label: '🍕 Пепперони', re: /пепперони|салями/i, score: 580 },
  { id: 'ham', label: '🥓 Ветчина', re: /ветчин|бекон/i, score: 560 },
  { id: 'meat', label: '🥩 Мясо/фарш', re: /мяс|говядин|фарш/i, score: 540 },
  // 2. Рыба / Морепродукты
  { id: 'salmon', label: '🐟 Лосось', re: /лосос|семг|форел/i, score: 520 },
  { id: 'tuna', label: '🐟 Тунец', re: /тунец/i, score: 500 },
  { id: 'shrimp', label: '🦐 Креветки', re: /креветк/i, score: 480 },
  { id: 'eel', label: '🥢 Угорь', re: /угор/i, score: 460 },
  { id: 'crab', label: '🦀 Краб', re: /краб/i, score: 440 },
  // 3. Сыры
  { id: 'cheese', label: '🧀 Сыр', re: /чеддер|пармезан|дорблю|фета|сырный|моцарелл/i, score: 380 },
  // 4. Грибы
  { id: 'mushrooms', label: '🍄 Грибы', re: /гриб|шампиньон/i, score: 340 },
  // 5. Острое
  { id: 'spicy', label: '🌶 Острая', re: /халапень|остр|чили/i, score: 300 },
  // 6. Овощи и добавки
  { id: 'tomatoes', label: '🍅 Томаты', re: /томат|помидор/i, score: 240 },
  { id: 'pineapple', label: '🍍 Ананас', re: /ананас/i, score: 200 },
  { id: 'veggies', label: '🥦 Овощи', re: /перец|цукини|баклажан|броккол|овощ|руккол/i, score: 160 }
];

function getTopIngredients(items) {
  var matched = [];
  INGREDIENT_GROUPS.forEach(function (grp) {
    var count = items.filter(function (p) {
      var str = ((p.name || '') + ' ' + (p.desc || '') + ' ' + (p.comp || []).join(' '));
      return grp.re.test(str);
    }).length;

    if (count >= 1) {
      matched.push({
        id: grp.id,
        label: grp.label,
        totalScore: grp.score + count * 15
      });
    }
  });

  matched.sort(function (a, b) { return b.totalScore - a.totalScore; });
  return matched.slice(0, 8);
}

function matchesIngredient(p, ingId) {
  if (!ingId || ingId === 'all') return true;
  var grp = INGREDIENT_GROUPS.find(function (g) { return g.id === ingId; });
  if (!grp) return true;
  var str = ((p.name || '') + ' ' + (p.desc || '') + ' ' + (p.comp || []).join(' '));
  return grp.re.test(str);
}

function ensureSubFilterBar() {
  var bar = document.getElementById('deliverySubFilter');
  if (!bar) {
    var grid = document.getElementById('deliveryGrid');
    if (grid && grid.parentNode) {
      bar = document.createElement('div');
      bar.id = 'deliverySubFilter';
      bar.className = 'subfilter-bar';
      bar.hidden = true;
      grid.parentNode.insertBefore(bar, grid);
    }
  }
  return bar;
}

function renderSubFilter(categoryItems) {
  var bar = ensureSubFilterBar();
  if (!bar) return;

  var isAddons = (dcat === 'sauces');

  if (isAddons) {
    bar.hidden = false;
    bar.innerHTML = ADDON_TABS.map(function (tab) {
      var on = (activeAddonTab === tab.id) ? ' on' : '';
      return '<button type="button" class="subchip' + on + '" data-addon-tab="' + tab.id + '">' + tab.label + '</button>';
    }).join('');
    return;
  }

  if (categoryItems.length > 5) {
    var chips = getTopIngredients(categoryItems);
    if (!chips.length) {
      bar.hidden = true;
      bar.innerHTML = '';
      return;
    }
    bar.hidden = false;
    var allOn = (activeIngredient === 'all') ? ' on' : '';
    var html = '<button type="button" class="subchip' + allOn + '" data-ing="all">Все</button>';
    html += chips.map(function (c) {
      var on = (activeIngredient === c.id) ? ' on' : '';
      return '<button type="button" class="subchip' + on + '" data-ing="' + c.id + '">' + c.label + '</button>';
    }).join('');
    bar.innerHTML = html;
  } else {
    bar.hidden = true;
    bar.innerHTML = '';
  }
}

function renderDeliveryRail() {
  $('#deliveryRail').innerHTML = DCATS.map(c =>
    `<button data-dcat="${c.id}" class="${c.id === dcat ? 'on' : ''}"><span class="re">${c.e}</span>${c.l}</button>`
  ).join('');
}

$('#deliveryRail').addEventListener('click', e => {
  const b = e.target.closest('[data-dcat]');
  if (b) {
    dcat = b.dataset.dcat;
    activeAddonTab = 'all';
    activeIngredient = 'all';
    renderDeliveryRail();
    if (typeof renderDeliverySkeleton === 'function') {
      renderDeliverySkeleton();
    }
    requestAnimationFrame(() => {
      window.renderDeliveryMenu();
      const grid = document.getElementById('deliveryGrid');
      if (grid) {
        const topOffset = grid.getBoundingClientRect().top + window.scrollY - 110;
        window.scrollTo({ top: Math.max(0, topOffset), behavior: 'smooth' });
      }
    });
  }
});

function renderDeliveryMenu() {
  const catItems = DMENU.filter(p => p.cat === dcat);

  if (dcat === 'sauces') {
    activeIngredient = 'all';
  } else {
    activeAddonTab = 'all';
    if (catItems.length <= 5) activeIngredient = 'all';
  }

  renderSubFilter(catItems);

  let list = catItems;
  if (dcat === 'sauces') {
    if (activeAddonTab !== 'all') {
      list = list.filter(p => getSafeAddonType(p) === activeAddonTab);
    }
  } else if (catItems.length > 5 && activeIngredient !== 'all') {
    list = list.filter(p => matchesIngredient(p, activeIngredient));
  }

  let html = list.map(p => {
    const opts = p.opts || [];
    const n0 = cart.reduce((a, c) => (String(c.id) === String(p.id) ? a + c.qty : a), 0);

    // Вариант 1: Пицца (2 строки: размер/тесто вверху, вес/цена внизу)
    let bodyMiddleHTML = '';
    if (opts.length > 0) {
      bodyMiddleHTML = `<div class="opts">
        ${opts.map((o, i) => {
          const lStr = String(o.l || '');
          const parts = lStr.split(',').map(s => s.trim());
          const sizeText = parts[0] || lStr;
          const crustText = parts[1] || '';
          const weightText = o.w ? esc(o.w) : '';
          const priceText = fmt(o.p);

          return `<button type="button" class="opt-btn" data-id="${p.id}" data-oi="${i}">
            <div class="opt-row opt-top">
              <span class="opt-size">${esc(sizeText)}</span>
              <span class="opt-crust">${esc(crustText)}</span>
            </div>
            <div class="opt-row opt-bottom">
              <span class="opt-weight">${weightText}</span>
              <span class="opt-price">${priceText}</span>
            </div>
          </button>`;
        }).join('')}
      </div>`;
    } else {
      // Вариант 2: Роллы, сеты, напитки, соусы
      const priceStr = fmt(Number(p.price) || 0);
      const volStr = p.vol ? esc(String(p.vol).trim()) : '';
      bodyMiddleHTML = `<div class="single-meta" style="display:flex;align-items:baseline;justify-content:space-between;margin:8px 0 12px;padding:4px 0;border-bottom:1px solid rgba(18,58,107,0.06)">
      ${volStr ? `<span class="vol" style="font-size:13px;font-weight:600;color:#5B6670">${volStr}</span>` : '<span></span>'}        <span class="price" style="font-size:18px;font-weight:800;color:var(--flame,#C03B2A)">${priceStr}</span>
      </div>`;
    }

    return `<article class="card" data-product-id="${p.id}">
      <div class="media" style="--tint:#F3E2CE"><span class="em">${p.e || '🍕'}</span></div>
      <div class="cbody">
        <h3>${esc(p.name)}</h3>
        ${p.desc ? `<div class="desc">${esc(p.desc)}</div>` : ''}
        ${p.comp && p.comp.length ? `<div class="comp">${p.comp.map(c => `<i>${esc(c)}</i>`).join('')}</div>` : ''}
        ${bodyMiddleHTML}
        <div class="steprow">
          <button type="button" class="step" data-step="-1" data-sid="${p.id}" ${n0 ? '' : 'hidden'}>−</button>
          <button class="cta" data-add="${p.id}">${n0 ? 'В корзине · ' + n0 : 'Добавить'}</button>
          <button type="button" class="step" data-step="1" data-sid="${p.id}" ${n0 ? '' : 'hidden'}>+</button>
        </div>
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

/* ── Слушатель кликов по чипсам и табам субфильтров ── */
document.addEventListener('click', function (e) {
  var bAddon = e.target.closest('#deliverySubFilter [data-addon-tab]');
  if (bAddon) {
    var tabId = bAddon.dataset.addonTab;
    activeAddonTab = (activeAddonTab === tabId && tabId !== 'all') ? 'all' : tabId;
    renderDeliveryMenu();
    return;
  }
  var bIng = e.target.closest('#deliverySubFilter [data-ing]');
  if (bIng) {
    var ingId = bIng.dataset.ing;
    activeIngredient = (activeIngredient === ingId && ingId !== 'all') ? 'all' : ingId;
    renderDeliveryMenu();
  }
});

/* ── Состояния карточек: поддержка Retina и авто-зум ── */
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

      if (p.img && !media.querySelector('img')) {
        const em = media.querySelector('.em'); if (em) em.remove();
        const im = document.createElement('img');
        im.src = p.img;
        im.alt = p.name || '';
        im.loading = (i === 0) ? 'eager' : 'lazy';
        im.decoding = 'async';
        if (i === 0) { try { im.fetchPriority = 'high'; } catch (e) {} }
        im.dataset.zoom = 'true';
        // Автоматически подменяем -card.webp на -zoom.webp для модалки
        im.dataset.zoomSrc = p.img.replace('-card.webp', '-zoom.webp');
        im.style.cssText = 'width:100%;height:100%;object-fit:cover;object-position:center;display:block;cursor:zoom-in;';
        media.appendChild(im);
      }
    }
    const add = card.querySelector('[data-add]');
    if (add) {
      if (!p.on) { add.disabled = true; add.classList.remove('incart', 'added'); add.textContent = 'СТОП — недоступно'; }
      else if (add.disabled) { add.disabled = false; }
    }
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

function syncAddButtons() {
  document.querySelectorAll('#deliveryGrid [data-add]').forEach(b => {
    if (b.disabled) return;
    const n = cart.reduce((a, c) => a + (String(c.id) === String(b.dataset.add) ? c.qty : 0), 0);
    b.classList.toggle('incart', n > 0);
    const row = b.closest('.steprow'); if (row) row.querySelectorAll('.step').forEach(s => { s.hidden = !n; });
    if (!b.classList.contains('added')) b.textContent = n > 0 ? ('В корзине · ' + n) : 'Добавить';
  });
}

$('#deliveryGrid').addEventListener('click', e => {
  // Полноэкранный Zoom фото с высоким разрешением
  const zoomImg = e.target.closest('[data-zoom], .media img');
  if (zoomImg) {
    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
    const card = zoomImg.closest('.card, article');
    const title = card ? (card.querySelector('h3') || {}).textContent : '';
    const price = card ? (card.querySelector('.price') || {}).textContent : '';
    const fullSrc = zoomImg.dataset.zoomSrc || zoomImg.src;
    if (typeof window.openZoom === 'function') {
      window.openZoom(fullSrc, title, price);
    }
    return;
  }

  // Режим редактирования не обрабатывает клики добавления
  if (e.target.closest('.edBtn') || e.target.closest('.donoff')) return;

  // Степпер
  const st = e.target.closest('[data-step]');
  if (st) {
    const id = st.dataset.sid; const delta = +st.dataset.step;
    const item = cart.find(c => String(c.id) === String(id));
    if (!item && delta < 0) return;
    if (item) { if (delta > 0) item.qty++; else if (item.qty > 1) item.qty--; else cart.splice(cart.indexOf(item), 1); }
    localStorage.setItem('zt_cart', JSON.stringify(cart));
    if (typeof window.updateCartFab === 'function') window.updateCartFab();
    if (typeof window.renderCart === 'function') window.renderCart();
    const n = cart.reduce((a, c) => (String(c.id) === String(id) ? a + c.qty : a), 0);
    const row = st.closest('.steprow'); const mid = row && row.querySelector('[data-add]');
    if (mid) { mid.textContent = n ? ('В корзине · ' + n) : 'Добавить'; mid.classList.toggle('incart', n > 0); }
    if (row) row.querySelectorAll('.step').forEach(s => { s.hidden = !n; });
    return;
  }

  // Тап по карточке (выбор опции)
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
      addBtn.click();
    }
    return;
  }

  // Клик по опции размера/теста
  const optBtn = e.target.closest('.opts button');
  if (optBtn) {
    const group = optBtn.closest('.opts');
    const wasSel = optBtn.classList.contains('sel');
    group.querySelectorAll('button').forEach(b => b.classList.remove('sel'));
    if (!wasSel) optBtn.classList.add('sel');
    return;
  }

  // Клик по кнопке «Добавить»
  const addBtn = e.target.closest('[data-add]');
  if (addBtn) {
    const id = addBtn.dataset.add;
    const p = DMENU.find(x => String(x.id) === String(id));
    if (!p) return;
    
    const opts = p.opts || [];
    const cardBody = addBtn.closest('.cbody');
    const selOpt = cardBody ? cardBody.querySelector('.opts button.sel') : null;

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
    
    if (typeof syncAddButtons === 'function') syncAddButtons();
    addBtn.classList.add('added');
    if (window.TgUx) window.TgUx.haptic('medium');
    setTimeout(() => addBtn.classList.remove('added'), 700);
    
    if (typeof updateCartFab === 'function') updateCartFab();
    if (typeof window.renderCart === 'function') window.renderCart();
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
  const _i = +b.dataset.ci;
  localStorage.setItem('zt_cart', JSON.stringify(cart));
  if (typeof updateCartFab === 'function') updateCartFab();
  window.renderCart();
});

$('#checkoutMethod').onchange = () => {
  const pickup = $('#checkoutMethod').value === 'pickup';
  $('#checkoutPlaceLabel').hidden = pickup;
  $('#checkoutAddrLabel').hidden = pickup;
  window.renderCart();
};

$('#cartFab').onclick = () => { window.renderCart(); $('#cartPanel').classList.add('open'); };

function populatePlaces() {
  if (!deliveryInfo) return;
  const places = deliveryInfo.zones.flatMap(z => z.places);
  $('#checkoutPlace').innerHTML = places.map(p => `<option>${p}</option>`).join('');
}

function skelCards(n){
  var c='<div class="card skeleton-card"><div class="media skeleton-pulse"></div><div class="cbody"><div class="skeleton-line skeleton-pulse" style="width:65%;height:14px"></div><div class="skeleton-line skeleton-pulse" style="width:85%;height:12px"></div><div class="skeleton-line skeleton-pulse" style="width:45%;height:12px;margin-top:auto"></div></div><div class="skeleton-foot skeleton-pulse"></div></div>';
  var out='';for(var i=0;i<n;i++)out+=c;return out;
}

function renderDeliverySkeleton() {
  var grid = document.getElementById('deliveryGrid');
  if (!grid) return;
  grid.innerHTML = skelCards(6);
}

window.loadDelivery = async function() {
  try {
    var g = document.getElementById('deliveryGrid');
    if (g && !DMENU.length) { g.innerHTML = skelCards(6); }
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
    window.renderDeliveryMenu();
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

  var busyList = (deliveryInfo && Array.isArray(deliveryInfo.busySlots)) ? deliveryInfo.busySlots : [];

  for (var d = dFrom; d < dTo; d++) {
    var items = [];
    for (var m = 690; m < 1320; m += 30) {
      var t = new Date(now);
      t.setDate(t.getDate() + d);
      t.setHours(Math.floor(m / 60), m % 60, 0, 0);

      var tEnd = new Date(t.getTime() + 30 * 60 * 1000);
      if (d === 0 && (t.getTime() - now.getTime() < 45 * 60 * 1000)) continue;

      var datePart = pad(t.getDate()) + '.' + pad(t.getMonth() + 1);
      var startPart = pad(t.getHours()) + ':' + pad(t.getMinutes());
      var endPart = pad(tEnd.getHours()) + ':' + pad(tEnd.getMinutes());

      var slotVal = datePart + ' | ' + startPart + '–' + endPart;
      var slotShort = startPart + ' – ' + endPart;
      var dayPrefix = (d === 0 ? 'Сегодня' : 'Завтра');
      var slotFull = dayPrefix + ' (' + datePart + ') · ' + slotShort;
      var isBusy = busyList.indexOf(slotVal) > -1;

      items.push({ 
        v: slotVal, 
        shortLabel: slotShort + (isBusy ? ' (мест нет)' : ''),
        fullLabel: slotFull + (isBusy ? ' (мест нет)' : ''),
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
  if (pm) html += '<option value="" disabled selected data-short="⏰ Выберите время доставки…" data-full="⏰ Выберите время доставки…">⏰ Выберите время доставки…</option>';
  else html += '<option value="asap" data-short="Как можно скорее (~45 мин)" data-full="Как можно скорее (~45 мин)">Как можно скорее (~45 мин)</option>';

  Object.keys(days).forEach(function (k) {
    html += '<optgroup label="' + days[k].label + '">' + 
      days[k].items.map(function (s) { 
        return '<option value="' + s.v + '" data-short="' + esc(s.shortLabel) + '" data-full="' + esc(s.fullLabel) + '"' + 
          (s.disabled ? ' disabled style="color:#8E9AA5;background:#F0F4F8"' : '') + '>' + 
          esc(s.shortLabel) + 
        '</option>'; 
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
    setupSlotDisplayToggle(sel);
  }
};

function setupSlotDisplayToggle(sel) {
  function showFull() {
    var cur = sel.options[sel.selectedIndex];
    if (cur && cur.dataset && cur.dataset.full) {
      cur.textContent = cur.dataset.full;
    }
  }

  function showShort() {
    for (var i = 0; i < sel.options.length; i++) {
      var o = sel.options[i];
      if (o.dataset && o.dataset.short) o.textContent = o.dataset.short;
    }
  }

  if (!sel.__displayBound) {
    sel.__displayBound = true;
    ['pointerdown', 'mousedown', 'touchstart', 'focus'].forEach(function(ev) {
      sel.addEventListener(ev, showShort, { passive: true });
    });
    ['change', 'blur', 'focusout'].forEach(function(ev) {
      sel.addEventListener(ev, showFull);
    });
  }

  showFull();
  window.syncSlotDisplay = showFull;
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

function promoDisc(sum, info){
  return info.kind === 'percent' ? Math.round(sum * Math.min(90, info.value) / 100) : Math.min(info.value || 0, sum);
}

window.preorderMode = function () {
  var h = new Date().getHours();
  if (h >= 22) return 'tomorrow';
  if (h < 11) return 'today';
  return null;
};
window.assertServiceOpen = function () { return window.preorderMode() === null; };
window.preorderSlot = function () { return ''; };

/* ── Ф3.28: стоп-лист и редактор карточек доставки ── */
$('#deliveryGrid').addEventListener('change', async function (e) {
  const t = e.target.closest('.donoff [data-onoff]'); if (!t) return;
  e.stopPropagation();
  const p = DMENU.find(x => String(x.id) === String(t.dataset.onoff)); if (!p) return;
  p.on = t.checked ? 1 : 0;
  try {
    await api('/menu/' + p.id, { method: 'PUT', body: p });
    window.renderDeliveryMenu();
    toast(t.checked ? '«' + esc(p.name) + '» снова в меню' : '«' + esc(p.name) + '» → стоп-лист', t.checked ? '✅' : '⛔');
  } catch (err) { toast(err.message, '⚠️'); await loadDelivery(); }
}, true);

$('#deliveryGrid').addEventListener('click', function (e) {
  const b = e.target.closest('.edBtn[data-ed]'); if (!b) return;
  e.stopPropagation(); e.preventDefault();
  if (typeof openEditor === 'function') openEditor(b.dataset.ed);
}, true);

/* ── Ф5.8h: ESM-шимы ── */
window.renderDeliveryRail = renderDeliveryRail;
window.renderDeliverySkeleton = renderDeliverySkeleton;
window.renderDeliveryMenu = renderDeliveryMenu;
window.patchDeliveryCards = patchDeliveryCards;
window.syncAddButtons = syncAddButtons;
window.populatePlaces = populatePlaces;
window.setupSlotDisplayToggle = setupSlotDisplayToggle;
window.promoDisc = promoDisc;
window.renderCart = renderCart;

/* ── СЛОЙ 3: изолированные стили доставки ── */
(function(){
  var existing = document.getElementById('deliverySubStyles');
  if (existing) existing.remove();

  var s = document.createElement('style');
  s.id = 'deliverySubStyles';
  s.textContent =
    '#deliveryGrid .card .cbody{display:flex;flex-direction:column}' +
    '.steprow{display:flex;gap:6px;align-items:stretch;margin-top:auto;padding-top:8px}' +
    '.steprow .cta{flex:1;margin-top:0}' +
    '.steprow .step{width:44px;border:2px solid var(--fr-choc,#3A2A1C);background:#fff;border-radius:12px;font:800 18px/1 "Golos Text",system-ui,sans-serif;color:var(--fr-choc,#3A2A1C);cursor:pointer}' +
    /* Субфильтры */
    '.subfilter-bar{display:flex;align-items:center;gap:6px;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;-webkit-overflow-scrolling:touch;margin-bottom:12px;padding:2px 2px 6px 2px;min-height:38px}' +
    '.subfilter-bar::-webkit-scrollbar{display:none}' +
    '.subchip{display:inline-flex;align-items:center;gap:5px;padding:6px 12px;border-radius:999px;background:var(--fr-paper,#F6EEE1);border:1.5px solid var(--fr-tan,#C99E6E);color:var(--fr-choc,#3A2A1C);font:600 12.5px/1 "Golos Text",system-ui,sans-serif;white-space:nowrap;cursor:pointer;transition:background .15s ease,border-color .15s ease,color .15s ease;flex-shrink:0}' +
    '.subchip:hover{background:var(--fr-rice,#EFE6D8)}' +
    '.subchip.on{background:var(--flame,#C03B2A);border-color:var(--fr-choc,#3A2A1C);color:#fff;font-weight:700;box-shadow:2px 2px 0 var(--fr-choc,#3A2A1C)}' +
    /* Плашки выбора опций пиццы */
    '#deliveryGrid .opts{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}' +
    '@media(max-width:400px){#deliveryGrid .opts{grid-template-columns:1fr}}' +
    '#deliveryGrid .opts .opt-btn{display:flex;flex-direction:column;justify-content:space-between;gap:3px;padding:7px 9px;border:2px solid var(--fr-tan,#C99E6E);border-radius:12px;background:#fff;min-height:50px;text-align:left;cursor:pointer;box-sizing:border-box;transition:background .15s ease,border-color .15s ease,box-shadow .15s ease}' +
    '#deliveryGrid .opts .opt-row{display:flex;justify-content:space-between;align-items:baseline;width:100%;line-height:1.2}' +
    '#deliveryGrid .opts .opt-size{font-size:11.5px;font-weight:800;color:var(--fr-choc,#3A2A1C)}' +
    '#deliveryGrid .opts .opt-crust{font-size:11px;font-weight:700;color:var(--fr-choc,#3A2A1C);text-transform:capitalize}' +
    '#deliveryGrid .opts .opt-weight{font-size:10.5px;font-weight:500;color:#5B6670}' +    '#deliveryGrid .opts .opt-price{font-size:12.5px;font-weight:800;color:var(--flame,#C03B2A);font-variant-numeric:tabular-nums}' +
    '#deliveryGrid .opts button.sel{background:var(--fr-tan,#C99E6E);border-color:var(--fr-choc,#3A2A1C);box-shadow:2px 2px 0 var(--fr-choc,#3A2A1C)}' +
    '#deliveryGrid .opts button.sel .opt-size,#deliveryGrid .opts button.sel .opt-crust,#deliveryGrid .opts button.sel .opt-weight,#deliveryGrid .opts button.sel .opt-price{color:var(--fr-choc,#3A2A1C)}' +
    /* Расширение рейла до 80px на мобильных */
    '@media(max-width:820px){' +
      'html body div.wrap{grid-template-columns:80px minmax(0,1fr)}' +
      'html body div.wrap>nav.rail,html body div.wrap>nav#deliveryRail{width:80px;min-width:80px}' +
      'html body div.wrap>nav.rail button,html body div.wrap>nav#deliveryRail button{width:100%;min-height:56px;padding:6px 2px;font-size:9.5px;line-height:1.15;word-break:normal;white-space:normal}' +
    '}';
  document.head.appendChild(s);
})();