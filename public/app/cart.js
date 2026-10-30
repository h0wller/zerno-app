/* public/app/cart.js — Корзина доставки, умные модификаторы блюд и чекаут */
(function () {
  "use strict";

  var activeAddonTab = "all";
  // Состояние раскрытых блоков модификаторов по индексам позиций в корзине
  var openModsMap = {};

  function checkIsDelivery() {
    if (typeof brand !== "undefined" && brand) {
      return brand === "delivery";
    }
    var bSegOn = document.querySelector("#brandSeg button.on");
    if (bSegOn && bSegOn.dataset.brand) {
      return bSegOn.dataset.brand === "delivery";
    }
    return document.documentElement.getAttribute("data-brand") === "delivery";
  }

  /* ── Строгая классификация: блюда (pizza, rolls, sets) НИКОГДА не попадают в допы ── */
  function isRollAddon(item) {
    if (!item || item.cat !== "sauces") return false;
    var n = item.name.toLowerCase();
    return /васаби|имбир|палочк|соев/i.test(n);
  }

  function isStandaloneSauce(item) {
    if (!item || item.cat !== "sauces") return false;
    var n = item.name.toLowerCase();
    if (isRollAddon(item)) return false;
    return /^соус /i.test(n) || /кетчуп|майонез|барбекю|сырный соус/i.test(n);
  }

  function isPizzaTopping(item) {
    // Топпингом для пиццы может быть ТОЛЬКО позиция из категории допов (cat === 'sauces')
    if (!item || item.cat !== "sauces") return false;
    if (isRollAddon(item) || isStandaloneSauce(item)) return false;
    var n = item.name.toLowerCase();
    return /ветчин|пепперони|чеддер|перец|лук|огурец|халапень|куриц|шампиньон|гриб|ананас|моцарелл|тунец|фарш|мяс|помидор|томат|сыр/i.test(n);
  }

  function getAddonType(item) {
    if (!item) return "pizza";
    if (item.cat === "drinks") return "drinks";
    if (isRollAddon(item)) return "rolls";
    if (isStandaloneSauce(item)) return "sauces";
    if (isPizzaTopping(item)) return "pizza";
    return "sauces";
  }
  window.getAddonType = getAddonType;

  /* ── Состояние промокодов ── */
  var cartPromoCode = localStorage.getItem("zt_cartpromo") || "";
  var promoInfo = null;
  var promoTimer = null;

  function promoDisc(sum, info) {
    if (!info || info.kind === "freeship") return 0;
    return info.kind === "percent"
      ? Math.round((sum * Math.min(90, info.value)) / 100)
      : Math.min(info.value || 0, sum);
  }

  function totalsNow() {
    var list = typeof cart !== "undefined" && Array.isArray(cart) ? cart : [];
    var sum = list.reduce(function (a, c) {
      var itemPrice = Number(c.price) || 0;
      var modsSum = (c.modifiers || []).reduce(function (mA, m) {
        return mA + (Number(m.price) || 0);
      }, 0);
      return a + (itemPrice + modsSum) * (Number(c.qty) || 1);
    }, 0);

    var methodEl = document.getElementById("checkoutMethod");
    var method = methodEl ? methodEl.value : "delivery";
    var isStaffUser = !!(typeof window.me !== "undefined" && window.me && ["admin", "cashier", "dispatch"].includes(window.me.role));
    var pickup = (method === "pickup" || isStaffUser) ? Math.round(sum * 0.1) : 0;
    var discLabel = method === "pickup" ? "−10% самовывоз" : (isStaffUser ? "−10% для своих" : "");
    var fee = 0;

    var minOrder = 0;
    var baseZoneFee = 0;
    var placeEl = document.getElementById("checkoutPlace");
    var placeVal = (placeEl && placeEl.value && placeEl.value.trim()) ? placeEl.value.trim() : "Янтарный";
    var normP = String(placeVal).toLowerCase().trim();

    if (method === "delivery") {
      if (typeof deliveryInfo !== "undefined" && deliveryInfo && deliveryInfo.zones) {
        var z = deliveryInfo.zones.find(function (zone) {
          return zone.places && zone.places.includes(placeVal);
        });
        if (z) {
          baseZoneFee = Number(z.fee) || 0;
          if (Number(z.min) > 0) minOrder = Number(z.min);
        }
      }
      if (window.AddressModule && typeof window.AddressModule.getFee === "function") {
        var zoneFee = Number(window.AddressModule.getFee(placeVal));
        if (zoneFee > 0) baseZoneFee = zoneFee;
      }
      if (!baseZoneFee) {
        baseZoneFee = /синявино|покровское/i.test(normP) ? 250 : (/куликово|яблоновка/i.test(normP) ? 300 : 200);
      }
      if (!minOrder) {
        minOrder = Number(window.MIN_DELIVERY_ORDER) > 0
          ? Number(window.MIN_DELIVERY_ORDER)
          : (/синявино|покровское/i.test(normP) ? 1000 : (/куликово|яблоновка/i.test(normP) ? 1200 : 0));
      } else if (Number(window.MIN_DELIVERY_ORDER) > 0) {
        minOrder = Number(window.MIN_DELIVERY_ORDER);
      }

      if (list.length) {
        // Доставка платная всегда (сервер freeFrom не знает), кроме персонального промокода «первая доставка бесплатно».
        fee = (promoInfo && promoInfo.kind === "freeship") ? 0 : baseZoneFee;
      }
    }

    var pd = promoInfo ? promoDisc(sum, promoInfo) : 0;
    return {
      sum: sum,
      pickup: pickup,
      discLabel: discLabel,
      fee: fee,
      baseZoneFee: baseZoneFee,
      freeShip: !!(promoInfo && promoInfo.kind === "freeship" && method === "delivery"),
      placeVal: placeVal,
      pd: pd,
      minOrder: minOrder,
      belowMin: method === "delivery" && minOrder > 0 && sum > 0 && sum < minOrder,
      total: Math.max(0, sum - pickup - pd + fee),
    };
  }

  function paintTotals() {
    var t = totalsNow();
    var list = typeof cart !== "undefined" && Array.isArray(cart) ? cart : [];
    var cnt = list.reduce(function (a, c) { return a + (Number(c.qty) || 1); }, 0);

    var el = document.getElementById("cartTotal");
    if (el) el.textContent = fmt(t.total);

    var s = document.getElementById("cartSum");
    if (s) s.textContent = cnt + " поз · " + Number(t.total).toLocaleString("ru-RU");

    var cntBadge = document.getElementById("cartHeadCount");
    if (cntBadge) cntBadge.textContent = cnt ? "· " + cnt + " шт." : "";

    var discEl = document.getElementById("cartDiscount");
    if (discEl) {
      discEl.textContent = t.pickup ? (t.discLabel || "−10% самовывоз") + ": −" + fmt(t.pickup) : "";
      discEl.style.display = t.pickup ? "flex" : "none";
    }

    var feeEl = document.getElementById("cartFee");
    if (feeEl) {
      var isDelMethod = ((document.getElementById("checkoutMethod") || {}).value || "delivery") === "delivery";
      if (list.length && isDelMethod) {
        feeEl.textContent = t.fee > 0 ? "Доставка (" + t.placeVal + "): " + fmt(t.fee) : "Доставка (" + t.placeVal + "): Бесплатно 🎉";
        feeEl.style.display = "flex";
      } else {
        feeEl.textContent = "";
        feeEl.style.display = "none";
      }
    }

    syncZoneFeeHint(t);
    syncCheckoutGuestAutofill();

    var checkBtnEl = document.getElementById("checkoutBtn");
    if (checkBtnEl && checkBtnEl.getAttribute("data-busy") !== "1") {
      if (t.belowMin) {
        checkBtnEl.disabled = true;
        checkBtnEl.classList.add("min-order-locked");
        checkBtnEl.textContent = "Мин. сумма доставки — " + fmt(t.minOrder) + " (ещё " + fmt(t.minOrder - t.sum) + ")";
      } else {
        checkBtnEl.disabled = false;
        checkBtnEl.classList.remove("min-order-locked");
        checkBtnEl.textContent = "Оформить заказ";
      }
    }

    renderGifts();
  }

  function cartFabShow() {
    var cf = document.getElementById("cartFab");
    if (!cf) return;
    var isDel = checkIsDelivery();
    var isGuestOrAdmin = typeof mode === "undefined" || mode === "guest" || mode === "admin";
    var hasItems = typeof cart !== "undefined" && cart.length > 0;
    var shouldShow = isGuestOrAdmin && isDel && hasItems;
    cf.classList.toggle("visible", shouldShow);
    cf.hidden = !shouldShow;
  }

  /* Персональный код «первая доставка бесплатно» (выдаётся за регистрацию) применяем сами, один раз на гостя за сессию. */
  var freeAutoFor = "";
  async function tryAutoFreeCode() {
    var u = typeof window.me !== "undefined" ? window.me : null;
    if (!u || !u.id || freeAutoFor === u.id) return "";
    freeAutoFor = u.id;
    try {
      var r = await api("/me/free-delivery");
      return (r && r.code) || "";
    } catch (e) { return ""; }
  }

/* ── PROMO-CLEAR v2: кнопка сброса промокода ── */
var PROMO_CLEAR_BTN = '<button type="button" class="promo-clear-btn" title="Убрать промокод" aria-label="Убрать промокод" style="margin-left:8px;padding:0 4px;background:none;border:none;cursor:pointer;font-size:15px;line-height:1;color:#B3372B;">✕</button>';

function bindPromoClear(line) {
  var btn = line.querySelector('.promo-clear-btn');
  if (!btn) return;
  btn.onclick = function () {
    cartPromoCode = '';
    promoInfo = null;
    localStorage.removeItem('zt_cartpromo');
    var inp = document.getElementById('cartPromo');
    if (inp) inp.value = '';
    line.innerHTML = '';
    paintTotals();
    refreshPromoLine(totalsNow().sum);
  };
}

async function refreshPromoLine(sum) {
  var line = document.getElementById('cartPromoLine');
  if (!line) return;

  if (!cartPromoCode) {
    var autoCode = await tryAutoFreeCode();
    if (autoCode) cartPromoCode = autoCode;
  }

  if (!cartPromoCode) {
    promoInfo = null;
    line.innerHTML = '';
    paintTotals();
    return;
  }

  try {
    var r = await fetch(API_BASE + '/api/promo/info?code=' + encodeURIComponent(cartPromoCode)).then(function (x) { return x.json(); });
    if (r.ok) {
      promoInfo = r;
      localStorage.setItem('zt_cartpromo', cartPromoCode);
      line.innerHTML = '<span>🎟 ' + esc(r.code) + ': ' + (r.kind === 'freeship' ? 'первая доставка бесплатно' : '−' + fmt(promoDisc(sum, r))) + '</span>' + PROMO_CLEAR_BTN;
      line.style.color = 'var(--green)';
      bindPromoClear(line);
    } else {
      promoInfo = null;
      localStorage.removeItem('zt_cartpromo');
      cartPromoCode = '';
      var typed = (document.getElementById('cartPromo') || {}).value || '';
      if (typed.trim()) {
        line.innerHTML = '<span>⚠️ ' + esc(r.error || 'Код не найден') + '</span>' + PROMO_CLEAR_BTN;
        line.style.color = '#B3372B';
        bindPromoClear(line);
      } else {
        line.innerHTML = '';
      }
    }
  } catch (e) { }
  paintTotals();
}

  /* ── Блок «Рекомендуем к заказу» (напитки и соусы к столу) ── */
  function renderAddons() {
    var host = document.getElementById("cartAddons");
    if (!host) return;

    if (!checkIsDelivery()) {
      host.innerHTML = "";
      return;
    }

    var list = typeof DMENU !== "undefined" && Array.isArray(DMENU) ? DMENU : [];
    // Только напитки и баночные соусы к столу (никаких пицц, роллов или мясных начинок)
    var available = list.filter(function (p) {
      return (p.cat === "drinks" || isStandaloneSauce(p)) && p.on !== 0;
    });

    if (!available.length) {
      host.innerHTML = "";
      return;
    }

    var cartList = typeof cart !== "undefined" && Array.isArray(cart) ? cart : [];

    var filtered = available;
    if (activeAddonTab === "drinks") {
      filtered = available.filter(function (p) { return p.cat === "drinks"; });
    } else if (activeAddonTab === "sauces") {
      filtered = available.filter(function (p) { return isStandaloneSauce(p); });
    }

    var tabs = [
      { id: "all", l: "Все" },
      { id: "sauces", l: "🥫 Соусы" },
      { id: "drinks", l: "🥤 Напитки" }
    ];

    var tabsHtml = tabs.map(function (t) {
      var isOn = activeAddonTab === t.id;
      return '<button type="button" class="addon-tab-btn' + (isOn ? " on" : "") + '" data-atab="' + t.id + '">' + t.l + "</button>";
    }).join("");

    var cardsHtml = filtered.map(function (p) {
      var inCart = cartList.find(function (c) { return String(c.id) === String(p.id) && (!c.modifiers || !c.modifiers.length); });
      var qty = inCart ? inCart.qty : 0;
      var priceStr = fmt(parseInt(p.price, 10) || 0);

      var imgHtml = p.img
        ? '<img src="' + esc(p.img) + '" alt="" class="ac-img" loading="lazy" />'
        : '<div class="ac-emoji">' + (p.e || (p.cat === "drinks" ? "🥤" : "🥫")) + "</div>";

      var actHtml = qty > 0
        ? '<div class="ac-stepper">' +
            '<button type="button" class="ac-step" data-ac-act="minus" data-addon-id="' + p.id + '">−</button>' +
            '<span class="ac-qty">' + qty + "</span>" +
            '<button type="button" class="ac-step" data-ac-act="plus" data-addon-id="' + p.id + '">+</button>' +
          "</div>"
        : '<button type="button" class="ac-add-btn" data-addon-id="' + p.id + '">＋</button>';

      return '<div class="addon-pill-card' + (qty > 0 ? " in-cart" : "") + '">' +
        '<div class="ac-media">' + imgHtml + "</div>" +
        '<div class="ac-info">' +
          '<div class="ac-name" title="' + esc(p.name) + '">' + esc(p.name) + "</div>" +
          '<div class="ac-price">' + priceStr + "</div>" +
        "</div>" +
        '<div class="ac-act">' + actHtml + "</div>" +
      "</div>";
    }).join("");

    host.innerHTML =
      '<div class="cart-addons-wrap">' +
        '<div class="cart-addons-head">' +
          '<span class="ca-title">Рекомендуем к заказу</span>' +
          '<div class="ca-tabs-scroll">' + tabsHtml + "</div>" +
        "</div>" +
        '<div class="ca-cards-scroll">' +
          (cardsHtml || '<div class="ca-empty">Нет позиций</div>') +
        "</div>" +
      "</div>";
  }

  /* #deliveryPromoBar отключён по продуктовому решению 2026-10-27: плашка «до подарка» больше не рисуется.
     Логика weekPromo (threshold/gift) остаётся в БД и API для будущих акций. */
  function updateDeliveryPromoBar() {
    var stale = document.getElementById("deliveryPromoBar");
    if (stale) stale.remove();
  }

function clearPromo() {
  cartPromoCode = '';
  promoInfo = null;
  localStorage.removeItem('zt_cartpromo');
  var line = document.getElementById('cartPromoLine');
  if (line) line.innerHTML = '';
  var inp = document.getElementById('cartPromo');
  if (inp) inp.value = '';
  paintTotals();
}

  function flagField(el) {
    if (!el) return;
    el.classList.remove("field-error", "need-slot");
    void el.offsetWidth;
    el.classList.add("field-error");

    var scrollBody = document.getElementById("cartScrollBody");
    if (scrollBody) {
      var rect = el.getBoundingClientRect();
      var bodyRect = scrollBody.getBoundingClientRect();
      var scrollOffset = (rect.top - bodyRect.top) + scrollBody.scrollTop - 70;
      scrollBody.scrollTo({ top: Math.max(0, scrollOffset), behavior: "smooth" });
    } else {
      try { el.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e) {}
    }

    try { el.focus({ preventScroll: true }); } catch (e) {}
    clearTimeout(el.__flagT);
    el.__flagT = setTimeout(function () { el.classList.remove("field-error"); }, 4000);
  }

  function syncZoneFeeHint(t) {
    var placeEl = document.getElementById("checkoutPlace");
    if (!placeEl) return;
    var method = (document.getElementById("checkoutMethod") || {}).value || "delivery";
    var hint = document.getElementById("zoneFeeHint");
    if (method === "pickup") {
      if (hint) hint.hidden = true;
      return;
    }
    if (!hint) {
      hint = document.createElement("div");
      hint.id = "zoneFeeHint";
      hint.className = "addr-fee-hint";
      var parent = placeEl.closest("label") || placeEl.parentElement;
      if (parent && parent.parentNode) {
        parent.parentNode.insertBefore(hint, parent.nextSibling);
      }
    }
    hint.hidden = false;
    var info = t || totalsNow();
    if (info.freeShip) {
      hint.innerHTML = "✅ <span><b>" + esc(info.placeVal) + ":</b> доставка бесплатно (бонус за регистрацию)</span>";
    } else {
      hint.innerHTML = "🚗 <span><b>" + esc(info.placeVal) + ":</b> доставка " + fmt(info.baseZoneFee) +
        " · мин. заказ " + fmt(info.minOrder) + "</span>";
    }
  }

  function syncCheckoutGuestAutofill() {
    var cPanelEl = document.getElementById("cartPanel");
    if (!cPanelEl) return;
    var gBar = document.getElementById("checkoutGuestBar");
    var user = typeof window.me !== "undefined" ? window.me : null;
    if (!user || (!user.name && !user.phone)) {
      if (gBar) gBar.hidden = true;
      return;
    }
    var methodEl = document.getElementById("checkoutMethod");
    if (!gBar && methodEl) {
      var wrapLabel = methodEl.closest("label") || methodEl.parentElement;
      if (wrapLabel && wrapLabel.parentNode) {
        gBar = document.createElement("div");
        gBar.id = "checkoutGuestBar";
        gBar.className = "checkout-guest-bar";
        wrapLabel.parentNode.insertBefore(gBar, wrapLabel);
      }
    }
    if (gBar) {
      gBar.hidden = false;
      gBar.innerHTML =
        '<span class="cgb-label">👤 Получатель:</span>' +
        '<b class="cgb-val" id="checkoutGuestName">' + esc(user.name || "Гость") + "</b>" +
        (user.phone ? '<span class="cgb-phone" id="checkoutGuestPhone">' + esc(user.phone) + "</span>" : "");
    }
    var nameInp = document.getElementById("checkoutName");
    if (nameInp && !nameInp.value && user.name) nameInp.value = user.name;
    var phoneInp = document.getElementById("checkoutPhone");
    if (phoneInp && !phoneInp.value && user.phone) phoneInp.value = user.phone;
  }

  function ensureTimeModeToggle() {
    var slotEl = document.getElementById("checkoutSlot");
    if (!slotEl || document.getElementById("checkoutTimeModeSeg")) return;
    var labelEl = slotEl.closest("label") || slotEl.parentElement;
    if (!labelEl) return;

    // Гарантируем, что у селекта слотов есть варианты выбора времени, если они ещё не подгружены
    if (slotEl.options.length <= 1) {
      var defaultSlots = ["12:00–13:00", "13:00–14:00", "14:00–15:00", "16:00–17:00", "18:00–19:00", "19:00–20:00", "20:00–21:00"];
      defaultSlots.forEach(function (sl) {
        var opt = document.createElement("option");
        opt.value = sl;
        opt.textContent = "Ко времени: " + sl;
        slotEl.appendChild(opt);
      });
    }

    var seg = document.createElement("div");
    seg.id = "checkoutTimeModeSeg";
    seg.className = "time-mode-seg";
    var isScheduled = slotEl.value && slotEl.value !== "asap";
    seg.innerHTML =
      '<button type="button" class="tms-btn' + (!isScheduled ? " on" : "") + '" data-tmode="asap">⚡ Как можно скорее</button>' +
      '<button type="button" class="tms-btn' + (isScheduled ? " on" : "") + '" data-tmode="slot">⏰ Ко времени</button>';

    labelEl.parentNode.insertBefore(seg, labelEl);

    function syncSlotVisibility(modeVal) {
      seg.querySelectorAll(".tms-btn").forEach(function (b) {
        b.classList.toggle("on", b.dataset.tmode === modeVal);
      });
      if (modeVal === "asap") {
        slotEl.value = "asap";
        labelEl.hidden = true;
      } else {
        labelEl.hidden = false;
        if (!slotEl.value || slotEl.value === "asap") {
          for (var i = 0; i < slotEl.options.length; i++) {
            if (slotEl.options[i].value && slotEl.options[i].value !== "asap") {
              slotEl.value = slotEl.options[i].value;
              break;
            }
          }
        }
      }
      slotEl.dispatchEvent(new Event("change", { bubbles: true }));
    }

    if (!isScheduled) labelEl.hidden = true;

    seg.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-tmode]");
      if (!btn) return;
      e.preventDefault();
      syncSlotVisibility(btn.dataset.tmode);
    });
  }

  function ensurePlaceOptions() {
    var placeEl = document.getElementById("checkoutPlace");
    if (!placeEl || placeEl.tagName !== "SELECT") return;
    var defaultPlaces = ["Янтарный", "Синявино", "Покровское", "Куликово", "Яблоновка", "Донское"];
    var existing = Array.from(placeEl.options).map(function (o) { return o.value.toLowerCase().trim(); });
    defaultPlaces.forEach(function (p) {
      if (!existing.includes(p.toLowerCase())) {
        var opt = document.createElement("option");
        opt.value = p;
        opt.textContent = p;
        placeEl.appendChild(opt);
      }
    });
    if (!placeEl.value) {
      placeEl.value = "Янтарный";
    }
  }

  function toggleDeliveryGroup() {
    var method = (document.getElementById("checkoutMethod") || {}).value || "delivery";
    var isPickup = method === "pickup";
    var grp = document.getElementById("checkoutDeliveryGroup");
    if (grp) grp.hidden = isPickup;
    ensurePlaceOptions();
    ensureTimeModeToggle();
    syncZoneFeeHint();
    syncCheckoutGuestAutofill();
  }

  function saveDraft() {
    try {
      var draft = {
        method: (document.getElementById("checkoutMethod") || {}).value,
        place: (document.getElementById("checkoutPlace") || {}).value,
        street: (document.getElementById("checkoutStreet") || {}).value,
        house: (document.getElementById("checkoutHouse") || {}).value,
        slot: (document.getElementById("checkoutSlot") || {}).value,
        pay: (document.getElementById("checkoutPay") || {}).value,
        comment: (document.getElementById("checkoutComment") || {}).value
      };
      sessionStorage.setItem("zt_checkout_draft", JSON.stringify(draft));
      /* Черновик ≠ сохранённый адрес: в «Мои адреса» адрес попадает только после успешного заказа
         (см. checkBtn.onclick). Раньше autoAdd вызывался на каждый ввод и плодил записи «Н», «Ну», «С». */
    } catch (e) {}
  }

  function restoreDraft() {
    try {
      var draft = JSON.parse(sessionStorage.getItem("zt_checkout_draft") || "{}");
      var saved = JSON.parse(localStorage.getItem("zt_saved_address") || "{}");

      var placeVal = draft.place || saved.place;
      var streetVal = draft.street || saved.street;
      var houseVal = draft.house || saved.house;

      if (draft.method && document.getElementById("checkoutMethod")) {
        document.getElementById("checkoutMethod").value = draft.method;
      }
      if (placeVal && document.getElementById("checkoutPlace")) {
        document.getElementById("checkoutPlace").value = placeVal;
      }
      if (streetVal && document.getElementById("checkoutStreet")) {
        document.getElementById("checkoutStreet").value = streetVal;
      }
      if (houseVal && document.getElementById("checkoutHouse")) {
        document.getElementById("checkoutHouse").value = houseVal;
      }
      if (draft.slot && document.getElementById("checkoutSlot")) {
        document.getElementById("checkoutSlot").value = draft.slot;
      }
      if (draft.pay && document.getElementById("checkoutPay")) {
        document.getElementById("checkoutPay").value = draft.pay;
      }
      if (draft.comment && document.getElementById("checkoutComment")) {
        document.getElementById("checkoutComment").value = draft.comment;
      }
      toggleDeliveryGroup();
    } catch (e) {}
  }

  function renderGifts() {
    var el = document.getElementById("cartGifts");
    if (!el) return;
    var list = typeof cart !== "undefined" && Array.isArray(cart) ? cart : [];
    var di = typeof deliveryInfo !== "undefined" && deliveryInfo ? deliveryInfo : null;
    var gifts = [];

    /* Подарок от суммы (weekPromo) не показываем — см. updateDeliveryPromoBar. */
    var pm2 = di && di.pizzaMonth;
    if (pm2 && pm2.name) {
      var big = list.reduce(function (a, c) {
        return a + ((Number(c.sz) === 35) ? (Number(c.qty) || 1) : 0);
      }, 0);
      if (big >= 2) gifts.push("🎁 " + pm2.name + " — подарок");
    }
    el.innerHTML = gifts.join("<br>");
  }

    /* ── Хелперы рендеринга модификаторов и карточек позиций ── */
  function renderAttachedModifiers(modifiers, itemIndex) {
    if (!modifiers || !modifiers.length) return "";
    return '<div class="ci-mods-list">' +
      modifiers.map(function (m, mIdx) {
        return '<div class="ci-mod-badge">' +
          '<span>└ ＋ ' + esc(m.name) + ' (' + fmt(m.price) + ')</span>' +
          '<button type="button" class="ci-mod-del" data-del-mod="' + itemIndex + '" data-mod-idx="' + mIdx + '" title="Убрать из блюда">✕</button>' +
        '</div>';
      }).join("") +
    '</div>';
  }

  function renderModChips(availableMods, attachedModifiers, itemIndex) {
    return '<div class="ci-mod-chips-wrap">' +
      '<div class="ci-mod-chips-scroll">' +
        availableMods.map(function (mod) {
          var isSelected = (attachedModifiers || []).some(function (m) { return String(m.id) === String(mod.id); });
          return '<button type="button" class="ci-mod-chip' + (isSelected ? " selected" : "") + '" data-toggle-mod-item="' + itemIndex + '" data-mod-id="' + mod.id + '">' +
            (isSelected ? "✓ " : "＋ ") + esc(mod.name) + " · " + fmt(mod.price) +
          '</button>';
        }).join("") +
      '</div>' +
    '</div>';
  }

  function renderItemAddModSection(c, itemIndex, origProd, pizzaToppings, rollAddons, isBlockOpen) {
    var isPizza = origProd ? (origProd.cat === "pizza" || (origProd.opts && origProd.opts.length > 0)) : false;
    var isRollOrSet = origProd ? (origProd.cat === "rolls" || origProd.cat === "sets") : false;

    var targetMods = isPizza ? pizzaToppings : (isRollOrSet ? rollAddons : null);
    if (!targetMods || !targetMods.length) return "";

    var defaultLabel = isPizza ? "＋ Добавить ингредиенты в эту пиццу" : "＋ Добавить к этим роллам";
    var toggleLabel = isBlockOpen ? "− Скрыть добавки" : defaultLabel;

    return '<div class="ci-add-mod-box">' +
      '<button type="button" class="ci-toggle-mods-btn" data-toggle-mods="' + itemIndex + '">' + toggleLabel + '</button>' +
      (isBlockOpen ? renderModChips(targetMods, c.modifiers, itemIndex) : '') +
    '</div>';
  }

  function renderCartItemRow(c, itemIndex, allMenu, pizzaToppings, rollAddons) {
    var optLabel = c.opt ? (typeof c.opt === "object" ? c.opt.name || "" : c.opt) : "";
    var origProd = allMenu.find(function (x) { return String(x.id) === String(c.id); });

    var modSum = (c.modifiers || []).reduce(function (mA, m) { return mA + (Number(m.price) || 0); }, 0);
    var lineTotal = ((Number(c.price) || 0) + modSum) * (Number(c.qty) || 1);

    var modsHtml = renderAttachedModifiers(c.modifiers, itemIndex);
    var addModSection = renderItemAddModSection(c, itemIndex, origProd, pizzaToppings, rollAddons, !!openModsMap[itemIndex]);

    return '<div class="cartItem" data-cart-idx="' + itemIndex + '">' +
      '<div class="ci-main-row">' +
        '<div class="ci-left">' +
          '<b class="ci-name">' + esc(c.name) + '</b>' +
          (optLabel ? '<div class="ci-opt">' + esc(optLabel) + '</div>' : '') +
          '<div class="ci-price">' + fmt(lineTotal) + '</div>' +
        '</div>' +
        '<div class="qty">' +
          '<button type="button" data-ci="' + itemIndex + '" data-act="-">−</button>' +
          '<span>' + c.qty + '</span>' +
          '<button type="button" data-ci="' + itemIndex + '" data-act="+">+</button>' +
        '</div>' +
      '</div>' +
      modsHtml +
      addModSection +
    '</div>';
  }

  function syncPreorderNotice(cItems) {
    var pmNotice = document.getElementById("preorderNotice");
    var pmMode = typeof window.preorderMode === "function" ? window.preorderMode() : null;
    if (pmMode && checkIsDelivery()) {
      if (!pmNotice) {
        pmNotice = document.createElement("div");
        pmNotice.id = "preorderNotice";
        pmNotice.className = "cart-preorder-notice";
        cItems.parentNode.insertBefore(pmNotice, cItems);
      }
      if (pmMode === "tomorrow") {
        pmNotice.innerHTML = "🌙 <b>Приём заказов на сегодня завершён.</b> Выберите удобный интервал доставки на завтра.";
      } else {
        var openHour = Number(window.deliveryInfo && window.deliveryInfo.today && window.deliveryInfo.today.open) || 11;
        pmNotice.innerHTML = "☀ <b>Откроемся в " + String(openHour).padStart(2, "0") + ":00.</b> Можно оформить предзаказ на сегодня.";
      }
      pmNotice.style.display = "";
    } else if (pmNotice) {
      pmNotice.style.display = "none";
    }
  }

  function persistCartUpdate() {
  localStorage.setItem("zt_cart", JSON.stringify(cart));
  if (typeof window.updateCartFab === 'function') window.updateCartFab();
  renderCartBase();
}

