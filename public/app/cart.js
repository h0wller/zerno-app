
function getKaliningradHour() {
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
function isDeliveryServiceOpen() {
  var h = getKaliningradHour();
  return h >= 11 && h < 22;
}

/* public/app/cart.js — Корзина доставки, промокоды, адрес и чекаут */
(function () {
  "use strict";

  function checkIsDelivery() {
    if (typeof brand !== 'undefined' && brand) {
      return brand === 'delivery';
    }
    var bSegOn = document.querySelector('#brandSeg button.on');
    if (bSegOn && bSegOn.dataset.brand) {
      return bSegOn.dataset.brand === 'delivery';
    }
    return document.documentElement.getAttribute('data-brand') === 'delivery';
  }

  /* ── Состояние промокодов ── */
  var cartPromoCode = localStorage.getItem("zt_cartpromo") || "";
  var promoInfo = null;
  var promoTimer = null;

  function promoDisc(sum, info) {
    if (!info) return 0;
    return info.kind === "percent"
      ? Math.round((sum * Math.min(90, info.value)) / 100)
      : Math.min(info.value || 0, sum);
  }

  function totalsNow() {
    var sum = (typeof cart !== 'undefined' ? cart : []).reduce(function (a, c) {
      return a + (Number(c.price) || 0) * (Number(c.qty) || 1);
    }, 0);

    var methodEl = document.getElementById("checkoutMethod");
    var method = methodEl ? methodEl.value : "delivery";
    var pickup = method === "pickup" ? Math.round(sum * 0.1) : 0;
    var fee = 0;
var cartLen = (typeof cart !== 'undefined' ? cart : []).length; /* Ф5.21b */
if (cartLen && method === "delivery" && typeof deliveryInfo !== 'undefined' && deliveryInfo && deliveryInfo.zones) {
      var placeEl = document.getElementById("checkoutPlace");
      var placeVal = placeEl ? placeEl.value : "";
      var z = deliveryInfo.zones.find(function (zone) {
        return zone.places && zone.places.includes(placeVal);
      });
      fee = z ? Number(z.fee) || 0 : 0;
    /* CHECKOUT-UX-FIX v2: безусловный override тарифа из справочника */
    if (window.AddressModule && typeof window.AddressModule.getFee === 'function') {
      var curPlace = (typeof placeVal !== 'undefined' ? placeVal : (document.getElementById('checkoutPlace') ? document.getElementById('checkoutPlace').value : ''));
      var zoneFee = Number(window.AddressModule.getFee(curPlace));
      if (zoneFee > 0) fee = zoneFee;
    }
    }

    var pd = promoInfo ? promoDisc(sum, promoInfo) : 0;
    return {
      sum: sum,
      pickup: pickup,
      fee: fee,
      pd: pd,
      total: Math.max(0, sum - pickup - pd + fee),
    };
  }

  function paintTotals() {
    var t = totalsNow();
    var el = document.getElementById("cartTotal");
    if (el) el.textContent = fmt(t.total);
    var s = document.getElementById("cartSum");
    var cnt = (typeof cart !== 'undefined' ? cart : []).reduce(function (a, c) {
      return a + (c.qty || 1);
    }, 0);
    if (s) s.textContent = cnt + " поз · " + Number(t.total).toLocaleString("ru-RU");

    var discEl = document.getElementById("cartDiscount");
    if (discEl) discEl.textContent = t.pickup ? "−10% самовывоз: −" + fmt(t.pickup) : "";
    var feeEl = document.getElementById("cartFee");
    if (feeEl) feeEl.textContent = t.fee ? "Доставка: " + fmt(t.fee) : "";
    renderGifts(); /* Ф5.21b */
}

  /* CART-PILL-PATCH v2: pill-bubble видимость через класс .visible */
function cartFabShow() {
  var cf = document.getElementById('cartFab');
  if (!cf) return;
  var isDel = checkIsDelivery();
  var isGuestOrAdmin = (typeof mode === 'undefined') || mode === 'guest' || mode === 'admin';
  var hasItems = typeof cart !== 'undefined' && cart.length > 0;
  var shouldShow = isGuestOrAdmin && isDel && hasItems;
  cf.classList.toggle('visible', shouldShow);
  cf.hidden = !shouldShow;
}

  async function refreshPromoLine(sum) {
    var line = document.getElementById("cartPromoLine");
    if (!line) return;
    if (!cartPromoCode) {
      promoInfo = null;
      line.textContent = "";
      paintTotals();
      return;
    }
    try {
      var r = await fetch(
        API_BASE + "/api/promo/info?code=" + encodeURIComponent(cartPromoCode)
      ).then(function (x) { return x.json(); });

      if (r.ok) {
        promoInfo = r;
        localStorage.setItem("zt_cartpromo", cartPromoCode);
        line.textContent = "🎟 " + r.code + ": −" + fmt(promoDisc(sum, r));
        line.style.color = "var(--green)";
      } else {
        promoInfo = null;
        localStorage.removeItem("zt_cartpromo");
        cartPromoCode = "";
        var typed = (document.getElementById("cartPromo") || {}).value || "";
        if (typed.trim()) {
          line.textContent = "⚠️ " + (r.error || "Код не найден");
          line.style.color = "#B3372B";
        } else {
          line.textContent = "";
        }
      }
    } catch (e) { }
    paintTotals();
  }

  function renderAddons() {
    var host = document.getElementById("cartAddons");
    if (!host) {
      var ci = document.getElementById("cartItems");
      if (ci && ci.parentNode) {
        host = document.createElement("div");
        host.id = "cartAddons";
        ci.parentNode.insertBefore(host, ci);
      }
    }
    if (!host) return;
    if (!checkIsDelivery()) {
      host.innerHTML = "";
      return;
    }
    var list = (typeof DMENU !== 'undefined' && DMENU) ? DMENU.filter(function (p) {
      return p.cat === "sauces" && p.on;
    }) : [];

    if (!list.length) {
      host.innerHTML = "";
      return;
    }
    host.innerHTML =
      '<div style="font-size:12px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#8B98A5;margin:0 0 6px">Добавить к заказу</div>' +
      list.map(function (p) {
        var inCart = (typeof cart !== 'undefined' ? cart : []).find(function (c) {
          return String(c.id) === String(p.id);
        });
        return (
          '<button type="button" class="addonChip" data-addon="' + p.id + '">' +
          (inCart ? "<b>×" + inCart.qty + "</b> " : "") +
          esc(p.name) + " · " + fmt(parseInt(p.price, 10) || 0) +
          "</button>"
        );
      }).join("");
  }

  function updateDeliveryPromoBar() {
  if (!((typeof cart !== 'undefined' ? cart : []).length)) { var pb0 = document.getElementById('deliveryPromoBar'); if (pb0) pb0.style.display = 'none'; return; } /* Ф5.21b */
    var isDel = checkIsDelivery();
    var pBar = document.getElementById('deliveryPromoBar');
    if (!isDel) {
      if (pBar) pBar.style.display = 'none';
      return;
    }
    var cartItems = document.getElementById('cartItems');
    if (!cartItems || !cartItems.parentNode) return;
    if (!pBar) {
      pBar = document.createElement('div');
      pBar.id = 'deliveryPromoBar';
      cartItems.parentNode.insertBefore(pBar, cartItems);
    }
    pBar.style.display = '';
    var tNow = totalsNow().sum;
    var wp = (typeof deliveryInfo !== 'undefined' && deliveryInfo && deliveryInfo.weekPromo) ? deliveryInfo.weekPromo : {};
    var thresholdVal = Number(wp.threshold) > 0 ? Number(wp.threshold) : 2000;
    var giftText = (wp.gift && wp.gift.trim()) ? wp.gift.trim() : 'Пиво 0,5';
    var isDone = tNow >= thresholdVal && tNow > 0;
    var diffVal = Math.max(0, thresholdVal - tNow);
    var progressVal = thresholdVal > 0 ? Math.min(100, Math.round((tNow / thresholdVal) * 100)) : 0;
    if (isDone) progressVal = 100;

    pBar.style.cssText = 'background: #F4EFE6; padding: 10px 14px; border-radius: 10px; margin: 8px 0 14px; border: 1.5px dashed var(--flame, #C03B2A);';
    pBar.innerHTML =
      '<div style="display:flex; justify-content:space-between; font-size:12px; font-weight:600; margin-bottom:6px; color:#222;">' +
      '<span>' + (isDone ? '🎁 Акция выполнена: ' + esc(giftText) : 'До подарка (' + esc(giftText) + '):') + '</span>' +
      '<span style="font-weight:700; color:' + (isDone ? '#186A43' : 'inherit') + ';">' +
      (isDone ? 'Выполнено' : 'еще ' + diffVal + ' ₽') +
      '</span>' +
      '</div>' +
      '<div style="height: 6px; background: #E0D9CD; border-radius: 4px; overflow: hidden;">' +
      '<div style="width: ' + progressVal + '%; height: 100%; background: ' + (isDone ? '#186A43' : 'var(--flame, #C03B2A)') + '; transition: width 0.3s ease;"></div>' +
      '</div>';
  }

  function clearPromo() {
    cartPromoCode = "";
    promoInfo = null;
    localStorage.removeItem("zt_cartpromo");
    var line = document.getElementById("cartPromoLine");
    if (line) line.textContent = "";
    paintTotals();
  }

  function flagField(el) {
    if (!el) return;
    el.classList.remove("field-error", "need-slot");
    void el.offsetWidth;
    el.classList.add("field-error");
    try { el.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e) { }
    try { el.focus({ preventScroll: true }); } catch (e) { }
    clearTimeout(el.__flagT);
    el.__flagT = setTimeout(function () { el.classList.remove("field-error"); }, 4000);
  }

  function toggleDeliveryGroup() {
    var method = (document.getElementById('checkoutMethod') || {}).value || 'delivery';
    var isPickup = method === 'pickup';
    var grp = document.getElementById('checkoutDeliveryGroup');
    if (grp) {
      grp.hidden = isPickup;
    } else {
      var pl = document.getElementById('checkoutPlaceLabel');
      var sl = document.getElementById('checkoutStreetLabel');
      var hl = document.getElementById('checkoutHouseLabel');
      if (pl) pl.hidden = isPickup;
      if (sl) sl.hidden = isPickup;
      if (hl) hl.hidden = isPickup;
    }
  }

  function saveDraft() {
    try {
      var draft = {
        method: (document.getElementById('checkoutMethod') || {}).value,
        place: (document.getElementById('checkoutPlace') || {}).value,
        street: (document.getElementById('checkoutStreet') || {}).value,
        house: (document.getElementById('checkoutHouse') || {}).value,
        slot: (document.getElementById('checkoutSlot') || {}).value,
        pay: (document.getElementById('checkoutPay') || {}).value,
        comment: (document.getElementById('checkoutComment') || {}).value
      };
      sessionStorage.setItem('zt_checkout_draft', JSON.stringify(draft));

      // ADDRESS-BOOK v2: сохраняем адрес в книгу (до 5, дедупликация)
    if (draft.place || draft.street || draft.house) {
      if (window.AddressBook && typeof window.AddressBook.autoAdd === 'function') {
        window.AddressBook.autoAdd({ place: draft.place, street: draft.street, house: draft.house });
      } else {
        localStorage.setItem('zt_saved_address', JSON.stringify({
          place: draft.place, street: draft.street, house: draft.house
        }));
      }
    }
    } catch (e) { }
  }

  function restoreDraft() {
    try {
      var draft = JSON.parse(sessionStorage.getItem('zt_checkout_draft') || '{}');
      var saved = JSON.parse(localStorage.getItem('zt_saved_address') || '{}');

      var placeVal = draft.place || saved.place;
      var streetVal = draft.street || saved.street;
      var houseVal = draft.house || saved.house;

      if (draft.method && document.getElementById('checkoutMethod')) {
        document.getElementById('checkoutMethod').value = draft.method;
      }
      if (placeVal && document.getElementById('checkoutPlace')) {
        document.getElementById('checkoutPlace').value = placeVal;
      }
      if (streetVal && document.getElementById('checkoutStreet')) {
        document.getElementById('checkoutStreet').value = streetVal;
      }
      if (houseVal && document.getElementById('checkoutHouse')) {
        document.getElementById('checkoutHouse').value = houseVal;
      }
      if (draft.slot && document.getElementById('checkoutSlot')) {
        document.getElementById('checkoutSlot').value = draft.slot;
      }
      if (draft.pay && document.getElementById('checkoutPay')) {
        document.getElementById('checkoutPay').value = draft.pay;
      }
      if (draft.comment && document.getElementById('checkoutComment')) {
        document.getElementById('checkoutComment').value = draft.comment;
      }
      toggleDeliveryGroup();
    } catch (e) { }
  }

  /* ── Основной рендер содержимого корзины ── */
  /* Ф5.21b: владелец строки подарков (перенесён из мёртвого renderCart delivery.js) */
function renderGifts() {
  var el = document.getElementById("cartGifts"); if (!el) return;
  var list = (typeof cart !== 'undefined' ? cart : []);
  var sum = list.reduce(function (a, c) { return a + (Number(c.price)||0) * (Number(c.qty)||1); }, 0);
  var di = (typeof deliveryInfo !== 'undefined' && deliveryInfo) ? deliveryInfo : null;
  var gifts = [];
  var wp2 = di && di.weekPromo;
  if (wp2 && wp2.gift && sum > 0) { var q = wp2.threshold > 0 ? Math.floor(sum / wp2.threshold) : 1; if (q > 0) gifts.push("🎁 " + wp2.gift + " ×" + q); }
  var pm2 = di && di.pizzaMonth;
  if (pm2 && pm2.name) { var big = list.reduce(function (a, c) { return a + ((Number(c.sz) === 35) ? (Number(c.qty)||1) : 0); }, 0); if (big >= 2) gifts.push("🎁 " + pm2.name + " — подарок"); }
  el.innerHTML = gifts.join("<br>");
}
function renderCartBase() {
    var cItems = document.getElementById('cartItems');
    if (!cItems) return;
    var list = typeof cart !== 'undefined' ? cart : [];

    cItems.innerHTML = list.map(function (c, i) {
      return '<div class="cartItem">' +
        '<div style="flex:1"><b>' + esc(c.name) + '</b>' +
        (c.opt ? '<div style="font-size:12px;color:var(--soft)">' + esc(typeof c.opt === 'object' ? c.opt.name || '' : c.opt) + '</div>' : '') +
        '</div>' +
        '<div class="qty">' +
        '<button type="button" data-ci="' + i + '" data-act="-">−</button>' +
        '<span>' + c.qty + '</span>' +
        '<button type="button" data-ci="' + i + '" data-act="+">+</button>' +
        '</div>' +
        '<div style="font-weight:700">' + fmt((Number(c.price) || 0) * (Number(c.qty) || 1)) + '</div>' +
        '</div>';
    }).join('') || '<div class="empty-state">' +
      '<div class="empty-state-icon">🍕</div>' +
      '<div class="empty-state-title">Корзина пуста</div>' +
      '<div class="empty-state-sub">Добавьте что-нибудь вкусное из меню доставки</div>' +
      '<button type="button" class="empty-state-btn" data-goto-menu>Перейти в меню</button>' +
      '</div>';

    // Плашка режима предзаказа вне рабочих часов (11:00–22:00)
    var pmNotice = document.getElementById('preorderNotice');
    var isOffHours = !isDeliveryServiceOpen();
    if (isOffHours && checkIsDelivery()) {
      if (!pmNotice) {
        pmNotice = document.createElement('div');
        pmNotice.id = 'preorderNotice';
        pmNotice.style.cssText = 'background:#FFF6E5;border:1.5px dashed #F2D9A5;border-radius:12px;padding:10px 14px;margin:10px 0;font-size:13px;color:#6B4E0E;font-weight:600;line-height:1.4;';
        cItems.parentNode.insertBefore(pmNotice, cItems);
      }
      var pmMode = window.preorderMode();
      pmNotice.innerHTML = pmMode === 'tomorrow'
        ? '🌙 <b>Кухня сейчас отдыхает.</b> Мы принимаем предзаказы на завтра — выберите удобное время доставки ниже!'
        : '☀️ <b>Откроемся в 11:00.</b> Оформите предзаказ сейчас, и мы привезём его к выбранному времени!';
      pmNotice.style.display = '';
    } else if (pmNotice) {
      pmNotice.style.display = 'none';
    }

    renderAddons();
    updateDeliveryPromoBar();
    paintTotals();
    toggleDeliveryGroup();
    refreshPromoLine(totalsNow().sum);
  }

  window.renderCart = renderCartBase;
  window.totalsNow = totalsNow;
  window.paintTotals = paintTotals;
  window.cartFabShow = cartFabShow;
  window.clearPromo = clearPromo;
  window.updateDeliveryPromoBar = updateDeliveryPromoBar;

  /* CART-PILL-PATCH v2: обновление содержимого пилюли */
window.updateCartFab = function () {
  var t = totalsNow();
  var fab = document.getElementById('cartFab');
  if (!fab) return;

  var hasItems = t.sum > 0;
  var cnt = (typeof cart !== 'undefined' ? cart : []).reduce(function (a, c) { return a + (c.qty || 1); }, 0);

  // Управление видимостью через класс .visible (для анимации scale/opacity)
  fab.classList.toggle('visible', hasItems);
  fab.hidden = !hasItems;

  // Обновляем содержимое пилюли
  var badge = fab.querySelector('.cf-badge');
  var total = fab.querySelector('.cf-total');
  if (badge) badge.textContent = cnt;
  if (total) total.textContent = Number(t.total).toLocaleString('ru-RU') + ' ₽';

  paintTotals();
  if (typeof syncAddButtons === 'function') syncAddButtons();
};

  renderGifts(); /* Ф5.21b */
/* ── Слушатели событий корзины ── */
  var cPanel = document.getElementById("cartPanel");
  if (cPanel) {
    cPanel.addEventListener('click', function (e) {
      var b = e.target.closest('[data-ci]');
      if (b) {
        var i = +b.dataset.ci;
        var it = cart[i]; if (!it) { renderCartBase(); return; } /* Ф5.21: гард протухшего индекса */
if (b.dataset.act === '+') it.qty++; else if (it.qty > 1) it.qty--; else cart.splice(i, 1);
        localStorage.setItem('zt_cart', JSON.stringify(cart));
        window.updateCartFab();
        renderCartBase();
        return;
      }

      var ch = e.target.closest("[data-addon]");
      if (ch && typeof DMENU !== 'undefined') {
        var p = DMENU.find(function (x) { return String(x.id) === String(ch.dataset.addon); });
        if (!p) return;
        var ex = cart.find(function (c) { return String(c.id) === String(p.id); });
        if (ex) {
          ex.qty++;
        } else {
          cart.push({
            key: p.id,
            id: p.id,
            oi: -1,
            name: p.name,
            opt: null,
            price: parseInt(p.price, 10) || 0,
            sz: 0,
            qty: 1,
          });
        }
        localStorage.setItem("zt_cart", JSON.stringify(cart));
        window.updateCartFab();
        renderCartBase();
      }
    });
  }

  var promoInput = document.getElementById("cartPromo");
  if (promoInput) {
    promoInput.addEventListener("input", function () {
      var v = promoInput.value.trim().toUpperCase();
      if (!v) { clearPromo(); return; }
      clearTimeout(promoTimer);
      promoTimer = setTimeout(function () {
        cartPromoCode = v;
        refreshPromoLine(totalsNow().sum);
      }, 400);
    });
  }

  var promoBtn = document.getElementById("cartPromoBtn");
  if (promoBtn) {
    promoBtn.onclick = function () {
      var v = (promoInput ? promoInput.value : "").trim().toUpperCase();
      if (!v) { clearPromo(); return; }
      cartPromoCode = v;
      refreshPromoLine(totalsNow().sum);
    };
  }

  var cmEl = document.getElementById("checkoutMethod");
  if (cmEl) {
    cmEl.addEventListener("change", function () {
      toggleDeliveryGroup();
      saveDraft();
      paintTotals();
    });
  }

  var cpEl = document.getElementById("checkoutPlace");
  if (cpEl) {
    cpEl.addEventListener("change", function () {
      saveDraft();
      paintTotals();
      if (window.AddressModule && typeof window.AddressModule.populateStreets === 'function') {
        window.AddressModule.populateStreets(cpEl.value);
      }
    });
  }

  ['checkoutStreet', 'checkoutHouse', 'checkoutSlot', 'checkoutPay', 'checkoutComment'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', saveDraft);
      el.addEventListener('change', saveDraft);
    }
  });

  /* ── Оформление заказа ── */
  var checkBtn = document.getElementById("checkoutBtn");
  if (checkBtn) {
    checkBtn.onclick = async function () {
      if (!me) {
        toast("Сначала войдите по номеру", "👤");
        if (typeof openAuth === 'function') openAuth();
        return;
      }
      if (!cart || cart.length === 0) {
        toast("Корзина пуста", "🛒");
        return;
      }

      var method = (document.getElementById("checkoutMethod") || {}).value || "delivery";
      var placeV = "";
      var streetV = "";
      var houseV = "";

      if (method === "delivery") {
        var placeEl = document.getElementById("checkoutPlace");
        placeV = placeEl ? placeEl.value.trim() : "";
        if (!placeV) { flagField(placeEl); return toast("Выберите населённый пункт", "📍"); }

        var streetEl = document.getElementById("checkoutStreet");
        var houseEl = document.getElementById("checkoutHouse");
        streetV = streetEl ? streetEl.value.trim() : "";
        houseV = houseEl ? houseEl.value.trim() : "";

        if (!streetV) { flagField(streetEl); return toast("Укажите улицу", "🏠"); }

        // Мгновенная проверка улицы по справочнику населённого пункта
        if (window.AddressModule && window.AddressModule.LOCAL_STREETS) {
          var placeKey = (window.AddressModule.normPlace || function(p){ return String(p || '').toLowerCase().trim(); })(placeV);
          var validStreets = window.AddressModule.LOCAL_STREETS[placeKey] || [];
          if (validStreets.length > 0) {
            var sClean = streetV.toLowerCase().replace(/^(ул\.?|улица|пер\.?|проезд|пр-д)\s+/i, '').replace(/\s+(ул\.?|улица)$/i, '').trim();
            var found = validStreets.some(function(s) {
              if (s === '(без улицы)') return true;
              var candClean = s.toLowerCase().replace(/^(ул\.?|улица|пер\.?|проезд|пр-д)\s+/i, '').replace(/\s+(ул\.?|улица)$/i, '').trim();
              return candClean === sClean;
            });
            if (!found && sClean !== 'без улицы' && sClean !== '(без улицы)') {
              flagField(streetEl); // Поле сразу затрясётся красным
              return toast("В " + placeV + " нет улицы «" + streetV + "»", "⚠️");
            }
          }
        }

        if (!houseV) { flagField(houseEl); return toast("Укажите дом и квартиру", "🏠"); }
      }

      var pm = typeof window.preorderMode === "function"
        ? window.preorderMode()
        : (typeof window.assertServiceOpen === "function" && !window.assertServiceOpen() ? "tomorrow" : null);
      var slotVal = (document.getElementById("checkoutSlot") || {}).value || "";
      var isPreorder = !!pm || (slotVal && slotVal !== "asap");

      if (isPreorder && (!slotVal || slotVal === "asap")) {
        var sl = document.getElementById("checkoutSlot");
        if (sl) flagField(sl);
        return toast("Выберите время доставки для предзаказа ⏰", "⚠️");
      }

      var preorderDate = "";
      if (slotVal && slotVal !== "asap") {
        var mDate = slotVal.match(/^(\d{2}[.-]\d{2})/);
        if (mDate) preorderDate = mDate[1];
      }

      var body = {
        method: method,
        place: method === 'pickup' ? 'Самовывоз' : placeV,
        street: streetV,
        house: houseV,
        slot: slotVal,
        is_preorder: isPreorder ? 1 : 0,
        preorder_date: preorderDate,
        pay: (document.getElementById("checkoutPay") || {}).value || "cash",
        comment: ((document.getElementById("checkoutComment") || {}).value || "").trim(),
        items: cart.map(function (c) {
          return { id: c.id, oi: c.oi, qty: c.qty };
        }),
      };
      if (cartPromoCode) body.promo = cartPromoCode;

try {
        var r = await api("/orders", { method: "POST", body: body });
        toast("Заказ #" + r.order.no + " оформлен!", "🎉");
      /* PREORDER-TIMER v5: если предзаказ — запускаем обновление таймеров */
      try {
        var preorderSlot = document.getElementById('checkoutSlot') ? document.getElementById('checkoutSlot').value : '';
        if (preorderSlot && preorderSlot !== 'asap' && window.PreorderTimer && typeof window.PreorderTimer.updateAll === 'function') {
          setTimeout(window.PreorderTimer.updateAll, 500);
        }
      } catch (e) {}
      /* CHECKOUT-UX-FIX v2: сохраняем адреса в массив (до 3 уникальных) */
      try {
        var cpEl = document.getElementById('checkoutPlace');
        var csEl = document.getElementById('checkoutStreet');
        var chEl = document.getElementById('checkoutHouse');
        var addrToSave = {
          place: cpEl ? cpEl.value : '',
          street: csEl ? csEl.value : '',
          house: chEl ? chEl.value : ''
        };
        if (addrToSave.place || addrToSave.street) {
          var addrList = [];
          try { addrList = JSON.parse(localStorage.getItem('zt_saved_addresses') || '[]'); } catch (e) {}
          if (!Array.isArray(addrList)) addrList = [];
          addrList = addrList.filter(function (a) {
            return !(a.place === addrToSave.place && a.street === addrToSave.street && a.house === addrToSave.house);
          });
          addrList.unshift(addrToSave);
          addrList = addrList.slice(0, 3);
          localStorage.setItem('zt_saved_addresses', JSON.stringify(addrList));
          localStorage.setItem('zt_saved_address', JSON.stringify(addrToSave));
        }
      } catch (e) {}
      if (window.TgUx) window.TgUx.success(); /* TG-UX-PATCH checkout */

        // 1. Очищаем корзину in-place для всех модулей
        if (typeof cart !== 'undefined' && Array.isArray(cart)) cart.length = 0;
        window.cart = [];
        localStorage.setItem("zt_cart", "[]");
        sessionStorage.removeItem("zt_checkout_draft");
        clearPromo();

        // 2. Очищаем поля ввода в шторке чекаута
        var pi = document.getElementById("cartPromo"); if (pi) pi.value = "";
        var stEl = document.getElementById("checkoutStreet"); if (stEl) stEl.value = "";
        var hsEl = document.getElementById("checkoutHouse"); if (hsEl) hsEl.value = "";
        var cmEl = document.getElementById("checkoutComment"); if (cmEl) cmEl.value = "";
        var slEl = document.getElementById("checkoutSlot"); 
        if (slEl) slEl.value = (window.preorderMode && window.preorderMode()) ? "" : "asap";

        // 3. Сбрасываем выбранные размеры на карточках пиццы (убираем коричневую подсветку .sel)
        document.querySelectorAll('#deliveryGrid .opts button.sel').forEach(function(b) {
          b.classList.remove('sel');
        });

        // 4. Обновляем кнопки карточек ("В корзине" -> "Добавить") и скрываем плавающую корзину
        if (typeof syncAddButtons === 'function') syncAddButtons();
        if (typeof updateCartFab === 'function') updateCartFab();
        renderCartBase();

        var cp = document.getElementById("cartPanel");
        if (cp) cp.classList.remove("open");
        if (typeof syncOverlay === 'function') syncOverlay();
        if (typeof loadMyOrders === 'function') loadMyOrders();
      } catch (e) {
        toast(e.message, "⚠️");
      }
    };
  }

  restoreDraft();

/* SKELETON-EMPTY-PATCH v3: кнопка «Перейти в меню» */
document.addEventListener('click', function (e) {
  var btn = e.target.closest('[data-goto-menu]');
  if (!btn) return;

  // Закрываем корзину или профиль через TgUx (для нативного BackButton)
  if (window.TgUx && typeof window.TgUx.closeTop === 'function') {
    window.TgUx.closeTop();
  } else {
    // Fallback: закрываем вручную
    var cp = document.getElementById('cartPanel');
    if (cp) cp.classList.remove('open');
    var panel = document.getElementById('panel');
    if (panel) panel.classList.remove('open');
    if (typeof window.syncOverlay === 'function') window.syncOverlay();
  }

  // Если активен кофе — переключить на доставку
  if (typeof window.brand !== 'undefined' && window.brand !== 'delivery') {
    if (typeof window.setBrand === 'function') {
      window.setBrand('delivery');
    } else if (typeof window.switchBrand === 'function') {
      window.switchBrand('delivery');
    } else {
      // Fallback: кликаем по кнопке бренда
      var brandBtn = document.querySelector('#brandSeg button[data-brand="delivery"]');
      if (brandBtn) brandBtn.click();
    }
  }

  // Скроллим к #deliveryGrid
  setTimeout(function () {
    var grid = document.getElementById('deliveryGrid');
    if (grid) {
      grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, 100);
});

})();