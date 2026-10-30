/* public/app/menu.js — F2.6a: гостевое меню — рейл, поиск, сетка, редактор-зум, авто-КБЖУ по техкартам.
   Без IIFE: fix-views.js оборачивает window.renderMenu(499) и window.renderRail(502),
   читает CATS лексически (406). Все объявления — top-level var/function. */
import { attachGridDnD, canDragMenu, dragAttr } from './core/dnd.js';
import { getVisibleComposition } from './core/menu-content.js';
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

/* ══════════════════════════════════════════════════════════════════════════
   АВТОМАТИЧЕСКИЙ КАЛЬКУЛЯТОР КБЖУ ПО ГРАММОВКАМ ТЕХКАРТ
   ══════════════════════════════════════════════════════════════════════════
   1. window.INGREDIENTS_DB — справочник пищевой ценности продуктов на 100 г:
      { kcal: ккал, p: белки, f: жиры, c: углеводы }
   2. window.TECH_CARDS — техкарты блюд в граммах.
      Достаточно вписать граммовку каждого ингредиента по названию или ID блюда,
      и функция calculateDishKbju() автоматически посчитает:
      - КБЖУ на 100 г готового блюда
      - КБЖУ на всю порцию (и общий вес в граммах)
   ══════════════════════════════════════════════════════════════════════════ */

