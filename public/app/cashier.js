/* public/app/cashier.js — F2.3: кассир — поиск гостя, штампы, списание, журнал. */
var found = null;
var foundRevision = 0;
var foundRefreshing = false;

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
  foundRevision++;
  found = u;
  $('#custCard').classList.add('show');
  $('#custInit').textContent = (u.name[0] || 'Г').toUpperCase();
  $('#custName').textContent = u.name;
  $('#custPhone').textContent = u.phone + ' · профиль по номеру';
  $('#custDots').innerHTML = dotsHTML(u, last);
  $('#custNote').textContent = `Штампов: ${u.stamps} из 10` + (u.free ? ` · бесплатных кофе: ${u.free}` : '');
  const fb = $('#custFree');
  if (fb) { fb.hidden = u.free < 1; const fn = $('#custFreeN'); if (fn) fn.textContent = u.free; }
  $('#custHist').innerHTML = (u.history || []).map(hrow).join('') || '<div class="hmini">История пуста</div>';
  $('#giveStampBtn').textContent = u.stamps === 9
    ? '☕ Пробить 10-й штамп → кофе в подарок'
    : `🫘 Пробить штамп · будет ${u.stamps + 1} из 10`;
  $('#redeemBtn').hidden = !(Number(u.free) > 0);
  renderBonus();
}

function clearCustomerCard() {
  found = null;
  foundRevision++;
  window.__foundId = null;
  $('#custCard').classList.remove('show');
  $('#redeemBtn').hidden = true;
  const freeBanner = $('#custFree');
  if (freeBanner) freeBanner.hidden = true;
}

