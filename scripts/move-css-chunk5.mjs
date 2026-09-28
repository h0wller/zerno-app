// scripts/fix-miniapp-frontend.mjs — v3: CRLF-safe + regex-устойчивость.
//   1. boot.js: не показывать authModal, если src=tg
//   2. push-ui.js: не показывать кнопку push в Telegram Mini App
//   3. deeplink.js: tab=bonus → сразу openQRFull
//   4. deeplink.js: ?reorder=<id> → восстановить корзину из заказа
//   5. .gitignore: добавить *.bak-*
//   6. sw.js: инкремент STATIC_CACHE
// Идемпотентно. CRLF/LF agnostic. Запуск: node scripts/fix-miniapp-frontend.mjs

import fs from 'node:fs';
import { execSync } from 'node:child_process';

const FILES = {
  boot:      'public/app/core/boot.js',
  pushui:    'public/app/core/push-ui.js',
  deeplink:  'public/app/core/deeplink.js',
  sw:        'public/sw.js',
  gitignore: '.gitignore',
};

// ─── Хелперы для CRLF-safe чтения/записи ───────────────────────────────
function readNorm(P) {
  const raw = fs.readFileSync(P, 'utf8');
  const isCRLF = raw.indexOf('\r\n') !== -1;
  return { content: raw.replace(/\r\n/g, '\n'), isCRLF };
}
function writeNorm(P, content, isCRLF) {
  fs.writeFileSync(P, isCRLF ? content.replace(/\n/g, '\r\n') : content, 'utf8');
}
function check(P) {
  try { execSync('node --check ' + P, { stdio: 'pipe' }); return true; }
  catch (e) {
    console.error('Синтаксис сломан в ' + P + ':');
    console.error((e.stderr || '').toString());
    return false;
  }
}

// ─── 1. boot.js ────────────────────────────────────────────────────────
{
  const P = FILES.boot;
  const { content, isCRLF } = readNorm(P);
  let s = content;
  if (s.indexOf('_qsSrc') !== -1) {
    console.log('✓ boot.js: уже пропатчен');
  } else {
    const FROM = 'if (!onboarded) setTimeout(() => openAuth(false), 600);';
    const TO = [
      'const _qsSrc = new URLSearchParams(location.search).get("src");',
      'if (!onboarded && _qsSrc !== "tg") setTimeout(() => openAuth(false), 600);',
    ].join('\n');
    if (s.indexOf(FROM) === -1) { console.error('✗ boot.js: не найден якорь'); process.exit(1); }
    s = s.replace(FROM, TO);
    writeNorm(P, s, isCRLF);
    console.log('✓ boot.js: authModal не открывается при src=tg');
  }
  if (!check(P)) process.exit(1);
}