window.INGREDIENTS_DB = Object.assign(
  {
    // Основа и тесто
    'тесто пицца': { kcal: 255, p: 8.2, f: 3.5, c: 47.6 },
    'тесто': { kcal: 255, p: 8.2, f: 3.5, c: 47.6 },
    'мука': { kcal: 342, p: 10.3, f: 1.1, c: 70.6 },
    'рис для суши': { kcal: 140, p: 2.8, f: 0.3, c: 31.2 },
    'рис': { kcal: 140, p: 2.8, f: 0.3, c: 31.2 },
    'нори': { kcal: 349, p: 46.1, f: 0.1, c: 41.0 },

    // Сыры
    'моцарелла': { kcal: 280, p: 22.0, f: 21.0, c: 1.0 },
    'сыр моцарелла': { kcal: 280, p: 22.0, f: 21.0, c: 1.0 },
    'чеддер': { kcal: 402, p: 25.0, f: 33.0, c: 1.3 },
    'сыр чеддер': { kcal: 402, p: 25.0, f: 33.0, c: 1.3 },
    'пармезан': { kcal: 431, p: 38.0, f: 29.0, c: 4.1 },
    'сыр пармезан': { kcal: 431, p: 38.0, f: 29.0, c: 4.1 },
    'дорблю': { kcal: 353, p: 21.4, f: 28.7, c: 0.0 },
    'сыр дорблю': { kcal: 353, p: 21.4, f: 28.7, c: 0.0 },
    'фета': { kcal: 264, p: 14.2, f: 21.3, c: 4.1 },
    'сливочный сыр': { kcal: 310, p: 6.5, f: 31.0, c: 3.2 },
    'творожный сыр': { kcal: 268, p: 6.8, f: 25.5, c: 3.0 },

    // Соусы
    'соус томатный': { kcal: 54, p: 1.4, f: 1.2, c: 9.2 },
    'томатный соус': { kcal: 54, p: 1.4, f: 1.2, c: 9.2 },
    'соус сливочный': { kcal: 215, p: 2.8, f: 20.5, c: 4.8 },
    'сливочный соус': { kcal: 215, p: 2.8, f: 20.5, c: 4.8 },
    'соус цезарь': { kcal: 390, p: 3.2, f: 40.0, c: 4.0 },
    'соус барбекю': { kcal: 172, p: 0.8, f: 0.6, c: 40.8 },
    'соус чесночный': { kcal: 380, p: 1.5, f: 39.0, c: 5.2 },
    'соус спайси': { kcal: 410, p: 1.2, f: 42.0, c: 6.0 },
    'соус унаги': { kcal: 224, p: 2.9, f: 0.1, c: 52.8 },
    'соус терияки': { kcal: 140, p: 3.5, f: 0.2, c: 31.0 },
    'майонез': { kcal: 627, p: 2.8, f: 67.0, c: 2.6 },
    'песто': { kcal: 450, p: 5.1, f: 45.0, c: 5.5 },

    // Мясо и птица
    'ветчина': { kcal: 240, p: 14.5, f: 19.5, c: 1.5 },
    'пепперони': { kcal: 465, p: 20.0, f: 42.0, c: 1.8 },
    'салями': { kcal: 445, p: 21.0, f: 39.0, c: 1.5 },
    'бекон': { kcal: 458, p: 13.0, f: 45.0, c: 0.8 },
    'курица': { kcal: 165, p: 23.0, f: 7.5, c: 0.5 },
    'куриное филе': { kcal: 165, p: 23.0, f: 7.5, c: 0.5 },
    'охотничьи колбаски': { kcal: 410, p: 15.5, f: 38.0, c: 1.8 },
    'говядина': { kcal: 250, p: 26.0, f: 16.0, c: 0.0 },
    'свинина': { kcal: 290, p: 21.0, f: 23.0, c: 0.0 },

    // Рыба и морепродукты
    'лосось': { kcal: 208, p: 20.4, f: 13.4, c: 0.0 },
    'семга': { kcal: 208, p: 20.4, f: 13.4, c: 0.0 },
    'угорь': { kcal: 315, p: 18.0, f: 26.0, c: 2.5 },
    'креветки': { kcal: 99, p: 21.0, f: 1.4, c: 0.2 },
    'тунец': { kcal: 130, p: 24.0, f: 4.0, c: 0.0 },
    'снежный краб': { kcal: 95, p: 7.5, f: 1.0, c: 14.0 },
    'краб-микс': { kcal: 195, p: 6.5, f: 14.0, c: 10.5 },
    'икра масаго': { kcal: 132, p: 17.5, f: 6.2, c: 1.5 },
    'мидии': { kcal: 172, p: 24.0, f: 4.5, c: 7.4 },

    // Овощи, грибы, зелень, фрукты
    'шампиньоны': { kcal: 27, p: 4.3, f: 1.0, c: 0.1 },
    'грибы': { kcal: 27, p: 4.3, f: 1.0, c: 0.1 },
    'томаты': { kcal: 20, p: 1.1, f: 0.2, c: 3.8 },
    'помидоры': { kcal: 20, p: 1.1, f: 0.2, c: 3.8 },
    'черри': { kcal: 22, p: 1.0, f: 0.2, c: 4.0 },
    'огурец': { kcal: 15, p: 0.8, f: 0.1, c: 2.8 },
    'огурцы маринованные': { kcal: 16, p: 0.8, f: 0.1, c: 3.0 },
    'перец болгарский': { kcal: 27, p: 1.3, f: 0.1, c: 5.3 },
    'халапеньо': { kcal: 29, p: 0.9, f: 0.4, c: 6.5 },
    'лук красный': { kcal: 41, p: 1.4, f: 0.1, c: 9.1 },
    'лук фри': { kcal: 590, p: 6.0, f: 44.0, c: 42.0 },
    'маслины': { kcal: 115, p: 0.8, f: 10.7, c: 6.3 },
    'оливки': { kcal: 145, p: 1.0, f: 15.3, c: 3.8 },
    'ананас': { kcal: 60, p: 0.4, f: 0.1, c: 14.5 },
    'авокадо': { kcal: 160, p: 2.0, f: 14.7, c: 1.8 },
    'айсберг': { kcal: 14, p: 0.9, f: 0.1, c: 3.0 },
    'руккола': { kcal: 25, p: 2.6, f: 0.7, c: 2.1 },
    'кунжут': { kcal: 573, p: 17.7, f: 49.7, c: 23.4 },
    'картофель фри': { kcal: 312, p: 3.4, f: 15.0, c: 41.0 },
    'наггетсы': { kcal: 275, p: 14.8, f: 16.5, c: 17.0 },

    // Кофейня (напитки и добавки)
    'эспрессо': { kcal: 9, p: 0.1, f: 0.2, c: 1.7 },
    'молоко 3.2%': { kcal: 60, p: 2.9, f: 3.2, c: 4.7 },
    'молоко': { kcal: 60, p: 2.9, f: 3.2, c: 4.7 },
    'сливки 10%': { kcal: 119, p: 2.7, f: 10.0, c: 4.5 },
    'сливки 20%': { kcal: 207, p: 2.5, f: 20.0, c: 4.0 },
    'альтернативное молоко': { kcal: 46, p: 0.8, f: 1.5, c: 7.2 },
    'сироп': { kcal: 268, p: 0.0, f: 0.0, c: 67.0 }
  },
  window.INGREDIENTS_DB || {}
);

