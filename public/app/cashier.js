/* public/app/cashier.js — F2.3: кассир — поиск гостя, штампы, списание, журнал.
   ВАЖНО: без IIFE — fix-views.js патчит showCust (1244), заменяет loadPending (553),
   зовёт renderLog (159). Всё должно быть в глобальном lexical env. */

var found = null;

function dotsHTML(u, last) {
  let h = '';
  for (let i = 0; i < 10; i++)
    h += `<span class="cdot ${i < u.stamps ? 'f' : ''} ${i === last ? 'last' : ''}">${i < u.stamps ? stampIcon(i) : ''}</span>`;
  return h;
}

function hrow(h) {
  return `<div class="hmini"><b>${fmtTs(h.ts)}</b> · ${esc(h.a)} <i>— ${esc(h.by)}</i></div>`;
}

function showCust(u, last = null) {
  found = u;
  $('#custCard').classList.add('show');
  $('#custInit').textContent = (u.name[0] || 'Г').toUpperCase();
  $('#custName').textContent = u.name;
  $('#custPhone').textContent = u.phone + ' · профиль по номеру';
  $('#custDots').innerHTML = dotsHTML(u, last);
  $('#custNote').textContent = `Штампов: ${u.stamps} из 10` + (u.free ? ` · бесплатных кофе: ${u.free}` : '');
  const fb = $('#custFree');
  if (fb) { fb.hidden = u.free < 1; const fn = $('#custFreeN'); if (fn) fn.textContent = u.free; }
  $('#custHist').innerHTML = (u.history || []).slice(0, 4).map(hrow).join('') || '<div class="hmini">История пуста</div>';
  $('#giveStampBtn').textContent = u.stamps === 9
    ? '☕ Пробить 10-й штамп → кофе в подарок'
    : `🫘 Пробить штамп · будет ${u.stamps + 1} из 10`;
  $('#redeemBtn').hidden = u.free === 0;
  renderBonus();
}

$('#findBtn').onclick = async () => {
  let q = $('#findInput').value.trim();
  // Очищаем от нецифровых символов для надежного поиска (обрезаем до 10 цифр с конца)
  const clean = q.replace(/\D/g, '');
  if (clean.length >= 7) {
    q = clean.slice(-10);
  }
  try {
    const r = await api('/staff/customers?search=' + encodeURIComponent(q));
    if (!r.customers || !r.customers.length) {
      return toast('Гость не найден. Создайте профиль → «＋ Новый гость»', '🔍');
    }
    if (r.customers.length > 1) {
      toast('Найдено несколько — показан первый', 'ℹ️');
    }
    showCust(r.customers[0]);
  } catch (e) { 
    toast(e.message, '⚠️'); 
  }
};

$('#findInput').addEventListener('keydown', e => { if (e.key === 'Enter') $('#findBtn').click(); });

$('#giveStampBtn').onclick = async () => {
  if (!found) return;
  try {
    const r = await api('/staff/stamp', { method: 'POST', body: { id: found.id } });
    found = r.customer;
    showCust(found, r.ten ? -1 : found.stamps - 1);
    renderLog();
    if (r.ten) confetti();
    toast(r.msg, r.ten ? '🎉' : '🫘');
  } catch (e) { toast(e.message, '⚠️'); }
};

$('#redeemBtn').onclick = async () => {
  if (!found) return;
  try {
    const r = await api('/staff/redeem', { method: 'POST', body: { id: found.id } });
    found = r.customer;
    showCust(found);
    renderLog();
    renderProfile();
    toast('Бесплатный кофе списан', '🎁');
  } catch (e) { toast(e.message, '⚠️'); }
};

$('#newGuestBtn').onclick = () => {
  $('#ngCard').hidden = !$('#ngCard').hidden;
  if (!$('#ngCard').hidden) $('#ngName').focus();
};

const ng2 = $('#newGuestBtn2');
if (ng2) ng2.onclick = () => {
  $('#ngCard').hidden = !$('#ngCard').hidden;
  if (!$('#ngCard').hidden) $('#ngName').focus();
};

$('#ngCancel').onclick = () => { $('#ngCard').hidden = true; };

