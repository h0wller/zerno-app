/* Ф5.8c-1-fix v2: два застарелых UX-бага поддержки. Якоря — regex с \s* (CRLF/отступы).
1) Панель не открывалась после выбора темы: bubble-обработчик ov из deeplink.js мёртв
   (capture-слушатель chat-core с stopPropagation перехватывает клик) → открываем
   #chatPanel/#chatFab прямо в обработчике chat-core перед reloadChatThread.
2) Чипс «Позвать сотрудника» залипал armed: ветка isFallback && !isExplicitHuman
   ре-армит чипс через 700 мс и не разоружает → после фактического вызова (callSent) пропускаем. */
import fs from 'node:fs';
const P = 'public/app/chat-core.js';
let s = fs.readFileSync(P, 'utf8');
if (s.includes('Ф5.8c-1-fix')) { console.log('⚠️ уже применено'); process.exit(0); }

/* ── Якорь A: setBotName×4 → reloadChatThread (вставляем открытие панели между) ── */
const reA = /setTimeout\(window\.setBotName,\s*900\);\s*window\.reloadChatThread\(\);/;
if (!reA.test(s)) { console.error('❌ якорь A не найден (regex) — покажи строки вокруг reloadChatThread'); process.exit(1); }
s = s.replace(reA,
  'setTimeout(window.setBotName, 900);\n' +
  '      /* Ф5.8c-1-fix (1): открываем панель после выбора темы (deeplink-обработчик мёртв из-за capture+stopPropagation) */\n' +
  '      var cp = document.getElementById("chatPanel");\n' +
  '      if (cp) cp.classList.add("open");\n' +
  '      var fb2 = document.getElementById("chatFab");\n' +
  '      if (fb2) fb2.classList.add("open");\n' +
  '      if (typeof window.syncOverlay === "function") window.syncOverlay();\n' +
  '      window.reloadChatThread();');

/* ── Якорь B0: объявление callSent перед showHints ── */
const reB0 = /^[ \t]*\/\*[ \t]*─+[ \t]*showHints[ \t]*─+[ \t]*\*\//m;
if (!reB0.test(s)) { console.error('❌ якорь B0 (showHints-баннер) не найден'); process.exit(1); }
s = s.replace(reB0, (m0) => '  var callSent = false; /* Ф5.8c-1-fix (2): вызов сотрудника уже выполнен */\n' + m0);

/* ── Якорь B1: mySend(CS.CALL_HINT) во втором тапе → ставим флаг ── */
const reB1 = /mySend\(CS\.CALL_HINT\);/;
if (!reB1.test(s)) { console.error('❌ якорь B1 (mySend CALL_HINT) не найден'); process.exit(1); }
s = s.replace(reB1, 'mySend(CS.CALL_HINT);\n        callSent = true;');

/* ── Якорь B2: re-arm в fallback-ветке → глушим после фактического вызова ── */
const reB2 = /call\.classList\.add\("armed",\s*"pulse"\);/;
if (!reB2.test(s)) { console.error('❌ якорь B2 (re-arm armed+pulse) не найден'); process.exit(1); }
s = s.replace(reB2, 'if (!callSent) call.classList.add("armed", "pulse");');

fs.writeFileSync(P, s);
console.log('✅ chat-core.js: панель открывается после выбора; чипс не ре-армится после вызова');