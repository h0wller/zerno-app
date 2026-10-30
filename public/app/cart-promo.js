/* public/app/cart-promo.js — состояние и интерфейс промокода корзины */
(function () {
  "use strict";
  var code = localStorage.getItem("zt_cartpromo") || "";
  var info = null;
  var timer = null;
  var freeAutoFor = "";
  function discount(sum, promoInfo) {
    if (!promoInfo || promoInfo.kind === "freeship") return 0;
    return promoInfo.kind === "percent" ? Math.round((sum * Math.min(90, promoInfo.value)) / 100) : Math.min(promoInfo.value || 0, sum);
  }
  async function tryAutoFreeCode() {
    var user = window.me || null;
    if (!user || !user.id || freeAutoFor === user.id) return "";
    freeAutoFor = user.id;
    try { var result = await window.fetchJSON("/me/free-delivery"); return (result && result.code) || ""; }
    catch (error) { return ""; }
  }
  function clear() {
    code = ""; info = null; localStorage.removeItem("zt_cartpromo");
    var line = document.getElementById("cartPromoLine"); if (line) line.innerHTML = "";
    var input = document.getElementById("cartPromo"); if (input) input.value = "";
    if (typeof window.paintTotals === "function") window.paintTotals();
  }
  function bindClear(line) {
    var button = line.querySelector(".promo-clear-btn"); if (!button) return;
    button.onclick = function () { clear(); if (typeof window.totalsNow === "function") refresh(window.totalsNow().sum); };
  }
  async function refresh(sum) {
    var line = document.getElementById("cartPromoLine"); if (!line) return;
    if (!code) { var autoCode = await tryAutoFreeCode(); if (autoCode) code = autoCode; }
    if (!code) { info = null; line.innerHTML = ""; if (typeof window.paintTotals === "function") window.paintTotals(); return; }
    try {
      var result = await fetch(window.API_BASE + "/api/promo/info?code=" + encodeURIComponent(code)).then(function (response) { return response.json(); });
      var clearButton = '<button type="button" class="promo-clear-btn" title="Убрать промокод" aria-label="Убрать промокод" style="margin-left:8px;padding:0 4px;background:none;border:none;cursor:pointer;font-size:15px;line-height:1;color:#B3372B;">✕</button>';
      if (result.ok) {
        info = result; localStorage.setItem("zt_cartpromo", code);
        line.innerHTML = '<span>🎟 ' + window.esc(result.code) + ": " + (result.kind === "freeship" ? "первая доставка бесплатно" : "−" + window.fmt(discount(sum, result))) + "</span>" + clearButton;
        line.style.color = "var(--green)"; bindClear(line);
      } else {
        info = null; localStorage.removeItem("zt_cartpromo"); code = "";
        var typed = (document.getElementById("cartPromo") || {}).value || "";
        if (typed.trim()) { line.innerHTML = '<span>⚠️ ' + window.esc(result.error || "Код не найден") + "</span>" + clearButton; line.style.color = "#B3372B"; bindClear(line); }
        else line.innerHTML = "";
      }
    } catch (error) {}
    if (typeof window.paintTotals === "function") window.paintTotals();
  }
  function init() {
    var input = document.getElementById("cartPromo");
    if (input) input.addEventListener("input", function () {
      var value = input.value.trim().toUpperCase(); if (!value) { clear(); return; }
      clearTimeout(timer); timer = setTimeout(function () { code = value; if (typeof window.totalsNow === "function") refresh(window.totalsNow().sum); }, 400);
    });
    var button = document.getElementById("cartPromoBtn");
    if (button) button.onclick = function () {
      var value = (input ? input.value : "").trim().toUpperCase(); if (!value) { clear(); return; }
      code = value; if (typeof window.totalsNow === "function") refresh(window.totalsNow().sum);
    };
  }
  window.CartPromo = { getCode: function () { return code; }, getInfo: function () { return info; }, discount: discount, refresh: refresh, clear: clear };
  init();
})();