$('#ngSave').onclick = async () => {
  const name = $('#ngName').value.trim(), phone = $('#ngPhone').value;
  if (name.length < 2) return toast('Введите имя гостя', '✍️');
  if (ph10(phone).length < 10) return toast('Введите номер полностью', '📵');
  try {
    const r = await api('/staff/customers', { method: 'POST', body: { name, phone } });
    $('#ngCard').hidden = true;
    $('#ngName').value = '';
    $('#ngPhone').value = '';
    showCust(r.customer);
    renderLog();
    toast(`Профиль создан: ${esc(name)}. Можно начислять штампы`, '✅');
  } catch (e) {
    if (e.code === 409) {
      try {
        const f = await api('/staff/customers?search=' + encodeURIComponent(phone));
        if (f.customers.length) {
          $('#ngCard').hidden = true;
          showCust(f.customers[0]);
          return toast(`Профиль уже есть по этому номеру: ${esc(f.customers[0].name)}`, '🔔');
        }
      } catch (_) {}
    }
    toast(e.message, '⚠️');
  }
};

async function loadPending() {
  const host = $('#pendingBox');
  if (!host) return;
  try {
    const r = await api('/staff/pending');
    host.innerHTML = r.pending.length
      ? r.pending.map(p => `<div class="hmini"><b>${esc(p.name)}</b> · ${esc(p.phone)} · код: <b style="font-size:15px">${p.actcode}</b></div>`).join('')
      : '<div class="hmini">Все гости активированы ✅</div>';
  } catch (e) {}
}

async function renderLog() {
  try {
    const r = await api('/staff/log');
    loadPending();
    $('#cashLog').innerHTML = r.log.map(l =>
      `<div class="logrow cashlog"><span class="lt">${esc(l.t)}</span><span class="la">${esc(l.w)} — ${esc(l.a)}</span></div>`
    ).join('') || '<div class="hmini">Журнал пуст</div>';
  } catch (e) { $('#cashLog').innerHTML = ''; }
}
/* ── Ф3.19a: чистка вида кассира + списание свободного кофе с выбором напитка.
Было fix-views.js: R7 + R9. ── */
function cashierClean(){
  var cl=document.getElementById('cashLog');if(cl){var card=cl.closest('.cash-card');if(card)card.style.display='none';}
  var ng2=document.getElementById('newGuestBtn2');if(ng2)ng2.style.display='none';
}
new MutationObserver(function(){
  var cv=document.getElementById('cashierView');if(cv&&!cv.hidden)cashierClean();
}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
showCust=(function(_sc){return function(u,last){window.__foundId=u&&u.id;return _sc(u,last);};})(showCust);
(function(){
  if(document.getElementById('redeemPick'))return;
  var m=document.createElement('div');m.id='redeemPick';
  m.innerHTML='<div class="omCard" style="max-width:420px"><button type="button" class="omClose">✕</button><h3 style="margin:0 0 12px">🎁 Какой кофе списать?</h3><div id="rpList" style="display:grid;gap:8px"></div></div>';
  document.body.appendChild(m);
  m.addEventListener('click',function(e){if(e.target===m||e.target.closest('.omClose'))m.classList.remove('show');});
  document.getElementById('rpList').innerHTML=['Эспрессо','Американо','Капучино','Латте','Флэт уайт','Батч брю'].map(function(n){return '<button type="button" class="btn ghost" data-rp="'+n+'" style="width:100%">'+n+'</button>';}).join('');
  m.addEventListener('click',async function(e){
    var b=e.target.closest('[data-rp]');if(!b)return;
    var id=window.__foundId;if(!id)return toast('Гость не найден','⚠️');
    try{var r=await api('/staff/redeem',{method:'POST',body:{id:id,item:b.dataset.rp}});
      m.classList.remove('show');toast('Списано: '+b.dataset.rp,'🎁');
      try{showCust(r.customer);}catch(e2){}
    }catch(err){toast(err.message,'⚠️');}
  });
  var rb=document.getElementById('redeemBtn');
  if(rb)rb.addEventListener('click',function(e){
    e.stopImmediatePropagation();e.preventDefault();
    document.getElementById('redeemPick').classList.add('show');
  },true);
})();
/* ── Ф3.23: выход из карточки гостя (было fix-views v62-FAB) + инициализация чистки ── */
(function(){
var acts=document.querySelector('#custCard .acts');
if(!acts||document.getElementById('custClose'))return;
var b=document.createElement('button');b.id='custClose';b.className='btn ghost';b.textContent='✕ Закрыть карточку';
b.onclick=function(){document.getElementById('custCard').classList.remove('show');try{found=null;}catch(e){}};
acts.appendChild(b);
})();
setTimeout(cashierClean,400);