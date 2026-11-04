import { attachGridDnD, canDragMenu, dragAttr } from './core/dnd.js';
import { getVisibleComposition } from './core/menu-content.js';
import { getMenuBadgeClass, getMenuBadgeLabel } from './core/menu-badges.js';
function getKaliningradTime() {
  if (typeof window !== "undefined" && typeof window.getKaliningradTime === "function" && window.getKaliningradTime !== getKaliningradTime) {
    return window.getKaliningradTime();
  }
  var dt = new Date(Date.now() + 2 * 3600000);
  return { hour: dt.getUTCHours(), minute: dt.getUTCMinutes() };
}

function getKaliningradNow() {
  var calendar = new Date(Date.now() + 2 * 3600000);
  var clock = getKaliningradTime();
  return new Date(Date.UTC(
    calendar.getUTCFullYear(),
    calendar.getUTCMonth(),
    calendar.getUTCDate(),
    Number(clock.hour),
    Number(clock.minute || 0)
  ) - 2 * 3600000);
}

function isDeliveryServiceOpen() {
  var schedule = deliveryInfo && (deliveryInfo.today || deliveryInfo.schedule);
  if (!schedule) return false;

  var open = Number(schedule.open);
  var close = Number(schedule.close);
  if (!Number.isFinite(open) || !Number.isFinite(close) || close <= open) return false;

  var time = getKaliningradTime();
  var currentMinute = time.hour * 60 + time.minute;
  return currentMinute >= open * 60 && currentMinute < close * 60;
}

if (typeof window !== 'undefined') {
  window.isDeliveryServiceOpen = isDeliveryServiceOpen;
  window.getKaliningradTime = getKaliningradTime;
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

async function fetchDeliveryInfo() {
  deliveryInfo = null;
  var response = await fetch(API_BASE + '/api/delivery/info');
  if (!response.ok) throw new Error('Не удалось обновить график работы');
  var info = await response.json();
  if (!info || !info.today || !Array.isArray(info.days)) {
    throw new Error('Сервер не вернул актуальное расписание');
  }
  deliveryInfo = info;
  return info;
}

var deliveryInfoRequest = null;
window.refreshDeliveryInfo = function () {
  if (!deliveryInfoRequest) {
    deliveryInfoRequest = fetchDeliveryInfo()
      .then(function (info) {
        populatePlaces();
        window.populateSlots();
        if (typeof window.applyBrandChrome === 'function') window.applyBrandChrome(true);
        return info;
      })
      .finally(function () {
        deliveryInfoRequest = null;
      });
  }
  return deliveryInfoRequest;
};

const DCATS = window.DCATS = [
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
      /* Прокрутка к шапке с поиском: поиск и сабфильтры остаются в кадре.
         Раньше прокручивало к сетке (−110px), и поиск уходил выше экрана. */
      const searchInput = document.getElementById('dSearch');
      const anchor = (searchInput && searchInput.closest('.menu-head')) || document.getElementById('deliveryGrid');
      if (anchor) {
        const topOffset = anchor.getBoundingClientRect().top + window.scrollY - 8;
        window.scrollTo({ top: Math.max(0, topOffset), behavior: 'smooth' });
      }
    });
  }
});

function renderCompositionChips(item) {
  const composition = getVisibleComposition(item);
  if (!composition.length) return '';
  return '<div class="comp">' +
    composition.map(function (name) { return '<i>' + esc(name) + '</i>'; }).join('') +
  '</div>';
}

function renderPizzaOptsHtml(p, opts) {
  const groupName = 'pizza-option-' + Array.from(new TextEncoder().encode(String(p.id)))
    .map(byte => byte.toString(16).padStart(2, '0')).join('');
  return '<fieldset class="opts">' +
    '<legend>Размер и тесто</legend>' +
    opts.map(function (o, i) {
      var lStr = String(o.l || '');
      var parts = lStr.split(',').map(function (s) { return s.trim(); });
      var sizeText = parts[0] || lStr;
      var crustText = parts[1] || '';
      var weightText = o.w ? esc(o.w) : '';
      var priceText = fmt(o.p);

      return '<label class="opt-btn" for="' + groupName + '-' + i + '">' +
        '<input class="opt-radio" type="radio" name="' + groupName + '" id="' + groupName + '-' + i +
          '" value="' + i + '" data-id="' + esc(String(p.id)) + '" data-oi="' + i + '">' +
        '<span class="opt-content">' +
          '<span class="opt-row opt-top">' +
            '<span class="opt-size">' + esc(sizeText) + '</span>' +
            '<span class="opt-crust">' + esc(crustText) + '</span>' +
          '</span>' +
          '<span class="opt-row opt-bottom">' +
            '<span class="opt-weight">' + weightText + '</span>' +
            '<span class="opt-price">' + priceText + '</span>' +
          '</span>' +
        '</span>' +
      '</label>';
    }).join('') +
    '<p class="opts-error" id="' + groupName + '-error" hidden>Выберите размер и тесто.</p>' +
  '</fieldset>';
}

