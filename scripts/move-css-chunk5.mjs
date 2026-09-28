// scripts/fix-tg-support-flow.mjs — выбор темы в Telegram + скрытие push в Mini App.
//   Patch 1: state.js      — детект __isTgMiniApp (до deeplink срезает query)
//   Patch 2: push-ui.js    — использовать __isTgMiniApp вместо window.Telegram
//   Patch 3: chat-state.js — принимать ?ctx=delivery|coffee из URL
//   Patch 4: views.js      — то же (это авторитетный window.__fvChatState)
//   Patch 5: deeplink.js   — при ctx= грузить тред; chat-панель уже открыта
//   Patch 6: tg.js         — «Задать вопрос» → callback → тема → web_app с ctx=
// CRLF-safe, идемпотентно. Запуск: node scripts/fix-tg-support-flow.mjs

import fs from 'node:fs';
import { execSync } from 'node:child_process';

function readNorm(P) {
  const raw = fs.readFileSync(P, 'utf8');
  const isCRLF = raw.indexOf('\r\n') !== -1;
  return { content: raw.replace(/\r\n/g, '\n'), isCRLF, raw };
}
function writeNorm(P, content, isCRLF) {
  fs.writeFileSync(P, isCRLF ? content.replace(/\n/g, '\r\n') : content, 'utf8');
}
function check(P) {
  try { execSync('node --check ' + P, { stdio: 'pipe' }); return true; }
  catch (e) { console.error('Синтаксис сломан в ' + P + ':\n' + (e.stderr || '').toString()); return false; }
}

// ─── Patch 1: state.js — детект Mini App ──────────────────────────────
{
  const P = 'public/app/core/state.js';
  const { content, isCRLF } = readNorm(P);
  let s = content;
  const MARKER = '// [tg-mini-app-detect]';
  if (s.indexOf(MARKER) !== -1) {
    console.log('✓ state.js: детект уже есть');
  } else {
    const ANCHOR = "window.TINT=Object.fromEntries(window.CATS.map(c=>[c.id,c.t]));";
    if (s.indexOf(ANCHOR) === -1) { console.error('✗ state.js: не найден якорь'); process.exit(1); }
    const BLOCK = [
      ANCHOR,
      '',
      MARKER,
      '// Детект Telegram Mini App. Выполняется ДО deeplink.js, который срезает query-строку.',
      'window.__isTgMiniApp = (function () {',
      '  try {',
      '    if (new URLSearchParams(location.search).get("src") === "tg") return true;',
      '    if (/tgWebAppData=/.test(location.hash)) return true;',
      '    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) return true;',
      '  } catch (e) {}',
      '  return false;',
      '})();',
    ].join('\n');
    s = s.replace(ANCHOR, BLOCK);
    writeNorm(P, s, isCRLF);
    console.log('✓ state.js: __isTgMiniApp');
  }
  if (!check(P)) process.exit(1);
}

// ─── Patch 2: push-ui.js — использовать __isTgMiniApp ─────────────────
{
  const P = 'public/app/core/push-ui.js';
  const { content, isCRLF } = readNorm(P);
  let s = content;
  const FROM = 'if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) {';
  const TO = 'if (window.__isTgMiniApp) { // [tg-mini-app-detect]';
  if (s.indexOf('window.__isTgMiniApp') !== -1) {
    console.log('✓ push-ui.js: уже использует __isTgMiniApp');
  } else if (s.indexOf(FROM) === -1) {
    console.error('✗ push-ui.js: не найден старый блок (window.Telegram...).');
    console.error('   Значит fix-miniapp-frontend ещё не прогнан — запусти его сначала.');
    process.exit(1);
  } else {
    s = s.replace(FROM, TO);
    writeNorm(P, s, isCRLF);
    console.log('✓ push-ui.js: проверка через __isTgMiniApp');
  }
  if (!check(P)) process.exit(1);
}

