/* public/app/checkout-validation.js — адрес и время доставки перед оформлением */
(function () {
  "use strict";

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

function ensureTimeModeToggle() {
    var slotEl = document.getElementById("checkoutSlot");
    if (!slotEl) return;
    var labelEl = slotEl.closest("label") || slotEl.parentElement;
    if (!labelEl) return;

    var seg = document.getElementById("checkoutTimeModeSeg");
    if (!seg) {
      if (typeof window.populateSlots === "function") window.populateSlots();
      seg = document.createElement("div");
      seg.id = "checkoutTimeModeSeg";
      seg.className = "time-mode-seg";
      seg.setAttribute("role", "group");
      seg.setAttribute("aria-label", "Когда получить заказ");
      seg.innerHTML =
        '<button type="button" class="tms-btn" data-tmode="asap">⚡ Как можно скорее</button>' +
        '<button type="button" class="tms-btn" data-tmode="slot">⏰ Ко времени</button>';
      labelEl.parentNode.insertBefore(seg, labelEl);
    }

    function syncTimeMode() {
      var preorderRequiredNow = !!window.deliveryInfo &&
        typeof window.preorderMode === "function" && !!window.preorderMode();
      if (slotEl.value && slotEl.value !== "asap") {
        slotEl.__checkoutTimeMode = "slot";
      } else if (slotEl.value === "asap") {
        slotEl.__checkoutTimeMode = "asap";
      } else if (preorderRequiredNow) {
        slotEl.__checkoutTimeMode = "slot";
      } else if (slotEl.__checkoutTimeMode !== "slot") {
        slotEl.__checkoutTimeMode = "asap";
      }
      slotEl.dataset.checkoutTimeMode = slotEl.__checkoutTimeMode;
      var isScheduled = slotEl.__checkoutTimeMode === "slot";
      seg.querySelectorAll(".tms-btn").forEach(function (button) {
        var isActive = button.dataset.tmode === (isScheduled ? "slot" : "asap");
        button.classList.toggle("on", isActive);
        button.setAttribute("aria-pressed", String(isActive));
      });
      labelEl.hidden = !isScheduled;
    }

    function syncSlotVisibility(modeVal) {
      slotEl.__checkoutTimeMode = modeVal;
      slotEl.dataset.checkoutTimeMode = modeVal;
      if (modeVal === "asap") {
        slotEl.value = "asap";
      } else if (slotEl.value === "asap") {
        // An empty value still represents an explicit scheduled-mode choice.
        slotEl.value = "";
      }
      syncTimeMode();
      slotEl.dispatchEvent(new Event("change", { bubbles: true }));
    }

    if (!slotEl.__timeModeChangeBound) {
      slotEl.addEventListener("change", syncTimeMode);
      slotEl.__timeModeChangeBound = true;
    }
    slotEl.__syncTimeMode = syncTimeMode;
    syncTimeMode();

    if (!seg.__timeModeClickBound) {
      seg.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-tmode]");
        if (!btn) return;
        e.preventDefault();
        syncSlotVisibility(btn.dataset.tmode);
      });
      seg.__timeModeClickBound = true;
    }
  }

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

async function resolveCheckoutSlot() {
    if (typeof window.refreshDeliveryInfo === "function") {
      try {
        await window.refreshDeliveryInfo();
      } catch (error) {
        return {
          ok: false,
          field: document.getElementById("checkoutSlot"),
          message: "Не удалось проверить актуальный график работы. Проверьте соединение и попробуйте снова.",
          icon: "⚠️"
        };
      }
    } else if (typeof window.populateSlots === "function") {
      window.populateSlots();
    }
    var pm = window.deliveryInfo && typeof window.preorderMode === "function"
      ? window.preorderMode()
      : null;
    var slotElCheck = document.getElementById("checkoutSlot");
    var slotVal = (slotElCheck && slotElCheck.value) || "";
    if (pm && slotElCheck) {
      ensureTimeModeToggle();
      slotElCheck.__checkoutTimeMode = "slot";
      if (!slotVal || slotVal === "asap") slotElCheck.value = "";
      slotVal = slotElCheck.value || "";
    }
    var isScheduled = !!slotElCheck && slotElCheck.__checkoutTimeMode === "slot";
    var isPreorder = !!pm || (!!slotVal && slotVal !== "asap");
    if ((pm || isScheduled) && (!slotVal || slotVal === "asap")) {
      ensureTimeModeToggle();
      if (slotElCheck && typeof slotElCheck.__syncTimeMode === "function") slotElCheck.__syncTimeMode();
      return { ok: false, field: slotElCheck, message: "Выберите время доставки для предзаказа ⏰", icon: "⚠️" };
    }

    var preorderDate = "";
    if (slotVal && slotVal !== "asap") {
      var mDate = slotVal.match(/^(\d{2}[.-]\d{2})/);
      if (mDate) preorderDate = mDate[1];
    }

    return { ok: true, slotVal: slotVal, isPreorder: isPreorder, preorderDate: preorderDate };
  }

  window.CheckoutValidation = {
    flagField: flagField,
    ensureTimeModeToggle: ensureTimeModeToggle,
    resolveAddress: resolveCheckoutAddress,
    resolveSlot: resolveCheckoutSlot
  };
})();
