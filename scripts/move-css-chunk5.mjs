#!/usr/bin/env node
/**
 * scripts/fix-dedup-tg-fonts.mjs
 * FINAL-DEDUP v2 + TG-OFFLOAD v1 + FONTS-LOCAL v1
 *
 * Фаза 1: theme-v2.css — brace-matching dedup legacy-семейств
 *         (addr-book, abs-, addr-dropdown, addr-item, addrBook, preorder-timer)
 *         и keyframes preorder / addr-shake — один канонический блок;
 *         sweep !important вне [hidden] + компенсатор специфичности.
 * Фаза 2: index.html — Telegram SDK грузится ТОЛЬКО внутри Mini App
 *         (UA / tgWebAppData / TelegramWebAppProxy); снаружи — no-op stub,
 *         ноль сетевых запросов к telegram.org.
 * Фаза 3: шрифты наружу: скачиваем woff2 (cyrillic+latin) в public/app/ui/fonts/,
 *         генерируем fonts.css, меняем link googleapis на локальный.
 * Фаза 4: sw.js — fonts.css и woff2 в STATIC_ASSETS, bump STATIC_CACHE.
 *
 * Запуск: node scripts/fix-dedup-tg-fonts.mjs && node scripts/css-audit.mjs
 * Прим: фазу 3 выполнять с машины, где доступен fonts.gstatic.com (один раз,
 *       файлы коммитятся в репозиторий).
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
function checkSyntaxString(code, label) {
  const tmp = path.join(root, 'scripts', '.tmp-check-' + stamp + '.js');
  fs.writeFileSync(tmp, code, 'utf8');
  try { checkSyntax(tmp); }
  finally { fs.unlinkSync(tmp); }
  void label;
}
function modifyFile(rel, fn) {
  const abs = resolvePath(rel);
  if (!fs.existsSync(abs)) { warnings.push('Файл не найден: ' + rel); return false; }
  const { text, eol } = readLf(abs);
  const out = fn(text);
  if (typeof out !== 'string' || out === text) return false;
  const bak = backupFile(abs);
  writeEol(abs, out, eol);
  if (rel.endsWith('.js') || rel.endsWith('.mjs')) {
    try { checkSyntax(abs); } catch (e) { if (bak) fs.copyFileSync(bak, abs); throw e; }
  }
  changed.push(rel);
  console.log('✔ Изменён: ' + rel + (bak ? ' (backup: ' + path.basename(bak) + ')' : ''));
  return true;
}

/* ═════════════ ФАЗА 1: CSS ═════════════ */
const LEG_SEL = /^(\.addr-book-|\.abs-|\.addr-dropdown|\.addr-item|#addrBook|\.preorder-timer)/;
const LEG_KF = /@keyframes[^;{]*\b(preorder-timer-in|preorder-pulse|addr-shake)\b/i;
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\s+/g, ' ').trim();

function cleanCss(css) {
  let out = '';
  let pos = 0;
  while (pos < css.length) {
    const open = css.indexOf('{', pos);
    if (open === -1) { out += css.slice(pos); break; }
    let d = 1, j = open + 1;
    while (j < css.length && d) {
      const c = css[j];
      if (c === '{') d++;
      else if (c === '}') d--;
      j++;
    }
    const sel = css.slice(pos, open).trim();
    let body = css.slice(open + 1, j - 1);
    pos = j;
    if (/^@media/i.test(sel) || /^@supports/i.test(sel)) {
      const inner = cleanCss(body);
      if (inner.trim()) out += sel + ' {' + inner + '}\n';
    } else if (/^@keyframes/i.test(sel)) {
      if (!LEG_KF.test(sel)) out += sel + ' {' + body + '}\n';
    } else if (/^@/.test(sel)) {
      out += sel + ' {' + body + '}\n';
    } else {
      if (stripComments(sel).indexOf('[hidden]') === -1) {
        body = body.replace(/\s*!important/g, '');
      }
      const parts = sel.split(',')
        .map(function (p) { return p.trim(); })
        .filter(function (p) { return p && !LEG_SEL.test(stripComments(p)); });
      if (parts.length) out += parts.join(',\n') + ' {' + body + '}\n';
    }
  }
  return out;
}
function compensateBadge(text) {
  if (text.indexOf('.auth-badge-confirmed.auth-badge-confirmed') !== -1) return text;
  return text.replace(/(^|[\}\n])\.auth-badge-confirmed\s*\{/g, '$1.auth-badge-confirmed.auth-badge-confirmed {');
}
const CANON = `
/* ── FINAL-DEDUP v2: единый блок адресной книги (токены Слоя 1) ── */
.addr-book-btn {
  display: inline-flex; align-items: center; gap: 6px;
  align-self: flex-start; width: fit-content; max-width: 100%;
  padding: 8px 14px; border-radius: 999px;
  background: var(--panel, #F3F8FC);
  border: 1.5px solid var(--line, #D8DFE4);
  color: var(--flame, #123A6B);
  font-size: 13px; font-weight: 700; cursor: pointer; margin-bottom: 8px;
}
.addr-book-btn:hover { border-color: var(--flame, #123A6B); }
.addr-book-sheet {
  position: fixed; left: 50%;
  bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  transform: translateX(-50%) translateY(12px);
  width: min(420px, calc(100vw - 24px));
  max-height: min(72vh, 540px);
  overflow-y: auto; overscroll-behavior: contain;
  background: var(--card, #FFFFFF); color: var(--ink, #101418);
  border: 1.5px solid var(--line, #D8DFE4); border-radius: 20px;
  box-shadow: var(--shadow-sheet, 0 -10px 40px -12px rgba(16, 20, 24, 0.25));
  padding: 14px; z-index: 1600;
  opacity: 0; pointer-events: none;
  transition: opacity 0.25s, transform 0.25s;
}
.addr-book-sheet.open { opacity: 1; pointer-events: auto; transform: translateX(-50%) translateY(0); }
.abs-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.abs-head b { font: 700 15px "Golos Text", system-ui, sans-serif; color: var(--flame, #123A6B); }
.abs-close { width: 32px; height: 32px; border-radius: 50%; background: var(--panel, #F3F8FC); color: var(--soft, #586470); font-size: 14px; }
.abs-close:hover { color: var(--ink, #101418); }
.abs-list { display: flex; flex-direction: column; gap: 6px; }
.abs-empty { font-size: 12.5px; color: var(--soft, #586470); text-align: center; padding: 14px 8px; line-height: 1.5; }
.abs-row { display: flex; align-items: center; gap: 6px; border: 1.5px solid var(--line, #D8DFE4); border-radius: 14px; padding: 4px; background: var(--card, #FFFFFF); }
.abs-pick { flex: 1; min-width: 0; text-align: left; padding: 10px; border-radius: 10px; color: var(--ink, #101418); }
.abs-pick:hover { background: var(--panel, #F3F8FC); }
.abs-title { display: block; font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.abs-ico { width: 34px; height: 34px; border-radius: 10px; background: var(--panel, #F3F8FC); color: var(--soft, #586470); font-size: 14px; flex: 0 0 auto; }
.abs-ico:hover { color: var(--flame, #123A6B); }
.abs-ico[data-abs="del"]:hover { color: var(--status-danger, #B3372B); }
.abs-edit { margin-top: 10px; border-top: 1px dashed var(--line, #D8DFE4); padding-top: 10px; display: flex; flex-direction: column; gap: 8px; }
.abs-edit label { font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--soft, #586470); display: flex; flex-direction: column; gap: 4px; }
.abs-edit input { border: 1.5px solid var(--line, #D8DFE4); border-radius: 10px; padding: 9px 12px; font-size: 14px; background: var(--card, #FFFFFF); color: var(--ink, #101418); }
.abs-edit input:focus { outline: none; border-color: var(--flame, #123A6B); }
.abs-fee { font-size: 12.5px; font-weight: 600; color: var(--flame, #123A6B); background: var(--panel, #F3F8FC); border-radius: 10px; padding: 8px 12px; }
.abs-edit-acts { display: flex; gap: 8px; }
.abs-save { flex: 1; background: var(--flame, #123A6B); color: var(--cream, #FFFFFF); border-radius: 10px; padding: 10px; font-weight: 800; font-size: 13px; }
.abs-save:hover { background: var(--flame-d, #0B2446); }
.abs-cancel { flex: 0 0 auto; background: var(--panel, #F3F8FC); color: var(--soft, #586470); border-radius: 10px; padding: 10px 14px; font-weight: 700; font-size: 13px; }
.abs-add { margin-top: 10px; width: 100%; background: var(--tint-alert, #FFF6E5); border: 1.5px dashed var(--amber, #C2935F); color: var(--ink, #101418); border-radius: 12px; padding: 10px; font-weight: 800; font-size: 13px; }
.addr-dropdown {
  position: absolute; z-index: 1700;
  background: var(--card, #FFFFFF); color: var(--ink, #101418);
  border: 1.5px solid var(--line, #D8DFE4); border-radius: 14px;
  box-shadow: var(--sh, 0 10px 30px -12px rgba(16, 20, 24, 0.18));
  max-height: 240px; overflow-y: auto; overscroll-behavior: contain; padding: 4px;
}
.addr-item { display: block; width: 100%; text-align: left; padding: 10px 14px; font: 500 14px "Golos Text", system-ui, sans-serif; color: var(--ink, #101418); background: transparent; border: none; border-radius: 10px; cursor: pointer; }
.addr-item:hover, .addr-item-active { background: var(--panel, #F3F8FC); color: var(--flame, #123A6B); }
#checkoutStreet.field-error,
.abs-edit input.field-error { border-color: var(--status-danger, #B3372B); background: var(--tint-danger, #FDE8E8); animation: addr-shake 0.4s; }
/* ── FINAL-DEDUP v2: единый блок таймера предзаказа ── */
.preorder-timer {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 12px; border-radius: 999px;
  font-size: 12px; font-weight: 700; margin-top: 8px;
  animation: preorder-timer-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
  transition: background 0.3s, color 0.3s;
}
.preorder-timer-waiting {
  background: var(--tint-alert, #FFF6E5);
  color: var(--status-alert, #B26A05);
  border: 1.5px dashed var(--amber, #F2D9A5);
  animation: preorder-timer-in 0.3s both, preorder-pulse 2s ease-in-out infinite;
}
.preorder-timer-active,
.preorder-timer-way {
  background: var(--tint-success, #E4EFE2);
  color: var(--status-success, #1E7A4E);
  border: 1.5px solid var(--status-success, #A8D5A0);
}
@keyframes preorder-timer-in {
  from { opacity: 0; transform: translateY(6px) scale(0.96); }
  to { opacity: 1; transform: none; }
}
@keyframes preorder-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.8; }
}
@keyframes addr-shake {
  20%, 60% { transform: translateX(-4px); }
  40%, 80% { transform: translateX(4px); }
}
@media (prefers-reduced-motion: reduce) {
  .addr-book-sheet { transition: none; }
  .preorder-timer, .preorder-timer-waiting { animation: none; }
  #checkoutStreet.field-error, .abs-edit input.field-error { animation: none; }
}
`;
function patchThemeCss(text) {
  let out = cleanCss(text);
  out = compensateBadge(out);
  if (out.indexOf('FINAL-DEDUP v2') === -1) out = out.trimEnd() + '\n' + CANON;
  return out;
}

/* ═════════════ ФАЗА 2: TG-OFFLOAD ═════════════ */
const TG_INLINE_JS = `(function () {
  var q = location.search + location.hash;
  var inTg = /Telegram/i.test(navigator.userAgent) ||
             /[?&#]tgWebApp(Data|Platform|Version|BotId)=/.test(q) ||
             !!window.TelegramWebAppProxy || !!window.TelegramGameProxy;
  window.__isTgMiniApp = window.__isTgMiniApp || inTg;
  function stub() {
    var noop = function () {};
    var btn = function () {
      return { text: '', isVisible: false, show: noop, hide: noop, enable: noop, disable: noop, setText: noop, setColor: noop, onClick: noop, offClick: noop };
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
      MainButton: btn(),
      BackButton: btn(),
      HapticFeedback: { impactOccurred: noop, notificationOccurred: noop, selectionChanged: noop }
    };
  }
  function installStub() {
    window.Telegram = window.Telegram || {};
    if (!window.Telegram.WebApp || window.Telegram.WebApp.isStub) {
      window.Telegram.WebApp = stub();
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

function patchIndexHtmlTg(text) {
  if (text.indexOf('TG-OFFLOAD v1') !== -1) return text;
  const tagRe = /<script[^>]*src=["']https:\/\/telegram\.org\/js\/telegram-web-app\.js["'][^>]*><\/script>/;
  if (!tagRe.test(text)) { warnings.push('index.html: статический тег telegram-web-app.js не найден'); return text; }
  const inline = '<script>/* TG-OFFLOAD v1: SDK только внутри Mini App; снаружи — stub, 0 запросов */\n' + TG_INLINE_JS + '\n</script>';
  return text.replace(tagRe, inline);
}

/* ═════════════ ФАЗА 3: ШРИФТЫ НАРУЖУ ═════════════ */
const FONTS_CSS_REL = '/app/ui/fonts.css';
const FONTS_DIR_REL = 'public/app/ui/fonts';
const KEEP_SUBSETS = ['cyrillic', 'latin'];
const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

async function selfHostFonts() {
  const indexAbs = resolvePath('public/index.html');
  const html = fs.readFileSync(indexAbs, 'utf8');
  if (html.indexOf('FONTS-LOCAL v1') !== -1) { console.log('— шрифты ужеセルフ-hosted'); return []; }
  const linkRe = /<link[^>]*href=["'](https:\/\/fonts\.googleapis\.com\/css2\?[^"']+)["'][^>]*>/;
  const m = html.match(linkRe);
  if (!m) { warnings.push('index.html: link googleapis css2 не найден — фаза шрифтов пропущена'); return []; }
  const cssUrl = m[1];

  let css;
  try {
    const res = await fetch(cssUrl, { headers: { 'User-Agent': CHROME_UA }, signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    css = await res.text();
  } catch (e) {
    warnings.push('Шрифты: googleapis недоступен (' + e.message + ') — пропуск фазы 3 (повторите с VPN)');
    return [];
  }

  const dir = resolvePath(FONTS_DIR_REL);
  fs.mkdirSync(dir, { recursive: true });

  const blocks = [];
  const re = /(?:\/\*\s*([a-z-]+)\s*\*\/\s*)?@font-face\s*\{([^}]+)\}/g;
  let mm;
  while ((mm = re.exec(css)) !== null) {
    const subset = mm[1] || '';
    const body = mm[2];
    if (KEEP_SUBSETS.indexOf(subset) === -1) continue;
    const fam = (body.match(/font-family:\s*'([^']+)'/) || [])[1];
    const weight = (body.match(/font-weight:\s*(\d+)/) || [])[1] || '400';
    const style = (body.match(/font-style:\s*(\w+)/) || [])[1] || 'normal';
    const url = (body.match(/url\((https:[^)]+\.woff2)\)/) || [])[1];
    const urange = (body.match(/unicode-range:\s*([^;]+);/) || [])[1] || '';
    if (!fam || !url) continue;
    blocks.push({ subset, fam, weight, style, url, urange });
  }
  if (!blocks.length) { warnings.push('Шрифты: не распознан ни один @font-face'); return []; }

  const downloaded = [];
  for (const b of blocks) {
    const fname = b.fam.replace(/\s+/g, '-').toLowerCase() + '-' + b.weight + '-' + b.subset + '.woff2';
    try {
      const res = await fetch(b.url, { headers: { 'User-Agent': CHROME_UA }, signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(path.join(dir, fname), buf);
      downloaded.push(Object.assign({ fname }, b));
      console.log('   ⬇ ' + fname + ' (' + (buf.length / 1024).toFixed(1) + ' KiB)');
    } catch (e) {
      warnings.push('Шрифты: не скачался ' + fname + ' (' + e.message + ')');
    }
  }
  if (!downloaded.length) return [];

  let out = '/* FONTS-LOCAL v1: self-hosted (было Google Fonts: 810 ms render-blocking + 185 KiB third-party) */\n';
  for (const d of downloaded) {
    out += '@font-face {\n' +
      "  font-family: '" + d.fam + "';\n" +
      '  font-style: ' + d.style + ';\n' +
      '  font-weight: ' + d.weight + ';\n' +
      '  font-display: swap;\n' +
      "  src: url('/app/ui/fonts/" + d.fname + "') format('woff2');\n" +
      (d.urange ? '  unicode-range: ' + d.urange.trim() + ';\n' : '') +
      '}\n';
  }
  const cssAbs = resolvePath('public/app/ui/fonts.css');
  const bakCss = fs.existsSync(cssAbs) ? backupFile(cssAbs) : null;
  fs.writeFileSync(cssAbs, out, 'utf8');
  changed.push('public/app/ui/fonts.css');
  console.log('✔ Создан: public/app/ui/fonts.css (' + downloaded.length + ' @font-face)');

  modifyFile('public/index.html', function (t) {
    let r = t.replace(linkRe, '<link rel="stylesheet" href="' + FONTS_CSS_REL + '"> /* FONTS-LOCAL v1 */');
    r = r.replace(/<link[^>]*href=["']https:\/\/fonts\.(googleapis|gstatic)\.com["'][^>]*>\n?/g, '');
    return r;
  });

  return downloaded.map(function (d) { return '/app/ui/fonts/' + d.fname; });
}

/* ═════════════ ФАЗА 4: SW ═════════════ */
function patchSw(text, fontPaths) {
  let out = text;
  if (fontPaths.length && out.indexOf("'/app/ui/fonts.css'") === -1) {
    const assets = ["'/app/ui/fonts.css'"].concat(fontPaths.map(function (p) { return "'" + p + "'"; }));
    out = out.replace(
      /(const STATIC_ASSETS = \[[\s\S]*?)('\/app\/core\/overlay\.js',)/,
      function (m, before, ov) { return before + assets.join(',\n  ') + ',\n  ' + ov; }
    );
  }
  let found = false;
  out = out.replace(/(STATIC_CACHE\s*=\s*['"])([^'"]+)(['"])/, function (m, pre, val, q) {
    found = true;
    const next = /\d/.test(val) ? val.replace(/(\d+)(?=[^\d]*$)/, function (_, n) { return String(Number(n) + 1); }) : val + '-2';
    console.log('   STATIC_CACHE: ' + val + ' -> ' + next);
    return pre + next + q;
  });
  if (!found) warnings.push('sw.js: STATIC_CACHE не найден');
  return found ? out : text;
}

/* ═════════════ MAIN ═════════════ */
(async function main() {
  try {
    console.log('Task: FINAL-DEDUP v2 + TG-OFFLOAD v1 + FONTS-LOCAL v1...\n');
    for (const f of ['public/app/ui/theme-v2.css', 'public/index.html', 'public/sw.js']) {
      if (!fs.existsSync(resolvePath(f))) { console.error('❌ Не найден: ' + f); process.exit(1); }
    }

    console.log('Фаза 1: theme-v2.css dedup + sweep !important...');
    modifyFile('public/app/ui/theme-v2.css', patchThemeCss);

    console.log('\nФаза 2: telegram-web-app.js — условная загрузка + stub...');
    checkSyntaxString(TG_INLINE_JS, 'tg-inline');
    modifyFile('public/index.html', patchIndexHtmlTg);

    console.log('\nФаза 3: шрифты наружу...');
    const fontPaths = await selfHostFonts();

    console.log('\nФаза 4: sw.js (STATIC_ASSETS + bump)...');
    modifyFile('public/sw.js', function (t) { return patchSw(t, fontPaths); });

    if (warnings.length) { console.warn('\nПредупреждения:'); warnings.forEach(function (w) { console.warn(' - ' + w); }); }
    if (changed.length) { console.log('\nИзменённые файлы:'); changed.forEach(function (f) { console.log(' - ' + f); }); }
    console.log('\nГотово. Далее: node scripts/css-audit.mjs\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Ошибка скрипта:');
    console.error(err);
    process.exit(1);
  }
})();