function renderSingleMetaHtml(p) {
  var priceStr = fmt(Number(p.price) || 0);
  var volStr = p.vol ? esc(String(p.vol).trim()) : '';
  return '<div class="single-meta" style="display:flex;align-items:baseline;justify-content:space-between;margin:8px 0 12px;padding:4px 0;border-bottom:1px solid rgba(18,58,107,0.06)">' +
    (volStr ? '<span class="vol" style="font-size:13px;font-weight:600;color:#5B6670">' + volStr + '</span>' : '<span></span>') +
    '<span class="price" style="font-size:18px;font-weight:800;color:var(--flame,#C03B2A)">' + priceStr + '</span>' +
  '</div>';
}

function syncDeliveryImagePriorities() {
  var grid = document.getElementById('deliveryGrid');
  if (!grid) return;
  var cards = Array.from(grid.querySelectorAll(':scope > .card[data-product-id]'));
  if (!cards.length) return;

  var firstRowTop = cards[0].getBoundingClientRect().top;
  var hasHighPriorityImage = false;
  cards.forEach(function (card) {
    var image = card.querySelector('.media img[src]');
    if (!image) return;
    var isFirstRow = Math.abs(card.getBoundingClientRect().top - firstRowTop) <= 1;
    image.setAttribute('loading', isFirstRow ? 'eager' : 'lazy');
    var isLcpImage = isFirstRow && !hasHighPriorityImage;
    image.setAttribute('fetchpriority', isLcpImage ? 'high' : 'auto');
    if (isLcpImage) hasHighPriorityImage = true;
  });
}

var deliveryImagePriorityFrame = 0;
function scheduleDeliveryImagePriorities() {
  if (deliveryImagePriorityFrame) return;
  deliveryImagePriorityFrame = requestAnimationFrame(function () {
    deliveryImagePriorityFrame = 0;
    syncDeliveryImagePriorities();
  });
}

window.addEventListener('resize', scheduleDeliveryImagePriorities, { passive: true });
window.addEventListener('load', scheduleDeliveryImagePriorities, { once: true });
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(scheduleDeliveryImagePriorities);
}

function renderDeliveryCard(p, n0) {
  var opts = p.opts || [];
  var bodyMiddleHTML = opts.length > 0 ? renderPizzaOptsHtml(p, opts) : renderSingleMetaHtml(p);
  var imageSet = p.imgSrcset
    ? ' srcset="' + esc(p.imgSrcset) + '" sizes="(max-width: 519px) calc(100vw - 110px), (max-width: 1180px) 42vw, (max-width: 1599px) 30vw, 23vw"'
    : '';
  var mediaContent = p.img
    ? '<img src="' + p.img + '"' + imageSet + ' alt="' + esc(p.name) + '" data-fallback-emoji="' + esc(p.e || '🍕') + '" width="300" height="180" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;display:block;" loading="lazy" fetchpriority="auto" decoding="async">'
    : '<span class="em">' + (p.e || '🍕') + '</span>';

  return '<article class="card' + (p.on ? '' : ' stopped') + '" data-product-id="' + p.id + '"' + dragAttr() + '>' +
      '<div class="media" style="--tint:#F3E2CE;position:relative;overflow:hidden;">' +
      mediaContent +
      (p.tag ? '<span class="tag ' + getMenuBadgeClass(p.tag) + '">' + esc(getMenuBadgeLabel(p.tag)) + '</span>' : '') +
      (p.on ? '' : '<span class="stopbadge">СТОП</span>') +
    '</div>' +
    '<div class="cbody">' +
      '<h3>' + esc(p.name) + '</h3>' +
      (p.desc ? '<div class="desc">' + esc(p.desc) + '</div>' : '') +
      renderCompositionChips(p) +
      bodyMiddleHTML +
      '<div class="steprow">' +
        '<button type="button" class="step" data-step="-1" data-sid="' + p.id + '" ' + (n0 ? '' : 'hidden') + '>−</button>' +
        '<button class="cta" data-add="' + p.id + '">' + (n0 ? 'В корзине · ' + n0 : 'Добавить') + '</button>' +
        '<button type="button" class="step" data-step="1" data-sid="' + p.id + '" ' + (n0 ? '' : 'hidden') + '>+</button>' +
      '</div>' +
    '</div>' +
  '</article>';
}

function getFilteredDeliveryItems(catItems) {
  if (dcat === 'sauces' && activeAddonTab !== 'all') {
    return catItems.filter(p => getSafeAddonType(p) === activeAddonTab);
  }
  if (dcat !== 'sauces' && catItems.length > 5 && activeIngredient !== 'all') {
    return catItems.filter(p => matchesIngredient(p, activeIngredient));
  }
  return catItems;
}