$('#findBtn').onclick = async () => {
  let q = $('#findInput').value.trim();
  const clean = q.replace(/\D/g, '');
  if (clean.length >= 7) q = clean.slice(-10);
  clearCustomerCard();
  try {
    const r = await api('/staff/customers?search=' + encodeURIComponent(q));
    if (!r.customers || !r.customers.length) {
      return toast('Гость не найден. Создайте профиль → «＋ Новый гость»', '🔍');
    }
    if (r.customers.length > 1) {
      return toast('Найдено несколько профилей. Уточните телефон или попросите администратора проверить дубликаты.', 'ℹ️');
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

const toggleNgModal = () => {
  const c = $('#ngCard');
  if (!c) return;
  c.hidden = !c.hidden;
  if (!c.hidden) {
    const f = $('#ngName');
    if (f) f.focus();
  }
};
$('#newGuestBtn').onclick = toggleNgModal;
const ng2 = $('#newGuestBtn2');
if (ng2) ng2.onclick = toggleNgModal;

$('#ngCancel').onclick = () => { $('#ngCard').hidden = true; $('#ngPin').value = ''; };

$('#ngSave').onclick = async () => {
  const name = $('#ngName').value.trim();
  const phone = $('#ngPhone').value;
  const pin = $('#ngPin').value.trim();
  if (name.length < 2) return toast('Введите имя гостя', '✍️');
  if (ph10(phone).length < 10) return toast('Введите номер полностью', '📵');
  if (!/^\d{4}$/.test(pin)) return toast('PIN гостя должен состоять ровно из 4 цифр', '🔐');
  try {
    const r = await api('/staff/customers', {
      method: 'POST',
      body: { name, phone, pin }
    });
    $('#ngCard').hidden = true;
    $('#ngName').value = '';
    $('#ngPhone').value = '';
    $('#ngPin').value = '';
    showCust(r.customer);
    renderLog();
    if (r.created) {
      toast(`Профиль создан: ${esc(r.customer.name)}. Передайте гостю PIN для входа`, '✅');
    } else if (r.pinPreserved) {
      toast(`Профиль уже существует. Его прежний PIN сохранён`, '🔔');
    } else {
      toast(`Профиль найден и активирован. PIN установлен`, '✅');
    }
  } catch (e) {
    toast(e.message, '⚠️');
  }
};


async function refreshFoundCustomer() {
  const current = found;
  const view = document.getElementById('cashierView');
  const picker = document.getElementById('redeemPick');
  if (!current || !current.id || foundRefreshing || document.hidden ||
      !view || view.hidden || (picker && picker.classList.contains('show'))) return;

  const customerId = current.id;
  const revision = foundRevision;
  foundRefreshing = true;
  try {
    const response = await api('/staff/customers/' + encodeURIComponent(customerId));
    if (!response.customer || !found || found.id !== customerId || foundRevision !== revision) return;

    const latest = response.customer;
    const changed =
      Number(latest.free) !== Number(found.free) ||
      Number(latest.stamps) !== Number(found.stamps) ||
      latest.name !== found.name ||
      latest.phone !== found.phone ||
      JSON.stringify(latest.history || []) !== JSON.stringify(found.history || []);
    if (changed) showCust(latest);
    else found = latest;
  } catch (_) {
    // A transient refresh failure must not erase the last valid cashier card.
  } finally {
    foundRefreshing = false;
  }
}

window.addEventListener('focus', refreshFoundCustomer);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refreshFoundCustomer();
});
setInterval(refreshFoundCustomer, 15000);

async function renderLog() {
  if (typeof window.loadPending === 'function') window.loadPending();   // ← вне try
  try {
    const r = await api('/staff/log?scope=coffee');
    const rows = r.log || [];
    $('#cashLog').innerHTML = rows.length
      ? rows.map(l =>
          `<div class="logrow cashlog"><span class="lt">${esc(l.t)}</span><span class="la">${esc(l.w)} — ${esc(l.a)}</span></div>`
        ).join('')
      : '<div class="hmini">Журнал пуст</div>';

    const h = $('#cashLog').previousElementSibling;
    if (h && h.tagName === 'H4') h.style.display = '';
    if (typeof window.filterCashLog === 'function') window.filterCashLog();
  } catch (e) {
    $('#cashLog').innerHTML = '';
  }
}

function cashierClean(){
  var ng2 = document.getElementById('newGuestBtn2');
  if (ng2) ng2.style.display = 'none';
}

// Наблюдатель привязан СТРОГО к #cashierView, не перегружая весь DOM приложения
(function initCashierObserver() {
  var cv = document.getElementById('cashierView');
  if (cv && typeof MutationObserver !== 'undefined') {
    new MutationObserver(function() {
      if (!cv.hidden) {
        cashierClean();
        refreshFoundCustomer();
      }
    }).observe(cv, { attributes: true, attributeFilter: ['hidden'] });
  }
})();

showCust=(function(_sc){return function(u,last){window.__foundId=u&&u.id;return _sc(u,last);};})(showCust);

(function(){
  var modal = document.getElementById('redeemPick');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'redeemPick';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'redeemPickTitle');
    modal.innerHTML = '<div class="omCard" style="max-width:420px"><button type="button" class="omClose" aria-label="Закрыть">✕</button><h3 id="redeemPickTitle" style="margin:0 0 12px">🎁 Какой кофе списать?</h3><div id="rpList" style="display:grid;gap:8px"></div></div>';
    document.body.appendChild(modal);
  }

  var drinks = ['Эспрессо','Американо','Капучино','Латте','Флэт уайт','Батч брю'];
  var list = modal.querySelector('#rpList');
  if (list && !list.children.length) {
    list.innerHTML = drinks.map(function(name) {
      return '<button type="button" class="btn ghost" data-rp="' + name + '" style="width:100%">' + name + '</button>';
    }).join('');
  }

  var redeemButton = document.getElementById('redeemBtn');
  var redeemTarget = null;
  var redeemOnSuccess = null;
  var redeemReturnFocus = null;

  function closePicker() {
    modal.classList.remove('show');
    if (typeof window.syncOverlay === 'function') window.syncOverlay();
    var focusTarget = redeemReturnFocus || redeemButton;
    redeemTarget = null;
    redeemOnSuccess = null;
    redeemReturnFocus = null;
    if (focusTarget && focusTarget.isConnected && !focusTarget.hidden && !focusTarget.disabled) {
      focusTarget.focus();
    }
  }

  async function openRedeemPicker(customer, onCustomerUpdate, returnFocus) {
    if (!customer || !customer.id) return false;

    var latest;
    try {
      var response = await api('/staff/customers/' + encodeURIComponent(customer.id));
      latest = response.customer;
    } catch (error) {
      toast(error.message || 'Не удалось обновить карточку гостя', '⚠️');
      return false;
    }
    if (!latest) return false;
    // Пока выполнялся lookup, кассир мог выбрать другого гостя.
    if (returnFocus === redeemButton && (!found || found.id !== customer.id)) return false;

    redeemOnSuccess = typeof onCustomerUpdate === 'function' ? onCustomerUpdate : null;
    if (redeemOnSuccess) {
      try { redeemOnSuccess(latest); } catch (callbackError) {
        console.error('[cashier] gift picker refresh callback failed', callbackError);
      }
    }
    if (!(Number(latest.free) > 0)) {
      toast('У гостя уже нет доступных бесплатных кофе', '⚠️');
      redeemOnSuccess = null;
      return false;
    }

    redeemTarget = latest;
    redeemReturnFocus = returnFocus || redeemButton;
    modal.classList.add('show');
    if (typeof window.syncOverlay === 'function') window.syncOverlay();
    var firstDrink = modal.querySelector('[data-rp]');
    if (firstDrink) firstDrink.focus();
    return true;
  }

  if (redeemButton) {
    // Capture the click before any legacy/direct-redeem handler can consume the gift.
    redeemButton.addEventListener('click', async function(event) {
      event.preventDefault();
      event.stopImmediatePropagation();
      await openRedeemPicker(found, function(updatedCustomer) {
        showCust(updatedCustomer);
      }, redeemButton);
    }, true);
  }

  modal.addEventListener('click', async function(event) {
    if (event.target === modal || event.target.closest('.omClose')) {
      closePicker();
      return;
    }

    var drinkButton = event.target.closest('[data-rp]');
    if (!drinkButton) return;

    var customer = redeemTarget;
    if (!customer || !(Number(customer.free) > 0)) {
      closePicker();
      return toast('У гостя нет доступных подарков', '⚠️');
    }

    var selectedDrink = drinkButton.dataset.rp;
    var onSuccess = redeemOnSuccess;
    var buttons = Array.from(modal.querySelectorAll('[data-rp]'));
    buttons.forEach(function(button) { button.disabled = true; });

    try {
      var result = await api('/staff/redeem', {
        method: 'POST',
        body: { id: customer.id, item: selectedDrink }
      });
      closePicker();
      if (onSuccess) {
        try { onSuccess(result.customer); } catch (callbackError) {
          console.error('[cashier] gift picker success callback failed', callbackError);
        }
      }
      renderLog();
      if (typeof renderProfile === 'function') renderProfile();
      toast('Списано: ' + selectedDrink, '🎁');
    } catch (error) {
      try {
        var fresh = await api('/staff/customers/' + encodeURIComponent(customer.id));
        if (fresh.customer && onSuccess) onSuccess(fresh.customer);
        if (!fresh.customer || !(Number(fresh.customer.free) > 0)) closePicker();
      } catch (_) {}
      toast(error.message || 'Не удалось списать подарок', '⚠️');
    } finally {
      buttons.forEach(function(button) { button.disabled = false; });
    }
  });

  // Shared entry point for cashier search and QR scanner guest cards.
  window.openRedeemPicker = openRedeemPicker;})();
(function(){
window.renderLog = renderLog; /* Ф5.6-финал шаг 2-fix: голый вызов из catalog setMode */
})();
/* ── Ф5.8f: ESM-шимы: scanner.js/views.js/cashier-card/admin-extra ── */
window.showCust = showCust;
window.dotsHTML = dotsHTML;
window.hrow = hrow;
window.cashierClean = cashierClean;