// ─── Patch 3: chat-state.js — читать ctx= из URL ─────────────────────
{
  const P = 'public/app/core/chat-state.js';
  const { content, isCRLF } = readNorm(P);
  let s = content;
  const MARKER = '// [tg-support-ctx-from-url]';
  if (s.indexOf(MARKER) !== -1) {
    console.log('✓ chat-state.js: ctx= из URL уже читается');
  } else {
    const FROM = "var chosen=SUPPORT_ENTRY?(sessionStorage.getItem('zt_support_ctx')||''):'';";
    if (s.indexOf(FROM) === -1) { console.error('✗ chat-state.js: не найден якорь'); process.exit(1); }
    const TO = [
      MARKER,
      "var ctxFromUrl=(QS.get('ctx')==='delivery'||QS.get('ctx')==='coffee')?QS.get('ctx'):'';",
      "var chosen=SUPPORT_ENTRY?(ctxFromUrl||sessionStorage.getItem('zt_support_ctx')||''):'';",
    ].join('\n');
    s = s.replace(FROM, TO);
    // Также сохраняем ctx в localStorage
    s = s.replace(
      "var ctx=localStorage.getItem('zt_chatctx')||'';\nif(chosen)ctx=chosen;",
      "var ctx=localStorage.getItem('zt_chatctx')||'';\nif(chosen){ctx=chosen;try{localStorage.setItem('zt_chatctx',chosen);}catch(e){}}"
    );
    writeNorm(P, s, isCRLF);
    console.log('✓ chat-state.js: ctx= из URL');
  }
  if (!check(P)) process.exit(1);
}

// ─── Patch 4: views.js — авторитетный __fvChatState ──────────────────
{
  const P = 'public/app/core/views.js';
  const { content, isCRLF } = readNorm(P);
  let s = content;
  const MARKER = '// [tg-support-ctx-from-url]';
  if (s.indexOf(MARKER) !== -1) {
    console.log('✓ views.js: ctx= из URL уже читается');
  } else {
    const FROM = "var chosenSupportCtx = SUPPORT_ENTRY ? (sessionStorage.getItem('zt_support_ctx') || '') : '';";
    if (s.indexOf(FROM) === -1) { console.error('✗ views.js: не найден якорь'); process.exit(1); }
    const TO = [
      MARKER,
      "var ctxFromUrl = (QS.get('ctx') === 'delivery' || QS.get('ctx') === 'coffee') ? QS.get('ctx') : '';",
      "var chosenSupportCtx = SUPPORT_ENTRY ? (ctxFromUrl || sessionStorage.getItem('zt_support_ctx') || '') : '';",
    ].join('\n');
    s = s.replace(FROM, TO);
    writeNorm(P, s, isCRLF);
    console.log('✓ views.js: ctx= из URL');
  }
  if (!check(P)) process.exit(1);
}

// ─── Patch 5: deeplink.js — при ctx= грузить тред ────────────────────
{
  const P = 'public/app/core/deeplink.js';
  const { content, isCRLF } = readNorm(P);
  let s = content;
  const MARKER = '// [tg-support-load-thread]';
  if (s.indexOf(MARKER) !== -1) {
    console.log('✓ deeplink.js: загрузка треда уже есть');
  } else {
    const FROM = [
      "      if (tab === 'chat') {",
      "        var cp = document.getElementById('chatPanel');",
      "        if (cp && QS.get('support') !== 'choose') cp.classList.add('open');",
      "      }",
    ].join('\n');
    if (s.indexOf(FROM) === -1) { console.error('✗ deeplink.js: не найден блок tab=chat'); process.exit(1); }
    const TO = [
      "      if (tab === 'chat') {",
      "        var cp = document.getElementById('chatPanel');",
      "        if (cp && QS.get('support') !== 'choose') cp.classList.add('open');",
      "        " + MARKER,
      "        if (QS.get('ctx')) {",
      "          setTimeout(function () {",
      "            if (typeof window.reloadChatThread === 'function') window.reloadChatThread();",
      "            if (typeof window.setBotName === 'function') window.setBotName();",
      "          }, 350);",
      "        }",
      "      }",
    ].join('\n');
    s = s.replace(FROM, TO);
    writeNorm(P, s, isCRLF);
    console.log('✓ deeplink.js: ctx= грузит тред');
  }
  if (!check(P)) process.exit(1);
}