function updateFirstDeliveryCard(gridEl, firstCard, list) {
  const p0 = list[0];
  const n0 = cart.reduce((a, c) => (String(c.id) === String(p0.id) ? a + c.qty : a), 0);
  firstCard.setAttribute('data-product-id', p0.id);
  firstCard.draggable = canDragMenu();
  firstCard.classList.toggle('stopped', !p0.on);

  const cbody0 = firstCard.querySelector('.cbody');
  if (cbody0) {
    const opts0 = p0.opts || [];
    const bodyMid0 = opts0.length > 0 ? renderPizzaOptsHtml(p0, opts0) : renderSingleMetaHtml(p0);
    cbody0.innerHTML =
      '<h3>' + esc(p0.name) + '</h3>' +
      (p0.desc ? '<div class="desc">' + esc(p0.desc) + '</div>' : '') +
      renderCompositionChips(p0) +
      bodyMid0 +
      '<div class="steprow">' +
        '<button type="button" class="step" data-step="-1" data-sid="' + p0.id + '" ' + (n0 ? '' : 'hidden') + '>−</button>' +
        '<button type="button" class="cta" data-add="' + p0.id + '">' + (n0 ? 'В корзине · ' + n0 : 'Добавить') + '</button>' +
        '<button type="button" class="step" data-step="1" data-sid="' + p0.id + '" ' + (n0 ? '' : 'hidden') + '>+</button>' +
      '</div>';
  }

  while (firstCard.nextElementSibling) {
    firstCard.nextElementSibling.remove();
  }

  let restHtml = list.slice(1).map((p) => {
    const n = cart.reduce((a, c) => (String(c.id) === String(p.id) ? a + c.qty : a), 0);
    return renderDeliveryCard(p, n);
  }).join('');
  if (typeof editMode !== 'undefined' && editMode) {
    restHtml += '<article class="card add-card" id="addDelivCard">' +
      '<div style="font-size:32px">➕</div>' +
      '<div>Добавить позицию в доставку</div>' +
    '</article>';
  }
  if (restHtml) gridEl.insertAdjacentHTML('beforeend', restHtml);
}

function renderDeliveryGrid(list) {
  const gridEl = $('#deliveryGrid');
  const firstCard = gridEl && gridEl.querySelector('.card:not(.skeleton-card)');
  const firstImg = firstCard && firstCard.querySelector('.media img[src]');
  const canKeepFirst = !!(
    firstCard &&
    firstImg &&
    list.length > 0 &&
    firstImg.getAttribute('src') === list[0].img
  );

  if (canKeepFirst) {
    updateFirstDeliveryCard(gridEl, firstCard, list);
    return;
  }

  let html = list.map((p) => {
    const n0 = cart.reduce((a, c) => (String(c.id) === String(p.id) ? a + c.qty : 0), 0);
    return renderDeliveryCard(p, n0);
  }).join('');
  if (typeof editMode !== 'undefined' && editMode) {
    html += '<article class="card add-card" id="addDelivCard">' +
      '<div style="font-size:32px">➕</div>' +
      '<div>Добавить позицию в доставку</div>' +
    '</article>';
  }
  if (list.length === 0 && (typeof editMode === 'undefined' || !editMode)) {
    html += '<div class="gempty">В этой категории пока пусто</div>';
  }
  gridEl.innerHTML = html;
}

