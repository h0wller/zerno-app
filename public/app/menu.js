/* public/app/menu.js — F2.6a: гостевое меню — рейл, поиск, сетка, редактор-зум, авто-КБЖУ по техкартам.
   Без IIFE: fix-views.js оборачивает window.renderMenu(499) и window.renderRail(502),
   читает CATS лексически (406). Все объявления — top-level var/function. */
import { attachGridDnD, canDragMenu, dragAttr } from './core/dnd.js';
import { getVisibleComposition } from './core/menu-content.js';
import { calculateDishKbju } from './core/nutrition.js';
window.cat = 'coffee'; /* Ф5.6-финал шаг 4-fix: menu-editor читает cat голым */
window.query = ''; /* Ф5.6-финал шаг 4-fix2: menu-editor пишет query голым */

/* F5.8h-fix: кофейный пул без delivery-секции (поиск и сетка не матчат чужой бренд) */
function coffeePool() {
  return MENU.filter(function (p) {
    return (p.section || 'coffee') !== 'delivery';
  });
}

$('#rail').innerHTML = CATS.map(
  c => `<button data-cat="${c.id}"><span class="re">${c.e}</span>${c.l}</button>`
).join('');

function renderRail() {
  document.querySelectorAll('#rail button').forEach(b =>
    b.classList.toggle('on', b.dataset.cat === cat)
  );
}

$('#rail').addEventListener('click', e => {
  const b = e.target.closest('[data-cat]');
  if (!b) return;
  cat = b.dataset.cat;
  window.renderRail();
  window.renderMenu();
});

$('#searchInput').addEventListener('input', e => {
  query = e.target.value.trim().toLowerCase();
  window.renderMenu();
});

/* Преобразует путь превью карточки (*-card.webp) в полноразмерный (*-zoom.webp) */
function toZoomSrc(src) {
  if (!src) return '';
  return String(src).replace(/-card\.webp(\?.*)?$/i, '-zoom.webp$1');
}

/* Поиск полного объекта блюда в MENU и DMENU (чтобы достать состав, описание и техкарту) */
function findDishForZoom(src, name, explicitItem) {
  if (explicitItem && typeof explicitItem === 'object') return explicitItem;
  const pools = []
    .concat(Array.isArray(window.MENU) ? window.MENU : [])
    .concat(Array.isArray(window.DMENU) ? window.DMENU : []);
  const cleanSrc = String(src || '').split('?')[0].replace(/-zoom\.webp$/i, '-card.webp');
  const cleanName = String(name || '').trim().toLowerCase();

  return (
    pools.find(x => x && x.img && String(x.img).split('?')[0] === cleanSrc) ||
    pools.find(x => x && String(x.name || '').trim().toLowerCase() === cleanName) ||
    null
  );
}

