/* public/app/ui/styles.js — Ф3.2/P3: Runtime CSS-инжекции.
   Базовые компоненты вынесены в theme/*.css.
   Здесь остаются runtime-инспекции (z-index, адаптивные сетки и пульсы).
   MutationObserver panel-open перенесён в views.js (Ф5.70). */
(function () {
  "use strict";

  /* ── 1. Runtime-слои: z-index, фиксация скролла при открытой шторке и layout ── */
  var css = document.createElement("style");
  css.id = "runtimeStyles";
  css.textContent =
    ".chat-fab{z-index:95!important}" +
    "@media(max-width:820px){body.panel-open .chat-fab{display:none}}" +
    "@media(max-width:820px){body.panel-open{overflow:hidden}}" +
    ".modal{z-index:340!important}#orderTrackModal{z-index:1010!important}";
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
})();