function renderDeliveryMenu() {
  const catItems = DMENU.filter(p => p.cat === dcat);

  if (dcat === 'sauces') {
    activeIngredient = 'all';
  } else {
    activeAddonTab = 'all';
    if (catItems.length <= 5) activeIngredient = 'all';
  }

  renderSubFilter(catItems);
  const list = getFilteredDeliveryItems(catItems);
  renderDeliveryGrid(list);
  patchDeliveryCards(list);
  syncDeliveryImagePriorities();

  const addCard = document.getElementById('addDelivCard');
  if (addCard) addCard.onclick = () => openEditor(null, 'delivery');
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
function patchDeliveryCardMedia(media, product, index) {
  if (!media) return;

  let menuBadge = media.querySelector('.tag');
  if (product.tag) {
    if (!menuBadge) {
      menuBadge = document.createElement('span');
      media.appendChild(menuBadge);
    }
    menuBadge.className = 'tag ' + getMenuBadgeClass(product.tag);
    menuBadge.textContent = getMenuBadgeLabel(product.tag);
  } else if (menuBadge) {
    menuBadge.remove();
  }

  let badge = media.querySelector('.stopbadge');
  if (!product.on && !badge) {
    badge = document.createElement('span');
    badge.className = 'stopbadge';
    badge.textContent = 'СТОП';
    media.appendChild(badge);
  }
  if (product.on && badge) badge.remove();

  if (product.img && !media.querySelector('img')) {
    const placeholder = media.querySelector('.em');
    if (placeholder) placeholder.remove();
    const image = document.createElement('img');
    image.src = product.img;
    image.alt = product.name || '';
    image.loading = index === 0 ? 'eager' : 'lazy';
    image.decoding = 'async';
    if (index === 0) {
      try { image.fetchPriority = 'high'; } catch (e) {}
    }
    image.dataset.zoom = 'true';
    image.dataset.zoomSrc = product.img.replace('-card.webp', '-zoom.webp');
    image.style.cssText = 'width:100%;height:100%;object-fit:cover;object-position:center;display:block;cursor:zoom-in;';
    media.appendChild(image);
  }
}

function patchDeliveryCardAction(card, product) {
  const add = card.querySelector('[data-add]');
  if (!add) return;
  if (!product.on) {
    add.disabled = true;
    add.classList.remove('incart', 'added');
    add.textContent = 'СТОП — недоступно';
  } else if (add.disabled) {
    add.disabled = false;
  }
}

function patchDeliveryCardEditor(card, product, editing) {
  if (!editing) {
    const stopControl = card.querySelector('.donoff');
    if (stopControl) stopControl.remove();
    const editButton = card.querySelector('.edBtn');
    if (editButton) editButton.remove();
    return;
  }

  if (!card.querySelector('.edBtn') && window.canEditMenu && window.canEditMenu()) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'edBtn';
    button.dataset.ed = product.id;
    button.textContent = '✏️';
    card.appendChild(button);
  }

  const canToggle = window.canToggleStopList && window.canToggleStopList('delivery');
  let label = card.querySelector('.donoff');
  if (canToggle && !label) {
    label = document.createElement('label');
    label.className = 'donoff';
    label.innerHTML = '<input type="checkbox" data-onoff="' + product.id + '">в меню';
    card.appendChild(label);
  } else if (!canToggle && label) {
    label.remove();
    return;
  }

  if (canToggle) {
    const input = label.querySelector('input');
    if (input) input.checked = !!product.on;
  }
}

function patchDeliveryCard(card, product, index, editing) {
  if (!product) return;
  card.classList.toggle('stopped', !product.on);
  patchDeliveryCardMedia(card.querySelector('.media'), product, index);
  patchDeliveryCardAction(card, product);
  patchDeliveryCardEditor(card, product, editing);
}

