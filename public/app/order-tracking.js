/* public/app/order-tracking.js — подтверждение и live tracking гостевого заказа */
(function () {
  "use strict";

  /* ── Спринт 3, Задача 3: Модалка подтверждения и Live Tracking заказа ── */
  var trackPollTimer = null;
  var activeTrackOrder = null;

  function statusStepIndex(st) {
    if (st === "done") return 3;
    if (st === "way") return 2;
    if (st === "cook" || st === "accept") return 1;
    return 0; // new
  }

  function renderTrackModalContent(order) {
    if (!order) return;
    activeTrackOrder = order;
    var modal = document.getElementById("orderTrackModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "orderTrackModal";
      modal.className = "modal";
      document.body.appendChild(modal);

      modal.addEventListener("click", function (e) {
        if (e.target === modal || e.target.closest("[data-ot-close]")) {
          closeOrderTrackModal();
          return;
        }
        if (e.target.closest("[data-ot-chat]")) {
          if (window.chatState && typeof window.chatState.setChatCtx === "function") {
            window.chatState.setChatCtx("delivery");
          }
          var cp = document.getElementById("chatPanel");
          if (cp) cp.classList.add("open");
          var fab = document.getElementById("chatFab");
          if (fab) fab.classList.add("open");
          closeOrderTrackModal();
          if (typeof window.setBotName === "function") window.setBotName();
          return;
        }
        if (e.target.closest("[data-ot-repeat]")) {
          if (activeTrackOrder && Array.isArray(activeTrackOrder.items)) {
            window.cart = activeTrackOrder.items.map(function (it) {
              return {
                key: String(it.id) + "_" + (it.opt || "0"),
                id: it.id,
                oi: typeof it.oi === "number" ? it.oi : -1,
                name: it.name || "Блюдо",
                opt: it.opt || null,
                price: Number(it.price) || 0,
                sz: Number(it.sz) || 0,
                qty: Number(it.qty) || 1,
                modifiers: it.modifiers || []
              };
            });
            localStorage.setItem("zt_cart", JSON.stringify(window.cart));
            if (typeof window.updateCartFab === "function") window.updateCartFab();
            if (typeof window.renderCart === "function") window.renderCart();
            var cPanelEl = document.getElementById("cartPanel");
            if (cPanelEl) cPanelEl.classList.add("open");
            closeOrderTrackModal();
            window.toast("Заказ добавлен в корзину", "🛒");
          }
        }
      });
    }

    var stepIdx = statusStepIndex(order.status || "new");
    var steps = [
      { l: "Новый", ic: "📝" },
      { l: "Готовится", ic: "🔥" },
      { l: "Курьер в пути", ic: "🛵" },
      { l: "Выполнен", ic: "✅" }
    ];

    var stepsHtml = steps.map(function (s, idx) {
      var cls = idx < stepIdx ? "done" : (idx === stepIdx ? "active" : "");
      return '<div class="ot-step ' + cls + '">' +
        '<div class="ot-dot">' + s.ic + "</div>" +
        '<span class="ot-lbl">' + s.l + "</span>" +
      "</div>";
    }).join("");

    var itemsList = Array.isArray(order.items) ? order.items : [];
    var itemsHtml = itemsList.map(function (it) {
      return '<div class="ot-item-row">' +
        '<span>' + window.esc(it.name || "Позиция") + (it.opt ? " (" + window.esc(it.opt) + ")" : "") + " × " + (it.qty || 1) + "</span>" +
        '<b>' + window.fmt((Number(it.price) || 0) * (Number(it.qty) || 1)) + "</b>" +
      "</div>";
    }).join("");

    var totalVal = Number(order.total || order.sum) || 0;

    modal.innerHTML =
      '<div class="modal-card ot-card">' +
        '<button type="button" class="mclose" data-ot-close aria-label="Закрыть">✕</button>' +
        '<div class="ot-head-badge">🎉 Заказ принят</div>' +
        '<h3 class="ot-title">Заказ #' + window.esc(order.no || order.id || "—") + "</h3>" +
        '<div class="msub">' + (order.slot && order.slot !== "asap" ? "Ко времени: " + window.esc(order.slot) : "Приготовим и доставим как можно скорее") + "</div>" +
        '<div class="ot-progress" data-step-idx="' + stepIdx + '">' + stepsHtml + "</div>" +
        '<div class="ot-items-box">' +
          (itemsHtml || '<div class="ot-item-row"><span>Состав заказа сохранён</span></div>') +
          (totalVal ? '<div class="ot-total-row"><span>Итого:</span><b>' + window.fmt(totalVal) + "</b></div>" : "") +
        "</div>" +
        '<div class="ot-actions">' +
          '<button type="button" class="btn fire" data-ot-chat>💬 Связаться с пиццерией</button>' +
          '<button type="button" class="btn ghost" data-ot-repeat>🔁 Повторить заказ</button>' +
        "</div>" +
      "</div>";
  }

  function pollOrderStatus(orderIdOrNo) {
    if (trackPollTimer) clearInterval(trackPollTimer);
    trackPollTimer = setInterval(async function () {
      var modal = document.getElementById("orderTrackModal");
      if (!modal || !modal.classList.contains("show")) {
        clearInterval(trackPollTimer);
        trackPollTimer = null;
        return;
      }
      try {
        var res = await window.api("/orders/mine");
        var list = (res && res.orders) || [];
        var found = list.find(function (o) {
          return String(o.id) === String(orderIdOrNo) || String(o.no) === String(orderIdOrNo);
        });
        if (found) {
          renderTrackModalContent(found);
          if (found.status === "done" || found.status === "cancel") {
            clearInterval(trackPollTimer);
            trackPollTimer = null;
          }
        }
      } catch (_) {}
    }, 5000);
  }

  function openOrderTrackModal(order) {
    renderTrackModalContent(order);
    var modal = document.getElementById("orderTrackModal");
    if (modal) {
      modal.classList.add("show");
      if (typeof window.syncOverlay === "function") window.syncOverlay();
      pollOrderStatus(order.id || order.no);
    }
  }

  function closeOrderTrackModal() {
    if (trackPollTimer) {
      clearInterval(trackPollTimer);
      trackPollTimer = null;
    }
    var modal = document.getElementById("orderTrackModal");
    if (modal) modal.classList.remove("show");
    if (typeof window.syncOverlay === "function") window.syncOverlay();
  }

  window.openOrderTrackModal = openOrderTrackModal;
  window.closeOrderTrackModal = closeOrderTrackModal;

})();