function renderCartBase() {
    var cItems = document.getElementById("cartItems");
    if (!cItems) return;
    var list = typeof cart !== "undefined" && Array.isArray(cart) ? cart : [];
    var allMenu = typeof DMENU !== "undefined" && Array.isArray(DMENU) ? DMENU : [];

    var pizzaToppings = allMenu.filter(function (p) { return isPizzaTopping(p) && p.on !== 0; });
    var rollAddons = allMenu.filter(function (p) { return isRollAddon(p) && p.on !== 0; });

    var itemsHtml = list.map(function (c, i) {
      return renderCartItemRow(c, i, allMenu, pizzaToppings, rollAddons);
    }).join("");

    cItems.innerHTML = itemsHtml ||
      '<div class="empty-state">' +
        '<div class="empty-state-icon">🍕</div>' +
        '<div class="empty-state-title">Корзина пуста</div>' +
        '<div class="empty-state-sub">Добавьте пиццу, роллы или напитки из меню</div>' +
        '<button type="button" class="empty-state-btn" data-goto-menu>Перейти в меню</button>' +
      '</div>';

    syncPreorderNotice(cItems);
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
    var fab = document.getElementById("cartFab");
    if (!fab) return;

    var hasItems = t.sum > 0;
    var cnt = (typeof cart !== "undefined" && Array.isArray(cart) ? cart : []).reduce(function (a, c) {
      return a + (Number(c.qty) || 1);
    }, 0);

    fab.classList.toggle("visible", hasItems);
    fab.hidden = !hasItems;

    var badge = fab.querySelector(".cf-badge");
    var total = fab.querySelector(".cf-total");
    if (badge) badge.textContent = cnt;
    if (total) total.textContent = Number(t.total).toLocaleString("ru-RU") + " ₽";

    paintTotals();
    if (typeof syncAddButtons === "function") syncAddButtons();
  };

  /* ── Слушатели событий корзины ── */
  var cFabBtn = document.getElementById("cartFab");
  if (cFabBtn) {
    cFabBtn.addEventListener("click", function () {
      setTimeout(function () {
        if (typeof window.syncOverlay === "function") window.syncOverlay();
      }, 0);
    });
  }
  var cPanel = document.getElementById("cartPanel");
  if (cPanel) {
    cPanel.addEventListener("click", function (e) {
      if (e.target.closest("#cartTopClose") || e.target.closest("#cartClose")) {
        e.preventDefault();
        cPanel.classList.remove("open");
        if (typeof syncOverlay === "function") syncOverlay();
        if (window.TgUx) window.TgUx.sync();
        return;
      }

      // Табы кросс-сейла (Все / Соусы / Напитки)
      var tabBtn = e.target.closest("[data-atab]");
      if (tabBtn) {
        e.preventDefault();
        activeAddonTab = tabBtn.dataset.atab;
        renderAddons();
        return;
      }

      // Раскрытие / сворачивание списка добавок по нажатию на кнопку
      var toggleBtn = e.target.closest("[data-toggle-mods]");
      if (toggleBtn) {
        e.preventDefault();
        var idx = +toggleBtn.dataset.toggleMods;
        openModsMap[idx] = !openModsMap[idx];
        renderCartBase();
        return;
      }

      // Переключатель модификатора: повторный клик по тому же чипсу убирает добавку
      var modChip = e.target.closest("[data-toggle-mod-item]");
      if (modChip && typeof DMENU !== "undefined") {
        e.preventDefault();
        var targetIdx = +modChip.dataset.toggleModItem;
        var modId = modChip.dataset.modId;
        var cartItem = cart[targetIdx];
        var modProduct = DMENU.find(function (x) { return String(x.id) === String(modId); });

        if (cartItem && modProduct) {
          if (!cartItem.modifiers) cartItem.modifiers = [];
          var existPos = cartItem.modifiers.findIndex(function (m) { return String(m.id) === String(modId); });

          if (existPos > -1) {
            // Уже добавлен -> клик по этому же тексту УБИРАЕТ его
            cartItem.modifiers.splice(existPos, 1);
          } else {
            // Не добавлен -> добавляем
            cartItem.modifiers.push({
              id: modProduct.id,
              name: modProduct.name,
              price: Number(modProduct.price) || 0
            });
            if (window.TgUx) window.TgUx.haptic("medium");
          }

          persistCartUpdate();
        }
        return;
      }

      // Удаление модификатора по крестику ✕
      var delModBtn = e.target.closest("[data-del-mod]");
      if (delModBtn) {
        e.preventDefault();
        var cIdx = +delModBtn.dataset.delMod;
        var mIdx = +delModBtn.dataset.modIdx;
        if (cart[cIdx] && cart[cIdx].modifiers) {
          cart[cIdx].modifiers.splice(mIdx, 1);
          persistCartUpdate();
        }
        return;
      }

      // Степпер изменения количества основного блюда
      var b = e.target.closest("[data-ci]");
      if (b) {
        var i = +b.dataset.ci;
        var it = cart[i];
        if (!it) { renderCartBase(); return; }
        if (b.dataset.act === "+") it.qty++;
        else if (it.qty > 1) it.qty--;
        else {
          cart.splice(i, 1);
          delete openModsMap[i];
        }

        persistCartUpdate();
        return;
      }

      // Быстрое добавление напитков или соусов из общего блока
      var acBtn = e.target.closest("[data-addon-id]");
      if (acBtn && typeof DMENU !== "undefined") {
        var aId = acBtn.dataset.addonId;
        var prod = DMENU.find(function (x) { return String(x.id) === String(aId); });
        if (!prod) return;

        var inCart = cart.find(function (c) { return String(c.id) === String(prod.id) && (!c.modifiers || !c.modifiers.length); });
        var action = acBtn.dataset.acAct;

        if (action === "minus") {
          if (inCart) {
            if (inCart.qty > 1) inCart.qty--;
            else cart.splice(cart.indexOf(inCart), 1);
          }
        } else {
          if (inCart) {
            inCart.qty++;
          } else {
            cart.push({
              key: prod.id,
              id: prod.id,
              oi: -1,
              name: prod.name,
              opt: null,
              price: parseInt(prod.price, 10) || 0,
              sz: 0,
              qty: 1,
              modifiers: []
            });
          }
          if (window.TgUx) window.TgUx.haptic("medium");
        }

        persistCartUpdate();
      }
    });
  }

  /* ── 1. Свайп мышью как на смартфоне (Drag-to-scroll) на ПК ── */
  (function initMouseDragScroll() {
    var isDown = false;
    var startX = 0;
    var scrollStart = 0;
    var activeEl = null;
    var hasDragged = false;

    document.addEventListener("mousedown", function (e) {
      if (e.button !== 0) return; // только левая кнопка
      var el = e.target.closest(".ca-cards-scroll, .ca-tabs-scroll, .ci-mod-chips-scroll, .subfilter-bar, .rail");
      if (!el) return;
      isDown = true;
      hasDragged = false;
      activeEl = el;
      startX = e.pageX;
      scrollStart = el.scrollLeft;
    });

    document.addEventListener("mousemove", function (e) {
      if (!isDown || !activeEl) return;
      var dx = e.pageX - startX;
      if (Math.abs(dx) > 4) {
        hasDragged = true;
        activeEl.style.cursor = "grabbing";
        activeEl.style.userSelect = "none";
      }
      activeEl.scrollLeft = scrollStart - dx;
    });

    function endDrag() {
      if (activeEl) {
        activeEl.style.cursor = "";
        activeEl.style.removeProperty("user-select");
      }
      isDown = false;
      activeEl = null;
    }

    document.addEventListener("mouseup", function () {
      endDrag();
      if (hasDragged) {
        setTimeout(function () { hasDragged = false; }, 60);
      }
    });

    // Если был свайп мышью — подавляем случайный клик по кнопке/чипсу
    document.addEventListener("click", function (e) {
      if (hasDragged) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);

    // Дополнительно: прокрутка колесиком мыши
    document.addEventListener("wheel", function (e) {
      var strip = e.target.closest(".ca-cards-scroll, .ca-tabs-scroll, .ci-mod-chips-scroll, .subfilter-bar");
      if (strip && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        strip.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    }, { passive: false });
  })();

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
      if (window.AddressModule && typeof window.AddressModule.populateStreets === "function") {
        window.AddressModule.populateStreets(cpEl.value);
      }
    });
  }

  ["checkoutStreet", "checkoutHouse", "checkoutSlot", "checkoutPay", "checkoutComment"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", saveDraft);
      el.addEventListener("change", saveDraft);
    }
  });

  /* ── Оформление заказа ── */
  function resolveCheckoutAddress(method) {
    if (method !== "delivery") {
      return { ok: true, placeV: "", streetV: "", houseV: "" };
    }

    var placeEl = document.getElementById("checkoutPlace");
    var streetEl = document.getElementById("checkoutStreet");
    var houseEl = document.getElementById("checkoutHouse");
    var placeV = placeEl ? placeEl.value.trim() : "";
    if (!placeV) {
      return { ok: false, field: placeEl, message: "Выберите населённый пункт", icon: "📍" };
    }

    var streetV = streetEl ? streetEl.value.trim() : "";
    var houseV = houseEl ? houseEl.value.trim() : "";

    if (!streetV) {
      return { ok: false, field: streetEl, message: "Укажите улицу", icon: "🏠" };
    }

    if (window.AddressModule && window.AddressModule.LOCAL_STREETS) {
      var placeKey = (window.AddressModule.normPlace || function (p) { return String(p || "").toLowerCase().trim(); })(placeV);
      var validStreets = window.AddressModule.LOCAL_STREETS[placeKey] || [];
      if (validStreets.length > 0) {
        var sClean = streetV.toLowerCase().replace(/^(ул\.?|улица|пер\.?|проезд|пр-д)\s+/i, "").replace(/\s+(ул\.?|улица)$/i, "").trim();
        var found = validStreets.some(function (s) {
          if (s === "(без улицы)") return true;
          var candClean = s.toLowerCase().replace(/^(ул\.?|улица|пер\.?|проезд|пр-д)\s+/i, "").replace(/\s+(ул\.?|улица)$/i, "").trim();
          return candClean === sClean;
        });
        if (!found && sClean !== "без улицы" && sClean !== "(без улицы)") {
          return { ok: false, field: streetEl, message: "В " + placeV + " нет улицы «" + streetV + "»", icon: "⚠️" };
        }
      }
    }

    if (!houseV) {
      return { ok: false, field: houseEl, message: "Укажите дом и квартиру", icon: "🏠" };
    }

    return { ok: true, placeV: placeV, streetV: streetV, houseV: houseV };
  }

  function resolveCheckoutSlot() {
    if (typeof window.populateSlots === "function") window.populateSlots();
    var pm = typeof window.preorderMode === "function"
      ? window.preorderMode()
      : (typeof window.assertServiceOpen === "function" && !window.assertServiceOpen() ? "tomorrow" : null);
    var slotElCheck = document.getElementById("checkoutSlot");
    var slotModeBtn = document.querySelector('#checkoutTimeModeSeg .tms-btn.on[data-tmode="slot"]');
    var slotVal = (slotElCheck && slotElCheck.value) || "";
    if ((pm || slotModeBtn) && (!slotVal || slotVal === "asap") && slotElCheck) {
      ensureTimeModeToggle();
      for (var sIdx = 0; sIdx < slotElCheck.options.length; sIdx++) {
        if (slotElCheck.options[sIdx].value && slotElCheck.options[sIdx].value !== "asap") {
          slotElCheck.value = slotElCheck.options[sIdx].value;
          slotVal = slotElCheck.value;
          break;
        }
      }
    }

    var isPreorder = !!pm || (slotVal && slotVal !== "asap");
    if (isPreorder && (!slotVal || slotVal === "asap")) {
      return { ok: false, field: slotElCheck, message: "Выберите время доставки для предзаказа ⏰", icon: "⚠️" };
    }

    var preorderDate = "";
    if (slotVal && slotVal !== "asap") {
      var mDate = slotVal.match(/^(\d{2}[.-]\d{2})/);
      if (mDate) preorderDate = mDate[1];
    }

    return { ok: true, slotVal: slotVal, isPreorder: isPreorder, preorderDate: preorderDate };
  }

  var checkBtn = document.getElementById("checkoutBtn");
  if (checkBtn) {
    checkBtn.onclick = async function () {
      if (checkBtn.disabled || checkBtn.getAttribute("data-busy") === "1") return;

      if (!me) {
        toast("Сначала войдите по номеру", "👤");
        if (typeof openAuth === "function") openAuth();
        return;
      }
      if (!cart || cart.length === 0) {
        toast("Корзина пуста", "🛒");
        return;
      }

      var tCheck = totalsNow();
      if (tCheck.belowMin) {
        toast("Минимальная сумма заказа для доставки — " + fmt(tCheck.minOrder), "⚠️");
        return;
      }

      var method = (document.getElementById("checkoutMethod") || {}).value || "delivery";
      var addressState = resolveCheckoutAddress(method);
      if (!addressState.ok) {
        if (addressState.field) flagField(addressState.field);
        return toast(addressState.message, addressState.icon);
      }

      var slotState = resolveCheckoutSlot();
      if (!slotState.ok) {
        if (slotState.field) flagField(slotState.field);
        return toast(slotState.message, slotState.icon);
      }

      var placeV = addressState.placeV;
      var streetV = addressState.streetV;
      var houseV = addressState.houseV;
      var slotVal = slotState.slotVal;
      var isPreorder = slotState.isPreorder;
      var preorderDate = slotState.preorderDate;

      var body = {
        method: method,
        place: method === "pickup" ? "Самовывоз" : placeV,
        street: streetV,
        house: houseV,
        slot: slotVal,
        is_preorder: isPreorder ? 1 : 0,
        preorder_date: preorderDate,
        pay: (document.getElementById("checkoutPay") || {}).value || "cash",
        comment: ((document.getElementById("checkoutComment") || {}).value || "").trim(),
        items: cart.map(function (c) {
          return {
            id: c.id,
            oi: c.oi,
            qty: c.qty,
            modifiers: c.modifiers || []
          };
        })
      };
      if (cartPromoCode) body.promo = cartPromoCode;

      // 1. Идемпотентный ID: защита от дублей при сетевом сбое
      body.client_order_id = "ord_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);

      // 2. Блокируем кнопку физически и визуально ДО отправки запроса
      var origBtnHtml = checkBtn.innerHTML;
      checkBtn.disabled = true;
      checkBtn.setAttribute("data-busy", "1");
      checkBtn.style.pointerEvents = "none";
      checkBtn.innerHTML = '<span>⏳ Оформляем заказ...</span>';

      if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.MainButton) {
        try { window.Telegram.WebApp.MainButton.showProgress(); } catch (tgErr) {}
      }

      var r;
      try {
        r = await api("/orders", { method: "POST", body: body });
        toast("Заказ #" + (r.order && r.order.no ? r.order.no : "") + " оформлен!", "🎉");

        /* Адрес прошёл валидацию и заказ принят — запоминаем его в «Моих адресах» (только доставка) */
        if (method !== "pickup" && window.AddressBook && typeof window.AddressBook.autoAdd === "function") {
          try { window.AddressBook.autoAdd({ place: placeV, street: streetV, house: houseV }); } catch (eAb) { }
        }

        if (window.TgUx) window.TgUx.success();

        if (typeof cart !== "undefined" && Array.isArray(cart)) cart.length = 0;
        window.cart = [];
        openModsMap = {};
        localStorage.setItem("zt_cart", "[]");
        sessionStorage.removeItem("zt_checkout_draft");
        clearPromo();

        var pi = document.getElementById("cartPromo"); if (pi) pi.value = "";
        var stEl = document.getElementById("checkoutStreet"); if (stEl) stEl.value = "";
        var hsEl = document.getElementById("checkoutHouse"); if (hsEl) hsEl.value = "";
        var cmEl = document.getElementById("checkoutComment"); if (cmEl) cmEl.value = "";
        var slEl = document.getElementById("checkoutSlot");
        if (slEl) slEl.value = (window.preorderMode && window.preorderMode()) ? "" : "asap";

        document.querySelectorAll("#deliveryGrid .opts button.sel").forEach(function (btn) {
          btn.classList.remove("sel");
        });

        if (typeof syncAddButtons === "function") syncAddButtons();
        if (typeof updateCartFab === "function") updateCartFab();
        renderCartBase();

        var cp2 = document.getElementById("cartPanel");
        if (cp2) cp2.classList.remove("open");
        if (typeof loadMyOrders === "function") loadMyOrders({ force: true });
        if (r && r.order) {
          openOrderTrackModal(r.order);
        } else if (typeof syncOverlay === "function") {
          syncOverlay();
        }
      } catch (e) {
        try {
          var preorderSlot = document.getElementById("checkoutSlot") ? document.getElementById("checkoutSlot").value : "";
          if (preorderSlot && preorderSlot !== "asap" && window.PreorderTimer && typeof window.PreorderTimer.updateAll === "function") {
            setTimeout(window.PreorderTimer.updateAll, 500);
          }
        } catch (e2) { }

        toast(e.message || "Ошибка оформления заказа", "⚠️");
      } finally {
        // 3. Разблокировка при любом исходе (успех, 500, таймаут)
        checkBtn.disabled = false;
        checkBtn.removeAttribute("data-busy");
        checkBtn.style.pointerEvents = "";
        checkBtn.innerHTML = origBtnHtml;

        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.MainButton) {
          try { window.Telegram.WebApp.MainButton.hideProgress(); } catch (tgErr) {}
        }
      }
    };
  }

  restoreDraft();

  /* Кнопка «Перейти в меню» */
  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-goto-menu]");
    if (!btn) return;

    if (window.TgUx && typeof window.TgUx.closeTop === "function") {
      window.TgUx.closeTop();
    } else {
      var cp = document.getElementById("cartPanel");
      if (cp) cp.classList.remove("open");
      var panel = document.getElementById("panel");
      if (panel) panel.classList.remove("open");
      if (typeof window.syncOverlay === "function") window.syncOverlay();
    }

    if (typeof window.brand !== "undefined" && window.brand !== "delivery") {
      var brandBtn = document.querySelector('#brandSeg button[data-brand="delivery"]');
      if (brandBtn) brandBtn.click();
    }

    setTimeout(function () {
      var grid = document.getElementById("deliveryGrid");
      if (grid) grid.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  });

  /* ── Спринт 3, Задача 3: Модалка подтверждения и Live Tracking заказа ── */
  var trackPollTimer = null;
  var activeTrackOrder = null;

  function statusStepIndex(st) {
    if (st === "done") return 3;
    if (st === "way") return 2;
    if (st === "cook" || st === "accept") return 1;
    return 0; // new
  }

  function renderTrackModalContent(order) {
    if (!order) return;
    activeTrackOrder = order;
    var modal = document.getElementById("orderTrackModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "orderTrackModal";
      modal.className = "modal";
      document.body.appendChild(modal);

      modal.addEventListener("click", function (e) {
        if (e.target === modal || e.target.closest("[data-ot-close]")) {
          closeOrderTrackModal();
          return;
        }
        if (e.target.closest("[data-ot-chat]")) {
          if (window.chatState && typeof window.chatState.setChatCtx === "function") {
            window.chatState.setChatCtx("delivery");
          }
          var cp = document.getElementById("chatPanel");
          if (cp) cp.classList.add("open");
          var fab = document.getElementById("chatFab");
          if (fab) fab.classList.add("open");
          closeOrderTrackModal();
          if (typeof window.setBotName === "function") window.setBotName();
          return;
        }
        if (e.target.closest("[data-ot-repeat]")) {
          if (activeTrackOrder && Array.isArray(activeTrackOrder.items)) {
            window.cart = activeTrackOrder.items.map(function (it) {
              return {
                key: String(it.id) + "_" + (it.opt || "0"),
                id: it.id,
                oi: typeof it.oi === "number" ? it.oi : -1,
                name: it.name || "Блюдо",
                opt: it.opt || null,
                price: Number(it.price) || 0,
                sz: Number(it.sz) || 0,
                qty: Number(it.qty) || 1,
                modifiers: it.modifiers || []
              };
            });
            persistCartUpdate();
            var cPanelEl = document.getElementById("cartPanel");
            if (cPanelEl) cPanelEl.classList.add("open");
            closeOrderTrackModal();
            toast("Заказ добавлен в корзину", "🛒");
          }
        }
      });
    }

    var stepIdx = statusStepIndex(order.status || "new");
    var steps = [
      { l: "Новый", ic: "📝" },
      { l: "Готовится", ic: "🔥" },
      { l: "Курьер в пути", ic: "🛵" },
      { l: "Выполнен", ic: "✅" }
    ];

    var stepsHtml = steps.map(function (s, idx) {
      var cls = idx < stepIdx ? "done" : (idx === stepIdx ? "active" : "");
      return '<div class="ot-step ' + cls + '">' +
        '<div class="ot-dot">' + s.ic + "</div>" +
        '<span class="ot-lbl">' + s.l + "</span>" +
      "</div>";
    }).join("");

    var itemsList = Array.isArray(order.items) ? order.items : [];
    var itemsHtml = itemsList.map(function (it) {
      return '<div class="ot-item-row">' +
        '<span>' + esc(it.name || "Позиция") + (it.opt ? " (" + esc(it.opt) + ")" : "") + " × " + (it.qty || 1) + "</span>" +
        '<b>' + fmt((Number(it.price) || 0) * (Number(it.qty) || 1)) + "</b>" +
      "</div>";
    }).join("");

    var totalVal = Number(order.total || order.sum) || 0;

    modal.innerHTML =
      '<div class="modal-card ot-card">' +
        '<button type="button" class="mclose" data-ot-close aria-label="Закрыть">✕</button>' +
        '<div class="ot-head-badge">🎉 Заказ принят</div>' +
        '<h3 class="ot-title">Заказ #' + esc(order.no || order.id || "—") + "</h3>" +
        '<div class="msub">' + (order.slot && order.slot !== "asap" ? "Ко времени: " + esc(order.slot) : "Приготовим и доставим как можно скорее") + "</div>" +
        '<div class="ot-progress" data-step-idx="' + stepIdx + '">' + stepsHtml + "</div>" +
        '<div class="ot-items-box">' +
          (itemsHtml || '<div class="ot-item-row"><span>Состав заказа сохранён</span></div>') +
          (totalVal ? '<div class="ot-total-row"><span>Итого:</span><b>' + fmt(totalVal) + "</b></div>" : "") +
        "</div>" +
        '<div class="ot-actions">' +
          '<button type="button" class="btn fire" data-ot-chat>💬 Связаться с пиццерией</button>' +
          '<button type="button" class="btn ghost" data-ot-repeat>🔁 Повторить заказ</button>' +
        "</div>" +
      "</div>";
  }

  function pollOrderStatus(orderIdOrNo) {
    if (trackPollTimer) clearInterval(trackPollTimer);
    trackPollTimer = setInterval(async function () {
      var modal = document.getElementById("orderTrackModal");
      if (!modal || !modal.classList.contains("show")) {
        clearInterval(trackPollTimer);
        trackPollTimer = null;
        return;
      }
      try {
        var res = await api("/orders/mine");
        var list = (res && res.orders) || [];
        var found = list.find(function (o) {
          return String(o.id) === String(orderIdOrNo) || String(o.no) === String(orderIdOrNo);
        });
        if (found) {
          renderTrackModalContent(found);
          if (found.status === "done" || found.status === "cancel") {
            clearInterval(trackPollTimer);
            trackPollTimer = null;
          }
        }
      } catch (_) {}
    }, 5000);
  }

  function openOrderTrackModal(order) {
    renderTrackModalContent(order);
    var modal = document.getElementById("orderTrackModal");
    if (modal) {
      modal.classList.add("show");
      if (typeof window.syncOverlay === "function") window.syncOverlay();
      pollOrderStatus(order.id || order.no);
    }
  }

  function closeOrderTrackModal() {
    if (trackPollTimer) {
      clearInterval(trackPollTimer);
      trackPollTimer = null;
    }
    var modal = document.getElementById("orderTrackModal");
    if (modal) modal.classList.remove("show");
    if (typeof window.syncOverlay === "function") window.syncOverlay();
  }

  window.openOrderTrackModal = openOrderTrackModal;
  window.closeOrderTrackModal = closeOrderTrackModal;

})();