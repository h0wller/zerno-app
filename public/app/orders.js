/* public/app/orders.js — F2.5.5: диспетчер заказов.
   Без IIFE: fix-views.js оборачивает orderCard (287) и renderOrders (563),
   читает/пишет window.ordersPoll (878). Всё — top-level. */

var ordersPoll = null, lastOrderNo = 0;

function orderLabel(s) {
  return ({ new: '🆕 Новый', accept: '✅ Принят', cook: '👨‍🍳 Готовится', way: '🛵 В пути', done: '🏁 Выполнен', cancel: '❌ Отменён' })[s] || s;
}

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = 880;
    g.gain.value = 0.15;
    o.start();
    setTimeout(() => { o.stop(); ctx.close(); }, 300);
  } catch (e) {}
}

function orderCard(o) {
  const next = o.status === 'new' ? ['accept']
    : o.status === 'accept' ? ['cook']
    : o.status === 'cook' ? (o.method === 'pickup' ? ['done'] : ['way'])
    : o.status === 'way' ? ['done']
    : [];
  const items = o.items.map(i => `${i.qty}× ${esc(i.name)}${i.opt ? ' (' + esc(i.opt) + ')' : ''}`).join('<br>');
  const gifts = (o.gifts || []).map(g => `🎁 ${esc(g.name)} ×${g.qty}`).join('<br>');
  return `<div class="orderCard" data-oid="${o.id}">
  <div class="ocHead"><b>#${o.no}</b><span class="ocStatus st-${o.status}">${orderLabel(o.status)}</span>
   <span class="ocTime">${new Date(o.created).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span></div>
  <div class="ocWho">${esc(o.name)} · ${esc(o.phone)}</div>
  <div class="ocAddr">${o.method === 'pickup' ? '🛍 Самовывоз, Советская 38А' : '🚗 ' + esc(o.place) + ', ' + esc(o.addr)}<br>⏰ ${o.slot === 'asap' ? 'как можно скорее' : esc(o.slot)} · 💳 ${o.pay === 'cash' ? 'наличные' : 'карта при получении'}</div>
  <div class="ocItems">${items}${gifts ? '<br>' + gifts : ''}</div>
  <div class="ocTotal">Итого: <b>${fmt(o.total)}</b>${o.discount ? ` · скидка ${fmt(o.discount)}` : ''}${o.fee ? ` · доставка ${fmt(o.fee)}` : ''}</div>
  ${o.comment ? `<div class="ocComment">💬 ${esc(o.comment)}</div>` : ''}
  <div class="ocActs">${next.map(s => `<button class="btn fire" data-os="${s}">${orderLabel(s)}</button>`).join('')}
   ${(o.status !== 'done' && o.status !== 'cancel') ? `<button class="btn ghost danger" data-os="cancel">❌ Отменить</button>` : ''}</div>
 </div>`;
}

async function renderOrders(silent) {
  try {
    const r = await api('/orders');
    const list = r.orders || [];
    const maxNo = list.length ? list[0].no : 0;
    if (!silent && lastOrderNo && maxNo > lastOrderNo) { toast(`Новый заказ #${maxNo}!`, '🍕'); beep(); }
    if (maxNo) lastOrderNo = maxNo;
    $('#ordersList').innerHTML = list.map(orderCard).join('') || '<div class="hmini">Заказов за последние 3 дня нет</div>';
  } catch (e) { if (!silent) toast(e.message, '⚠️'); }
}

$('#ordersList').addEventListener('click', async e => {
  const b = e.target.closest('[data-os]');
  if (!b) return;
  const id = b.closest('.orderCard').dataset.oid;
  try { await api('/orders/' + id + '/status', { method: 'POST', body: { status: b.dataset.os } }); renderOrders(true); }
  catch (e2) { toast(e2.message, '⚠️'); }
});

$('#ordersRefresh').onclick = () => renderOrders();
/* ── Ф3.13b: активации гостей (было секция 7 fix-views) ── */
window.loadPending=async function(){
  try{
    var r=await api('/staff/pending');
    var html=r.pending.length?r.pending.map(function(p){
      return '<div class="hmini"><b>'+esc(p.name)+'</b> · '+esc(p.phone)+' · код: <b style="font-size:15px">'+p.actcode+'</b> <button class="btn fire" data-actg="'+p.id+'" style="margin-left:6px;padding:4px 10px;font-size:11px">Активировать</button></div>';
    }).join(''):'<div class="hmini">Все гости активированы ✅</div>';
    var a=document.getElementById('pendingBox');if(a)a.innerHTML=html;
    var b=document.getElementById('pendingBoxD');if(b)b.innerHTML=html;
  }catch(e){}
};
renderOrders=(function(_ro){return async function(s){var r=await _ro(s);window.loadPending();return r;};})(renderOrders);
document.addEventListener('click',async function(e){
  var b=e.target.closest('[data-actg]');if(!b)return;
  try{await api('/staff/activate-guest',{method:'POST',body:{id:b.dataset.actg}});toast('Гость активирован','✅');window.loadPending();}
  catch(e2){toast(e2.message,'⚠️');}
});