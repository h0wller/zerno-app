/* public/app/core/overlay-core.js — Ф5.7: кластер "overlay-core" из legacy-core.js (вербатим, порядок сохранён). Top-level = global. */
let histPushed = false;
function syncOverlay() {
        const ov = document.getElementById("overlay");
        const panel = document.getElementById("panel");
        if (!ov) return;
        const on =
          !!document.querySelector(".modal.show") ||
          !!(panel && panel.classList.contains("open"));
        ov.classList.toggle("show", on);
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
