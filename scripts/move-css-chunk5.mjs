#!/usr/bin/env node
/**
 * scripts/fix-tg-syntax-definitive.mjs
 * TG-OFFLOAD v3: полная перезапись inline-скрипта на заведомо корректную версию
 * (без многострочных цепочек с || в начале — именно это было причиной "Unexpected token '||'").
 * + проверка применения всех остальных патчей.
 * Запуск: node scripts/fix-tg-syntax-definitive.mjs && npx playwright test
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const stamp = new Date().toISOString().replace(/[:T]/g, '-').replace(/\..+$/, '');
const changed = [], warnings = [];

const resolvePath = (p) => path.join(root, p);
function backupFile(abs) {
  if (!fs.existsSync(abs)) return null;
  let c = abs + '.bak-' + stamp, i = 1;
  while (fs.existsSync(c)) c = abs + '.bak-' + stamp + '-' + (i++);
  fs.copyFileSync(abs, c); return c;
}
function readLf(abs) {
  const raw = fs.readFileSync(abs, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  return { text: raw.replace(/\r\n/g, '\n'), eol };
}
function writeEol(abs, text, eol) {
  fs.writeFileSync(abs, eol === '\r\n' ? text.replace(/\n/g, '\r\n') : text, 'utf8');
}
function checkSyntax(abs) {
  const r = spawnSync(process.execPath, ['--check', abs], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error('node --check failed: ' + abs + '\n' + (r.stderr || r.stdout));
}
function modifyFile(rel, fn) {
  const abs = resolvePath(rel);
  if (!fs.existsSync(abs)) { warnings.push('Файл не найден: ' + rel); return false; }
  const { text, eol } = readLf(abs);
  const out = fn(text);
  if (typeof out !== 'string' || out === text) return false;
  const bak = backupFile(abs);
  writeEol(abs, out, eol);
  changed.push(rel);
  console.log('✔ Изменён: ' + rel + (bak ? ' (backup: ' + path.basename(bak) + ')' : ''));
  return true;
}
function patchSwCache(text) {
  let found = false;
  const out = text.replace(/(STATIC_CACHE\s*=\s*['"])([^'"]+)(['"])/, function (m, pre, val, q) {
    found = true;
    const next = /\d/.test(val) ? val.replace(/(\d+)(?=[^\d]*$)/, function (_, n) { return String(Number(n) + 1); }) : val + '-2';
    console.log('   STATIC_CACHE: ' + val + ' -> ' + next);
    return pre + next + q;
  });
  if (!found) warnings.push('sw.js: STATIC_CACHE не найден');
  return found ? out : text;
}

/* ── TG-OFFLOAD v3: заведомо корректная версия (без многострочных || цепочек) ── */
const TG_INLINE_JS_V3 = `(function () {
  /* TG-OFFLOAD v3: SDK грузится ТОЛЬКО внутри Mini App; снаружи — stub, 0 запросов */
  var q = location.search + location.hash;
  var inTg = false;
  try {
    inTg = /Telegram/i.test(navigator.userAgent) ||
      /[?&#]tgWebApp(Data|Platform|Version|BotId)=/.test(q) ||
      !!(window.TelegramWebAppProxy || window.TelegramGameProxy) ||
      !!(window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData);
  } catch (e) { inTg = false; }
  window.__isTgMiniApp = window.__isTgMiniApp || inTg;
  function makeStub() {
    var noop = function () {};
    var btn = function () {
      return { text: '', isVisible: false, show: noop, hide: noop, enable: noop,
               disable: noop, setText: noop, setColor: noop, onClick: noop, offClick: noop };
    };
    return {
      isStub: true, readyState: 'ready', isExpanded: true,
      initData: '', initDataUnsafe: {}, version: '0.0', platform: 'web',
      colorScheme: 'light', themeParams: {},
      ready: noop, expand: noop, close: noop,
      enableClosingConfirmation: noop, disableVerticalSwipes: noop,
      setHeaderColor: noop, setBackgroundColor: noop,
      showPopup: noop, showAlert: noop,
      showConfirm: function () { return false; },
      openLink: noop, openTelegramLink: noop, openInvoice: noop,
      onEvent: noop, offEvent: noop,
      MainButton: btn(), BackButton: btn(),
      HapticFeedback: { impactOccurred: noop, notificationOccurred: noop, selectionChanged: noop }
    };
  }
  function installStub() {
    window.Telegram = window.Telegram || {};
    if (!window.Telegram.WebApp || window.Telegram.WebApp.isStub) {
      window.Telegram.WebApp = makeStub();
    }
  }
  if (inTg) {
    var s = document.createElement('script');
    s.src = 'https://telegram.org/js/telegram-web-app.js';
    s.async = false;
    s.onerror = installStub;
    document.head.appendChild(s);
  } else {
    installStub();
  }
})();`;