// ─── 2. push-ui.js ─────────────────────────────────────────────────────
{
  const P = FILES.pushui;
  const { content, isCRLF } = readNorm(P);
  let s = content;
  const MARKER = '// [tg-mini-app-skip-push]';

  if (s.indexOf(MARKER) !== -1) {
    console.log('✓ push-ui.js: уже пропатчен');
  } else {
    // Устойчивый regex: допускает любое число пробелов, переводы строк, CRLF.
    const FROM_RE = /function refreshPushBtn\(\) \{\n(\s*)const pb = \$\("#pushBtn"\);\n\s*const av = \$\("#profileTopBtn"\);\n\s*if \(!pb\) return;/;

    const m = s.match(FROM_RE);
    if (!m) {
      console.error('✗ push-ui.js: не найден блок function refreshPushBtn');
      console.error('  Покажи этот файл — подстрою якорь.');
      process.exit(1);
    }

    const matched = m[0];
    const INSERT = [
      matched,
      '        ' + MARKER,
      '        // В Telegram Mini App пуши идут через нативного бота,',
      '        // кнопка «Включить уведомления» не нужна.',
      '        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) {',
      '          pb.hidden = true;',
      '          if (av) av.classList.remove("pulse-hint");',
      '          window.togglePushHint(false);',
      '          return;',
      '        }',
    ].join('\n');

    s = s.replace(matched, INSERT);
    writeNorm(P, s, isCRLF);
    console.log('✓ push-ui.js: кнопка push скрыта в Telegram Mini App');
  }
  if (!check(P)) process.exit(1);
}

// ─── 3. deeplink.js: tab=bonus → openQRFull ───────────────────────────
{
  const P = FILES.deeplink;
  const { content, isCRLF } = readNorm(P);
  let s = content;
  const MARKER = '// [tg-mini-app-qr-full]';

  if (s.indexOf(MARKER) !== -1) {
    console.log('✓ deeplink.js (QR): уже пропатчен');
  } else {
    const FROM_RE = /if \(tab === 'bonus'\) \{\n(\s*)if \(me\) \{ openPanel\('profile'\); setTab\('bonus'\); \}\n\s*else \{ window\.__ztPendingDeep = 'bonus'; openAuth\(\); \}\n\s*\}/;

    const m = s.match(FROM_RE);
    if (!m) {
      console.error('✗ deeplink.js: не найден блок tab=bonus');
      process.exit(1);
    }

    const REPLACEMENT = [
      "if (tab === 'bonus') {",
      "        if (me) {",
      "          openPanel('profile');",
      "          setTab('bonus');",
      "          " + MARKER,
      "          setTimeout(function () {",
      "            if (typeof openQRFull === 'function') {",
      "              try { openQRFull(); } catch (e) {}",
      "            }",
      "          }, 500);",
      "        }",
      "        else { window.__ztPendingDeep = 'bonus'; openAuth(); }",
      "      }",
    ].join('\n');

    s = s.replace(m[0], REPLACEMENT);
    writeNorm(P, s, isCRLF);
    console.log('✓ deeplink.js: tab=bonus открывает полный QR');
  }
  if (!check(P)) process.exit(1);
}

// ─── 4. deeplink.js: ?reorder=<id> ────────────────────────────────────
{
  const P = FILES.deeplink;
  const { content, isCRLF } = readNorm(P);
  let s = content;
  const MARKER = '// [tg-mini-app-reorder]';

  if (s.indexOf(MARKER) !== -1) {
    console.log('✓ deeplink.js (reorder): уже пропатчен');
  } else {
    const ANCHOR = "  if (QS.get('support') !== 'choose') {";
    if (s.indexOf(ANCHOR) === -1) {
      console.error('✗ deeplink.js: не найден якорь для reorder');
      process.exit(1);
    }
    const BLOCK = [
      "  " + MARKER,
      "  (function () {",
      "    var rid = QS.get('reorder');",
      "    if (!rid) return;",
      "    var tries = 0;",
      "    var iv = setInterval(function () {",
      "      tries++;",
      "      if (window.me && typeof api === 'function') {",
      "        clearInterval(iv);",
      "        api('/orders/mine').then(function (data) {",
      "          var order = (data.orders || []).find(function (x) { return x.id === rid; });",
      "          if (!order) return;",
      "          var restored = (order.items || []).map(function (i) {",
      "            return {",
      "              key: String(i.id) + '_' + (i.opt || '0'),",
      "              id: i.id,",
      "              oi: -1,",
      "              name: i.name,",
      "              opt: i.opt || null,",
      "              price: Number(i.price) || 0,",
      "              sz: Number(i.sz) || 0,",
      "              qty: Number(i.qty) || 1,",
      "            };",
      "          });",
      "          window.cart = restored;",
      "          try { localStorage.setItem('zt_cart', JSON.stringify(restored)); } catch (e) {}",
      "          if (typeof window.updateCartFab === 'function') window.updateCartFab();",
      "          if (typeof window.renderCart === 'function') window.renderCart();",
      "          if (typeof window.syncAddButtons === 'function') window.syncAddButtons();",
      "          var cp = document.getElementById('cartPanel');",
      "          if (cp) cp.classList.add('open');",
      "          if (typeof window.syncOverlay === 'function') window.syncOverlay();",
      "          if (typeof toast === 'function') toast('Заказ восстановлен в корзине', '🛒');",
      "        }).catch(function () {});",
      "      }",
      "      if (tries > 40) clearInterval(iv);",
      "    }, 250);",
      "  })();",
      "",
      ANCHOR,
    ].join('\n');
    s = s.replace(ANCHOR, BLOCK);
    writeNorm(P, s, isCRLF);
    console.log('✓ deeplink.js: ?reorder=<id> восстанавливает корзину');
  }
  if (!check(P)) process.exit(1);
}

// ─── 5. .gitignore ────────────────────────────────────────────────────
{
  const P = FILES.gitignore;
  const raw = fs.existsSync(P) ? fs.readFileSync(P, 'utf8') : '';
  const isCRLF = raw.indexOf('\r\n') !== -1;
  let s = raw.replace(/\r\n/g, '\n');
  const MARKER = '# Backups от скриптов';
  if (s.indexOf(MARKER) !== -1) {
    console.log('✓ .gitignore: уже пропатчен');
  } else {
    s = s + '\n' + MARKER + '\n*.bak\n*.bak-*\n';
    fs.writeFileSync(P, isCRLF ? s.replace(/\n/g, '\r\n') : s, 'utf8');
    console.log('✓ .gitignore: добавлено *.bak-*');
  }
}

// ─── 6. sw.js ─────────────────────────────────────────────────────────
{
  const P = FILES.sw;
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
console.log('  2. git commit -m "fix(miniapp): push skip, QR full, reorder, .gitignore"');
console.log('  3. git push');
console.log('  4. Дождись деплоя (или pm2 restart zerno-app --update-env на сервере)');
console.log('');
console.log('Проверь в боте:');
console.log('  • /start -> «Привязать номер» -> inline-ответ');
console.log('  • /orders -> «Детали» -> профиль delivery');
console.log('  • /orders -> «Повторить» -> корзина');
console.log('  • /bonus -> «Показать QR кассиру» -> сразу полный QR');
console.log('  • Кнопки «Включить уведомления» в Mini App больше нет');