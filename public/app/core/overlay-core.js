/* public/app/core/overlay-core.js — Ф5.7: кластер "overlay-core" из legacy-core.js (вербатим, порядок сохранён). Top-level = global. */
let histPushed = false;

function syncOverlay() {
  const ov = document.getElementById("overlay");
  const panel = document.getElementById("panel");
  const cartPanel = document.getElementById("cartPanel");
  if (!ov) return;

  if (window.TgUx && typeof window.TgUx.updateMainButton === "function") {
    window.TgUx.updateMainButton();
  }

  const on =
    !!document.querySelector(".modal.show") ||
    !!(panel && panel.classList.contains("open")) ||
    !!(cartPanel && cartPanel.classList.contains("open"));

  ov.classList.toggle("show", on);

  const isMiniApp = window.TgUx && typeof window.TgUx.isTg === "function" ? window.TgUx.isTg() : false;

  // Нативная кнопка Telegram — строго внутри Mini App
  try {
    const tg = window.Telegram && window.Telegram.WebApp;
    if (tg && tg.BackButton && isMiniApp) {
      if (on) tg.BackButton.show();
      else tg.BackButton.hide();
    }
  } catch (_) {}

  ov.style.pointerEvents = on ? "auto" : "none";
  ov.setAttribute("aria-hidden", on ? "false" : "true");

  // Манипулируем history только внутри Telegram, чтобы не ломать Safari / PWA
  if (isMiniApp) {
    if (on && !histPushed) {
      histPushed = true;
      try { history.pushState({ zerno: 1 }, ""); } catch (e) {}
    } else if (!on && histPushed) {
      histPushed = false;
      try { history.back(); } catch (e) {}
    }
  }
}

addEventListener("popstate", () => {
  if (!histPushed) return;
  histPushed = false;
  closePanel();
  closeEditor();
  closeAuth();
  closePin();
  closeQRFull();
  closePromo();
  closeDash();
  if (typeof closeStaffChat === "function") closeStaffChat();
  const cartPanel = document.getElementById("cartPanel");
  if (cartPanel) cartPanel.classList.remove("open");
});

$("#overlay").onclick = () => {
  closePanel();
  closeEditor();
  closePin();
  closeSetPin();
  closeQRFull();
  closePromo();
  closeDash();
  const cartPanel = document.getElementById("cartPanel");
  if (cartPanel) cartPanel.classList.remove("open");
  if (onboarded || me) closeAuth();
};

addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closePanel();
    closeEditor();
    closePin();
    closeSetPin();
    closeQRFull();
    closePromo();
    closeDash();
    $("#chatPanel").classList.remove("open");
    const cartPanel = document.getElementById("cartPanel");
    if (cartPanel) cartPanel.classList.remove("open");
    if (onboarded || me) closeAuth();
  }
});

$("#brandSeg").addEventListener("click", (e) => {
  const b = e.target.closest("[data-brand]");
  if (!b) return;
  brand = b.dataset.brand;
  if (mode === "cashier" || mode === "orders") setMode("guest");
  syncBrandViews();
  if (brand === "delivery" && !DMENU.length) loadDelivery();
});

/* ── Ф5.6.2h: ESM-шим (на случай чтения до инъекта overlay.js) ── */
window.syncOverlay = syncOverlay;

