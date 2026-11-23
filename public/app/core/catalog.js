/* public/app/core/catalog.js — Ф5.7: кластер "catalog" из legacy-core.js (вербатим, порядок сохранён). Top-level = global. */
"use strict";

      /* ── меню ── */
      async function loadMenu(options) {
        var requestedBrand = options && options.expectedBrand;
        var requestedRole = options && options.expectedRole;
        try {
          const r = await api(
            me && ["admin", "cashier", "dispatch"].indexOf(me.role) !== -1 ? "/menu/all" : "/menu",
          );
          if ((requestedBrand && window.brand !== requestedBrand) ||
              (requestedRole && (!me || me.role !== requestedRole))) return false;
          MENU = r.items;
          meta.updatedAt = r.updatedAt;
          renderUpd();
          if (!options || options.render !== false) renderMenu();
          return true;
        } catch (e) {
          toast(e.message, "⚠️");
          return false;
        }
      }

      let modeSegBound = false;
      function renderModes() {
        const role = me ? me.role : "guest";
        const btns = [{ m: "guest", l: "Гость" }];
        if (role === "cashier" || role === "admin")
          btns.push({ m: "cashier", l: "Кассир" });
        if (role === "dispatch" || role === "cashier" || role === "admin")
          btns.push({ m: "orders", l: "Заказы" });
        if (role === "admin") btns.push({ m: "admin", l: "Админ" });
        const seg = $("#modeSeg");
        seg.innerHTML = btns
          .map(
            (b) =>
              `<button data-mode="${b.m}" class="${mode === b.m ? "on" : ""}">${b.l}</button>`,
          )
          .join("");
        seg.hidden = btns.length < 2;
        if (!modeSegBound) {
          modeSegBound = true;
          seg.addEventListener("click", (e) => {
            const b = e.target.closest("[data-mode]");
            if (b) window.setMode(b.dataset.mode);
          });
        }
      }
      
/* ── Ф5.6.2b: ESM-шим: явные window-экспорты для классик-потребителей ── */
window.loadMenu = loadMenu;
window.renderModes = renderModes;