// ─── Patch 6: tg.js — тема в Telegram, чат в PWA ─────────────────────
{
  const P = 'server/routes/tg.js';
  const { content, isCRLF, raw } = readNorm(P);
  let s = content;
  const MARKER = '// [tg-support-flow-v1]';
  fs.writeFileSync(P + '.bak-support', raw, 'utf8');

  if (s.indexOf(MARKER) !== -1) {
    console.log('✓ tg.js: support-flow уже пропатчен');
  } else {
    // 6a. Кнопка в welcomeKeyboard: web_app → callback_data
    const BTN_FROM = "{ text: '💬 Задать вопрос', web_app: { url: APP_URL + '/?src=tg&tab=chat&support=choose' } },";
    const BTN_TO = "{ text: '💬 Задать вопрос', callback_data: 'support_choose' },";
    if (s.indexOf(BTN_FROM) === -1) { console.error('✗ tg.js: не найдена кнопка «Задать вопрос»'); process.exit(1); }
    s = s.replace(BTN_FROM, BTN_TO);

    // 6b. Добавить обработчики перед link_phone
    const ANCHOR = "      if (data === 'link_phone') {\n        const existing = db.prepare('SELECT * FROM customers WHERE tg=?').get(chatId);";
    if (s.indexOf(ANCHOR) === -1) { console.error('✗ tg.js: не найден блок link_phone'); process.exit(1); }

    const HANDLERS = [
      "      " + MARKER,
      "      /* 💬 Поддержка: выбор темы в Telegram, потом открытие WebApp */",
      "      if (data === 'support_choose') {",
      "        await tgSend(chatId, '💬 По какой теме вопрос?', {",
      "          inline_keyboard: [",
      "            [{ text: '🍕 Доставка — «Пятница»', callback_data: 'support_delivery' }],",
      "            [{ text: '☕ Кофейня — «…и кофе»',  callback_data: 'support_coffee' }],",
      "          ]",
      "        });",
      "        return;",
      "      }",
      "      if (data === 'support_delivery' || data === 'support_coffee') {",
      "        const ctx = data === 'support_delivery' ? 'delivery' : 'coffee';",
      "        const label = ctx === 'delivery' ? '🍕 Доставка' : '☕ Кофейня';",
      "        const cbMsgId = cb.message && cb.message.message_id;",
      "        const openBtn = {",
      "          inline_keyboard: [[",
      "            { text: '💬 Открыть чат с поддержкой', web_app: { url: APP_URL + '/?src=tg&tab=chat&ctx=' + ctx } }",
      "          ]]",
      "        };",
      "        if (cbMsgId && TG_TOKEN) {",
      "          await fetch('https://api.telegram.org/bot' + TG_TOKEN + '/editMessageText', {",
      "            method: 'POST',",
      "            headers: { 'Content-Type': 'application/json' },",
      "            body: JSON.stringify({",
      "              chat_id: chatId,",
      "              message_id: cbMsgId,",
      "              text: 'Открываю чат: ' + label,",
      "              reply_markup: openBtn,",
      "            }),",
      "          }).catch(function () {});",
      "        } else {",
      "          await tgSend(chatId, 'Открываю чат: ' + label, openBtn);",
      "        }",
      "        return;",
      "      }",
      "",
      ANCHOR,
    ].join('\n');

    s = s.replace(ANCHOR, HANDLERS);
    writeNorm(P, s, isCRLF);
    console.log('✓ tg.js: тема в Telegram, чат в PWA с ctx=');
  }
  if (!check(P)) process.exit(1);
}

// ─── sw.js ────────────────────────────────────────────────────────────
{
  const P = 'public/sw.js';
  if (fs.existsSync(P)) {
    const { content, isCRLF } = readNorm(P);
    const m = content.match(/zerno-static-v(\d+)/);
    if (m) {
      const before = m[1];
      const next = content.replace(/zerno-static-v(\d+)/, 'zerno-static-v' + (parseInt(before, 10) + 1));
      writeNorm(P, next, isCRLF);
      console.log('✓ sw.js: STATIC_CACHE v' + before + ' → v' + (parseInt(before, 10) + 1));
    }
  }
}

console.log('');
console.log('Готово. Дальше:');
console.log('  1. git add -A');
console.log('  2. git commit -m "fix(tg): выбор темы в Telegram, ctx= в чат, push-hint для Mini App"');
console.log('  3. git push');
console.log('  4. pm2 restart zerno-app --update-env  (или дождись автодеплоя)');
console.log('');
console.log('Проверь в боте:');
console.log('  • /start -> «Задать вопрос» -> тема (2 кнопки) -> «Открыть чат»');
console.log('    -> открывается чат БЕЗ сплэша, Ника правильная («🍕 доставка» или «☕ кофейня»)');
console.log('  • В Mini App больше нет ни хинта «Включите пуши тут →», ни кнопки push');
console.log('  • В браузере (не из Telegram) — push-кнопка и хинт остаются как были');