/* ── ТЕХКАРТЫ БЛЮД (вносите граммовки сюда) ──
   Ключом может быть точное название блюда (регистр не важен) или его ID.
   Формат:
   'Название блюда': {
     'ингредиент из INGREDIENTS_DB': граммы,
     ...
     // При необходимости можно задать кастомный ингредиент прямо на месте:
     // 'фирменный соус': { g: 45, kcal: 280, p: 2, f: 26, c: 8 }
   }
*/
window.TECH_CARDS = Object.assign(
  {
    // Примеры (замените граммовки на точные цифры из ваших техкарт):
    // 'Ветчина и грибы': {
    //   'тесто пицца': 280,
    //   'соус сливочный': 60,
    //   'моцарелла': 110,
    //   'ветчина': 80,
    //   'шампиньоны': 60,
    //   'чеддер': 30
    // },
    // 'Сырная': {
    //   'тесто пицца': 280,
    //   'соус сливочный': 60,
    //   'моцарелла': 120,
    //   'чеддер': 45,
    //   'дорблю': 30,
    //   'пармезан': 25
    // }
  },
  window.TECH_CARDS || {}
);

/* Вычисляет КБЖУ блюда по техкарте (граммовкам) или прямому полю item.kbju / item.recipe */
function calculateDishKbju(item, titleFallback) {
  const nameKey = String((item && item.name) || titleFallback || '').trim();
  const lowerName = nameKey.toLowerCase();
  const itemId = item && item.id != null ? String(item.id) : '';

  // 1. Ищем рецепт (граммовки) в item.recipe / item.techCard или в window.TECH_CARDS
  let recipe = (item && (item.recipe || item.techCard)) || null;
  if (!recipe && window.TECH_CARDS) {
    if (itemId && window.TECH_CARDS[itemId]) {
      recipe = window.TECH_CARDS[itemId];
    } else if (window.TECH_CARDS[nameKey]) {
      recipe = window.TECH_CARDS[nameKey];
    } else {
      const matchedKey = Object.keys(window.TECH_CARDS).find(
        k => k.trim().toLowerCase() === lowerName
      );
      if (matchedKey) recipe = window.TECH_CARDS[matchedKey];
    }
  }

  if (typeof recipe === 'string') {
    try { recipe = JSON.parse(recipe); } catch (_) { recipe = null; }
  }

  // 2. Если задана техкарта с граммовками — считаем автоматически
  if (recipe && typeof recipe === 'object' && !('kcal' in recipe)) {
    let totalGrams = 0;
    let totalKcal = 0;
    let totalP = 0;
    let totalF = 0;
    let totalC = 0;
    const breakdown = [];

    const db = window.INGREDIENTS_DB || {};
    const entries = Array.isArray(recipe)
      ? recipe.map(r => [r.name || r.ing, r])
      : Object.entries(recipe);

    for (const [rawIngName, val] of entries) {
      const ingKey = String(rawIngName || '').trim().toLowerCase();
      if (!ingKey) continue;

      let grams = 0;
      let ref = db[ingKey] || null;

      if (typeof val === 'number' || typeof val === 'string') {
        grams = parseFloat(val) || 0;
      } else if (val && typeof val === 'object') {
        grams = parseFloat(val.g ?? val.grams ?? val.weight ?? 0) || 0;
        if (val.kcal != null) {
          ref = {
            kcal: Number(val.kcal) || 0,
            p: Number(val.p) || 0,
            f: Number(val.f) || 0,
            c: Number(val.c) || 0
          };
        }
      }

      if (grams <= 0 || !ref) continue;

      const factor = grams / 100;
      totalGrams += grams;
      totalKcal += (Number(ref.kcal) || 0) * factor;
      totalP += (Number(ref.p) || 0) * factor;
      totalF += (Number(ref.f) || 0) * factor;
      totalC += (Number(ref.c) || 0) * factor;
      breakdown.push({ name: rawIngName, grams: Math.round(grams) });
    }

    if (totalGrams > 0) {
      const round1 = n => Math.round(n * 10) / 10;
      const scale100 = 100 / totalGrams;
      return {
        totalWeight: Math.round(totalGrams),
        per100: {
          kcal: Math.round(totalKcal * scale100),
          p: round1(totalP * scale100),
          f: round1(totalF * scale100),
          c: round1(totalC * scale100)
        },
        perPortion: {
          kcal: Math.round(totalKcal),
          p: round1(totalP),
          f: round1(totalF),
          c: round1(totalC)
        },
        breakdown
      };
    }
  }

  // 3. Фолбэк: если у блюда уже задано готовое КБЖУ напрямую (item.kbju или в TECH_CARDS со свойством kcal)
  let direct = (item && (item.kbju || item.nutrition)) || (recipe && recipe.kcal != null ? recipe : null);
  if (typeof direct === 'string') {
    try { direct = JSON.parse(direct); } catch (_) { direct = null; }
  }
  if (direct && (direct.kcal != null || direct.p != null)) {
    const w = Number(direct.weight || direct.grams || 0) || 0;
    const p100 = {
      kcal: Math.round(Number(direct.kcal) || 0),
      p: Number(direct.p) || 0,
      f: Number(direct.f) || 0,
      c: Number(direct.c) || 0
    };
    return {
      totalWeight: w,
      per100: p100,
      perPortion: w > 0
        ? {
            kcal: Math.round((p100.kcal * w) / 100),
            p: Math.round(((p100.p * w) / 100) * 10) / 10,
            f: Math.round(((p100.f * w) / 100) * 10) / 10,
            c: Math.round(((p100.c * w) / 100) * 10) / 10
          }
        : null,
      breakdown: []
    };
  }

  return null;
}

