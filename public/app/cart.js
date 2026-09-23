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

    if (method === "delivery" && typeof deliveryInfo !== 'undefined' && deliveryInfo && deliveryInfo.zones) {
      var placeEl = document.getElementById("checkoutPlace");
      var placeVal = placeEl ? placeEl.value : "";
      var z = deliveryInfo.zones.find(function (zone) {
        return zone.places && zone.places.includes(placeVal);
      });
      fee = z ? Number(z.fee) || 0 : 0;
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
  }

  function cartFabShow() {
    var cf = document.getElementById("cartFab");
    if (cf) {
      var isDel = checkIsDelivery();
      var isGuestOrAdmin = (typeof mode === 'undefined') || mode === "guest" || mode === "admin";
      cf.style.display = (isGuestOrAdmin && isDel && typeof cart !== 'undefined' && cart.length > 0) ? "" : "none";
    }
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
    } catch (e) { }
  }

  function restoreDraft() {
    try {
      var draft = JSON.parse(sessionStorage.getItem('zt_checkout_draft') || '{}');
      if (draft.method && document.getElementById('checkoutMethod')) {
        document.getElementById('checkoutMethod').value = draft.method;
      }
      if (draft.place && document.getElementById('checkoutPlace')) document.getElementById('checkoutPlace').value = draft.place;
      if (draft.street && document.getElementById('checkoutStreet')) document.getElementById('checkoutStreet').value = draft.street;
      if (draft.house && document.getElementById('checkoutHouse')) document.getElementById('checkoutHouse').value = draft.house;
      if (draft.slot && document.getElementById('checkoutSlot')) document.getElementById('checkoutSlot').value = draft.slot;
      if (draft.pay && document.getElementById('checkoutPay')) document.getElementById('checkoutPay').value = draft.pay;
      if (draft.comment && document.getElementById('checkoutComment')) document.getElementById('checkoutComment').value = draft.comment;
      toggleDeliveryGroup();
    } catch (e) { }
  }

  /* ── Основной рендер содержимого корзины ── */
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
    }).join('') || '<div style="color:var(--soft);text-align:center;padding:20px">Корзина пуста</div>';

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

  window.updateCartFab = function () {
    var t = totalsNow();
    var fab = document.getElementById('cartFab');
    if (fab) fab.hidden = (t.sum === 0);
    paintTotals();
    if (typeof syncAddButtons === 'function') syncAddButtons();
    cartFabShow();
  };

  /* ── Слушатели событий корзины ── */
  var cPanel = document.getElementById("cartPanel");
  if (cPanel) {
    cPanel.addEventListener('click', function (e) {
      var b = e.target.closest('[data-ci]');
      if (b) {
        var i = +b.dataset.ci;
        if (b.dataset.act === '+') cart[i].qty++;
        else if (cart[i].qty > 1) cart[i].qty--;
        else cart.splice(i, 1);
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

      var pm = typeof window.preorderMode === "function"
        ? window.preorderMode()
        : (typeof window.assertServiceOpen === "function" && !window.assertServiceOpen() ? "tomorrow" : null);
      var preorder = !!pm;
      var slotVal = (document.getElementById("checkoutSlot") || {}).value || "";
      if (preorder && (!slotVal || slotVal === "asap")) {
        var sl = document.getElementById("checkoutSlot");
        if (sl) flagField(sl);
        return toast("Выберите время доставки ⏰", "⚠️");
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
        if (!houseV) { flagField(houseEl); return toast("Укажите дом и квартиру", "🏠"); }
      }

      var body = {
        method: method,
        place: method === 'pickup' ? 'Самовывоз' : placeV,
        street: streetV,
        house: houseV,
        slot: slotVal,
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
        cart = [];
        localStorage.setItem("zt_cart", "[]");
        sessionStorage.removeItem("zt_checkout_draft");
        clearPromo();
        var pi = document.getElementById("cartPromo");
        if (pi) pi.value = "";
        window.updateCartFab();
        renderCartBase();
        var cp = document.getElementById("cartPanel");
        if (cp) cp.classList.remove("open");
        if (typeof loadMyOrders === 'function') loadMyOrders();
      } catch (e) {
        toast(e.message, "⚠️");
      }
    };
  }

  restoreDraft();
})();