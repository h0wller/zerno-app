/* public/app/cart.js — Корзина доставки, умные модификаторы блюд и чекаут */
import { getNextLunchPromoBoundaryDelay } from "./core/lunch-promo-time.js";

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

  function getCartSubtotal(list) {
    return list.reduce(function (total, item) {
      var itemPrice = Number(item.price) || 0;
      var modifiersPrice = (item.modifiers || []).reduce(function (sum, modifier) {
        return sum + (Number(modifier.price) || 0);
      }, 0);
      return total + (itemPrice + modifiersPrice) * (Number(item.qty) || 1);
    }, 0);
  }

  function getDeliveryPlace() {
    var placeEl = document.getElementById("checkoutPlace");
    return (placeEl && placeEl.value) ? placeEl.value.trim() : "";
  }

  function getDefaultDeliveryRates(normalizedPlace) {
    var isFarZone = /синявино|покровское/i.test(normalizedPlace);
    var isOuterZone = /куликово|яблоновка/i.test(normalizedPlace);
    return { fee: isFarZone ? 250 : (isOuterZone ? 300 : 200) };
  }

  function getDeliveryZoneRates(placeVal) {
    var baseZoneFee = 0;
    var normalizedPlace = String(placeVal || "").toLowerCase().trim();
    if (!normalizedPlace) return { baseZoneFee: 0 };

    if (typeof deliveryInfo !== "undefined" && deliveryInfo && deliveryInfo.zones) {
      var zone = deliveryInfo.zones.find(function (entry) {
        return entry.places && entry.places.includes(placeVal);
      });
      if (zone) baseZoneFee = Number(zone.fee) || 0;
    }

    if (window.AddressModule && typeof window.AddressModule.getFee === "function") {
      var addressFee = Number(window.AddressModule.getFee(placeVal));
      if (addressFee > 0) baseZoneFee = addressFee;
    }

    var defaults = getDefaultDeliveryRates(normalizedPlace);
    if (!baseZoneFee) baseZoneFee = defaults.fee;

    return { baseZoneFee: baseZoneFee };
  }

  function getLunchPromoTimeParts() {
    var slotEl = document.getElementById("checkoutSlot");
    var slotVal = slotEl ? slotEl.value : "asap";
    if (!slotVal) return null;

    if (slotVal !== "asap") {
      var match = slotVal.match(/^(\d{2})\.(\d{2})\s*\|\s*(\d{2}):(\d{2})/);
      if (!match) return null;
      var day = match[1], month = match[2];
      var now = new Date(Date.now() + 2 * 60 * 60 * 1000);
      var year = now.getUTCFullYear();
      var targetDate = Date.UTC(year, Number(month) - 1, Number(day));
      var todayDate = Date.UTC(year, now.getUTCMonth(), now.getUTCDate());
      if (targetDate < todayDate) targetDate = Date.UTC(year + 1, Number(month) - 1, Number(day));
      var selectedWeekday = new Date(targetDate).getUTCDay();
      return {
        dayOfWeek: selectedWeekday,
        hour: Number(match[3]),
        minute: Number(match[4]),
      };
    }

    var kaliningradNow = new Date(Date.now() + 2 * 60 * 60 * 1000);
    var clock = typeof window.getKaliningradTime === "function"
      ? window.getKaliningradTime()
      : { hour: kaliningradNow.getUTCHours(), minute: kaliningradNow.getUTCMinutes() };
    return {
      dayOfWeek: kaliningradNow.getUTCDay(),
      hour: Number(clock.hour),
      minute: Number(clock.minute),
    };
  }

  function isLunchPromoActive() {
    var time = getLunchPromoTimeParts();
    if (!time || time.dayOfWeek < 1 || time.dayOfWeek > 5) return false;
    var minuteOfDay = time.hour * 60 + time.minute;
    return minuteOfDay >= 11 * 60 && minuteOfDay < 15 * 60;
  }

  function scheduleLunchPromoRefresh() {
    var delay = getNextLunchPromoBoundaryDelay(new Date());
    window.setTimeout(function () {
      var slotEl = document.getElementById("checkoutSlot");
      if (!slotEl || slotEl.value === "asap") {
        paintTotals();
        refreshPromoLine(totalsNow().sum);
      }
      scheduleLunchPromoRefresh();
    }, delay + 100);
  }

  function getDeliveryPricing(list, method, placeVal) {
    if (method !== "delivery") {
      return { fee: 0, baseZoneFee: 0, awaitingPlace: false };
    }
    if (!placeVal) {
      return { fee: 0, baseZoneFee: 0, awaitingPlace: list.length > 0 };
    }

    var rates = getDeliveryZoneRates(placeVal);
    var fee = 0;
    if (list.length) {
      // Доставка платная всегда, кроме персонального промокода «первая доставка бесплатно».
      fee = (promoInfo && promoInfo.kind === "freeship") ? 0 : rates.baseZoneFee;
    }

    return {
      fee: fee,
      baseZoneFee: rates.baseZoneFee,
      awaitingPlace: false,
    };
  }

  function totalsNow() {
    var list = typeof cart !== "undefined" && Array.isArray(cart) ? cart : [];
    var sum = getCartSubtotal(list);
    var methodEl = document.getElementById("checkoutMethod");
    var method = methodEl ? methodEl.value : "delivery";
    var isStaffUser = !!(typeof window.me !== "undefined" && window.me &&
      ["admin", "cashier", "dispatch"].includes(window.me.role));
    var lunchPromo = isLunchPromoActive();
    var pickup = lunchPromo
      ? Math.round(sum * (isStaffUser ? 0.3 : 0.2))
      : ((method === "pickup" || isStaffUser) ? Math.round(sum * 0.1) : 0);
    var discLabel = lunchPromo
      ? (isStaffUser ? "20% обеденная акция + 10% для своих" : "20% обеденная акция")
      : (method === "pickup" ? "−10% самовывоз" : (isStaffUser ? "−10% для своих" : ""));
    var placeVal = getDeliveryPlace();
    var deliveryPricing = getDeliveryPricing(list, method, placeVal);
    var pd = !lunchPromo && promoInfo ? promoDisc(sum, promoInfo) : 0;
    var personalFreeShip = !!(
      promoInfo && promoInfo.kind === "freeship" && freeAutoCode &&
      String(promoInfo.code || "").toUpperCase() === String(freeAutoCode).toUpperCase()
    );

    return {
      sum: sum,
      pickup: pickup,
      discLabel: discLabel,
      method: method,
      isStaffUser: isStaffUser,
      fee: deliveryPricing.fee,
      baseZoneFee: deliveryPricing.baseZoneFee,
      freeShip: !!(promoInfo && promoInfo.kind === "freeship" && method === "delivery"),
      personalFreeShip: personalFreeShip,
      lunchPromo: lunchPromo,
      placeVal: placeVal,
      pd: pd,
      awaitingPlace: !!deliveryPricing.awaitingPlace,
      total: Math.max(0, sum - pickup - pd + deliveryPricing.fee),
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

    var subtotalEl = document.getElementById("cartSubtotal");
    if (subtotalEl) {
      subtotalEl.innerHTML =
        '<span class="csl-main"><span>Товары и добавки</span><strong>' + fmt(t.sum) + '</strong></span>';
      subtotalEl.style.display = list.length ? "block" : "none";
    }

    var promoDiscountEl = document.getElementById("cartPromoDiscount");
    if (promoDiscountEl) {
      if (t.pd > 0) {
        var promoCodeLabel = (promoInfo && promoInfo.code) || cartPromoCode || "Промокод";
        var promoReason = promoInfo && promoInfo.kind === "percent"
          ? "Скидка " + Number(promoInfo.value || 0) + "% по промокоду " + esc(promoCodeLabel)
          : "Фиксированная скидка по промокоду " + esc(promoCodeLabel);
        promoDiscountEl.innerHTML =
          '<span class="csl-main"><span>Промокод · ' + esc(promoCodeLabel) + '</span><strong>−' + fmt(t.pd) + '</strong></span>' +
          '<small class="csl-explain">' + promoReason + '</small>';
        promoDiscountEl.style.display = "block";
      } else {
        promoDiscountEl.innerHTML = "";
        promoDiscountEl.style.display = "none";
      }
    }

    var discEl = document.getElementById("cartDiscount");
    if (discEl) {
      if (t.pickup > 0) {
        var discountTitle = t.lunchPromo
          ? (t.isStaffUser
            ? "Обеденная акция · 20% + «Для своих» · 10%"
            : "Обеденная акция · 20%")
          : (t.method === "pickup" ? "Самовывоз · 10%" : "Для своих · 10%");
        var discountReason = t.lunchPromo
          ? (t.isStaffUser
            ? "Скидки суммируются от суммы блюд · будни, 11:00–15:00"
            : "Будни, 11:00–15:00 · по времени доставки или самовывоза")
          : (t.method === "pickup"
            ? "Скидка за получение заказа самовывозом."
            : "Скидка для сотрудника.");
        discEl.innerHTML =
          '<span class="csl-main"><span>' + discountTitle + '</span><strong>−' + fmt(t.pickup) + '</strong></span>' +
          '<small class="csl-explain">' + discountReason + '</small>';
        discEl.style.display = "block";
      } else {
        discEl.innerHTML = "";
        discEl.style.display = "none";
      }
    }

    var feeEl = document.getElementById("cartFee");
    if (feeEl) {
      feeEl.classList.toggle("is-free", !!(list.length && t.method === "delivery" && (t.personalFreeShip || t.freeShip)));
      if (list.length && t.method === "delivery" && t.awaitingPlace) {
        var pendingDeliveryReason = t.personalFreeShip || t.freeShip
          ? "Бесплатная доставка уже применена. Выберите населённый пункт, чтобы увидеть размер экономии."
          : "Выберите населённый пункт — покажем точную стоимость доставки.";
        feeEl.innerHTML =
          '<span class="csl-main"><span>Доставка</span><strong>' + (t.personalFreeShip || t.freeShip ? "Бесплатно" : "Уточняется") + '</strong></span>' +
          '<small class="csl-explain">' + pendingDeliveryReason + '</small>';
        feeEl.style.display = "block";
      } else if (list.length && t.method === "delivery") {
        var feeTitle = t.fee > 0 ? fmt(t.fee) : "Бесплатно";
        var feeReason = t.personalFreeShip
          ? "Бонус за регистрацию · экономия " + fmt(t.baseZoneFee)
          : (t.freeShip ? "Промокод на бесплатную доставку · экономия " + fmt(t.baseZoneFee) : "");
        feeEl.innerHTML =
          '<span class="csl-main"><span>Доставка · ' + esc(t.placeVal) + '</span><strong>' + feeTitle + '</strong></span>' +
          (feeReason ? '<small class="csl-explain">' + feeReason + '</small>' : '');
        feeEl.style.display = "block";
      } else {
        feeEl.innerHTML = "";
        feeEl.style.display = "none";
      }
    }

    var totalLabelEl = document.getElementById("cartTotalLabel");
    if (totalLabelEl) {
      totalLabelEl.textContent = t.awaitingPlace && list.length && !t.freeShip && !t.personalFreeShip
        ? "Сумма без доставки"
        : "Итого к оплате";
    }

    syncZoneFeeHint(t);
    syncCheckoutGuestAutofill();

    var checkBtnEl = document.getElementById("checkoutBtn");
    if (checkBtnEl && checkBtnEl.getAttribute("data-busy") !== "1") {
      checkBtnEl.disabled = false;
      checkBtnEl.textContent = "Оформить заказ";
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

  /* Персональный одноразовый код первой доставки: загружаем один раз на аккаунт и применяем автоматически. */
  var freeAutoFor = "";
  var freeAutoCode = null;
  var freeAutoAttempted = false;
  var freeAutoSuppressedFor = "";

  async function getPersonalFreeCode() {
    var u = typeof window.me !== "undefined" ? window.me : null;
    if (!u || !u.id) return "";
    if (freeAutoFor !== u.id) {
      freeAutoFor = u.id;
      freeAutoCode = null;
      freeAutoAttempted = false;
      freeAutoSuppressedFor = "";
    }
    if (freeAutoCode === null) {
      try {
        var r = await api("/me/free-delivery");
        freeAutoCode = (r && r.code) || "";
      } catch (e) {
        freeAutoCode = "";
      }
    }
    return freeAutoCode;
  }

  async function tryAutoFreeCode() {
    var u = typeof window.me !== "undefined" ? window.me : null;
    if (!u || !u.id || (freeAutoFor === u.id && freeAutoAttempted)) return "";
    freeAutoFor = u.id;
    freeAutoAttempted = true;
    if (freeAutoSuppressedFor === u.id) return "";
    return getPersonalFreeCode();
  }

  function suppressPersonalFreeCode() {
    var u = typeof window.me !== "undefined" ? window.me : null;
    if (u && u.id && freeAutoCode && cartPromoCode === freeAutoCode) {
      freeAutoSuppressedFor = u.id;
    }
  }

/* ── PROMO-CLEAR v2: кнопка сброса промокода ── */
var PROMO_CLEAR_BTN = '<button type="button" class="promo-clear-btn" title="Убрать промокод" aria-label="Убрать промокод" style="margin-left:8px;padding:0 4px;background:none;border:none;cursor:pointer;font-size:15px;line-height:1;color:#B3372B;">✕</button>';

function bindPromoClear(line) {
  var btn = line.querySelector('.promo-clear-btn');
  if (!btn) return;
  btn.onclick = function () {
    suppressPersonalFreeCode();
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

  var lunchPromo = isLunchPromoActive();
  var user = typeof window.me !== "undefined" ? window.me : null;
  var personalCode = "";
  if (lunchPromo) {
    personalCode = await getPersonalFreeCode();
    var canUsePersonalCode = !!(personalCode && user && freeAutoSuppressedFor !== user.id);
    if (canUsePersonalCode) {
      if (cartPromoCode !== personalCode) promoInfo = null;
      cartPromoCode = personalCode;
      var promoInputDuringLunch = document.getElementById('cartPromo');
      if (promoInputDuringLunch) promoInputDuringLunch.value = personalCode;
    } else {
      promoInfo = null;
      if (cartPromoCode) {
        cartPromoCode = '';
        localStorage.removeItem('zt_cartpromo');
        var blockedPromoInput = document.getElementById('cartPromo');
        if (blockedPromoInput) blockedPromoInput.value = '';
        line.innerHTML = '<span>Обеденная акция: обычные промокоды отключены. Бонус бесплатной доставки за регистрацию остаётся доступен.</span>';
        line.style.color = '#B3372B';
        paintTotals();
        return;
      }
    }
  } else if (!cartPromoCode) {
    var autoCode = await tryAutoFreeCode();
    if (autoCode) {
      cartPromoCode = autoCode;
      personalCode = autoCode;
    }
  } else if (user && user.id) {
    personalCode = await getPersonalFreeCode();
  }

  if (!cartPromoCode) {
    promoInfo = null;
    line.innerHTML = '';
    paintTotals();
    return;
  }

  try {
    var r = await fetch(API_BASE + '/api/promo/info?code=' + encodeURIComponent(cartPromoCode)).then(function (x) { return x.json(); });
    if (r.ok && (!lunchPromo || (r.kind === 'freeship' && r.code === personalCode))) {
      promoInfo = r;
      localStorage.setItem('zt_cartpromo', cartPromoCode);
      var isPersonalRegistrationCode = r.kind === 'freeship' && personalCode &&
        String(r.code || '').toUpperCase() === String(personalCode).toUpperCase();
      var appliedMessage = isPersonalRegistrationCode
        ? '✓ Бонус за регистрацию применён · первая доставка бесплатно'
        : (r.kind === 'freeship'
          ? '🎟 ' + esc(r.code) + ' · бесплатная доставка'
          : '🎟 Промокод ' + esc(r.code) + ' применён · −' + fmt(promoDisc(sum, r)));
      line.innerHTML = '<span>' + appliedMessage + '</span>' + PROMO_CLEAR_BTN;
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
  suppressPersonalFreeCode();
  cartPromoCode = '';
  promoInfo = null;
  localStorage.removeItem('zt_cartpromo');
  var line = document.getElementById('cartPromoLine');
  if (line) line.innerHTML = '';
  var inp = document.getElementById('cartPromo');
  if (inp) inp.value = '';
  paintTotals();
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
    if (info.awaitingPlace) {
      hint.innerHTML = "📍 <span>Выберите населённый пункт — покажем точную стоимость доставки</span>";
    } else if (info.freeShip) {
      hint.innerHTML = "✅ <span><b>" + esc(info.placeVal) + ":</b> доставка бесплатно (бонус за регистрацию)</span>";
    } else {
      hint.innerHTML = "🚗 <span><b>" + esc(info.placeVal) + ":</b> доставка " + fmt(info.baseZoneFee) +
        "</span>";
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

  function ensurePlaceOptions() {
    var placeEl = document.getElementById("checkoutPlace");
    if (!placeEl || placeEl.tagName !== "SELECT") return;
    var previous = placeEl.value;
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
    if (!Array.from(placeEl.options).some(function (option) { return option.value === ""; })) {
      var placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "Выберите населённый пункт";
      placeholder.disabled = true;
      placeEl.insertBefore(placeholder, placeEl.firstChild);
    }
    var hasPrevious = previous && Array.from(placeEl.options).some(function (option) {
      return option.value === previous;
    });
    placeEl.value = hasPrevious ? previous : "";
  }

  function toggleDeliveryGroup() {
    var method = (document.getElementById("checkoutMethod") || {}).value || "delivery";
    var isPickup = method === "pickup";
    var grp = document.getElementById("checkoutDeliveryGroup");
    if (grp) grp.hidden = isPickup;
    ensurePlaceOptions();
    window.CheckoutValidation.ensureTimeModeToggle();
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

      // Восстановление сохранённого адреса принадлежит address-autocomplete.js; здесь читаем только черновик чекаута.
      var placeVal = draft.place || "";
      var streetVal = draft.street || "";
      var houseVal = draft.house || "";

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
    if (isLunchPromoActive()) {
      el.innerHTML = "";
      return;
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

    var baseUnitPrice = Number(c.price) || 0;
    var modSum = (c.modifiers || []).reduce(function (mA, m) { return mA + (Number(m.price) || 0); }, 0);
    var unitTotal = baseUnitPrice + modSum;
    var lineTotal = unitTotal * (Number(c.qty) || 1);
    var priceUpdateNote = Number(c.priceUpdateFrom) > 0
      ? '<small class="ci-price-update">Цена обновлена по актуальному меню: ' + fmt(c.priceUpdateFrom) + ' → ' + fmt(baseUnitPrice) + '</small>'
      : '';

    var modsHtml = renderAttachedModifiers(c.modifiers, itemIndex);
    var addModSection = renderItemAddModSection(c, itemIndex, origProd, pizzaToppings, rollAddons, !!openModsMap[itemIndex]);

    return '<div class="cartItem" data-cart-idx="' + itemIndex + '">' +
      '<div class="ci-main-row">' +
        '<div class="ci-left">' +
          '<b class="ci-name">' + esc(c.name) + '</b>' +
          (optLabel ? '<div class="ci-opt">' + esc(optLabel) + '</div>' : '') +
          '<div class="ci-price">' +
            '<span class="ci-unit-price">' + fmt(unitTotal) + ' / шт.</span>' +
            '<strong class="ci-line-total">' + fmt(lineTotal) + '</strong>' +
          '</div>' +
          priceUpdateNote +
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
  function handleCartCloseClick(e, panel) {
    if (!e.target.closest("#cartTopClose") && !e.target.closest("#cartClose")) return false;
    e.preventDefault();
    panel.classList.remove("open");
    if (typeof syncOverlay === "function") syncOverlay();
    if (window.TgUx) window.TgUx.sync();
    return true;
  }

  function handleCartAddonTabClick(e) {
    var tabBtn = e.target.closest("[data-atab]");
    if (!tabBtn) return false;
    e.preventDefault();
    activeAddonTab = tabBtn.dataset.atab;
    renderAddons();
    return true;
  }

  function handleCartModifiersToggleClick(e) {
    var toggleBtn = e.target.closest("[data-toggle-mods]");
    if (!toggleBtn) return false;
    e.preventDefault();
    var idx = +toggleBtn.dataset.toggleMods;
    openModsMap[idx] = !openModsMap[idx];
    renderCartBase();
    return true;
  }

  function handleCartModifierChipClick(e) {
    var modChip = e.target.closest("[data-toggle-mod-item]");
    if (!modChip || typeof DMENU === "undefined") return false;
    e.preventDefault();

    var targetIdx = +modChip.dataset.toggleModItem;
    var modId = modChip.dataset.modId;
    var cartItem = cart[targetIdx];
    var modProduct = DMENU.find(function (item) { return String(item.id) === String(modId); });

    if (cartItem && modProduct) {
      if (!cartItem.modifiers) cartItem.modifiers = [];
      var existingIndex = cartItem.modifiers.findIndex(function (modifier) {
        return String(modifier.id) === String(modId);
      });

      if (existingIndex > -1) {
        cartItem.modifiers.splice(existingIndex, 1);
      } else {
        cartItem.modifiers.push({
          id: modProduct.id,
          name: modProduct.name,
          price: Number(modProduct.price) || 0,
        });
        if (window.TgUx) window.TgUx.haptic("medium");
      }
      persistCartUpdate();
    }
    return true;
  }

  function handleCartModifierDeleteClick(e) {
    var deleteButton = e.target.closest("[data-del-mod]");
    if (!deleteButton) return false;
    e.preventDefault();

    var cartIndex = +deleteButton.dataset.delMod;
    var modifierIndex = +deleteButton.dataset.modIdx;
    if (cart[cartIndex] && cart[cartIndex].modifiers) {
      cart[cartIndex].modifiers.splice(modifierIndex, 1);
      persistCartUpdate();
    }
    return true;
  }

  function removeCartItemAt(index) {
    cart.splice(index, 1);
    var nextOpenModsMap = {};
    Object.keys(openModsMap).forEach(function (key) {
      var itemIndex = Number(key);
      if (itemIndex < index) nextOpenModsMap[itemIndex] = openModsMap[key];
      else if (itemIndex > index) nextOpenModsMap[itemIndex - 1] = openModsMap[key];
    });
    openModsMap = nextOpenModsMap;
  }

  function handleCartQuantityClick(e) {
    var button = e.target.closest("[data-ci]");
    if (!button) return false;

    var index = +button.dataset.ci;
    var item = cart[index];
    if (!item) {
      renderCartBase();
      return true;
    }

    if (button.dataset.act === "+") item.qty++;
    else if (item.qty > 1) item.qty--;
    else removeCartItemAt(index);
    persistCartUpdate();
    return true;
  }

  function handleCartQuickAddonClick(e) {
    var addonButton = e.target.closest("[data-addon-id]");
    if (!addonButton || typeof DMENU === "undefined") return false;

    var addonId = addonButton.dataset.addonId;
    var product = DMENU.find(function (item) { return String(item.id) === String(addonId); });
    if (!product) return true;

    var inCart = cart.find(function (item) {
      return String(item.id) === String(product.id) && (!item.modifiers || !item.modifiers.length);
    });
    var action = addonButton.dataset.acAct;

    if (action === "minus") {
      if (inCart) {
        if (inCart.qty > 1) inCart.qty--;
        else removeCartItemAt(cart.indexOf(inCart));
      }
    } else if (inCart) {
      inCart.qty++;
      if (window.TgUx) window.TgUx.haptic("medium");
    } else {
      cart.push({
        key: product.id,
        id: product.id,
        oi: -1,
        name: product.name,
        opt: null,
        price: parseInt(product.price, 10) || 0,
        sz: 0,
        qty: 1,
        modifiers: [],
      });
      if (window.TgUx) window.TgUx.haptic("medium");
    }

    persistCartUpdate();
    return true;
  }

  function handleCartPanelClick(e) {
    if (handleCartCloseClick(e, cPanel)) return;
    if (handleCartAddonTabClick(e)) return;
    if (handleCartModifiersToggleClick(e)) return;
    if (handleCartModifierChipClick(e)) return;
    if (handleCartModifierDeleteClick(e)) return;
    if (handleCartQuantityClick(e)) return;
    handleCartQuickAddonClick(e);
  }

  if (cPanel) cPanel.addEventListener("click", handleCartPanelClick);

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
      el.addEventListener("change", function () {
        saveDraft();
        paintTotals();
        if (id === "checkoutSlot") refreshPromoLine(totalsNow().sum);
      });
    }
  });

  function canStartCheckout(checkBtn) {
    if (checkoutInProgress || checkBtn.disabled || checkBtn.getAttribute("data-busy") === "1") return false;
    if (!me) {
      toast("Сначала войдите по номеру", "👤");
      if (typeof openAuth === "function") openAuth();
      return false;
    }
    if (!cart || cart.length === 0) {
      toast("Корзина пуста", "🛒");
      return false;
    }

    return true;
  }

  async function resolveCheckoutInput() {
    var method = (document.getElementById("checkoutMethod") || {}).value || "delivery";
    var addressState = window.CheckoutValidation.resolveAddress(method);
    if (!addressState.ok) {
      if (addressState.field) window.CheckoutValidation.flagField(addressState.field);
      toast(addressState.message, addressState.icon);
      return null;
    }

    var slotState = await window.CheckoutValidation.resolveSlot();
    if (!slotState.ok) {
      if (slotState.field) window.CheckoutValidation.flagField(slotState.field);
      toast(slotState.message, slotState.icon);
      return null;
    }

    return {
      method: method,
      placeV: addressState.placeV,
      streetV: addressState.streetV,
      houseV: addressState.houseV,
      slotVal: slotState.slotVal,
      isPreorder: slotState.isPreorder,
      preorderDate: slotState.preorderDate,
    };
  }

  function buildCheckoutRequest(checkoutInput) {
    var body = {
      method: checkoutInput.method,
      place: checkoutInput.method === "pickup" ? "Самовывоз" : checkoutInput.placeV,
      street: checkoutInput.streetV,
      house: checkoutInput.houseV,
      slot: checkoutInput.slotVal,
      is_preorder: checkoutInput.isPreorder ? 1 : 0,
      preorder_date: checkoutInput.preorderDate,
      pay: (document.getElementById("checkoutPay") || {}).value || "cash",
      comment: ((document.getElementById("checkoutComment") || {}).value || "").trim(),
      items: cart.map(function (item) {
        return {
          id: item.id,
          oi: item.oi,
          qty: item.qty,
          modifiers: item.modifiers || [],
        };
      }),
    };
    if (cartPromoCode && (!isLunchPromoActive() || (promoInfo && promoInfo.kind === 'freeship'))) body.promo = cartPromoCode;

    // Идемпотентный ID: защита от дублей при сетевом сбое.
    body.client_order_id = "ord_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    return body;
  }

  function showCheckoutProgress(checkBtn, label) {
    var originalHtml = checkBtn.innerHTML;
    checkBtn.disabled = true;
    checkBtn.setAttribute("data-busy", "1");
    checkBtn.style.pointerEvents = "none";
    checkBtn.innerHTML = '<span>⏳ ' + (label || "Оформляем заказ...") + '</span>';

    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.MainButton) {
      try { window.Telegram.WebApp.MainButton.showProgress(); } catch (tgErr) {}
    }
    return originalHtml;
  }

  function completeCheckoutSuccess(result, checkoutInput) {
    toast("Заказ #" + (result.order && result.order.no ? result.order.no : "") + " оформлен!", "🎉");

    if (checkoutInput.method !== "pickup" && window.AddressBook && typeof window.AddressBook.autoAdd === "function") {
      try {
        window.AddressBook.autoAdd({
          place: checkoutInput.placeV,
          street: checkoutInput.streetV,
          house: checkoutInput.houseV,
        });
      } catch (eAb) {}
    }

    if (window.TgUx) window.TgUx.success();
    if (typeof cart !== "undefined" && Array.isArray(cart)) cart.length = 0;
    window.cart = [];
    openModsMap = {};
    localStorage.setItem("zt_cart", "[]");
    sessionStorage.removeItem("zt_checkout_draft");
    clearPromo();

    var promoInput = document.getElementById("cartPromo");
    if (promoInput) promoInput.value = "";
    var streetInput = document.getElementById("checkoutStreet");
    if (streetInput) streetInput.value = "";
    var houseInput = document.getElementById("checkoutHouse");
    if (houseInput) houseInput.value = "";
    var commentInput = document.getElementById("checkoutComment");
    if (commentInput) commentInput.value = "";
    var slotInput = document.getElementById("checkoutSlot");
    if (slotInput) slotInput.value = (window.preorderMode && window.preorderMode()) ? "" : "asap";

    document.querySelectorAll('#deliveryGrid .opts input[type="radio"]:checked').forEach(function (radio) {
      radio.checked = false;
    });

    if (typeof syncAddButtons === "function") syncAddButtons();
    if (typeof updateCartFab === "function") updateCartFab();
    renderCartBase();

    var panel = document.getElementById("cartPanel");
    if (panel) panel.classList.remove("open");
    if (typeof loadMyOrders === "function") loadMyOrders({ force: true });
    if (result && result.order) {
      window.openOrderTrackModal(result.order);
    } else if (typeof syncOverlay === "function") {
      syncOverlay();
    }
  }

  function handleCheckoutFailure(error) {
    try {
      var slot = document.getElementById("checkoutSlot");
      var preorderSlot = slot ? slot.value : "";
      if (preorderSlot && preorderSlot !== "asap" &&
          window.PreorderTimer && typeof window.PreorderTimer.updateAll === "function") {
        setTimeout(window.PreorderTimer.updateAll, 500);
      }
    } catch (timerError) {}

    toast(error.message || "Ошибка оформления заказа", "⚠️");
  }

  function restoreCheckoutProgress(checkBtn, originalHtml) {
    checkBtn.disabled = false;
    checkBtn.removeAttribute("data-busy");
    checkBtn.style.pointerEvents = "";
    checkBtn.innerHTML = originalHtml;

    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.MainButton) {
      try { window.Telegram.WebApp.MainButton.hideProgress(); } catch (tgErr) {}
    }
  }

  /* ── Оформление заказа ── */
  var checkoutInProgress = false;
  var checkBtn = document.getElementById("checkoutBtn");
  if (checkBtn) {
    checkBtn.onclick = async function () {
      if (!canStartCheckout(checkBtn)) return;

      // Acquire the lock synchronously, before async address/time validation starts.
      checkoutInProgress = true;
      var originalHtml = showCheckoutProgress(checkBtn, "Проверяем данные...");
      try {
        var checkoutInput = await resolveCheckoutInput();
        if (!checkoutInput) return;

        var body = buildCheckoutRequest(checkoutInput);
        checkBtn.innerHTML = '<span>⏳ Оформляем заказ...</span>';
        var result = await api("/orders", { method: "POST", body: body });
        completeCheckoutSuccess(result, checkoutInput);
      } catch (error) {
        handleCheckoutFailure(error);
      } finally {
        checkoutInProgress = false;
        // Validation failure, API error and success all release the same lock.
        restoreCheckoutProgress(checkBtn, originalHtml);
      }
    };
  }

  restoreDraft();
  scheduleLunchPromoRefresh();

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


})();