window.calculateDishKbju = calculateDishKbju;

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
            editMode
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

/* ── Полноэкранный зум с пинчем двумя пальцами, составом и авто-КБЖУ ── */
function openZoom(src, name, price, itemObj) {
  const dish = findDishForZoom(src, name, itemObj);
  const title = name || (dish && dish.name) || '';
  const isDeliv = typeof brand !== 'undefined' && brand === 'delivery';
  const accentColor = isDeliv ? '#C03B2A' : '#2E6F8E';

  const descText = dish && dish.desc ? String(dish.desc).trim() : '';
  const compList = getVisibleComposition(dish);
  const kbjuData = calculateDishKbju(dish, title);
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

  let kbjuHtml = '';
  if (kbjuData) {
    const hasPortion = !!(kbjuData.perPortion && kbjuData.totalWeight > 0);
    const cell = (idKey, val, lbl) =>
      `<div style="flex:1;background:#F8FAFC;border:1px solid #E5EBF0;border-radius:12px;padding:7px 4px;text-align:center">` +
        `<b data-kbju-val="${idKey}" style="display:block;font-size:14px;color:#101418">${esc(val ?? '—')}</b>` +
        `<span style="font-size:10.5px;color:#6E7A85">${lbl}</span>` +
      `</div>`;

    kbjuHtml =
      `<div id="zoomKbjuBox" style="margin-top:2px">` +
        `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">` +
          `<span style="font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#8B98A5">Пищевая ценность</span>` +
          (hasPortion
            ? `<div style="display:inline-flex;background:#EEF2F6;border-radius:999px;padding:2px;gap:2px">` +
                `<button type="button" data-kbju-mode="100" style="border:none;background:#fff;color:#101418;font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,.1)">на 100 г</button>` +
                `<button type="button" data-kbju-mode="portion" style="border:none;background:transparent;color:#586470;font-size:11px;font-weight:600;padding:3px 9px;border-radius:999px;cursor:pointer">на порцию (${kbjuData.totalWeight} г)</button>` +
              `</div>`
            : `<span style="font-size:11px;color:#8B98A5">на 100 г</span>`) +
        `</div>` +
        `<div style="display:flex;gap:6px">` +
          cell('kcal', kbjuData.per100.kcal, 'ккал') +
          cell('p', kbjuData.per100.p, 'белки, г') +
          cell('f', kbjuData.per100.f, 'жиры, г') +
          cell('c', kbjuData.per100.c, 'углеводы, г') +
        `</div>` +
      `</div>`;
  }

  cap.innerHTML = headHtml + compHtml + kbjuHtml;

  // Переключатель «на 100 г» / «на порцию»
  if (kbjuData && kbjuData.perPortion) {
    cap.addEventListener('click', e => {
      const btn = e.target.closest('[data-kbju-mode]');
      if (!btn) return;
      const mode = btn.dataset.kbjuMode;
      const targetVals = mode === 'portion' ? kbjuData.perPortion : kbjuData.per100;
      cap.querySelectorAll('[data-kbju-mode]').forEach(b => {
        const active = b === btn;
        b.style.background = active ? '#fff' : 'transparent';
        b.style.color = active ? '#101418' : '#586470';
        b.style.fontWeight = active ? '700' : '600';
        b.style.boxShadow = active ? '0 1px 3px rgba(0,0,0,.1)' : 'none';
      });
      ['kcal', 'p', 'f', 'c'].forEach(k => {
        const el = cap.querySelector(`[data-kbju-val="${k}"]`);
        if (el) el.textContent = targetVals[k];
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