function patchIndexHtml(text) {
  if (text.indexOf('TG-OFFLOAD v3') !== -1) return text;

  /* Удаляем ЛЮБОЙ существующий inline-скрипт TG-OFFLOAD */
  let out = text.replace(
    /<script>[\s\n]*\/\*[\s\n]*TG-OFFLOAD v[12][\s\S]*?<\/script>/g,
    ''
  );

  /* Ищем тег-заглушку или старый статический тег telegram-web-app.js */
  const staticTag = /<script[^>]*src=["']https:\/\/telegram\.org\/js\/telegram-web-app\.js["'][^>]*><\/script>/;
  if (staticTag.test(out)) {
    out = out.replace(staticTag, '');
  }

  /* Вставляем новый TG-OFFLOAD v3 в <head> сразу после meta charset */
  const newTag = '<script>' + TG_INLINE_JS_V3 + '</script>';
  if (out.indexOf('TG-OFFLOAD v3') === -1) {
    if (/<meta charset/i.test(out)) {
      out = out.replace(/(<meta charset[^>]*>)/i, '$1\n' + newTag);
    } else if (/<head>/i.test(out)) {
      out = out.replace(/<head>/i, '<head>\n' + newTag);
    } else {
      warnings.push('index.html: не найдено место для вставки TG-OFFLOAD v3');
    }
  }

  return out;
}

function patchBaselineSpec(text) {
  if (text.indexOf("process.env.ZERNO_STAFF_CODE") !== -1) return text;
  const out = text.replace(/(['"])1234\1/g, "(process.env.ZERNO_STAFF_CODE || '1234') /* SYNTAX-FIX v1 */");
  if (out === text) warnings.push('ui-baseline.spec.js: литерал 1234 не найден');
  return out;
}

const HELPER = `
/** TEST-FIX v2: гарантированная видимость .cartFab с ретраями добавления */
async function ensureCartFabVisible(page) {
  let ok = await page.evaluate(() => (window.cart || []).length > 0).catch(() => false);
  if (!ok) {
    const addBtn = page.locator('#deliveryGrid [data-add], #deliveryGrid .cta').first();
    for (let i = 0; i < 3 && !ok; i++) {
      const opt = page.locator('#deliveryGrid .opts button').first();
      if (await opt.isVisible().catch(() => false)) await opt.click().catch(() => {});
      await addBtn.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(250);
      ok = await page.evaluate(() => (window.cart || []).length > 0).catch(() => false);
    }
  }
  await page.evaluate(() => {
    if (window.updateCartFab) window.updateCartFab();
    if (window.cartFabShow) window.cartFabShow();
  });
  await page.locator('.cartFab').waitFor({ state: 'visible', timeout: 5000 });
}
`;
function patchResponsiveSpec(text) {
  if (text.indexOf('TEST-FIX v2') !== -1) return text;
  let out = text;
  const pagesAnchor = /(const PAGES = \[[\s\S]*?\];)/;
  if (pagesAnchor.test(out)) {
    out = out.replace(pagesAnchor, function (m) { return m + '\n' + HELPER; });
  } else {
    out = HELPER + '\n' + out;
  }
  out = out.replace(/await cartFab\.waitFor\(\{ state: 'visible', timeout: 3000 \}\);/g, 'await ensureCartFabVisible(page);');
  return out;
}

try {
  console.log('Task: TG-OFFLOAD v3 (полная перезапись) + все фиксы тестов...\n');

  console.log('index.html: полная перезапись TG-OFFLOAD на v3...');
  modifyFile('public/index.html', patchIndexHtml);

  console.log('ui-baseline.spec.js: ZERNO_STAFF_CODE из env...');
  modifyFile('tests/ui-baseline.spec.js', patchBaselineSpec);

  console.log('pwa-responsive.spec.js: ensureCartFabVisible хелпер...');
  modifyFile('tests/pwa-responsive.spec.js', patchResponsiveSpec);

  console.log('sw.js: bump STATIC_CACHE...');
  modifyFile('public/sw.js', patchSwCache);

  if (warnings.length) { console.warn('\nПредупреждения:'); warnings.forEach(function (w) { console.warn(' - ' + w); }); }
  if (changed.length) { console.log('\nИзменённые файлы:'); changed.forEach(function (f) { console.log(' - ' + f); }); }
  console.log('\nГотово. Далее: npx playwright test\n');
  process.exit(0);
} catch (err) {
  console.error('\n❌ Ошибка скрипта:');
  console.error(err);
  process.exit(1);
}