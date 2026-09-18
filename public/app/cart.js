/* public/app/cart.js — Ф3.9: корзина доставки (состояние, промо, итоги, аддоны, checkout).
   База рендера (renderCart/orderCard) остаётся в index.html; здесь — состояние и дополнения. */
(function () {
  "use strict";

  /* ── состояние промо ── */
  var cartPromoCode = localStorage.getItem("zt_cartpromo") || "";
  var promoInfo = null;
  var promoTimer = null;

  function promoDisc(sum, info) {
    return info.kind === "percent"
      ? Math.round((sum * Math.min(90, info.value)) / 100)
      : Math.min(info.value || 0, sum);
  }

  function totalsNow() {
    var sum = cart.reduce(function (a, c) {
      return a + c.price * c.qty;
    }, 0);
    var method = document.getElementById("checkoutMethod").value;
    var pickup = method === "pickup" ? Math.round(sum * 0.1) : 0;
    var fee = 0;
    if (method === "delivery" && deliveryInfo) {
      var z = deliveryInfo.zones.find(function (z) {
        return z.places.includes(
          document.getElementById("checkoutPlace").value,
        );
      });
      fee = z ? z.fee : 0;
    }
    var pd = promoInfo ? promoDisc(sum, promoInfo) : 0;
    return {
      sum: sum,
      pickup: pickup,
      fee: fee,
      pd: pd,
      total: sum - pickup - pd + fee,
    };
  }

  function paintTotals() {
    var t = totalsNow();
    var el = document.getElementById("cartTotal");
    if (el) el.textContent = fmt(t.total);
    var s = document.getElementById("cartSum");
    var cnt = cart.reduce(function (a, c) {
      return a + c.qty;
    }, 0);
    if (s)
      s.textContent = cnt + " поз · " + Number(t.total).toLocaleString("ru-RU");
  }

  function cartFabShow() {
    var cf = document.getElementById("cartFab");
    if (cf)
      cf.style.display =
        (mode === "guest" || mode === "admin") && brand === "delivery"
          ? ""
          : "none";
  }

  async function refreshPromoLine(sum) {
    var line = document.getElementById("cartPromoLine");
    if (!line) return;
    if (!cartPromoCode) {
      promoInfo = null;
      line.textContent = "";
      paintTotals();
      return;
    }
    try {
      var r = await fetch(
        API_BASE + "/api/promo/info?code=" + encodeURIComponent(cartPromoCode),
      ).then(function (x) {
        return x.json();
      });
      if (r.ok) {
        promoInfo = r;
        localStorage.setItem("zt_cartpromo", cartPromoCode);
        line.textContent = "🎟 " + r.code + ": −" + fmt(promoDisc(sum, r));
        line.style.color = "var(--green)";
      } else {
        promoInfo = null;
        localStorage.removeItem("zt_cartpromo");
        cartPromoCode = "";
        var typed = (document.getElementById("cartPromo") || {}).value || "";
        if (typed.trim()) {
          line.textContent = "⚠️ " + (r.error || "Код не найден");
          line.style.color = "#B3372B";
        } else line.textContent = "";
      }
    } catch (e) {}
    paintTotals();
  }

  function renderAddons() {
    var host = document.getElementById("cartAddons");
    if (!host) return;
    var list = DMENU.filter(function (p) {
      return p.cat === "sauces" && p.on;
    });
    if (!list.length) {
      host.innerHTML = "";
      return;
    }
    host.innerHTML =
      '<div style="font-size:12px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#8B98A5;margin:0 0 6px">Добавить к заказу</div>' +
      list
        .map(function (p) {
          var inCart = cart.find(function (c) {
            return c.id === p.id;
          });
          return (
            '<button class="addonChip" data-addon="' +
            p.id +
            '">' +
            (inCart ? "<b>×" + inCart.qty + "</b> " : "") +
            esc(p.name) +
            " · " +
            fmt(parseInt(p.price) || 0) +
            "</button>"
          );
        })
        .join("");
  }

  function clearPromo() {
    cartPromoCode = "";
    promoInfo = null;
    localStorage.removeItem("zt_cartpromo");
    var line = document.getElementById("cartPromoLine");
    if (line) line.textContent = "";
    paintTotals();
  }

  window.totalsNow = totalsNow;
  window.paintTotals = paintTotals;
  window.cartFabShow = cartFabShow;
  window.clearPromo = clearPromo;

  // Прогресс-бар акции доставки, синхронизированный с админкой (weekPromo)
  var isDelivery = document.documentElement.getAttribute('data-brand') === 'delivery';
  if (isDelivery) {
    var tNow = window.totalsNow ? window.totalsNow().sum : 0;
    var wp = (typeof deliveryInfo !== 'undefined' && deliveryInfo && deliveryInfo.weekPromo) ? deliveryInfo.weekPromo : {};
    var thresholdVal = Number(wp.threshold) > 0 ? Number(wp.threshold) : 2000;
    var giftText = wp.gift || 'бонус';
    
    var diffVal = thresholdVal - (tNow % thresholdVal);
    var progressVal = thresholdVal > 0 ? Math.min(100, Math.round(((thresholdVal - (tNow % thresholdVal)) / thresholdVal) * 100)) : 0;
    if (tNow >= thresholdVal) progressVal = 100;
    var isDone = tNow >= thresholdVal;
    
    var container = document.getElementById('cartItems');
    var pBar = document.getElementById('deliveryPromoBar');
    if (!pBar && container) {
      pBar = document.createElement('div');
      pBar.id = 'deliveryPromoBar';
      container.prepend(pBar);
    }
    if (pBar) {
      pBar.style.cssText = 'background: #F4EFE6; padding: 10px 14px; border-radius: 10px; margin: 8px 0 14px; border: 1px dashed var(--flame, #C03B2A);';
      pBar.innerHTML = '<div style="display:flex; justify-content:space-between; font-size:12px; font-weight:600; margin-bottom:6px; color:#222;">' +
        '<span>' + (isDone ? '🎁 Акция выполнена: ' + esc(giftText) : 'До подарка (' + esc(giftText) + '):') + '</span>' +
        '<span>' + (isDone ? 'Выполнено' : 'еще ' + diffVal + ' ₽') + '</span></div>' +
        '<div style="height: 6px; background: #E0D9CD; border-radius: 4px; overflow: hidden;">' +
        '<div style="width: ' + progressVal + '%; height: 100%; background: var(--flame, #C03B2A); transition: width 0.3s ease;"></div></div>';
    }
  }

  /* ── обёртки рендера ── */
  renderCart = (function (_rc) {
    return function () {
      var r = _rc();
      renderAddons();
      paintTotals();
      
      var isDelBrand = document.documentElement.getAttribute('data-brand') === 'delivery';
      var container = document.getElementById('cartItems');
      if (isDelBrand && container && !document.getElementById('deliveryPromoBar')) {
        var tNow = window.totalsNow ? window.totalsNow().sum : 0;
        var wp = (typeof deliveryInfo !== 'undefined' && deliveryInfo && deliveryInfo.weekPromo) ? deliveryInfo.weekPromo : {};
        var thresholdVal = Number(wp.threshold) > 0 ? Number(wp.threshold) : 2000;
        var giftText = wp.gift || 'бонус';
        var diffVal = thresholdVal - (tNow % thresholdVal);
        var progressVal = thresholdVal > 0 ? Math.min(100, Math.round(((thresholdVal - (tNow % thresholdVal)) / thresholdVal) * 100)) : 0;
        if (tNow >= thresholdVal) progressVal = 100;
        var isDone = tNow >= thresholdVal;

        var pBar = document.createElement('div');
        pBar.id = 'deliveryPromoBar';
        pBar.style.cssText = 'background: #F4EFE6; padding: 10px 14px; border-radius: 10px; margin: 8px 0 14px; border: 1px dashed var(--flame, #C03B2A);';
        pBar.innerHTML = '<div style="display:flex; justify-content:space-between; font-size:12px; font-weight:600; margin-bottom:6px; color:#222;">' +
          '<span>' + (isDone ? '🎁 Акция выполнена: ' + esc(giftText) : 'До подарка (' + esc(giftText) + '):') + '</span>' +
          '<span>' + (isDone ? 'Выполнено' : 'еще ' + diffVal + ' ₽') + '</span></div>' +
          '<div style="height: 6px; background: #E0D9CD; border-radius: 4px; overflow: hidden;">' +
          '<div style="width: ' + progressVal + '%; height: 100%; background: var(--flame, #C03B2A); transition: width 0.3s ease;"></div></div>';
        container.prepend(pBar);
      }
      var sum = cart.reduce(function (a, c) {
        return a + c.price * c.qty;
      }, 0);
      refreshPromoLine(sum);
      return r;
    };
  })(renderCart);

  orderCard = (function (_oc) {
    return function (o) {
      var h = _oc(o);
      if (o.promo)
        h = h.replace(
          '<div class="ocTotal">',
          '<div class="ocItems">🎟 Промокод ' +
            esc(o.promo) +
            ": −" +
            fmt(o.promodiscount || 0) +
            '</div><div class="ocTotal">',
        );
      return h;
    };
  })(orderCard);

  var promoInput = document.getElementById("cartPromo");
  if (promoInput) {
    promoInput.addEventListener("input", function () {
      var v = promoInput.value.trim().toUpperCase();
      if (!v) { clearPromo(); return; }
      clearTimeout(promoTimer);
      promoTimer = setTimeout(function () {
        cartPromoCode = v;
        refreshPromoLine(totalsNow().sum);
      }, 400);
    });
  }
  var promoBtn = document.getElementById("cartPromoBtn");
  if (promoBtn)
    promoBtn.onclick = function () {
      var v = (promoInput ? promoInput.value : "").trim().toUpperCase();
      if (!v) { clearPromo(); return; }
      cartPromoCode = v;
      refreshPromoLine(totalsNow().sum);
    };
  function repaintCart() { renderCart(); }
  document.getElementById("checkoutPlace").addEventListener("change", repaintCart);
  document.getElementById("checkoutMethod").addEventListener("change", repaintCart);

  document.getElementById("cartPanel").addEventListener("click", function (e) {
    var ch = e.target.closest("[data-addon]");
    if (!ch) return;
    var p = DMENU.find(function (x) {
      return x.id === ch.dataset.addon;
    });
    if (!p) return;
    var ex = cart.find(function (c) {
      return c.id === p.id;
    });
    if (ex) ex.qty++;
    else
      cart.push({
        key: p.id,
        id: p.id,
        oi: -1,
        name: p.name,
        opt: null,
        price: parseInt(p.price) || 0,
        sz: 0,
        qty: 1,
      });
    localStorage.setItem("zt_cart", JSON.stringify(cart));
    updateCartFab();
    renderCart();
  });

  document.getElementById("checkoutBtn").onclick = async function () {
    if (!me) {
      toast("Сначала войдите по номеру", "👤");
      openAuth();
      return;
    }
    var clipped=false;cart.forEach(function(c){if(c.qty>99){c.qty=99;clipped=true;}});
    if(clipped){toast('Максимум 99 шт в одной строке','⚠️');renderCart();return;}
    var method = document.getElementById("checkoutMethod").value;
    if (method === "delivery") {
      if (!document.getElementById("checkoutPlace").value)
        return toast("Выберите населённый пункт", "📍");
      var addrV = document.getElementById("checkoutAddr").value.trim();
      if (!addrV) return toast("Укажите адрес", "🏠");
      if (!/\d/.test(addrV) || addrV.length < 5)
        return toast("Адрес выглядит неполным: нужны улица и номер дома, напр. «Советская 10, кв. 5»", "🏠");
    }
    var body = {
      method: method,
      place: document.getElementById("checkoutPlace").value,
      addr: document.getElementById("checkoutAddr").value.trim(),
      slot: document.getElementById("checkoutSlot").value,
      pay: document.getElementById("checkoutPay").value,
      comment: document.getElementById("checkoutComment").value.trim(),
      items: cart.map(function (c) {
        return { id: c.id, oi: c.oi, qty: c.qty };
      }),
    };
    if (cartPromoCode) body.promo = cartPromoCode;
    try {
      var r = await api("/orders", { method: "POST", body: body });
      toast("Заказ #" + r.order.no + " оформлен!", "🎉");
      cart = [];
      localStorage.setItem("zt_cart", "[]");
      clearPromo();
      var pi = document.getElementById("cartPromo");
      if (pi) pi.value = "";
      updateCartFab();
      renderCart();
      document.getElementById("cartPanel").classList.remove("open");
    } catch (e) {
      toast(e.message, "⚠️");
    }
  };

  (function () {
    var s = document.createElement("style");
    s.textContent = "body:has(#cartPanel.open) #chatFab{display:none!important}";
    document.head.appendChild(s);
  })();
})();