function patchDeliveryCards(list) {
  const cards = $('#deliveryGrid').querySelectorAll('.card');
  const editing = (typeof editMode !== 'undefined' && editMode);
  cards.forEach((card, index) => patchDeliveryCard(card, list[index], index, editing));
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

function handleDeliveryZoomClick(e) {
  const zoomImg = e.target.closest('[data-zoom], .media img');
  if (!zoomImg) return false;
  e.preventDefault();
  e.stopPropagation();
  if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
  const card = zoomImg.closest('.card, article');
  const title = card ? (card.querySelector('h3') || {}).textContent : '';
  const price = card ? (card.querySelector('.price') || {}).textContent : '';
  const fullSrc = zoomImg.dataset.zoomSrc || zoomImg.src;
  const product = card && card.dataset.productId
    ? DMENU.find(item => String(item.id) === String(card.dataset.productId))
    : null;
  if (typeof window.openZoom === 'function') window.openZoom(fullSrc, title, price, product);
  return true;
}

function handleDeliveryStepperClick(e) {
  const step = e.target.closest('[data-step]');
  if (!step) return false;
  const id = step.dataset.sid;
  const delta = +step.dataset.step;
  const item = cart.find(entry => String(entry.id) === String(id));
  if (!item && delta < 0) return true;
  if (item) {
    if (delta > 0) item.qty++;
    else if (item.qty > 1) item.qty--;
    else cart.splice(cart.indexOf(item), 1);
  }
  localStorage.setItem('zt_cart', JSON.stringify(cart));
  if (typeof window.updateCartFab === 'function') window.updateCartFab();
  if (typeof window.renderCart === 'function') window.renderCart();
  const count = cart.reduce((total, entry) => (String(entry.id) === String(id) ? total + entry.qty : total), 0);
  const row = step.closest('.steprow');
  const addButton = row && row.querySelector('[data-add]');
  if (addButton) {
    addButton.textContent = count ? ('В корзине · ' + count) : 'Добавить';
    addButton.classList.toggle('incart', count > 0);
  }
  if (row) row.querySelectorAll('.step').forEach(button => { button.hidden = !count; });
  return true;
}

function handleDeliveryCardClick(e) {
  const card = e.target.closest('#deliveryGrid .card');
  if (!card || e.target.closest('.opts') || e.target.closest('[data-add]') ||
      e.target.closest('.edBtn') || e.target.closest('.donoff')) return false;

  const addButton = card.querySelector('[data-add]');
  const product = DMENU.find(item => String(item.id) === String(addButton && addButton.dataset.add));
  if (product && !(product.opts || []).length && addButton) addButton.click();
  return true;
}

function resolveDeliveryAddSelection(addButton, product) {
  const options = product.opts || [];
  const cardBody = addButton.closest('.cbody');
  const optionsBox = cardBody && cardBody.querySelector('.opts');
  const selectedOption = optionsBox ? optionsBox.querySelector('input[type="radio"]:checked') : null;
  if (!selectedOption && options.length > 0) {
    if (optionsBox) {
      const error = optionsBox.querySelector('.opts-error');
      if (error) error.hidden = false;
      const firstOption = optionsBox.querySelector('input[type="radio"]');
      if (firstOption) {
        if (error) firstOption.setAttribute('aria-describedby', error.id);
        firstOption.focus();
        firstOption.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
      optionsBox.classList.remove('shake');
      void optionsBox.offsetWidth;
      optionsBox.classList.add('shake');
      optionsBox.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    return null;
  }

  if (optionsBox) {
    const error = optionsBox.querySelector('.opts-error');
    if (error) error.hidden = true;
    optionsBox.querySelectorAll('input[type="radio"]').forEach(radio => radio.removeAttribute('aria-describedby'));
  }
  const optionIndex = selectedOption ? Number.parseInt(selectedOption.dataset.oi, 10) : -1;
  const option = options[optionIndex];
  const price = option ? Number(option.p) : (Number(product.price) || 0);
  if (price <= 0) {
    if (typeof toast === 'function') toast('Ошибка цены', '⚠️');
    return null;
  }
  return { optionIndex, option, price };
}

function deliveryOptions(product) {
  if (Array.isArray(product && product.opts)) return product.opts;
  if (product && typeof product.opts === 'string') {
    try {
      const parsed = JSON.parse(product.opts);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {}
  }
  return [];
}

function syncDeliveryCartPrices(products) {
  const byId = new Map((products || []).map(product => [String(product.id), product]));
  let changed = false;

  cart.forEach(item => {
    const product = byId.get(String(item.id));
    if (!product) return;

    const optionIndex = item.oi === undefined || item.oi === null || item.oi === ''
      ? -1
      : parseInt(item.oi, 10);
    const options = deliveryOptions(product);
    const option = Number.isInteger(optionIndex) && optionIndex >= 0
      ? options[optionIndex]
      : null;
    if (optionIndex >= 0 && !option) return;

    const price = option ? Number(option.p) : (Number(product.price) || 0);
    if (!Number.isFinite(price) || price <= 0) return;

    const nextOpt = option ? (option.l || option.name || '') : null;
    const nextSize = option ? (Number(option.sz) || 0) : 0;
    const previousPrice = Number(item.price) || 0;
    if (previousPrice > 0 && previousPrice !== price && !Number(item.priceUpdateFrom)) {
      item.priceUpdateFrom = previousPrice;
    }

    if (previousPrice !== price ||
        item.name !== product.name ||
        item.opt !== nextOpt ||
        Number(item.sz) !== nextSize ||
        Number(item.oi) !== optionIndex) {
      item.price = price;
      item.name = product.name;
      item.opt = nextOpt;
      item.sz = nextSize;
      item.oi = optionIndex;
      changed = true;
    }
  });

  if (changed) localStorage.setItem('zt_cart', JSON.stringify(cart));
  return changed;
}

function upsertDeliveryCartItem(product, selection) {
  const id = product.id;
  const key = id + (selection.optionIndex >= 0 ? '_' + selection.optionIndex : '');
  const existing = cart.find(item => String(item.key) === String(key));
  if (existing) {
    const previousPrice = Number(existing.price) || 0;
    if (previousPrice > 0 && previousPrice !== selection.price && !Number(existing.priceUpdateFrom)) {
      existing.priceUpdateFrom = previousPrice;
    }
    existing.name = product.name;
    existing.oi = selection.optionIndex;
    existing.opt = selection.option ? selection.option.l : null;
    existing.price = selection.price;
    existing.sz = selection.option ? (Number(selection.option.sz) || 0) : 0;
    existing.qty++;
    return;
  }
  cart.push({
    key: key,
    id: id,
    oi: selection.optionIndex,
    name: product.name,
    opt: selection.option ? selection.option.l : null,
    price: selection.price,
    sz: selection.option ? (Number(selection.option.sz) || 0) : 0,
    qty: 1
  });
}

function handleDeliveryAddClick(e) {
  const addButton = e.target.closest('[data-add]');
  if (!addButton) return false;
  const product = DMENU.find(item => String(item.id) === String(addButton.dataset.add));
  if (!product) return true;
  const selection = resolveDeliveryAddSelection(addButton, product);
  if (!selection) return true;

  upsertDeliveryCartItem(product, selection);
  localStorage.setItem('zt_cart', JSON.stringify(cart));
  if (typeof syncAddButtons === 'function') syncAddButtons();
  addButton.classList.add('added');
  if (window.TgUx) window.TgUx.haptic('medium');
  setTimeout(() => addButton.classList.remove('added'), 700);
  if (typeof updateCartFab === 'function') updateCartFab();
  if (typeof window.renderCart === 'function') window.renderCart();
  if (typeof toast === 'function') {
    const choice = selection.option ? ' · ' + selection.option.l : '';
    toast('Добавлено: ' + product.name + choice + ' · ' + fmt(selection.price), '🛒');
  }
  return true;
}

function handleDeliveryGridClick(e) {
  if (handleDeliveryZoomClick(e)) return;
  if (e.target.closest('.edBtn') || e.target.closest('.donoff')) return;
  if (handleDeliveryStepperClick(e)) return;
  if (e.target.closest('.opts')) return;
  if (handleDeliveryCardClick(e)) return;
  handleDeliveryAddClick(e);
}

$('#deliveryGrid').addEventListener('click', handleDeliveryGridClick);
$('#deliveryGrid').addEventListener('change', function (e) {
  const radio = e.target.closest('.opts input[type="radio"]');
  if (!radio) return;
  const optionsBox = radio.closest('.opts');
  if (!optionsBox) return;
  const error = optionsBox.querySelector('.opts-error');
  if (error) error.hidden = true;
  optionsBox.querySelectorAll('input[type="radio"]').forEach(input => input.removeAttribute('aria-describedby'));
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
  const deliveryGroup = $('#checkoutDeliveryGroup');
  if (deliveryGroup) deliveryGroup.style.display = pickup ? 'none' : 'contents';
  window.renderCart();
};

$('#cartFab').onclick = async () => {
  window.renderCart();
  const cartScrollBody = $('#cartScrollBody');
  $('#cartPanel').classList.add('open');
  // Reset after the sheet becomes visible; while closed, the browser may clamp
  // scrollTop against the collapsed scroll viewport and restore the old offset.
  requestAnimationFrame(() => {
    if (cartScrollBody) cartScrollBody.scrollTop = 0;
  });
  const checkoutButton = $('#checkoutBtn');
  if (checkoutButton) checkoutButton.disabled = true;
  try {
    await window.refreshDeliveryInfo();
    window.renderCart();
  } catch (error) {
    if (typeof toast === 'function') {
      toast('Не удалось обновить график работы. Проверьте соединение перед оформлением.', '⚠️');
    }
  }
};

function populatePlaces() {
  if (!deliveryInfo) return;
  const select = $('#checkoutPlace');
  const previous = select.value;
  const places = Array.from(new Set(deliveryInfo.zones.flatMap(z => z.places || [])));
  select.innerHTML =
    '<option value="" disabled>Выберите населённый пункт</option>' +
    places.map(p => '<option value="' + esc(p) + '">' + esc(p) + '</option>').join('');
  select.value = places.includes(previous) ? previous : '';
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
    // Ставим скелетоны ТОЛЬКО если нет реальных карточек (SSR или уже загруженных)
    if (g && !DMENU.length && !g.querySelector('.card:not(.skeleton-card)')) {
      g.innerHTML = skelCards(6);
    }
    var r = (me && ['admin','cashier','dispatch'].indexOf(me.role) !== -1)
      ? await api('/menu/all').then(function(all) {
          MENU = all.items || [];
          return {
            items: MENU.filter(function(p){ return p.section === 'delivery'; }),
            updatedAt: all.updatedAt,
          };
        })
      : await api('/dmenu');
    DMENU = r.items || [];
    syncDeliveryCartPrices(DMENU);
    if (r.updatedAt) {
      window.meta.updatedAt = r.updatedAt;
      if (typeof window.renderUpd === 'function') window.renderUpd();
    }
    renderDeliveryRail();
    window.renderDeliveryMenu();
    updateCartFab();
  } catch(e) {}
};

function buildSlotItem(now, daySchedule, startMinute, busyList, pad) {
  var parts = String(daySchedule.date || '').split('-').map(Number);
  if (parts.length !== 3) return null;

  var year = parts[0];
  var month = parts[1];
  var day = parts[2];
  var step = Number(deliveryInfo && deliveryInfo.slotStep) || 30;
  var endMinute = startMinute + step;
  var startInstant = new Date(Date.UTC(
    year, month - 1, day, Math.floor(startMinute / 60), startMinute % 60
  ) - 2 * 3600000);

  if (Number(daySchedule.offset) === 0
    && startInstant.getTime() - now.getTime() < (Number(deliveryInfo && deliveryInfo.eta) || 45) * 60000) {
    return null;
  }

  var datePart = pad(day) + '.' + pad(month);
  var startPart = pad(Math.floor(startMinute / 60)) + ':' + pad(startMinute % 60);
  var endPart = pad(Math.floor(endMinute / 60)) + ':' + pad(endMinute % 60);
  var slotVal = datePart + ' | ' + startPart + '–' + endPart;
  var slotShort = startPart + ' – ' + endPart;
  var slotFull = (Number(daySchedule.offset) === 0 ? 'Сегодня' : 'Завтра')
    + ' (' + datePart + ') · ' + slotShort;
  var isBusy = busyList.indexOf(slotVal) > -1;

  return {
    v: slotVal,
    shortLabel: slotShort + (isBusy ? ' (мест нет)' : ''),
    fullLabel: slotFull + (isBusy ? ' (мест нет)' : ''),
    disabled: isBusy,
  };
}

function buildDaySlots(now, daySchedule, busyList, pad) {
  if (!daySchedule) return null;
  var items = [];
  var step = Number(deliveryInfo && deliveryInfo.slotStep) || 30;
  var firstMinute = Number(daySchedule.open) * 60 + step;
  var closeMinute = Number(daySchedule.close) * 60;

  for (var minute = firstMinute; minute + step <= closeMinute; minute += step) {
    var item = buildSlotItem(now, daySchedule, minute, busyList, pad);
    if (item) items.push(item);
  }
  if (!items.length) return null;

  var parts = String(daySchedule.date || '').split('-');
  return {
    label: (Number(daySchedule.offset) === 0 ? 'Сегодня' : 'Завтра')
      + ' (' + parts[2] + '.' + parts[1] + ')',
    items: items,
  };
}

function renderSlotGroupOptions(days, pm) {
  var html = '';
  if (pm) {
    html += '<option value="" disabled selected data-short="⏰ Выберите время доставки…" data-full="⏰ Выберите время доставки…">⏰ Выберите время доставки…</option>';
  } else {
    html += '<option value="asap" data-short="Как можно скорее (~45 мин)" data-full="Как можно скорее (~45 мин)">Как можно скорее (~45 мин)</option>';
  }

  Object.keys(days).forEach(function (key) {
    html += '<optgroup label="' + days[key].label + '">' +
      days[key].items.map(function (slot) {
        return '<option value="' + slot.v + '" data-short="' + esc(slot.shortLabel)
          + '" data-full="' + esc(slot.fullLabel) + '"'
          + (slot.disabled ? ' disabled style="color:#8E9AA5;background:#F0F4F8"' : '')
          + '>' + esc(slot.shortLabel) + '</option>';
      }).join('') +
      '</optgroup>';
  });
  return html;
}

window.populateSlots = function () {
  var now = getKaliningradNow();
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var pm = typeof window.preorderMode === 'function' ? window.preorderMode() : 'today';
  var sel = document.getElementById('checkoutSlot');
  var previousValue = sel ? sel.value : '';
  var scheduledWithoutSelection = !!sel && sel.__checkoutTimeMode === 'slot'
    && (!previousValue || previousValue === 'asap') && !pm;
  var days = {};
  var scheduleDays = deliveryInfo && Array.isArray(deliveryInfo.days) ? deliveryInfo.days : [];
  var allowedOffsets = pm === 'today' ? [0] : pm === 'tomorrow' ? [1] : [0, 1];
  var busyList = (deliveryInfo && Array.isArray(deliveryInfo.busySlots)) ? deliveryInfo.busySlots : [];

  allowedOffsets.forEach(function (offset) {
    var daySchedule = scheduleDays.find(function (day) { return Number(day.offset) === offset; });
    var dayData = buildDaySlots(now, daySchedule, busyList, pad);
    if (dayData) days[offset] = dayData;
  });

  if (sel) {
    sel.innerHTML = renderSlotGroupOptions(days, pm);
    var restoredSelection = false;
    if (previousValue) {
      for (var i = 0; i < sel.options.length; i++) {
        if (sel.options[i].value === previousValue && !sel.options[i].disabled) {
          sel.value = previousValue;
          restoredSelection = true;
          break;
        }
      }
    }

    if (scheduledWithoutSelection) {
      sel.value = '';
      sel.__checkoutTimeMode = 'slot';
    } else if (previousValue && !restoredSelection && !pm) {
      sel.value = 'asap';
      sel.__checkoutTimeMode = 'asap';
    } else if (pm && (!restoredSelection || !sel.value || sel.value === 'asap')) {
      sel.value = '';
      sel.__checkoutTimeMode = 'slot';
    }

    sel.classList.toggle('need-slot', !!pm && !sel.value);
    setupSlotDisplayToggle(sel);
    if (typeof sel.__syncTimeMode === 'function') sel.__syncTimeMode();
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
  if (info.kind === 'freeship') return 0;
  return info.kind === 'percent' ? Math.round(sum * Math.min(90, info.value) / 100) : Math.min(info.value || 0, sum);
}

window.preorderMode = function () {
  if (!deliveryInfo || !deliveryInfo.today) return 'today';

  var time = getKaliningradTime();
  var currentMinute = Number(time.hour) * 60 + Number(time.minute || 0);
  var openMinute = Number(deliveryInfo.today.open) * 60;
  var closeMinute = Number(deliveryInfo.today.close) * 60;
  var etaMinutes = Number(deliveryInfo.eta) || 45;

  if (currentMinute < openMinute) return 'today';
  if (currentMinute >= closeMinute || currentMinute + etaMinutes >= closeMinute) return 'tomorrow';
  return null;
};
window.assertServiceOpen = function () { return window.preorderMode() === null; };
window.preorderSlot = function () { return ''; };

/* ── Ф3.28: стоп-лист и редактор карточек доставки ── */
$('#deliveryGrid').addEventListener('change', async function (e) {
  const t = e.target.closest('.donoff [data-onoff]'); if (!t) return;
  e.stopPropagation();
  const p = DMENU.find(x => String(x.id) === String(t.dataset.onoff)); if (!p) return;
  if (!window.canToggleStopList || !window.canToggleStopList('delivery')) {
    t.checked = !!p.on;
    return;
  }
  p.on = t.checked ? 1 : 0;
  try {
    // F3.68: не-админ (cashier/dispatch) шлёт ТОЛЬКО {on} — иначе серверный PUT /api/menu/:id отдаёт 403
    const body = (window.me && window.me.role === 'admin') ? p : { on: p.on };
    await api('/menu/' + p.id, { method: 'PUT', body });
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
/* ── F3.70: DnD порядка доставки ── */
attachGridDnD(document.getElementById('deliveryGrid'), {
  canDrag: canDragMenu,
  getIds: () => (window.DMENU || []).map(p => p.id),
  onReorder: async (ids) => {
    await api('/menu/reorder', { method: 'PUT', body: { brand: 'delivery', ids } });
    await loadDelivery();
  },
  rerender: () => renderDeliveryMenu()
});
/* ── ScrollSpy: подсветка активной категории #deliveryRail при скролле витрины ──
   Перенесено из cart.js: владелец рейла и грида — delivery.js (docs/module-map.md). */
(function initDeliveryRailScrollSpy() {
  var spyTick = false;
  function isDeliveryNow() {
    if (typeof brand !== "undefined" && brand) return brand === "delivery";
    return document.documentElement.getAttribute("data-brand") === "delivery";
  }
  function resolveCardCat(card) {
    if (!card) return null;
    var direct = card.getAttribute("data-cat") || card.getAttribute("data-cat-anchor");
    if (direct) return direct;
    var addBtn = card.querySelector("[data-add]");
    var id = addBtn ? addBtn.getAttribute("data-add") : card.getAttribute("data-item-id");
    if (id && typeof window.DMENU !== "undefined" && Array.isArray(window.DMENU)) {
      var prod = window.DMENU.find(function (x) { return String(x.id) === String(id); });
      if (prod && prod.cat) { card.setAttribute("data-cat", prod.cat); return prod.cat; }
    }
    return null;
  }
  function syncRailActiveOnScroll() {
    spyTick = false;
    if (!isDeliveryNow()) return;
    var rail = document.getElementById("deliveryRail");
    var grid = document.getElementById("deliveryGrid");
    if (!rail || !grid) return;
    var cards = Array.from(grid.querySelectorAll("[data-cat-anchor], .cat-section[data-cat], .card:not(.skeleton-card)"))
      .filter(function (el) { return el.offsetParent !== null; });
    if (!cards.length) return;
    var topThreshold = 160, currentCat = null;
    for (var i = 0; i < cards.length; i++) {
      var r = cards[i].getBoundingClientRect();
      if (r.bottom > 90 && r.top <= topThreshold) { currentCat = resolveCardCat(cards[i]); if (currentCat) break; }
    }
    if (!currentCat && cards.length) currentCat = resolveCardCat(cards[0]);
    if (currentCat) {
      rail.querySelectorAll("button").forEach(function (btn) {
        var bCat = btn.getAttribute("data-dcat") || btn.getAttribute("data-cat") || btn.dataset.dcat || btn.dataset.cat;
        if (bCat) btn.classList.toggle("on", bCat === currentCat);
      });
    }
  }
  window.__syncDeliveryScrollSpy = syncRailActiveOnScroll;
  window.addEventListener("scroll", function () {
    if (!spyTick) { spyTick = true; requestAnimationFrame(syncRailActiveOnScroll); }
  }, { passive: true });
})();