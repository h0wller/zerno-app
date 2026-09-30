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
      // 1. Iserra dagiti modals
      const openModal = document.querySelector('.modal.show');
      if (openModal) {
        openModal.classList.remove('show');
      }
      // 2. Iserra ti panel
      const panel = document.getElementById('panel');
      if (panel && panel.classList.contains('open')) {
        panel.classList.remove('open');
      }
      // 3. Iserra ti cartPanel
      const cartPanel = document.getElementById('cartPanel');
      if (cartPanel && cartPanel.classList.contains('open')) {
        cartPanel.classList.remove('open');
      }
      // 4. Iserra ti chatPanel
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
