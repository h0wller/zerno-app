/* public/app/menu.js — F2.6a: гостевое меню — рейл, поиск, сетка, редактор-зум.
   Без IIFE: fix-views.js оборачивает renderMenu (499) и renderRail (502),
   читает CATS лексически (406). Все объявления — top-level var/function. */

var cat = 'coffee';
var query = '';

$('#rail').innerHTML = CATS.map(c => `<button data-cat="${c.id}"><span class="re">${c.e}</span>${c.l}</button>`).join('');

function renderRail() {
  document.querySelectorAll('#rail button').forEach(b => b.classList.toggle('on', b.dataset.cat === cat));
}

$('#rail').addEventListener('click', e => {
  const b = e.target.closest('[data-cat]');
  if (!b) return;
  cat = b.dataset.cat;
  renderRail();
  renderMenu();
});

$('#searchInput').addEventListener('input', e => {
  query = e.target.value.trim().toLowerCase();
  renderMenu();
});

function renderMenu() {
  let list = query
    ? MENU.filter(p => (p.name + ' ' + p.desc + ' ' + (p.comp || []).join(' ')).toLowerCase().includes(query))
    : MENU.filter(p => p.cat === cat);
  if (!editMode) list = list.filter(p => p.on);

  const fmtMulti = p => {
    const parts = String(p).split('/');
    if (parts.length === 1) return fmt(Number(p) || 0);
    return parts.map(x => fmt(Number(x.trim()))).join(' / ');
  };
  const fmtVol = v => {
    if (!v) return '';
    return String(v).replace(/(\d+)\s*\/\s*(\d+)\s*(мл|л|г|кг)?/i, '$1 / $2 $3').trim();
  };

  const gridEl = $('#grid');
  if (!gridEl) return;
  
  gridEl.innerHTML = '';
  requestAnimationFrame(() => {
    gridEl.innerHTML = list.map((p, i) => {
      const tg = p.tag ? `<span class="tag ${p.tag === 'Хит' ? 'hit' : p.tag === 'New' ? 'new' : 'vegan'}">${esc(p.tag)}</span>` : '';
      const priceStr = fmtMulti(p.price);
      const volStr = fmtVol(p.vol);
      return `<article class="card ${p.on ? '' : 'stopped'}" style="--d:${Math.min(i, 10) * 35}ms" data-item-id="${p.id}">
       <div class="media" style="--tint:${TINT[p.cat] || '#E7ECF0'}">
                  ${p.img ? `<img src="${p.img}" alt="${esc(p.name)}" data-zoom="${p.img}" width="300" height="150" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;display:block;cursor:zoom-in" loading="lazy" decoding="async">` : `<span class="em">${p.e || '☕'}</span>`}
         ${tg}${p.on ? '' : '<span class="stopbadge">СТОП</span>'}
         ${editMode ? `<button class="editbtn" data-ed="${p.id}" title="Редактировать">✏️</button>` : ''}
       </div>
       <div class="cbody">
         <h3>${esc(p.name)}</h3>
         ${p.desc ? `<div class="desc">${esc(p.desc)}</div>` : ''}
         ${(() => {
           try {
             const arr = typeof p.opts === 'string' ? JSON.parse(p.opts) : (p.opts || []);
             if (!arr.length) return '';
             return `<div style="margin: 6px 0; font-size: 11px; color: #666;">
               ${arr.map(o => `<span style="display: inline-block; background: #EFE9DE; padding: 2px 6px; border-radius: 4px; margin-right: 4px;">${esc(o.name)}${o.price_delta ? ' +' + o.price_delta + ' ₽' : ''}</span>`).join('')}
             </div>`;
           } catch(e) { return ''; }
         })()}
         ${p.comp && p.comp.length ? `<div class="comp">${p.comp.map(c => `<i>${esc(c)}</i>`).join('')}</div>` : ''}
         ${volStr ? `<span class="vol">${esc(volStr)}</span>` : ''}
         <div class="cfoot"><span class="price">${priceStr}</span>
          ${editMode ? `<label class="qswitch"><input type="checkbox" data-onoff="${p.id}" ${p.on ? 'checked' : ''}>в меню</label>` : ''}
         </div></div></article>`;
    }).join('')
    + (editMode ? `<button class="addcard" id="addCard"><span>＋</span>Добавить позицию</button>` : '')
    + (list.length === 0 ? `<div class="gempty" style="grid-column:1/-1"><span class="ee">${query ? '🔍' : ''}</span>${query ? 'Ничего не нашлось. Попробуйте другой запрос.' : 'В этой категории пока пусто.'}</div>` : '');

    const a = $('#addCard');
    if (a) a.onclick = () => openEditor(null);
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
    opts = typeof product.opts === 'string' ? JSON.parse(product.opts) : (product.opts || []);
  } catch(e) {}

  var selectedOpt = opts.length > 0 ? opts[0] : null;

  modal.innerHTML = `
    <div style="background:#fff;border-radius:24px;padding:24px;max-width:400px;width:92vw;box-shadow:0 25px 60px rgba(0,0,0,0.3);position:relative">
      <h3 style="margin:0 0 6px;font-size:18px;color:#123A6B">${esc(product.name)}</h3>
      <p style="color:#666;font-size:13px;margin:0 0 16px">${esc(product.desc || 'Выберите параметры')}</p>
      
      ${opts.length > 0 ? `
        <div style="margin-bottom:16px">
          <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:#8B98A5;margin-bottom:8px">Вариант / Размер</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px" id="modalOptsList">
            ${opts.map((o, idx) => `
              <button type="button" class="optChip ${idx === 0 ? 'active' : ''}" data-opt-idx="${idx}" style="padding:10px 14px;border-radius:12px;border:1.5px solid ${idx === 0 ? '#123A6B' : '#D8DFE4'};background:${idx === 0 ? '#EAF1F9' : '#fff'};color:#123A6B;font-weight:700;font-size:13px;cursor:pointer">
                ${esc(o.name)} ${o.price_delta ? '(+' + o.price_delta + '₽)' : ''}
              </button>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <div style="display:flex;gap:10px;margin-top:20px">
        <button type="button" id="modalAddBtn" class="btn fire" style="flex:1;padding:14px;border-radius:14px;background:#C03B2A;color:#fff;font-weight:700;border:none;cursor:pointer">Добавить в корзину</button>
        <button type="button" id="modalCloseBtn" class="btn ghost" style="padding:14px 20px;border-radius:14px;background:#F3F8FC;color:#123A6B;font-weight:700;border:1.5px solid #D8DFE4;cursor:pointer">Отмена</button>
      </div>
    </div>
  `;

  modal.style.cssText = 'position:fixed;inset:0;background:rgba(16,20,24,0.65);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;';
  modal.classList.add('open');

  var addBtn = modal.querySelector('#modalAddBtn');
  var closeBtn = modal.querySelector('#modalCloseBtn');
  var optsList = modal.querySelector('#modalOptsList');

  if (optsList) {
    optsList.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-opt-idx]');
      if (!btn) return;
      var idx = parseInt(btn.dataset.optidx, 10);
      selectedOpt = opts[idx];

      optsList.querySelectorAll('.optChip').forEach(function(b, i) {
        var isSel = i === idx;
        b.classList.toggle('active', isSel);
        b.style.borderColor = isSel ? '#123A6B' : '#D8DFE4';
        b.style.background = isSel ? '#EAF1F9' : '#fff';
      });
    });
  }

  closeBtn.onclick = function() {
    modal.classList.remove('open');
    modal.innerHTML = '';
  };

  modal.onclick = function(e) {
    if (e.target === modal) {
      modal.classList.remove('open');
      modal.innerHTML = '';
    }
  };

  addBtn.onclick = function() {
    if (opts.length > 0 && !selectedOpt) {
      toast('Выберите размер или вариант', '⚠️');
      return;
    }

    var finalPrice = parseInt(product.price) || 0;
    var finalName = product.name;
    if (selectedOpt) {
      finalPrice += parseInt(selectedOpt.price_delta) || 0;
      finalName += ' (' + selectedOpt.name + ')';
    }

    if (typeof cart !== 'undefined') {
      var ex = cart.find(function(c) { return String(c.id) === String(product.id) && c.optName === (selectedOpt ? selectedOpt.name : null); });
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

function openZoom(src, name, price) {
  const w = document.createElement('div');
  w.style.cssText = 'position:fixed;inset:0;z-index:400;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(16,24,32,.72);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);opacity:0;transition:opacity .25s';
  const card = document.createElement('div');
  card.style.cssText = 'width:min(430px,94vw);background:#fff;border-radius:22px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.45);transform:scale(.92) translateY(14px);transition:transform .3s cubic-bezier(.2,1.25,.35,1)';
  const im = new Image();
  im.src = src; im.alt = name || '';
  im.style.cssText = 'display:block;width:100%;height:min(62vh,430px);object-fit:cover;background:#E7ECF0';
  const cap = document.createElement('div');
  cap.style.cssText = 'display:flex;align-items:baseline;gap:10px;padding:14px 18px calc(14px + env(safe-area-inset-bottom))';
  cap.innerHTML = '<b style="flex:1;font:700 16px -apple-system,\'Segoe UI\',Roboto,sans-serif;color:#12303E">' + (name || '') + '</b>' + (price ? '<span style="font:800 15px -apple-system,\'Segoe UI\',Roboto,sans-serif;color:#2E6F8E">' + price + '</span>' : '');
  card.appendChild(im); card.appendChild(cap);
  const x = document.createElement('button');
  x.setAttribute('aria-label', 'Закрыть');
  x.textContent = '✕';
  x.style.cssText = 'position:absolute;top:calc(12px + env(safe-area-inset-top));right:12px;width:42px;height:42px;border:none;border-radius:50%;background:rgba(255,255,255,.95);color:#12303E;font-size:17px;box-shadow:0 6px 18px rgba(0,0,0,.28)';
  w.appendChild(card); w.appendChild(x);
  const close = () => { w.style.opacity = '0'; card.style.transform = 'scale(.92) translateY(14px)'; document.body.style.overflow = ''; setTimeout(() => w.remove(), 260); };
  w.addEventListener('click', e => { if (e.target === w || e.target === x) close(); });
  document.body.style.overflow = 'hidden';
  document.body.appendChild(w);
  requestAnimationFrame(() => { w.style.opacity = '1'; card.style.transform = 'none'; });
}

$('#grid').addEventListener('click', e => {
  if (editMode) return;
  
  const img = e.target.closest('[data-zoom]');
  if (img) {
    const art = img.closest('article');
    openZoom(img.dataset.zoom,
      art && art.querySelector('h3') ? art.querySelector('h3').textContent : '',
      art && art.querySelector('.price') ? art.querySelector('.price').textContent : '');
    return;
  }

  const card = e.target.closest('article[data-item-id]');
  if (card && !e.target.closest('button') && !e.target.closest('input')) {
    const p = MENU.find(x => String(x.id) === String(card.dataset.itemId));
    if (p) {
      try {
        const opts = typeof p.opts === 'string' ? JSON.parse(p.opts) : (p.opts || []);
        if (opts.length > 0) {
          openItemModifiersModal(p);
        }
      } catch(err) {}
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
  renderMenu();
  try {
    await api('/menu/' + p.id, { method: 'PUT', body: p });
    await loadMenu();
    toast(on ? `«${esc(p.name)}» снова в меню` : `«${esc(p.name)}» → стоп-лист`, on ? '✅' : '⛔');
  } catch (err) {
    toast(err.message, '⚠️');
    loadMenu();
  }
});

/* ── Ф6.2: LCP-картинка первого экрана — eager + fetchpriority ── */
(function(){
function fixLcp(){
var f=document.querySelector('#grid img, #deliveryGrid img');
if(f&&!f.dataset.lcp){f.dataset.lcp='1';f.loading='eager';try{f.fetchPriority='high';}catch(e){}}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fixLcp);else fixLcp();
new MutationObserver(function(){fixLcp();}).observe(document.body,{childList:true,subtree:true});
})();