function renderMenu() {
  let list = query
    ? coffeePool().filter(p =>
        (p.name + ' ' + p.desc + ' ' + (p.comp || []).join(' ')).toLowerCase().includes(query)
      )
    : coffeePool().filter(p => p.cat === cat);
  if (!editMode) list = list.filter(p => p.on);

  const getFallbackPrice = item => {
    if (!item) return null;
    if (/капучино/i.test(item.name || '') || item.id === 'cap') return '250 / 340 ₽';
    if (/латте/i.test(item.name || '') || item.id === 'lat') return '310 / 360 ₽';
    if (/батч/i.test(item.name || '') || item.id === 'batch') return '220 / 260 ₽';
    return null;
  };

  const fmtMulti = (p, item) => {
    const raw =
      p != null && String(p).trim() !== '' && String(p).trim() !== '0'
        ? String(p)
        : item && item.prices
        ? String(item.prices)
        : '';
    const nums = raw
      .split(/[\/|,;–—-]+/)
      .map(x => parseInt(String(x).replace(/[^\d]/g, ''), 10))
      .filter(n => Number.isFinite(n) && n > 0);
    if (nums.length > 1) return nums.join(' / ') + ' ₽';
    if (nums.length === 1) return fmt(nums[0]);
    if (item && item.opts) {
      try {
        const arr = typeof item.opts === 'string' ? JSON.parse(item.opts) : item.opts || [];
        const optPrices = arr
          .map(o => parseInt(o.p || o.price || o.price_delta || 0, 10))
          .filter(n => Number.isFinite(n) && n > 0);
        if (optPrices.length > 1) return optPrices.slice(0, 2).join(' / ') + ' ₽';
        if (optPrices.length === 1) return fmt(optPrices[0]);
      } catch (_) {}
    }
    return getFallbackPrice(item) || fmt(0);
  };

  const fmtVol = v => {
    if (!v) return '';
    return String(v).replace(/(\d+)\s*\/\s*(\d+)\s*(мл|л|г|кг)?/i, '$1 / $2 $3').trim();
  };

  const gridEl = $('#grid');
  if (!gridEl) return;

  gridEl.innerHTML = '';
  requestAnimationFrame(() => {
    gridEl.innerHTML =
      list
        .map((p, i) => {
          const tg = p.tag
            ? `<span class="tag ${p.tag === 'Хит' ? 'hit' : p.tag === 'New' ? 'new' : 'vegan'}">${esc(p.tag)}</span>`
            : '';
          const priceStr = fmtMulti(p.price, p);
          const volStr = fmtVol(p.vol);
          return `<article class="card ${p.on ? '' : 'stopped'}" style="--d:${Math.min(i, 10) * 35}ms" data-item-id="${p.id}"${dragAttr()}>
       <div class="media" style="--tint:${TINT[p.cat] || '#E7ECF0'}">
                  ${
                    p.img
                      ? `<img src="${p.img}" alt="${esc(p.name)}" data-zoom="${toZoomSrc(p.img)}" width="300" height="150" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;display:block;cursor:zoom-in" loading="${i < 4 ? 'eager' : 'lazy'}" fetchpriority="${i < 4 ? 'high' : 'auto'}" decoding="async">`
                      : `<span class="em">${p.e || '☕'}</span>`
                  }
         ${tg}${p.on ? '' : '<span class="stopbadge">СТОП</span>'}
          ${editMode && window.canEditMenu && window.canEditMenu() ? `<button class="edBtn" data-ed="${p.id}" title="Редактировать">✏️</button>` : ''}
       </div>
       <div class="cbody">
         <h3>${esc(p.name)}</h3>
         ${p.desc ? `<div class="desc">${esc(p.desc)}</div>` : ''}
         ${(() => {
           try {
             const arr = typeof p.opts === 'string' ? JSON.parse(p.opts) : p.opts || [];
             if (!arr.length) return '';
             return `<div style="margin: 6px 0; font-size: 11px; color: #666;">
               ${arr
                 .map(
                   o =>
                     `<span style="display: inline-block; background: #EFE9DE; padding: 2px 6px; border-radius: 4px; margin-right: 4px;">${esc(o.name)}${o.price_delta ? ' +' + o.price_delta + ' ₽' : ''}</span>`
                 )
                 .join('')}
             </div>`;
           } catch (e) {
             return '';
           }
         })()}
         ${
           p.comp && p.comp.length
             ? '<div class="comp">' + p.comp.map(c => '<i>' + esc(c) + '</i>').join('') + '</div>'
             : ''
         }
         ${volStr ? `<span class="vol">${esc(volStr)}</span>` : ''}
         <div class="cfoot"><span class="price">${priceStr}</span>
          ${
            editMode && window.canToggleStopList && window.canToggleStopList('coffee')
              ? `<label class="donoff"><input type="checkbox" data-onoff="${p.id}" ${p.on ? 'checked' : ''}>в меню</label>`
              : ''
          }
         </div></div></article>`;
        })
        .join('') +
      (editMode && window.canEditMenu && window.canEditMenu()
        ? `<button class="addcard" id="addCard"><span>＋</span>Добавить позицию</button>`
        : '') +
      (list.length === 0
        ? `<div class="gempty" style="grid-column:1/-1"><span class="ee">${query ? '🔍' : ''}</span>${query ? 'Ничего не нашлось. Попробуйте другой запрос.' : 'В этой категории пока пусто.'}</div>`
        : '');

    const a = $('#addCard');
    if (a) a.onclick = () => openEditor(null);
    if (typeof fixLcp === 'function') fixLcp();
  });
  const a = $('#addCard');
  if (a) a.onclick = () => openEditor(null);
}

/* ── UX и валидация модалки модификаторов (размер, тесто, опции) ── */
function openItemModifiersModal(product) {
  var modal = document.getElementById('itemModal');
  if (!modal) return;

  var opts = [];
  try {
    opts = typeof product.opts === 'string' ? JSON.parse(product.opts) : product.opts || [];
  } catch (e) {}

  var selectedOpt = opts.length > 0 ? opts[0] : null;

  modal.innerHTML = `
    <div style="background:#fff;border-radius:24px;padding:24px;max-width:400px;width:92vw;box-shadow:0 25px 60px rgba(0,0,0,0.3);position:relative">
      <h3 style="margin:0 0 6px;font-size:18px;color:#123A6B">${esc(product.name)}</h3>
      <p style="color:#666;font-size:13px;margin:0 0 16px">${esc(product.desc || 'Выберите параметры')}</p>
      
      ${
        opts.length > 0
          ? `
        <div style="margin-bottom:16px">
          <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:#8B98A5;margin-bottom:8px">Вариант / Размер</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px" id="modalOptsList">
            ${opts
              .map(
                (o, idx) => `
              <button type="button" class="optChip ${idx === 0 ? 'active' : ''}" data-opt-idx="${idx}" style="padding:10px 14px;border-radius:12px;border:1.5px solid ${idx === 0 ? '#123A6B' : '#D8DFE4'};background:${idx === 0 ? '#EAF1F9' : '#fff'};color:#123A6B;font-weight:700;font-size:13px;cursor:pointer">
                ${esc(o.name)} ${o.price_delta ? '(+' + o.price_delta + '₽)' : ''}
              </button>
            `
              )
              .join('')}
          </div>
        </div>
      `
          : ''
      }

      <div style="display:flex;gap:10px;margin-top:20px">
        <button type="button" id="modalAddBtn" class="btn fire" style="flex:1;padding:14px;border-radius:14px;background:#C03B2A;color:#fff;font-weight:700;border:none;cursor:pointer">Добавить в корзину</button>
        <button type="button" id="modalCloseBtn" class="btn ghost" style="padding:14px 20px;border-radius:14px;background:#F3F8FC;color:#123A6B;font-weight:700;border:1.5px solid #D8DFE4;cursor:pointer">Отмена</button>
      </div>
    </div>
  `;

  modal.style.cssText =
    'position:fixed;inset:0;background:rgba(16,20,24,0.65);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;';
  modal.classList.add('open');

  var addBtn = modal.querySelector('#modalAddBtn');
  var closeBtn = modal.querySelector('#modalCloseBtn');
  var optsList = modal.querySelector('#modalOptsList');

  if (optsList) {
    optsList.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-opt-idx]');
      if (!btn) return;
      var idx = parseInt(btn.dataset.optIdx, 10);
      selectedOpt = opts[idx];

      optsList.querySelectorAll('.optChip').forEach(function (b, i) {
        var isSel = i === idx;
        b.classList.toggle('active', isSel);
        b.style.borderColor = isSel ? '#123A6B' : '#D8DFE4';
        b.style.background = isSel ? '#EAF1F9' : '#fff';
      });
    });
  }

  closeBtn.onclick = function () {
    modal.classList.remove('open');
    modal.innerHTML = '';
  };

  modal.onclick = function (e) {
    if (e.target === modal) {
      modal.classList.remove('open');
      modal.innerHTML = '';
    }
  };

  addBtn.onclick = function () {
    if (opts.length > 0 && !selectedOpt) {
      toast('Выберите размер или вариант', '⚠️');
      return;
    }

    var finalPrice = parseInt(product.price, 10) || 0;
    var finalName = product.name;
    if (selectedOpt) {
      finalPrice += parseInt(selectedOpt.price_delta, 10) || 0;
      finalName += ' (' + selectedOpt.name + ')';
    }

    if (typeof cart !== 'undefined') {
      var ex = cart.find(function (c) {
        return (
          String(c.id) === String(product.id) &&
          c.optName === (selectedOpt ? selectedOpt.name : null)
        );
      });
      if (ex) {
        ex.qty++;
      } else {
        cart.push({
          key: product.id + (selectedOpt ? '-' + selectedOpt.name : ''),
          id: product.id,
          oi: -1,
          name: finalName,
          opt: selectedOpt,
          optName: selectedOpt ? selectedOpt.name : null,
          price: finalPrice,
          sz: 0,
          qty: 1
        });
      }
      localStorage.setItem('zt_cart', JSON.stringify(cart));
      if (typeof updateCartFab === 'function') updateCartFab();
      if (typeof renderCart === 'function') renderCart();
      toast('Добавлено в корзину', '🛒');
    }

    modal.classList.remove('open');
    modal.innerHTML = '';
  };
}

function getZoomPizzaOptions(dish) {
  if (!dish || dish.section !== 'delivery' || dish.cat !== 'pizza') return [];
  const raw = dish.opts;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }
  return [];
}

function renderZoomNutrition(data, pizzaOptions, selectedOptionIndex) {
  const optionSelector = pizzaOptions.length
    ? '<div style="margin-bottom:9px">' +
        '<div style="font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--nutrition-muted, #8B98A5);margin-bottom:6px">Размер и тесто</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:5px">' +
          pizzaOptions.map((option, index) => {
            const active = index === selectedOptionIndex;
            const label = String(option.l || option.name || ('Вариант ' + (index + 1)));
            const buttonStyle = active
              ? 'border:2px solid var(--nutrition-accent, var(--flame, #123A6B));background:var(--nutrition-accent-soft, #EAF1F9);color:var(--nutrition-text, #101418);box-shadow:2px 2px 0 var(--nutrition-border, transparent);'
              : 'border:1px solid var(--nutrition-border, #D8DFE4);background:var(--nutrition-surface, #F8FAFC);color:var(--nutrition-text, #101418);';
            return '<button type="button" data-kbju-option="' + index + '" aria-pressed="' + active + '" style="' + buttonStyle + 'border-radius:9px;padding:6px 8px;font-size:11px;font-weight:' + (active ? '700' : '500') + ';cursor:pointer">' + esc(label) + '</button>';
          }).join('') +
        '</div>' +
      '</div>'
    : '';

  if (!data) {
    if (!pizzaOptions.length) return '';
    return '<div id="zoomKbjuBox" style="margin-top:2px">' +
      optionSelector +
      '<div style="font-size:12px;line-height:1.45;color:var(--nutrition-warning, #7A5A26)">Для этой позиции пока нет ТТК. КБЖУ не рассчитывается.</div>' +
    '</div>';
  }

  if (data.status === 'incomplete' || !data.complete || !data.per100) {
    const missing = (data.missingIngredients || []).map(esc).join(', ');
    return '<div id="zoomKbjuBox" style="margin-top:2px">' +
      optionSelector +
      '<div style="font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--nutrition-muted, #8B98A5);margin-bottom:5px">Пищевая ценность — оценка</div>' +
      '<div style="font-size:12px;line-height:1.45;color:var(--nutrition-warning, #7A5A26)">Полный расчёт недоступен: не хватает данных по ' + (missing || 'одному или нескольким ингредиентам') + '. Числа не показываются, чтобы не занижать КБЖУ.</div>' +
    '</div>';
  }

  const hasPortion = !!(data.perPortion && data.totalWeight > 0);
  const cell = (idKey, val, label) =>
    '<div style="flex:1;background:var(--nutrition-surface, #F8FAFC);border:1px solid var(--nutrition-border, #E5EBF0);border-radius:12px;padding:7px 4px;text-align:center">' +
      '<b data-kbju-val="' + idKey + '" style="display:block;font-size:14px;color:var(--nutrition-text, #101418)">' + esc(val ?? '—') + '</b>' +
      '<span style="font-size:10.5px;color:var(--nutrition-muted, #6E7A85)">' + label + '</span>' +
    '</div>';

  return '<div id="zoomKbjuBox" style="margin-top:2px">' +
    optionSelector +
    '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px">' +
      '<span style="font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--nutrition-muted, #8B98A5)">Пищевая ценность — оценка</span>' +
      (hasPortion
        ? '<div style="display:inline-flex;background:var(--nutrition-toggle-bg, #EEF2F6);border:var(--nutrition-toggle-border, none);border-radius:999px;padding:2px;gap:2px;white-space:nowrap">' +
            '<button type="button" data-kbju-mode="100" style="border:var(--nutrition-toggle-active-border, none);background:var(--nutrition-toggle-active-bg, #FFFFFF);color:var(--nutrition-text, #101418);font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;cursor:pointer;box-shadow:var(--nutrition-toggle-active-shadow, 0 1px 3px rgba(0,0,0,.1))">на 100 г</button>' +
            '<button type="button" data-kbju-mode="portion" style="border:none;background:transparent;color:var(--nutrition-muted, #586470);font-size:11px;font-weight:600;padding:3px 9px;border-radius:999px;cursor:pointer">на порцию (' + data.totalWeight + ' г)</button>' +
          '</div>'
        : '<span style="font-size:11px;color:var(--nutrition-muted, #8B98A5)">на 100 г</span>') +
    '</div>' +
    '<div style="display:flex;gap:6px">' +
      cell('kcal', data.per100.kcal, 'ккал') +
      cell('p', data.per100.p, 'белки, г') +
      cell('f', data.per100.f, 'жиры, г') +
      cell('c', data.per100.c, 'углеводы, г') +
    '</div>' +
    '<div style="font-size:10.5px;line-height:1.4;color:var(--nutrition-muted, #8B98A5);margin-top:6px">Расчёт по граммовкам ТТК и усреднённым справочным значениям ингредиентов; фактический состав поставщика и потери при приготовлении могут отличаться.</div>' +
  '</div>';
}/* ── Полноэкранный зум с пинчем двумя пальцами, составом и авто-КБЖУ ── */
function openZoom(src, name, price, itemObj) {
  const dish = findDishForZoom(src, name, itemObj);
  const title = name || (dish && dish.name) || '';
  const isDeliv = typeof brand !== 'undefined' && brand === 'delivery';
  const accentColor = isDeliv ? '#C03B2A' : '#2E6F8E';

  const descText = dish && dish.desc ? String(dish.desc).trim() : '';
  const compList = getVisibleComposition(dish);
  const pizzaOptions = getZoomPizzaOptions(dish);
  let selectedPizzaOptionIndex = 0;
  let kbjuData = calculateDishKbju(dish, title, {
    option: pizzaOptions[selectedPizzaOptionIndex] || null
  });
  const volText =
    (dish && dish.vol ? String(dish.vol).trim() : '') ||
    (kbjuData && kbjuData.totalWeight ? kbjuData.totalWeight + ' г' : '');

  const w = document.createElement('div');
  w.id = 'itemZoomOverlay';
  w.style.cssText =
    'position:fixed;inset:0;z-index:400;display:flex;align-items:center;justify-content:center;padding:12px;background:rgba(16,24,32,.78);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);opacity:0;transition:opacity .25s';

  const card = document.createElement('div');
  card.style.cssText =
    'width:min(500px,96vw);max-height:90dvh;display:flex;flex-direction:column;background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.48);transform:scale(.94) translateY(12px);transition:transform .28s cubic-bezier(.2,1.25,.35,1)';

  // Контейнер для фото с поддержкой жестов (щипок двумя пальцами + перетаскивание + двойной тап)
  const imgWrap = document.createElement('div');
  imgWrap.style.cssText =
    'position:relative;width:100%;height:min(54dvh,420px);background:#F6F3EE;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;display:flex;align-items:center;justify-content:center;cursor:grab';

  const im = new Image();
  const zoomUrl = toZoomSrc(src);
  im.decoding = 'async';
  im.fetchPriority = 'high';
  im.draggable = false;
  im.onerror = () => {
    if (im.src !== src && src) {
      im.onerror = null;
      im.src = src;
    }
  };
  im.src = zoomUrl;
  im.alt = title;
  // Начальный масштаб 1.12 убирает лишние пустые поля вокруг пиццы и делает блюдо крупнее
  const baseScale = 1.12;
  im.style.cssText =
    `display:block;width:100%;height:100%;object-fit:cover;transform-origin:center center;will-change:transform;transform:scale(${baseScale})`;

  const hint = document.createElement('div');
  hint.textContent = '🔍 Щипок или 2 тапа — приблизить';
  hint.style.cssText =
    'position:absolute;bottom:10px;right:10px;background:rgba(16,20,24,.58);color:#fff;font-size:11px;font-weight:600;padding:4px 10px;border-radius:999px;pointer-events:none;transition:opacity .3s';
  setTimeout(() => {
    hint.style.opacity = '0';
  }, 2400);

  imgWrap.appendChild(im);
  imgWrap.appendChild(hint);

  let scale = baseScale;
  let tx = 0;
  let ty = 0;
  let startDist = 0;
  let startScale = baseScale;
  let startX = 0;
  let startY = 0;
  let isPanning = false;
  let lastTap = 0;

  function clampPan() {
    const maxX = Math.max(0, ((scale - 1) * imgWrap.clientWidth) / 2);
    const maxY = Math.max(0, ((scale - 1) * imgWrap.clientHeight) / 2);
    tx = Math.max(-maxX, Math.min(maxX, tx));
    ty = Math.max(-maxY, Math.min(maxY, ty));
  }

  function applyTransform(animated) {
    im.style.transition = animated ? 'transform .22s cubic-bezier(.2,.9,.3,1)' : 'none';
    im.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`;
  }

  imgWrap.addEventListener(
    'touchstart',
    e => {
      hint.style.opacity = '0';
      if (e.touches.length === 2) {
        isPanning = false;
        startDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        startScale = scale;
      } else if (e.touches.length === 1) {
        const now = Date.now();
        if (now - lastTap < 280) {
          e.preventDefault();
          if (scale > baseScale + 0.15) {
            scale = baseScale;
            tx = 0;
            ty = 0;
          } else {
            const rect = imgWrap.getBoundingClientRect();
            const tapX = e.touches[0].clientX - (rect.left + rect.width / 2);
            const tapY = e.touches[0].clientY - (rect.top + rect.height / 2);
            scale = 2.5;
            tx = -tapX * 0.9;
            ty = -tapY * 0.9;
            clampPan();
          }
          applyTransform(true);
          lastTap = 0;
          return;
        }
        lastTap = now;
        if (scale > baseScale + 0.05) {
          isPanning = true;
          startX = e.touches[0].clientX - tx;
          startY = e.touches[0].clientY - ty;
        }
      }
    },
    { passive: false }
  );

  imgWrap.addEventListener(
    'touchmove',
    e => {
      if (e.touches.length === 2 && startDist > 0) {
        e.preventDefault();
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        scale = Math.max(1, Math.min(4, startScale * (dist / startDist)));
        clampPan();
        applyTransform(false);
      } else if (e.touches.length === 1 && isPanning && scale > baseScale + 0.05) {
        e.preventDefault();
        tx = e.touches[0].clientX - startX;
        ty = e.touches[0].clientY - startY;
        clampPan();
        applyTransform(false);
      }
    },
    { passive: false }
  );

  imgWrap.addEventListener('touchend', e => {
    if (e.touches.length < 2) startDist = 0;
    if (e.touches.length === 0) {
      isPanning = false;
      if (scale < baseScale) {
        scale = baseScale;
        tx = 0;
        ty = 0;
        applyTransform(true);
      }
    }
  });

  imgWrap.addEventListener('dblclick', e => {
    if (scale > baseScale + 0.15) {
      scale = baseScale;
      tx = 0;
      ty = 0;
    } else {
      const rect = imgWrap.getBoundingClientRect();
      scale = 2.5;
      tx = -(e.clientX - (rect.left + rect.width / 2)) * 0.9;
      ty = -(e.clientY - (rect.top + rect.height / 2)) * 0.9;
      clampPan();
    }
    applyTransform(true);
  });

  // Нижний блок: заголовок, состав, описание и блок КБЖУ
  const cap = document.createElement('div');
  cap.style.cssText =
    'padding:16px 18px calc(16px + env(safe-area-inset-bottom));overflow-y:auto;display:flex;flex-direction:column;gap:10px';

  const headHtml =
    `<div style="display:flex;align-items:baseline;gap:10px;justify-content:space-between">` +
      `<b style="font:700 18px/1.25 -apple-system,'Segoe UI',Roboto,sans-serif;color:#12303E">${esc(title)}` +
        (volText ? ` <small style="font-weight:500;font-size:13px;color:#6E7A85">${esc(volText)}</small>` : '') +
      `</b>` +
      (price
        ? `<span style="font:800 16px -apple-system,'Segoe UI',Roboto,sans-serif;color:${accentColor};white-space:nowrap">${esc(price)}</span>`
        : '') +
    `</div>`;

  let compHtml = '';
  if (descText) {
    compHtml += `<div class="zoom-desc" style="font-size:13.5px;line-height:1.45;color:#45505B">${esc(descText)}</div>`;
  }
  if (compList.length) {
    compHtml +=
      `<div>` +
        `<div style="font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#8B98A5;margin-bottom:6px">Состав</div>` +
        `<div style="display:flex;flex-wrap:wrap;gap:6px">` +
          compList
            .map(
              c =>
                `<span style="font-size:12px;background:#F3F5F7;color:#2C3640;padding:4px 10px;border-radius:999px;font-weight:500">${esc(c)}</span>`
            )
            .join('') +
        `</div>` +
      `</div>`;
  }

  const kbjuHtml = renderZoomNutrition(kbjuData, pizzaOptions, selectedPizzaOptionIndex);

  cap.innerHTML = headHtml + compHtml + '<div id="zoomKbjuMount">' + kbjuHtml + '</div>';

  // Переключение размера/теста и формата КБЖУ в одном обработчике.
  if (kbjuData || pizzaOptions.length) {
    cap.addEventListener('click', e => {
      const optionButton = e.target.closest('[data-kbju-option]');
      if (optionButton) {
        selectedPizzaOptionIndex = Number.parseInt(optionButton.dataset.kbjuOption, 10) || 0;
        kbjuData = calculateDishKbju(dish, title, {
          option: pizzaOptions[selectedPizzaOptionIndex] || null
        });
        const mount = cap.querySelector('#zoomKbjuMount');
        if (mount) {
          mount.innerHTML = renderZoomNutrition(kbjuData, pizzaOptions, selectedPizzaOptionIndex);
        }
        return;
      }

      const modeButton = e.target.closest('[data-kbju-mode]');
      if (!modeButton || !kbjuData?.perPortion) return;

      const mode = modeButton.dataset.kbjuMode;
      const targetValues = mode === 'portion' ? kbjuData.perPortion : kbjuData.per100;
      cap.querySelectorAll('[data-kbju-mode]').forEach(button => {
        const active = button === modeButton;
        button.style.background = active ? '#fff' : 'transparent';
        button.style.color = active ? '#101418' : '#586470';
        button.style.fontWeight = active ? '700' : '600';
        button.style.boxShadow = active ? '0 1px 3px rgba(0,0,0,.1)' : 'none';
      });
      ['kcal', 'p', 'f', 'c'].forEach(key => {
        const element = cap.querySelector('[data-kbju-val="' + key + '"]');
        if (element) element.textContent = targetValues[key];
      });
    });
  }

  card.appendChild(imgWrap);
  card.appendChild(cap);

  const x = document.createElement('button');
  x.setAttribute('aria-label', 'Закрыть');
  x.textContent = '✕';
  x.style.cssText =
    'position:absolute;top:calc(12px + env(safe-area-inset-top));right:12px;width:42px;height:42px;border:none;border-radius:50%;background:rgba(255,255,255,.95);color:#12303E;font-size:17px;box-shadow:0 6px 18px rgba(0,0,0,.28);cursor:pointer';
  w.appendChild(card);
  w.appendChild(x);

  const close = () => {
    w.style.opacity = '0';
    card.style.transform = 'scale(.94) translateY(12px)';
    document.body.style.overflow = '';
    setTimeout(() => w.remove(), 260);
  };
  w.addEventListener('click', e => {
    if (e.target === w || e.target === x) close();
  });
  document.body.style.overflow = 'hidden';
  document.body.appendChild(w);
  requestAnimationFrame(() => {
    w.style.opacity = '1';
    card.style.transform = 'none';
  });
}

$('#grid').addEventListener('click', e => {
  if (editMode) return;

  const img = e.target.closest('[data-zoom]');
  if (img) {
    const art = img.closest('article');
    const item =
      art && art.dataset.itemId
        ? MENU.find(x => String(x.id) === String(art.dataset.itemId))
        : null;
    openZoom(
      img.dataset.zoom,
      art && art.querySelector('h3') ? art.querySelector('h3').textContent : '',
      art && art.querySelector('.price') ? art.querySelector('.price').textContent : '',
      item
    );
    return;
  }

  const card = e.target.closest('article[data-item-id]');
  if (card && !e.target.closest('button') && !e.target.closest('input')) {
    const p = MENU.find(x => String(x.id) === String(card.dataset.itemId));
    if (p) {
      try {
        const opts = typeof p.opts === 'string' ? JSON.parse(p.opts) : p.opts || [];
        if (opts.length > 0) {
          openItemModifiersModal(p);
        }
      } catch (err) {}
    }
  }
});

$('#grid').addEventListener('change', async e => {
  const t = e.target.closest('[data-onoff]');
  if (!t) return;
  const p = MENU.find(x => String(x.id) === String(t.dataset.onoff));
  if (!p) return;
  if (!window.canToggleStopList || !window.canToggleStopList('coffee')) {
    t.checked = !!p.on;
    return;
  }
  const on = t.checked ? 1 : 0;
p.on = on;
try {
// F3.68: не-админ (cashier/dispatch) шлёт ТОЛЬКО {on} — серверный PUT /api/menu/:id отдаёт 403 на любое другое тело
const body = (window.me && window.me.role === 'admin') ? p : { on };
await api('/menu/' + p.id, { method: 'PUT', body });
window.renderMenu();   // локальный рендер из обновлённого MENU — без stale-рефетча
toast(on ? `«${esc(p.name)}» снова в меню` : `«${esc(p.name)}» → стоп-лист`, on ? '✅' : '⛔');
} catch (err) {
toast(err.message, '⚠️');
await loadMenu();
}
});

/* ── Ф6.2: LCP-картинка первого экрана — eager + fetchpriority ── */
function fixLcp() {
  var f = document.querySelector('#grid img, #deliveryGrid img');
  if (f && !f.dataset.lcp) {
    f.dataset.lcp = '1';
    f.loading = 'eager';
    try {
      f.fetchPriority = 'high';
    } catch (e) {}
  }
}
window.fixLcp = fixLcp;
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', fixLcp);
} else {
  fixLcp();
}

/* ── Ф5.8g: ESM-шимы (boot/catalog/editor/menu-editor + обёртки admin-extra/delivery-search) ── */
window.renderMenu = renderMenu;
if (typeof window.alignRailWithCard === 'function') setTimeout(window.alignRailWithCard, 40);
if (typeof window.alignRailWithCard === 'function') setTimeout(window.alignRailWithCard, 0);
window.renderRail = renderRail;
window.openZoom = openZoom;
window.openItemModifiersModal = openItemModifiersModal;

/* ── F3.70: DnD порядка кофейни ── */
attachGridDnD(document.getElementById('grid'), {
  canDrag: canDragMenu,
  getIds: () => coffeePool().map(p => p.id),
  onReorder: async (ids) => {
    await api('/menu/reorder', { method: 'PUT', body: { brand: 'coffee', ids } });
    await loadMenu();
  },
  rerender: () => renderMenu()
});