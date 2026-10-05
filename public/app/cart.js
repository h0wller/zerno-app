/* public/app/cart.js — Корзина доставки, умные модификаторы блюд и чекаут */
(function () {
  "use strict";

  function isServiceOpen() {
    return typeof window.isDeliveryServiceOpen === "function"
      ? window.isDeliveryServiceOpen()
      : true;
  }

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
    if (!info) return 0;
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
    var pickup = method === "pickup" ? Math.round(sum * 0.1) : 0;
    var fee = 0;

    if (list.length && method === "delivery") {
      var placeEl = document.getElementById("checkoutPlace");
      var placeVal = placeEl ? placeEl.value : "";
      if (typeof deliveryInfo !== "undefined" && deliveryInfo && deliveryInfo.zones) {
        var z = deliveryInfo.zones.find(function (zone) {
          return zone.places && zone.places.includes(placeVal);
        });
        fee = z ? Number(z.fee) || 0 : 0;
      }
      if (window.AddressModule && typeof window.AddressModule.getFee === "function") {
        var zoneFee = Number(window.AddressModule.getFee(placeVal));
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
      discEl.textContent = t.pickup ? "−10% самовывоз: −" + fmt(t.pickup) : "";
      discEl.style.display = t.pickup ? "flex" : "none";
    }

    var feeEl = document.getElementById("cartFee");
    if (feeEl) {
      feeEl.textContent = t.fee ? "Доставка: " + fmt(t.fee) : "";
      feeEl.style.display = t.fee ? "flex" : "none";
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

  function updateDeliveryPromoBar() {
    var list = typeof cart !== "undefined" && Array.isArray(cart) ? cart : [];
    var pBar = document.getElementById("deliveryPromoBar");
    if (!list.length || !checkIsDelivery()) {
      if (pBar) pBar.style.display = "none";
      return;
    }
    var cartItems = document.getElementById("cartItems");
    if (!cartItems || !cartItems.parentNode) return;
    if (!pBar) {
      pBar = document.createElement("div");
      pBar.id = "deliveryPromoBar";
      cartItems.parentNode.insertBefore(pBar, cartItems);
    }
    pBar.style.display = "";

    var tNow = totalsNow().sum;
    var wp = typeof deliveryInfo !== "undefined" && deliveryInfo && deliveryInfo.weekPromo ? deliveryInfo.weekPromo : {};
    var thresholdVal = Number(wp.threshold) > 0 ? Number(wp.threshold) : 2000;
    var giftText = wp.gift && wp.gift.trim() ? wp.gift.trim() : "Пиво 0,5";
    var isDone = tNow >= thresholdVal && tNow > 0;
    var diffVal = Math.max(0, thresholdVal - tNow);
    var progressVal = thresholdVal > 0 ? Math.min(100, Math.round((tNow / thresholdVal) * 100)) : 0;
    if (isDone) progressVal = 100;

    pBar.className = "cart-promo-badge";
    pBar.innerHTML =
      '<div class="cpb-top">' +
        "<span>" + (isDone ? "🎁 Подарок добавлен: " + esc(giftText) : "До подарка (" + esc(giftText) + "):") + "</span>" +
        '<b class="' + (isDone ? "done" : "") + '">' + (isDone ? "Выполнено!" : "ещё " + fmt(diffVal)) + "</b>" +
      "</div>" +
      '<div class="cpb-bar">' +
        '<div class="cpb-fill' + (isDone ? " done" : "") + '" style="width:' + progressVal + '%;"></div>' +
      "</div>";
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

  function toggleDeliveryGroup() {
    var method = (document.getElementById("checkoutMethod") || {}).value || "delivery";
    var isPickup = method === "pickup";
    var grp = document.getElementById("checkoutDeliveryGroup");
    if (grp) grp.hidden = isPickup;
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

      if (draft.place || draft.street || draft.house) {
        if (window.AddressBook && typeof window.AddressBook.autoAdd === "function") {
          window.AddressBook.autoAdd({ place: draft.place, street: draft.street, house: draft.house });
        } else {
          localStorage.setItem("zt_saved_address", JSON.stringify({
            place: draft.place, street: draft.street, house: draft.house
          }));
        }
      }
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
    var sum = list.reduce(function (a, c) { return a + (Number(c.price) || 0) * (Number(c.qty) || 1); }, 0);
    var di = typeof deliveryInfo !== "undefined" && deliveryInfo ? deliveryInfo : null;
    var gifts = [];

    var wp2 = di && di.weekPromo;
    if (wp2 && wp2.gift && sum > 0) {
      var q = wp2.threshold > 0 ? Math.floor(sum / wp2.threshold) : 1;
      if (q > 0) gifts.push("🎁 " + wp2.gift + " ×" + q);
    }
    var pm2 = di && di.pizzaMonth;
    if (pm2 && pm2.name) {
      var big = list.reduce(function (a, c) {
        return a + ((Number(c.sz) === 35) ? (Number(c.qty) || 1) : 0);
      }, 0);
      if (big >= 2) gifts.push("🎁 " + pm2.name + " — подарок");
    }
    el.innerHTML = gifts.join("<br>");
  }

  /* ── Рендер корзины: точные модификаторы блюд и защита от оверфлоу ── */
  function renderCartBase() {
    var cItems = document.getElementById("cartItems");
    if (!cItems) return;
    var list = typeof cart !== "undefined" && Array.isArray(cart) ? cart : [];
    var allMenu = typeof DMENU !== "undefined" && Array.isArray(DMENU) ? DMENU : [];

    // Топпинги пиццы и допы к роллам берутся ИСКЛЮЧИТЕЛЬНО из cat === 'sauces'
    var pizzaToppings = allMenu.filter(function (p) { return isPizzaTopping(p) && p.on !== 0; });
    var rollAddons = allMenu.filter(function (p) { return isRollAddon(p) && p.on !== 0; });

    cItems.innerHTML = list.map(function (c, i) {
      var optLabel = c.opt ? (typeof c.opt === "object" ? c.opt.name || "" : c.opt) : "";
      
      var origProd = allMenu.find(function (x) { return String(x.id) === String(c.id); });
      var isPizza = origProd ? (origProd.cat === "pizza" || (origProd.opts && origProd.opts.length > 0)) : false;
      var isRollOrSet = origProd ? (origProd.cat === "rolls" || origProd.cat === "sets") : false;

      var modSum = (c.modifiers || []).reduce(function (mA, m) { return mA + (Number(m.price) || 0); }, 0);
      var lineTotal = ((Number(c.price) || 0) + modSum) * (Number(c.qty) || 1);

      // Прикреплённые к блюду допы со значком удаления ✕
      var modsHtml = "";
      if (c.modifiers && c.modifiers.length) {
        modsHtml = '<div class="ci-mods-list">' +
          c.modifiers.map(function (m, mIdx) {
            return '<div class="ci-mod-badge">' +
              '<span>└ ＋ ' + esc(m.name) + ' (' + fmt(m.price) + ')</span>' +
              '<button type="button" class="ci-mod-del" data-del-mod="' + i + '" data-mod-idx="' + mIdx + '" title="Убрать из блюда">✕</button>' +
            '</div>';
          }).join("") +
        '</div>';
      }

      // Блок добавления ингредиентов (раскрывается / сворачивается по клику)
      var addModSection = "";
      var isBlockOpen = !!openModsMap[i];

      if (isPizza && pizzaToppings.length) {
        var toggleLabel = isBlockOpen ? "− Скрыть добавки" : "＋ Добавить ингредиенты в эту пиццу";
        addModSection =
          '<div class="ci-add-mod-box">' +
            '<button type="button" class="ci-toggle-mods-btn" data-toggle-mods="' + i + '">' + toggleLabel + '</button>' +
            (isBlockOpen ? (
              '<div class="ci-mod-chips-wrap">' +
                '<div class="ci-mod-chips-scroll">' +
                  pizzaToppings.map(function (top) {
                    var isSelected = (c.modifiers || []).some(function (m) { return String(m.id) === String(top.id); });
                    return '<button type="button" class="ci-mod-chip' + (isSelected ? " selected" : "") + '" data-toggle-mod-item="' + i + '" data-mod-id="' + top.id + '">' +
                      (isSelected ? "✓ " : "＋ ") + esc(top.name) + " · " + fmt(top.price) +
                    '</button>';
                  }).join("") +
                '</div>' +
              '</div>'
            ) : '') +
          '</div>';
      } else if (isRollOrSet && rollAddons.length) {
        var toggleRollLabel = isBlockOpen ? "− Скрыть добавки" : "＋ Добавить к этим роллам";
        addModSection =
          '<div class="ci-add-mod-box">' +
            '<button type="button" class="ci-toggle-mods-btn" data-toggle-mods="' + i + '">' + toggleRollLabel + '</button>' +
            (isBlockOpen ? (
              '<div class="ci-mod-chips-wrap">' +
                '<div class="ci-mod-chips-scroll">' +
                  rollAddons.map(function (ra) {
                    var isSelected = (c.modifiers || []).some(function (m) { return String(m.id) === String(ra.id); });
                    return '<button type="button" class="ci-mod-chip' + (isSelected ? " selected" : "") + '" data-toggle-mod-item="' + i + '" data-mod-id="' + ra.id + '">' +
                      (isSelected ? "✓ " : "＋ ") + esc(ra.name) + " · " + fmt(ra.price) +
                    '</button>';
                  }).join("") +
                '</div>' +
              '</div>'
            ) : '') +
          '</div>';
      }

      return '<div class="cartItem" data-cart-idx="' + i + '">' +
        '<div class="ci-main-row">' +
          '<div class="ci-left">' +
            '<b class="ci-name">' + esc(c.name) + '</b>' +
            (optLabel ? '<div class="ci-opt">' + esc(optLabel) + '</div>' : '') +
            '<div class="ci-price">' + fmt(lineTotal) + '</div>' +
          '</div>' +
          '<div class="qty">' +
            '<button type="button" data-ci="' + i + '" data-act="-">−</button>' +
            '<span>' + c.qty + '</span>' +
            '<button type="button" data-ci="' + i + '" data-act="+">+</button>' +
          '</div>' +
        '</div>' +
        modsHtml +
        addModSection +
      '</div>';
    }).join("") ||
      '<div class="empty-state">' +
        '<div class="empty-state-icon">🍕</div>' +
        '<div class="empty-state-title">Корзина пуста</div>' +
        '<div class="empty-state-sub">Добавьте пиццу, роллы или напитки из меню</div>' +
        '<button type="button" class="empty-state-btn" data-goto-menu>Перейти в меню</button>' +
      '</div>';

    var pmNotice = document.getElementById("preorderNotice");
    var isOffHours = !isServiceOpen();
    if (isOffHours && checkIsDelivery()) {
      if (!pmNotice) {
        pmNotice = document.createElement("div");
        pmNotice.id = "preorderNotice";
        pmNotice.className = "cart-preorder-notice";
        cItems.parentNode.insertBefore(pmNotice, cItems);
      }
      var pmMode = typeof window.preorderMode === "function" ? window.preorderMode() : "today";
      pmNotice.innerHTML = pmMode === "tomorrow"
        ? "🌙 <b>Кухня сейчас отдыхает.</b> Принимаем предзаказы на завтра — выберите удобный интервал ниже!"
        : "☀ <b>Откроемся в 11:00.</b> Оформите предзаказ, и мы привезём его точно ко времени!";
      pmNotice.style.display = "";
    } else if (pmNotice) {
      pmNotice.style.display = "none";
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

          localStorage.setItem("zt_cart", JSON.stringify(cart));
          window.updateCartFab();
          renderCartBase();
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
          localStorage.setItem("zt_cart", JSON.stringify(cart));
          window.updateCartFab();
          renderCartBase();
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

        localStorage.setItem("zt_cart", JSON.stringify(cart));
        window.updateCartFab();
        renderCartBase();
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

        localStorage.setItem("zt_cart", JSON.stringify(cart));
        window.updateCartFab();
        renderCartBase();
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
  var checkBtn = document.getElementById("checkoutBtn");
  if (checkBtn) {
    checkBtn.onclick = async function () {
      if (!me) {
        toast("Сначала войдите по номеру", "👤");
        if (typeof openAuth === "function") openAuth();
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
              flagField(streetEl);
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
        }),
      };
      if (cartPromoCode) body.promo = cartPromoCode;

      try {
        var r = await api("/orders", { method: "POST", body: body });
        toast("Заказ #" + r.order.no + " оформлен!", "🎉");

        try {
          var preorderSlot = document.getElementById("checkoutSlot") ? document.getElementById("checkoutSlot").value : "";
          if (preorderSlot && preorderSlot !== "asap" && window.PreorderTimer && typeof window.PreorderTimer.updateAll === "function") {
            setTimeout(window.PreorderTimer.updateAll, 500);
          }
        } catch (e) { }

        try {
          var cpEl2 = document.getElementById("checkoutPlace");
          var csEl2 = document.getElementById("checkoutStreet");
          var chEl2 = document.getElementById("checkoutHouse");
          var addrToSave = {
            place: cpEl2 ? cpEl2.value : "",
            street: csEl2 ? csEl2.value : "",
            house: chEl2 ? chEl2.value : ""
          };
          if (addrToSave.place || addrToSave.street) {
            var addrList = [];
            try { addrList = JSON.parse(localStorage.getItem("zt_saved_addresses") || "[]"); } catch (e) { }
            if (!Array.isArray(addrList)) addrList = [];
            addrList = addrList.filter(function (a) {
              return !(a.place === addrToSave.place && a.street === addrToSave.street && a.house === addrToSave.house);
            });
            addrList.unshift(addrToSave);
            addrList = addrList.slice(0, 3);
            localStorage.setItem("zt_saved_addresses", JSON.stringify(addrList));
            localStorage.setItem("zt_saved_address", JSON.stringify(addrToSave));
          }
        } catch (e) { }

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

        var cp = document.getElementById("cartPanel");
        if (cp) cp.classList.remove("open");
        if (typeof syncOverlay === "function") syncOverlay();
        if (typeof loadMyOrders === "function") loadMyOrders();
      } catch (e) {
        toast(e.message, "⚠️");
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

  /* ── Стили Слоя 3: фиксация оверфлоу, drag-курсор и чипсы-переключатели ── */
  (function () {
    var existing = document.getElementById("cartCoreStyles");
    if (existing) existing.remove();

    var s = document.createElement("style");
    s.id = "cartCoreStyles";
    s.textContent =
      /* Защита от flex-оверфлоу: cartItem никогда не растягивает панель */
      ".cartItem{display:flex;flex-direction:column;gap:6px;padding:12px 0;border-bottom:1.5px dashed rgba(58,42,28,0.18);width:100%;max-width:100%;min-width:0;box-sizing:border-box;overflow:hidden;}" +
      ".ci-main-row{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;min-width:0;box-sizing:border-box;}" +
      ".ci-left{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;}" +
      ".ci-name{font-size:14.5px;font-weight:700;line-height:1.25;color:var(--ink,#101418);}" +
      ".ci-opt{font-size:11.5px;color:var(--soft,#586470);font-weight:500;}" +
      ".ci-price{font-size:14px;font-weight:800;color:var(--flame,#C03B2A);margin-top:2px;font-variant-numeric:tabular-nums;}" +
      /* Прикреплённые к блюду добавки */
      ".ci-mods-list{display:flex;flex-direction:column;gap:4px;padding-left:10px;margin-top:2px;border-left:2px solid var(--fr-tan,#C99E6E);width:100%;box-sizing:border-box;}" +
      ".ci-mod-badge{display:inline-flex;align-items:center;justify-content:space-between;background:rgba(201,158,110,0.14);border-radius:6px;padding:3px 8px;font-size:11.5px;font-weight:600;color:var(--fr-choc,#3A2A1C);box-sizing:border-box;}" +
      ".ci-mod-del{background:none;border:none;color:var(--soft,#586470);font-size:13px;padding:0 4px;cursor:pointer;line-height:1;}" +
      ".ci-mod-del:hover{color:var(--status-danger,#B3372B);}" +
      /* Кнопка открытия/закрытия списка добавок под блюдом */
      ".ci-add-mod-box{width:100%;max-width:100%;min-width:0;box-sizing:border-box;margin-top:4px;}" +
      ".ci-toggle-mods-btn{background:none;border:none;padding:2px 0;font-size:11.5px;font-weight:700;color:var(--flame,#C03B2A);cursor:pointer;display:inline-block;text-align:left;}" +
      ".ci-toggle-mods-btn:hover{text-decoration:underline;}" +
      /* Лента чипсов добавок без оверфлоу */
      ".ci-mod-chips-wrap{width:100%;max-width:100%;min-width:0;overflow:hidden;box-sizing:border-box;margin-top:4px;}" +
      ".ci-mod-chips-scroll{display:flex;gap:6px;overflow-x:auto;overflow-y:hidden;width:100%;max-width:100%;box-sizing:border-box;padding:4px 2px 6px;scrollbar-width:none;-webkit-overflow-scrolling:touch;cursor:grab;}" +
      ".ci-mod-chips-scroll::-webkit-scrollbar{display:none;}" +
      ".ci-mod-chip{flex:0 0 auto;background:#fff;border:1.5px solid var(--fr-tan,#C99E6E);border-radius:999px;padding:4px 10px;font-size:11.5px;font-weight:600;color:var(--fr-choc,#3A2A1C);cursor:pointer;white-space:nowrap;transition:all .15s ease;box-sizing:border-box;}" +
      ".ci-mod-chip:hover{background:var(--fr-rice,#EFE6D8);}" +
      /* Активный чипс (уже добавлен в эту пиццу/ролл) */
      ".ci-mod-chip.selected{background:var(--flame,#C03B2A);color:#fff;border-color:var(--fr-choc,#3A2A1C);font-weight:700;box-shadow:1.5px 1.5px 0 var(--fr-choc,#3A2A1C);}" +
      /* Верхняя карусель «Рекомендуем к заказу» */
      ".cart-addons-wrap{margin:8px 0 14px;padding:10px;background:rgba(201,158,110,0.12);border-radius:14px;border:1.5px solid rgba(201,158,110,0.25);width:100%;box-sizing:border-box;overflow:hidden;}" +
      ".cart-addons-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;}" +
      ".ca-title{font-size:10.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--fr-choc,#3A2A1C);white-space:nowrap;}" +
      ".ca-tabs-scroll{display:flex;gap:4px;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;cursor:grab;}" +
      ".ca-tabs-scroll::-webkit-scrollbar{display:none;}" +
      ".addon-tab-btn{border:1px solid var(--line,#D8DFE4);background:#fff;color:var(--ink,#101418);border-radius:999px;padding:3px 9px;font-size:10.5px;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0;}" +
      ".addon-tab-btn.on{background:var(--flame,#C03B2A);border-color:var(--fr-choc,#3A2A1C);color:#fff;}" +
      ".ca-cards-scroll{display:flex;gap:8px;overflow-x:auto;padding:2px 2px 4px;-webkit-overflow-scrolling:touch;scrollbar-width:none;cursor:grab;}" +
      ".ca-cards-scroll::-webkit-scrollbar{display:none;}" +
      ".addon-pill-card{flex:0 0 185px;width:185px;height:54px;background:#fff;border:1.5px solid var(--line,#D8DFE4);border-radius:12px;padding:5px 8px;box-sizing:border-box;display:flex;align-items:center;gap:7px;}" +
      ".addon-pill-card.in-cart{border-color:var(--flame,#C03B2A);background:rgba(192,59,42,0.03);}" +
      ".ac-media{width:42px;height:42px;flex:0 0 42px;border-radius:8px;overflow:hidden;background:#F9F6F0;display:grid;place-items:center;}" +
      ".ac-img{width:100%;height:100%;object-fit:cover;display:block;}" +
      ".ac-emoji{font-size:24px;line-height:1;}" +
      ".ac-info{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:2px;}" +
      ".ac-name{font-size:11px;font-weight:700;color:var(--ink,#101418);line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}" +
      ".ac-price{font-size:12px;font-weight:800;color:var(--flame,#C03B2A);}" +
      ".ac-act{flex:0 0 auto;}" +
      ".ac-add-btn{width:28px;height:28px;border-radius:8px;background:var(--panel,#F3F8FC);border:1px solid var(--line,#D8DFE4);color:var(--ink,#101418);font-size:15px;font-weight:800;display:grid;place-items:center;cursor:pointer;}" +
      ".ac-add-btn:hover{background:var(--flame,#C03B2A);border-color:var(--fr-choc,#3A2A1C);color:#fff;}" +
      ".ac-stepper{display:flex;align-items:center;justify-content:space-between;height:28px;border-radius:8px;background:var(--flame,#C03B2A);border:1px solid var(--fr-choc,#3A2A1C);color:#fff;padding:0 3px;gap:2px;}" +
      ".ac-step{border:none;background:none;color:#fff;font-size:14px;font-weight:800;cursor:pointer;padding:0 3px;line-height:1;}" +
      ".ac-qty{font-size:11px;font-weight:800;min-width:14px;text-align:center;}" +
      /* Плашки предзаказа и подарка */
      ".cart-promo-badge{background:#F4EFE6;padding:8px 12px;border-radius:10px;margin:8px 0 12px;border:1.5px dashed var(--flame,#C03B2A);}" +
      ".cpb-top{display:flex;justify-content:space-between;font-size:11.5px;font-weight:600;margin-bottom:5px;color:var(--ink,#101418);}" +
      ".cpb-top b.done{color:var(--green,#186A43);}" +
      ".cpb-bar{height:5px;background:#E0D9CD;border-radius:3px;overflow:hidden;}" +
      ".cpb-fill{height:100%;background:var(--flame,#C03B2A);transition:width .3s ease;}" +
      ".cpb-fill.done{background:var(--green,#186A43);}" +
      ".cart-preorder-notice{background:#FFF6E5;border:1.5px dashed #F2D9A5;border-radius:10px;padding:8px 12px;margin:8px 0;font-size:12px;color:#6B4E0E;font-weight:600;line-height:1.35;}";
    document.head.appendChild(s);
  })();

})();