/* TG-UX-OBJECT-PATCH v2 */
(function () {
  const getTg = () =>
    (typeof window !== "undefined" &&
      window.Telegram &&
      window.Telegram.WebApp) ||
    null;

  // Строгий детектор Telegram Mini App
  function isTg() {
    if (window.__isTgMiniApp) return true;
    const tg = getTg();
    if (!tg) return false;
    return !!(
      (tg.initData && tg.initData.length > 0) ||
      (tg.initDataUnsafe &&
        (tg.initDataUnsafe.query_id || tg.initDataUnsafe.user)) ||
      (tg.platform && tg.platform !== "unknown") ||
      /tgWebAppData=/.test(location.hash) ||
      new URLSearchParams(location.search).get("src") === "tg"
    );
  }

  // Инъекция стилей скрытия стандартной кнопки корзины и регистрация WebApp
  function ensureTgEnvironment() {
    if (!isTg()) return;
    const tg = getTg();
    if (tg) {
      try {
        if (typeof tg.ready === "function") tg.ready();
        if (typeof tg.expand === "function") tg.expand();
      } catch (_) {}
    }

    // Замените блок инъекции стилей:
if (!document.getElementById("tgUxNativeCss")) {
  const st = document.createElement("style");
  st.id = "tgUxNativeCss";
  st.textContent = `
    html.tg-native-main #checkoutBtn { display: none !important; }
  `;
  document.head.appendChild(st);
}
  }

  // Корректная тактильная отдача: разделение impactOccurred и notificationOccurred
  function haptic(style = "light") {
    if (!isTg()) return;

    try {
      window.__tgEvents = window.__tgEvents || {};
      if (!Array.isArray(window.__tgEvents.hapticCalls))
        window.__tgEvents.hapticCalls = [];
      window.__tgEvents.hapticCalls.push(style);
    } catch (_) {}

    const tg = getTg();
    if (!tg || !tg.HapticFeedback) return;

    try {
      if (style === "success" || style === "error" || style === "warning") {
        tg.HapticFeedback.notificationOccurred(style);
      } else if (style === "selection") {
        tg.HapticFeedback.selectionChanged();
      } else {
        const allowed = ["light", "medium", "heavy", "rigid", "soft"];
        tg.HapticFeedback.impactOccurred(
          allowed.includes(style) ? style : "light"
        );
      }
    } catch (_) {}
  }

  // Расчет актуального состояния корзины
  function getCartSummary() {
    const list =
      typeof window.cart !== "undefined" && Array.isArray(window.cart)
        ? window.cart
        : [];
    const count = list.reduce((acc, c) => acc + (Number(c.qty) || 1), 0);

    let total = 0;
    if (typeof window.totalsNow === "function") {
      try {
        const t = window.totalsNow();
        if (t && Number(t.total) > 0) total = Number(t.total);
      } catch (_) {}
    }
    if (!total) {
      const el = document.getElementById("cartTotal");
      if (el) {
        total = Number(String(el.textContent || "").replace(/\D/g, "")) || 0;
      }
    }
    if (!total) {
      total = list.reduce(
        (acc, c) => acc + (Number(c.price) || 0) * (Number(c.qty) || 1),
        0
      );
    }
    return { count, total };
  }

  // Обновление состояния кнопки MainButton
  function updateMainButton() {
    if (!isTg()) {
      document.documentElement.classList.remove("tg-native-main");
      return;
    }
    const tg = getTg();
    const mb = tg && tg.MainButton;
    if (!mb) return;

    const cartPanel = document.getElementById("cartPanel");
    const isCartOpen = !!(cartPanel && cartPanel.classList.contains("open"));
    const { count, total } = getCartSummary();
    const shouldShow = isCartOpen && count > 0 && total > 0;

    if (shouldShow) {
      document.documentElement.classList.add("tg-native-main");
      const isDeliv =
        typeof window.brand !== "undefined" && window.brand === "delivery";
      const btnColor = isDeliv ? "#C03B2A" : "#123A6B";
      const text = `Оформить заказ · ${total.toLocaleString("ru-RU")} ₽`;

      try {
        if (typeof mb.setParams === "function") {
          mb.setParams({
            text: text,
            color: btnColor,
            text_color: "#FFFFFF",
            is_active: true,
            is_visible: true,
          });
        } else {
          mb.setText(text);
          mb.show();
        }
      } catch (_) {}
    } else {
      document.documentElement.classList.remove("tg-native-main");
      try {
        mb.hide();
      } catch (_) {}
    }
  }

  // Закрытие активных модальных окон и панелей
  function closeTop() {
    haptic("light");
    const openModal = document.querySelector(".modal.show");
    if (openModal) {
      openModal.classList.remove("show");
    } else {
      const cartPanel = document.getElementById("cartPanel");
      if (cartPanel && cartPanel.classList.contains("open")) {
        cartPanel.classList.remove("open");
      }
      const panel = document.getElementById("panel");
      if (panel && panel.classList.contains("open")) {
        panel.classList.remove("open");
      }
      const chatPanel = document.getElementById("chatPanel");
      if (chatPanel && chatPanel.classList.contains("open")) {
        chatPanel.classList.remove("open");
      }
    }

    if (typeof window.syncOverlay === "function") {
      window.syncOverlay();
    }
    updateMainButton();
  }

  const TgUx = {
    isTg: isTg,
    closeTop: closeTop,
    success: function () {
      haptic("success");
    },
    impact: function (style = "light") {
      haptic(style);
    },
    haptic: function (style) {
      haptic(style || "light");
    },
    notify: function (type) {
      haptic(type || "success");
    },
    syncMainButton: updateMainButton,
    updateMainButton: updateMainButton,
    sync: function () {
      if (typeof window.syncOverlay === "function") window.syncOverlay();
      updateMainButton();
    },
  };

  window.TgUx = TgUx;

  // Клик по MainButton делегирует клик на реальную кнопку оформления заказа
  try {
    const tg = getTg();
    if (tg && tg.MainButton) {
      const onMainClick = function () {
        haptic("medium");
        const btn = document.getElementById("checkoutBtn");
        if (btn) btn.click();
      };
      if (typeof tg.MainButton.onClick === "function") {
        tg.MainButton.onClick(onMainClick);
      } else if (typeof tg.MainButton.onEvent === "function") {
        tg.MainButton.onEvent("clicked", onMainClick);
      }
    }
  } catch (_) {}

  // Клик по BackButton
  try {
    const tg = getTg();
    if (tg && tg.BackButton) {
      const onBackClick = function () {
        closeTop();
      };
      if (typeof tg.BackButton.onClick === "function") {
        tg.BackButton.onClick(onBackClick);
      } else if (typeof tg.BackButton.onEvent === "function") {
        tg.BackButton.onEvent("clicked", onBackClick);
      }
    }
  } catch (_) {}

  // Тактильная отдача для элементов интерфейса
  document.addEventListener(
    "click",
    function (e) {
      if (!isTg()) return;
      const t = e.target;
      if (!t || typeof t.closest !== "function") return;

      // Легкий клик на счетчиках, переключателях и табах
      if (
        t.closest(
          ".qty button, [data-step], .step, [data-act], #deliveryRail button, #brandSeg button, .rail button, .tabs button, [data-brand]"
        )
      ) {
        haptic("light");
        return;
      }
      // Средний клик при добавлении в корзину
      if (
        t.closest(
          ".addBtn, .cta.add, [data-addon], #deliveryGrid .card .cta, #deliveryGrid .opts button, .cfoot button"
        )
      ) {
        haptic("medium");
        return;
      }
    },
    true
  );

  // Тактильная отдача при появлении тостов
  if (typeof window.toast === "function") {
    const rawToast = window.toast;
    window.toast = function (msg, icon) {
      if (isTg()) {
        if (
          icon === "🎉" ||
          icon === "✅" ||
          (msg && /оформлен|успешно|принят|сохранен/i.test(msg))
        ) {
          haptic("success");
        } else if (
          icon === "⚠️" ||
          icon === "⛔" ||
          (msg && /ошибка|не удалось/i.test(msg))
        ) {
          haptic("warning");
        }
      }
      return rawToast.apply(this, arguments);
    };
  }

  // Наблюдатель за корзиной для автоматического вызова MainButton
  function initTgEnvironment() {
    ensureTgEnvironment();
    updateMainButton();

    const obsTarget = document.getElementById("cartPanel") || document.body;
    if (obsTarget && typeof MutationObserver !== "undefined") {
      const obs = new MutationObserver(() => updateMainButton());
      obs.observe(obsTarget, {
        attributes: true,
        attributeFilter: ["class"],
        childList: true,
        subtree: true,
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTgEnvironment);
  } else {
    initTgEnvironment();
  }
})();

/* TG-UX-GATE v3: гарантирует наличие методов-заглушек вне Telegram Mini App */
(function () {
  var NEED = [
    "haptic",
    "success",
    "notify",
    "sync",
    "updateMainButton",
    "syncMainButton",
    "closeTop",
    "isTg",
  ];
  function noop() {}
  function ensure() {
    window.TgUx = window.TgUx || {};
    NEED.forEach(function (k) {
      if (typeof window.TgUx[k] !== "function") window.TgUx[k] = noop;
    });
  }
  ensure();
  document.addEventListener("DOMContentLoaded", ensure);
  window.addEventListener("load", ensure);
})();
