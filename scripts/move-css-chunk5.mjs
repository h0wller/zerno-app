#!/usr/bin/env node
/**
 * scripts/fix-dup-ui-and-css.mjs
 * UI-DEDUP v4: уборка дублей после нескольких поколений патчей.
 *  1) theme-v2.css: вырезаются ВСЕ legacy-блоки адресной книги/дропадауна
 *     (.addr-book-*, .abs-*, .addr-dropdown, .addr-item, #addrBook*),
 *     взамен — ОДИН канонический токен-блок (маркер ADDRESS-BOOK v4-final).
 *  2) address-autocomplete.js: marker-independent вырезание legacy-кода книги
 *     (renderAddressBook, addrBookObserver, вызовы) — источник белой пилюли.
 *  3) address-book.js: ensureButton/openSheet делают purge legacy-узлов,
 *     кнопка и шторка существуют в единственном экземпляре.
 *  4) panel.js: дедупликация таб-кнопок по data-tab («Мои заказы» и др.).
 *  5) preorder-timer.js: не более одного бейджа-пилюли на карточку заказа.
 *  6) sw.js: bump STATIC_CACHE.
 * Запуск: node scripts/fix-dup-ui-and-css.mjs && node scripts/css-audit.mjs
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
  if (rel.endsWith('.js') || rel.endsWith('.mjs')) {
    try { checkSyntax(abs); } catch (e) { if (bak) fs.copyFileSync(bak, abs); throw e; }
  }
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

/* ══ 1. theme-v2.css: вырез legacy-селекторов + один канонический блок ══ */
const LEGACY_SEL = /^(\.addr-book-|\.abs-|\.addr-dropdown|\.addr-item|#addrBook)/;

function sweepLegacyCss(text) {
  let out = text.replace(/([^{}]+)\{([^{}]*)\}/g, function (m, sel, body) {
    if (sel.indexOf('[hidden]') !== -1) return m;
    const parts = sel.split(',');
    const kept = parts.filter(function (p) { return !LEGACY_SEL.test(p.trim()); });
    if (kept.length === parts.length) return m;   // правило не трогает legacy
    if (!kept.length) return '';                  // правило целиком legacy
    return kept.join(',') + '{' + body + '}';
  });
  out = out.replace(/@media[^{;]*\{[\s;]*\}/g, ''); // схлопнуть опустевшие media
  return out;
}

const CANON_CSS = `
/* ── ADDRESS-BOOK v4-final: ЕДИНЫЙ блок (кнопка, шторка, дропдаун) на токенах Слоя 1 ── */
.addr-book-btn {
  display: inline-flex; align-items: center; gap: 6px;
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
  background: var(--card, #FFFFFF);
  color: var(--ink, #101418);
  border: 1.5px solid var(--line, #D8DFE4);
  border-radius: 20px;
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
.abs-edit input.field-error { border-color: var(--status-danger, #B3372B); background: var(--tint-danger, #FDE8E8); }
@media (prefers-reduced-motion: reduce) {
  .addr-book-sheet { transition: none; }
}
`;

function patchThemeCss(text) {
  let out = sweepLegacyCss(text);
  if (out.indexOf('ADDRESS-BOOK v4-final') === -1) out = out.trimEnd() + '\n' + CANON_CSS;
  return out;
}

/* ══ 2. address-autocomplete.js: marker-independent вырез legacy-книги ══ */
function patchAutocomplete(text) {
  if (text.indexOf('UI-DEDUP v4') !== -1) return text;
  let out = text;

  out = out.replace(
    /var addrBookRefreshTimer = null;\n\s*var addrBookObserver = new MutationObserver\(function \(\) \{\n[\s\S]*?\n\s*\}\);\n\s*addrBookObserver\.observe\([^;]*;\n?/,
    ''
  );
  out = out.replace(/function renderAddressBook\(\) \{\n[\s\S]*?\n  \}\n/, '');
  out = out.replace(/function getSavedAddresses\(\) \{\n[\s\S]*?\n  \}\n/, '');
  out = out.replace(/\n[ \t]*renderAddressBook\(\);/g, '');
  out = out.replace(/\n[ \t]*\/\*[^\n]*CHECKOUT-UX-FIX v1[^\n]*\*\//g, '');

  if (/addrBook|renderAddressBook/.test(out)) {
    warnings.push('address-autocomplete.js: после вырезки остались упоминания addrBook — проверьте вручную');
  }
  return out + '\n/* UI-DEDUP v4: legacy-книга адресов вырезана, владелец — address-book.js */\n';
}

/* ══ 3. address-book.js: purge legacy-узлов, единственная кнопка/шторка ══ */
function patchAddressBook(text) {
  if (text.indexOf('UI-DEDUP v4') !== -1) return text;
  let out = text;

  const purge = `
    /* UI-DEDUP v4: purge legacy-кнопок и меню перед созданием своей */
    document.querySelectorAll('.addr-book-menu, .addr-book-btn').forEach(function (n) { n.remove(); });
`;
  out = out.replace(/function ensureButton\(\) \{\n/, function (m) { return m + purge; });

  out = out.replace(
    /function openSheet\(\) \{\s*ensureSheet\(\);/,
    function (m) {
      return m + `
    document.querySelectorAll('.addr-book-menu').forEach(function (n) { n.remove(); }); /* UI-DEDUP v4 */`;
    }
  );

  if (out === text) warnings.push('address-book.js: точки вставки purge не найдены');
  return out;
}

/* ══ 4. panel.js: дедупликация таб-кнопок по data-tab ══ */
function patchPanel(text) {
  if (text.indexOf('UI-DEDUP v4') !== -1) return text;
  const anchor = /var tabs = document\.querySelector\('\.tabs'\);/;
  if (!anchor.test(text)) { warnings.push('panel.js: якорь .tabs не найден'); return text; }
  return text.replace(anchor, function (m) {
    return `/* UI-DEDUP v4: защита от дублей таб-кнопок («Мои заказы» и др.) */
  (function () {
    var seen = {};
    document.querySelectorAll('.tabs [data-tab]').forEach(function (b) {
      if (seen[b.dataset.tab]) { b.remove(); return; }
      seen[b.dataset.tab] = 1;
    });
  })();
  ` + m;
  });
}

/* ══ 5. preorder-timer.js: не более одного бейджа на карточку ══ */
function patchTimer(text) {
  if (text.indexOf('UI-DEDUP v4') !== -1) return text;
  const anchor = /function updateAllTimers\(\) \{\n(\s*)autoInjectBadges\(\);\n/;
  if (!anchor.test(text)) { warnings.push('preorder-timer.js: якорь updateAllTimers не найден'); return text; }
  return text.replace(anchor, function (m, ind) {
    return m + ind + `/* UI-DEDUP v4: максимум один бейдж предзаказа на карточку */
` + ind + `document.querySelectorAll('.orderCard, .order-card, .history-item, .oc, .card').forEach(function (c) {
` + ind + `  var bs = c.querySelectorAll('.preorder-timer');
` + ind + `  for (var i = 1; i < bs.length; i++) bs[i].remove();
` + ind + `});
`;
  });
}

/* ══ MAIN ══ */
try {
  console.log('Task: UI-DEDUP v4 (css-дубли, legacy-меню, двойные кнопки)...\n');
  ['public/app/ui/theme-v2.css', 'public/sw.js'].forEach(function (f) {
    if (!fs.existsSync(resolvePath(f))) { console.error('❌ Не найден: ' + f); process.exit(1); }
  });

  console.log('theme-v2.css: вырез legacy-блоков + канонический v4-final...');
  modifyFile('public/app/ui/theme-v2.css', patchThemeCss);

  console.log('address-autocomplete.js: вырез legacy-книги...');
  modifyFile('public/app/core/address-autocomplete.js', patchAutocomplete);

  console.log('address-book.js: purge legacy-узлов...');
  modifyFile('public/app/core/address-book.js', patchAddressBook);

  console.log('panel.js: дедупликация таб-кнопок...');
  modifyFile('public/app/core/panel.js', patchPanel);

  console.log('preorder-timer.js: дедупликация бейджей...');
  modifyFile('public/app/core/preorder-timer.js', patchTimer);

  console.log('sw.js: bump STATIC_CACHE...');
  modifyFile('public/sw.js', patchSwCache);

  if (warnings.length) { console.warn('\nПредупреждения:'); warnings.forEach(function (w) { console.warn(' - ' + w); }); }
  if (changed.length) { console.log('\nИзменённые файлы:'); changed.forEach(function (f) { console.log(' - ' + f); }); }
  console.log('\nГотово. Далее: node scripts/css-audit.mjs\n');
  process.exit(0);
} catch (err) {
  console.error('\n❌ Ошибка скрипта:');
  console.error(err);
  process.exit(1);
}