/* public/app/core/overlay-core.js — Ф5.7: кластер "overlay-core" из legacy-core.js (вербатим, порядок сохранён). Top-level = global. */
let histPushed = false;
function syncOverlay() {
        const ov = document.getElementById("overlay");
        const panel = document.getElementById("panel");
        if (!ov) return;
    if (window.TgUx && typeof window.TgUx.syncMainButton === 'function') window.TgUx.syncMainButton();
        const on =
          !!document.querySelector(".modal.show") ||
          !!(panel && panel.classList.contains("open"));
        ov.classList.toggle("show", on);
    /* TG-BACKBUTTON-PATCH v1 */
    try {
      const tg = window.Telegram && window.Telegram.WebApp;
      if (tg && tg.BackButton) {
        if (on) {
          tg.BackButton.show();
          document.documentElement.classList.add('tg-native-back');
        } else {
          tg.BackButton.hide();
          document.documentElement.classList.remove('tg-native-back');
        }
      }
    } catch (_) {}
        ov.style.pointerEvents = on ? "auto" : "none";
        ov.setAttribute("aria-hidden", on ? "false" : "true");
        if (on && !histPushed) {
          histPushed = true;
          try {
            history.pushState({ zerno: 1 }, "");
          } catch (e) {}
        } else if (!on && histPushed) {
          histPushed = false;
          try {
            history.back();
          } catch (e) {}
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
        closeStaffChat();
      });

      $("#overlay").onclick = () => {
        closePanel();
        closeEditor();
        closePin();
        closeSetPin();
        closeQRFull();
        closePromo();
        closeDash();
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


/* TG-UX-OBJECT-PATCH v1 */
(function() {
  const getTg = () => (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp) || null;

  const TgUx = {
    closeTop: function() {
      try { TgUx.impact('light'); } catch (_) {}
      const openModal = document.querySelector('.modal.show');
      if (openModal) {
        openModal.classList.remove('show');
      }
      const panel = document.getElementById('panel');
      if (panel && panel.classList.contains('open')) {
        panel.classList.remove('open');
      }
      const cartPanel = document.getElementById('cartPanel');
      if (cartPanel && cartPanel.classList.contains('open')) {
        cartPanel.classList.remove('open');
      }
      const chatPanel = document.getElementById('chatPanel');
      if (chatPanel && chatPanel.classList.contains('open')) {
        chatPanel.classList.remove('open');
      }

      if (typeof window.syncOverlay === 'function') {
        window.syncOverlay();
      }
    },

    success: function() {
      try {
        const tg = getTg();
        if (tg && tg.HapticFeedback) {
          tg.HapticFeedback.notificationOccurred('success');
        }
      } catch (_) {}
    },

    impact: function(style = 'light') {
      try {
        const tg = getTg();
        if (tg && tg.HapticFeedback) {
          tg.HapticFeedback.impactOccurred(style);
        }
      } catch (_) {}
    }
  };

  /* TG-UX-HAPTIC-ALIAS v1: haptic() — публичный алиас impact().
     Совместимость с panel.js/delivery.js/ptr.js, которые зовут TgUx.haptic('light'|'medium'). */
  TgUx.haptic = function(style) {
    try {
      window.__tgEvents = window.__tgEvents || {};
      if (!Array.isArray(window.__tgEvents.hapticCalls)) window.__tgEvents.hapticCalls = [];
      window.__tgEvents.hapticCalls.push(style || 'light');
    } catch (_) {}
    TgUx.impact(style || 'light');
  };

  /* TG-UX-NOTIFY-ALIAS v1: notify(type) — алиас haptic для уведомлений. */
  TgUx.notify = function(type) {
    TgUx.haptic(type || 'success');
  };

  TgUx.syncMainButton = function() {
      try {
        const tg = getTg();
        if (!tg || !tg.MainButton) return;
        const cp = document.getElementById('cartPanel');
        const isCartOpen = cp && cp.classList.contains('open');
        if (isCartOpen) {
          tg.MainButton.setText('Оформить заказ');
          tg.MainButton.show();
        } else {
          tg.MainButton.hide();
        }
      } catch (_) {}
    };

  /* TG-UX-SYNC-ALIAS v1: sync() — публичный метод.
     panel.js зовёт window.TgUx.sync() после syncOverlay(); если метода нет — TypeError. */
  TgUx.sync = function() {
    try {
      if (typeof window.syncOverlay === 'function') window.syncOverlay();
    } catch (_) {}
    try { TgUx.syncMainButton(); } catch (_) {}
  };

  TgUx.updateMainButton = TgUx.syncMainButton;

  window.TgUx = TgUx;

  /* TG-HAPTIC-MAINBTN-PATCH v1 */
  try {
    const tg = getTg();
    if (tg && tg.MainButton) {
      tg.MainButton.onClick(function() {
        const btn = document.getElementById('checkoutBtn');
        if (btn) btn.click();
      });
    }
  } catch (_) {}


  // I-bind ti BackButton click event
  try {
    const tg = getTg();
    if (tg && tg.BackButton) {
      tg.BackButton.onClick(function() {
        TgUx.closeTop();
      });
    }
  } catch (_) {}
})();

/* TG-UX-GATE v3: контракт window.TgUx.* выполняется всегда.
   Дописывает noop ТОЛЬКО по отсутствующим методам; реальные не трогает.
   Вне miniApp основной гейт отдаёт noop-API => фичи неактивны (требование сохранено). */
(function () {
  var NEED = ['haptic', 'success', 'notify', 'sync', 'updateMainButton', 'closeTop'];
  function noop() {}
  function ensure() {
    window.TgUx = window.TgUx || {};
    NEED.forEach(function (k) {
      if (typeof window.TgUx[k] !== 'function') window.TgUx[k] = noop;
    });
  }
  ensure();
  document.addEventListener('DOMContentLoaded', ensure);
  window.addEventListener('load', ensure);
})();