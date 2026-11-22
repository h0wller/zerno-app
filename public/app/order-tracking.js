/* public/app/order-tracking.js — подтверждение и live tracking гостевого заказа */
import { restoreOrderItems } from './core/order-reorder.js';
(function () {
  "use strict";

  /* ── Спринт 3, Задача 3: Модалка подтверждения и Live Tracking заказа ── */
  var trackPollTimer = null;
  var activeTrackOrder = null;

  function statusStepIndex(status, isPickup) {
    if (status === "cancel") return -1;
    if (status === "done") return 3;
    if (isPickup) {
      if (status === "cook") return 2;
      if (status === "accept") return 1;
      return 0;
    }
    if (status === "way") return 2;
    if (status === "cook" || status === "accept") return 1;
    return 0;
  }

  function trackingSignature(order) {
    return JSON.stringify({
      status: order.status,
      eta: order.eta,
      slot: order.slot,
      is_preorder: order.is_preorder,
      method: order.method,
      place: order.place,
      addr: order.addr,
      items: order.items,
      gifts: order.gifts,
      discount: order.discount,
      discount_label: order.discount_label,
      fee: order.fee,
      total: order.total,
      pay: order.pay
    });
  }


  function openDeliveryChat() {
    var chatState = window.chatState;
    if (chatState) {
      if (typeof chatState.setChosenSupportCtx === "function") chatState.setChosenSupportCtx("delivery");
      if (typeof chatState.setSupportPending === "function") chatState.setSupportPending(false);
      if (typeof chatState.setChatCtx === "function") chatState.setChatCtx("delivery");
    }
    document.body.classList.remove("support-pending");
    if (typeof window.hideSupportOverlay === "function") window.hideSupportOverlay();

    var chatPanel = document.getElementById("chatPanel");
    if (chatPanel) chatPanel.classList.add("open");
    var chatFab = document.getElementById("chatFab");
    if (chatFab) chatFab.classList.add("open");
    closeOrderTrackModal();

    if (typeof window.setBotName === "function") window.setBotName();
    if (typeof window.reloadChatThread === "function") window.reloadChatThread();

    var input = document.getElementById("chatInput");
    var orderNo = activeTrackOrder && (activeTrackOrder.no || activeTrackOrder.id);
    if (input) {
      input.value = "Здравствуйте! У меня вопрос по заказу" +
        (orderNo ? " №" + orderNo : "") + ".";
      input.focus();
    }
  }

  async function repeatTrackedOrder() {
    if (!activeTrackOrder || !Array.isArray(activeTrackOrder.items)) return;
    if ((!Array.isArray(window.DMENU) || !window.DMENU.length) &&
        activeTrackOrder.items.some(function (item) { return item.opt && !Number.isInteger(item.oi); }) &&
        typeof window.loadDelivery === "function") {
      await window.loadDelivery();
    }
    var repeatedItems = restoreOrderItems(activeTrackOrder.items, window.DMENU);
    if (repeatedItems.some(function (item) { return item.opt && item.oi < 0; })) {
      window.toast("Не удалось восстановить вариант одной из позиций. Проверьте меню и повторите заказ.", "⚠️");
      return;
    }
    if (typeof window.replaceCartItems !== "function") {
      window.toast("Корзина ещё загружается. Повторите попытку.", "⚠️");
      return;
    }
    window.replaceCartItems(repeatedItems);
    if (typeof window.cartFabShow === "function") window.cartFabShow();
    var cartPanel = document.getElementById("cartPanel");
    if (cartPanel) cartPanel.classList.add("open");
    closeOrderTrackModal();
    window.toast("Заказ добавлен в корзину", "🛒");
  }

  function handleTrackModalClick(event) {
    var target = event.target;
    if (target === event.currentTarget || target.closest("[data-ot-close]")) {
      closeOrderTrackModal();
    } else if (target.closest("[data-ot-chat]")) {
      openDeliveryChat();
    } else if (target.closest("[data-ot-repeat]")) {
      repeatTrackedOrder().catch(function () { window.toast('Не удалось повторить заказ. Попробуйте ещё раз.', '⚠️'); });
    }
  }

  var lastRenderedSignature = '';

  function renderTrackModalContent(order) {
    if (!order) return false;
    activeTrackOrder = order;
    var signature = trackingSignature(order);
    var modal = document.getElementById("orderTrackModal");
    if (modal && signature === lastRenderedSignature) return false;
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "orderTrackModal";
      modal.className = "modal";
      document.body.appendChild(modal);
      modal.addEventListener("click", handleTrackModalClick);
    }

    lastRenderedSignature = signature;
    var isPickup = order.method === "pickup";
    var status = order.status || "new";
    var canceled = status === "cancel";
    var stepIdx = statusStepIndex(status, isPickup);
    var steps = isPickup
      ? [
          { l: "Новый", ic: "📝" },
          { l: "Подтверждён", ic: "✅" },
          { l: "Готовится", ic: "🔥" },
          { l: "Выдан", ic: "🛍" }
        ]
      : [
          { l: "Новый", ic: "📝" },
          { l: "Готовится", ic: "🔥" },
          { l: "Курьер в пути", ic: "🛵" },
          { l: "Доставлен", ic: "✅" }
        ];

    var statusLabels = {
      new: "📝 Заказ принят",
      accept: "✅ Заказ подтверждён",
      cook: isPickup ? "🔥 Заказ готовится к самовывозу" : "🔥 Заказ готовится",
      way: "🛵 Курьер выехал",
      done: isPickup ? "✅ Заказ выдан" : "🏁 Заказ выполнен",
      cancel: "❌ Заказ отменён"
    };

    var stepsHtml = steps.map(function (step, index) {
      var cls = canceled ? "" : (index < stepIdx ? "done" : (index === stepIdx ? "active" : ""));
      return '<div class="ot-step ' + cls + '">' +
        '<div class="ot-dot">' + step.ic + "</div>" +
        '<span class="ot-lbl">' + step.l + "</span>" +
      "</div>";
    }).join("");

    var itemsList = Array.isArray(order.items) ? order.items : [];
    var itemsHtml = itemsList.map(function (item) {
      var qty = Math.max(1, Number(item.qty) || 1);
      var modifiers = Array.isArray(item.modifiers) ? item.modifiers : [];
      var modifiersSum = modifiers.reduce(function (sum, modifier) {
        return sum + (Number(modifier.price) || 0);
      }, 0);
      var itemTotal = ((Number(item.price) || 0) + modifiersSum) * qty;
      var details = (item.opt ? " (" + window.esc(item.opt) + ")" : "") + " × " + qty;
      var modifierHtml = modifiers.map(function (modifier) {
        return '<small class="ot-item-modifier">＋ ' + window.esc(modifier.name || "Добавка") +
          ' · ' + window.fmt(Number(modifier.price) || 0) + "</small>";
      }).join("");
      return '<div class="ot-item-row"><span>' + window.esc(item.name || "Позиция") +
        details + modifierHtml + '</span><b>' + window.fmt(itemTotal) + "</b></div>";
    }).join("");

    var gifts = Array.isArray(order.gifts) ? order.gifts : [];
    var giftsHtml = gifts.map(function (gift) {
      var qty = Math.max(1, Number(gift.qty) || 1);
      return '<div class="ot-item-row ot-gift-row"><span>🎁 ' +
        window.esc(gift.name || "Подарок") + " × " + qty + '</span><b>0 ₽</b></div>';
    }).join("");

    var fee = Number(order.fee) || 0;
    var discount = Number(order.discount) || 0;
    var totalVal = Number(order.total ?? order.sum) || 0;
    var destination = isPickup
      ? "🛍 Самовывоз · Советская, 38А"
      : "🚗 Доставка" + (order.place ? " · " + window.esc(order.place) : "") +
        (order.addr ? ", " + window.esc(order.addr) : "");
    var schedule = order.is_preorder && order.slot && order.slot !== "asap"
      ? "⏰ Предзаказ · " + window.esc(order.slot)
      : (isPickup ? "⏰ Время самовывоза согласуется с заведением" : "⏰ Доставка · около 45 минут");
    var etaHtml = order.eta
      ? '<div class="ot-live-note">🕒 Обновлённое время: ' + window.esc(order.eta) + "</div>"
      : "";
    var cancelHtml = canceled
      ? '<div class="ot-cancel-note" role="status">Заказ отменён. Оплата и возврат средств уточняются у заведения.</div>'
      : "";

    modal.innerHTML =
      '<div class="modal-card ot-card">' +
        '<button type="button" class="mclose" data-ot-close aria-label="Закрыть">✕</button>' +
        '<div class="ot-head-badge">' + (statusLabels[status] || statusLabels.new) + "</div>" +
        '<h3 class="ot-title">Заказ #' + window.esc(order.no || order.id || "—") + "</h3>" +
        '<div class="msub">' + destination + "<br>" + schedule + "</div>" +
        etaHtml + cancelHtml +
        (canceled ? "" : '<div class="ot-progress" data-step-idx="' + stepIdx + '">' + stepsHtml + "</div>") +
        '<div class="ot-items-box">' +
          (itemsHtml || '<div class="ot-item-row"><span>Состав заказа сохранён</span></div>') +
          giftsHtml +
          (fee > 0 ? '<div class="ot-total-row"><span>Доставка:</span><b>' + window.fmt(fee) + "</b></div>" : "") +
          (discount > 0 ? '<div class="ot-total-row"><span>' + window.esc(order.discount_label || "Скидка") + ': −' + window.fmt(discount) + "</span></div>" : "") +
          '<div class="ot-total-row"><span>Оплата · ' + (order.pay === "cash" ? "наличные" : "картой при получении") + "</span></div>" +
          '<div class="ot-total-row"><span>Итого:</span><b>' + window.fmt(totalVal) + "</b></div>" +
        "</div>" +
        '<div class="ot-actions">' +
          '<button type="button" class="btn fire" data-ot-chat>💬 Связаться с заведением</button>' +
          '<button type="button" class="btn ghost" data-ot-repeat>🔁 Повторить заказ</button>' +
        "</div>" +
      "</div>";
    return true;
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
          // Update only when a meaningful order field changes; don't replace the
          // whole dialog every five seconds while the customer is reading it.
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
    lastRenderedSignature = '';
    if (typeof window.syncOverlay === "function") window.syncOverlay();
  }

  window.openOrderTrackModal = openOrderTrackModal;
  window.closeOrderTrackModal = closeOrderTrackModal;

})();
