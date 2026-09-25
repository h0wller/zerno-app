/* public/app/core/catalog.js — Ф5.7: кластер "catalog" из legacy-core.js (вербатим, порядок сохранён). Top-level = global. */
"use strict";

      /* ── меню ── */
      async function loadMenu() {
        try {
          const r = await api(
            me && me.role === "admin" ? "/menu/all" : "/menu",
          );
          MENU = r.items;
          meta.updatedAt = r.updatedAt;
          renderUpd();
          renderMenu();
        } catch (e) {
          toast(e.message, "⚠️");
        }
      }

      let modeSegBound = false;
      function renderModes() {
        const role = me ? me.role : "guest";
        const btns = [{ m: "guest", l: "Гость" }];
        if (role === "cashier" || role === "admin")
          btns.push({ m: "cashier", l: "Кассир" });
        if (role === "dispatch" || role === "cashier" || role === "admin")
          btns.push({ m: "orders", l: "🍕 Заказы" });
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

      function setMode(m) {
        const role = me ? me.role : "guest";
        if (m === "cashier" && role !== "cashier" && role !== "admin") return;
        if (
          m === "orders" &&
          role !== "dispatch" &&
          role !== "cashier" &&
          role !== "admin"
        )
          return;
        if (m === "admin" && role !== "admin") return;
        mode = m;
        document.body.classList.toggle(
          "is-cashier",
          m === "cashier" || m === "orders",
        );
        const cv = $("#cashierView");
        if (cv) cv.hidden = m !== "cashier";
        const ov = $("#ordersView");
        if (ov) ov.hidden = m !== "orders";
        window.syncBrandViews();
        const ab = $("#adminBar");
        if (ab) ab.hidden = m !== "admin";
        const pt = $("#promoToggle");
        if (pt) pt.hidden = m !== "admin";
        const dt = $("#dashToggle");
        if (dt) dt.hidden = m !== "admin";
        const ct = $("#chatsToggle2");
        if (ct)
          ct.hidden = !(me && (me.role === "admin" || me.role === "cashier"));
        const bd = $("#adminBadge");
        if (bd) bd.hidden = m !== "admin";
        if (m !== "admin") exitEdit();
        $("#mbonusBtn").style.display =
          m === "cashier" || m === "orders" ? "none" : "";
        const cf = $("#cartFab");
        if (cf) cf.style.display = m === "guest" ? "" : "none";
        if (m === "cashier") renderLog();
        if (m === "orders") {
          renderOrders();
          if (!ordersPoll)
            ordersPoll = setInterval(() => {
              if (mode === "orders") renderOrders(true);
            }, 8000);
        }
        if (m === "admin") window.loadMenu();
        if (
          (m === "guest" || m === "admin") &&
          brand === "delivery" &&
          !DMENU.length
        )
          loadDelivery();
        window.renderModes();
        toast(
          m === "admin"
            ? "Режим администратора активен"
            : m === "cashier"
              ? "Смена кассира активна"
              : m === "orders"
                ? "Панель диспетчера"
                : "Режим гостя",
          m === "admin"
            ? "🔓"
            : m === "cashier"
              ? "🧾"
              : m === "orders"
                ? "🍕"
                : "",
        );
      }

      function syncBrandViews() {
        const isDel = brand === "delivery";
        const bName = isDel ? "delivery" : "coffee";

        // 1. Принудительно выставляем актуальный бренд на html и body
        document.documentElement.setAttribute("data-brand", bName);
        document.body.setAttribute("data-brand", bName);

        // 2. Синхронизируем активную кнопку в переключателе
        const bSeg = document.getElementById("brandSeg");
        if (bSeg) {
          bSeg.querySelectorAll("button").forEach((btn) => {
            btn.classList.toggle("on", btn.dataset.brand === bName);
          });
        }

        // 3. Переключаем видимость меню
        const showGuest = mode === "guest" || mode === "admin";
        const mv = document.getElementById("menuView");
        const dv = document.getElementById("deliveryView");
        const rl = document.getElementById("rail");

        if (mv) mv.hidden = !showGuest || isDel;
        if (dv) dv.classList.toggle("active", showGuest && isDel);
        if (rl) rl.style.display = mv && mv.hidden ? "none" : "";

        const et = document.getElementById("editToggle");
        if (et) et.hidden = !(mode === "admin" && !isDel);

        // 4. Обновляем корзину и плавающую кнопку
        if (typeof window.cartFabShow === "function") window.cartFabShow();
        if (typeof window.updateDeliveryPromoBar === "function")
          window.updateDeliveryPromoBar();
      }
      
/* ── Ф5.6.2b: ESM-шим: явные window-экспорты для классик-потребителей ── */
window.loadMenu = loadMenu;
window.renderModes = renderModes;
window.setMode = setMode;
window.syncBrandViews = syncBrandViews;
