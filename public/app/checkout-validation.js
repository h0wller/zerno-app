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
    if (!slotEl || document.getElementById("checkoutTimeModeSeg")) return;
    var labelEl = slotEl.closest("label") || slotEl.parentElement;
    if (!labelEl) return;

    if (typeof window.populateSlots === "function") window.populateSlots();

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

  window.CheckoutValidation = {
    flagField: flagField,
    ensureTimeModeToggle: ensureTimeModeToggle,
    resolveAddress: resolveCheckoutAddress,
    resolveSlot: resolveCheckoutSlot
  };
})();
