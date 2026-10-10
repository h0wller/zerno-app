/* public/app/ui/styles.js — Ф3.2/P3: Runtime CSS-инжекции + panel-open observer.
Базовые компоненты (.siteFooter, .omCard, #chatHintsBar и др.) вынесены в theme-v2.css (СЛОЙ 1).
Здесь остаются исключительно runtime-инспекции (z-index, observer шторки, адаптивные сетки и пульсы). */
(function () {
  "use strict";

  /* ── 1. Runtime-слои: z-index, фиксация скролла при открытой шторке и layout ── */
  var css = document.createElement("style");
  css.id = "runtimeStyles";
  css.textContent =
    ".chat-fab{z-index:95!important}" +
    "@media(max-width:820px){body.panel-open .chat-fab{display:none}}" +
    "@media(max-width:820px){body.panel-open{overflow:hidden}}" +
    ".modal{z-index:340!important}" +
    /* Десктопная сетка кофейни */
    "@media(min-width:1181px){#grid{grid-template-columns:repeat(3,1fr)!important}}" +
    "@media(min-width:1600px){#grid{grid-template-columns:repeat(4,1fr)!important}}" +
    /* Корзина на широких мониторах (≥900px) */
    "@media(min-width:900px){" +
    ".cartPanel{max-width:860px!important;margin:0 auto!important;padding:28px 32px!important;font-size:15px}" +
    ".cartPanel h3{font-size:20px;margin-bottom:20px!important}" +
    ".cartPanel #cartItems{margin-bottom:20px}" +
    ".cartPanel .checkoutForm{display:grid;grid-template-columns:1fr 1fr;gap:14px 20px;margin-top:20px}" +
    ".cartPanel .checkoutForm label{display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--soft)}" +
    ".cartPanel .checkoutForm label:nth-child(3),.cartPanel .checkoutForm label:nth-child(6){grid-column:1/-1}" +
    ".cartPanel .checkoutForm select,.cartPanel .checkoutForm input,.cartPanel .checkoutForm textarea{font-size:15px;padding:12px 14px}" +
    ".cartPanel .checkoutForm textarea{min-height:80px}" +
    ".cartPanel button.cta{margin-top:24px!important;font-size:16px;padding:16px}" +
    ".cartPanel .findrow{display:flex;gap:8px;margin-top:14px}" +
    ".cartPanel .findrow input{flex:1;font-size:14px}" +
    "}";
  document.head.appendChild(css);

  /* ── 2. Пульс и активные состояния подсказок чата ── */
  var cssChat = document.createElement("style");
  cssChat.id = "chatPulseStyles";
  cssChat.textContent =
    ".pulse{animation:chatHintPulse 1.3s ease-in-out infinite;background:var(--tint-warm,#F3E2CE)!important;border-color:var(--flame)!important;color:#6B2A0E!important;font-weight:700}" +
    "@keyframes chatHintPulse{0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(180,85,45,.45)}50%{transform:scale(1.05);box-shadow:0 0 0 10px rgba(180,85,45,0)}}" +
    "#chatHintsBar .chatHint.pulse{animation:hintPulse 1.2s ease-in-out 3}" +
    "@keyframes hintPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06);background:#FDE8E8;border-color:var(--status-danger)}}" +
    '#chatHintsBar .chatHint.armed,#chatHintsBar .chatHint[data-arm="1"]{background:var(--tint-danger)!important;border-color:var(--status-danger)!important;color:var(--status-danger)!important;font-weight:700}';
  document.head.appendChild(cssChat);

  /* ── 3. Установка класса panel-open на body ── */
  var panel = document.getElementById("panel");
  if (panel) {
    new MutationObserver(function () {
      document.body.classList.toggle("panel-open", panel.classList.contains("open"));
    }).observe(panel, { attributes: true, attributeFilter: ["class"] });
  }
})();
