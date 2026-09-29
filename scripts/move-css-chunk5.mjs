#!/usr/bin/env node
/**
 * scripts/fix-lcp-preload-and-sw-reload.mjs
 * PERF-P0 v3:
 *  1) lcp-preload.js: preload ТОЛЬКО /friday-logo.svg и только для бренда delivery.
 *     Кофейная марка — инлайн-SVG в шапке, предзагружать нечего (убираем 404).
 *  2) index.html: ГАРАНТИРОВАННАЯ инжекция <script src="/app/early/lcp-preload.js">
 *     в <head> сразу после <meta charset> (было упущено в v2 — файл не подключался).
 *  3) boot.js: guard одноразового reload при апдейте SW без `return` внутри try
 *     (безопасно в любом контексте — функция, top-level, arrow-хендлер):
 *       - в чистом профиле (не было контроллера) reload НЕ делаем;
 *       - loop-breaker: не чаще одного reload за 10 секунд (sessionStorage).
 *  4) sw.js: bump STATIC_CACHE + явный warning, если маркер не найден.
 * Запуск: node scripts/fix-lcp-preload-and-sw-reload.mjs
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

function ensureDir(abs) {
  const dir = path.dirname(abs);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
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
  // IIFE-скрипт валиден и как ESM, и как classic — node --check пройдёт в обоих случаях.
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
function replaceFile(rel, content) {
  const abs = resolvePath(rel);
  ensureDir(abs);
  const bak = fs.existsSync(abs) ? backupFile(abs) : null;
  writeEol(abs, content, '\n');
  try { checkSyntax(abs); } catch (e) { if (bak) fs.copyFileSync(bak, abs); throw e; }
  changed.push(rel);
  console.log('✔ Перезаписан: ' + rel + (bak ? ' (backup: ' + path.basename(bak) + ')' : ''));
  return true;
}
function patchSwCache(text) {
  let found = false;
  const out = text.replace(/(STATIC_CACHE\s*=\s*['"])([^'"]+)(['"])/, function (m, pre, val, q) {
    found = true;
    const next = /\d/.test(val)
      ? val.replace(/(\d+)(?=[^\d]*$)/, (_, n) => String(Number(n) + 1))
      : val + '-2';
    console.log('   STATIC_CACHE: ' + val + ' -> ' + next);
    return pre + next + q;
  });
  if (!found) warnings.push('sw.js: STATIC_CACHE не найден — кэш НЕ сброшен, деплой не увидится!');
  return found ? out : text;
}

/* ══ 1. Новый lcp-preload.js (PERF-P0 v2) ══ */
const LCP_PRELOAD_V2 = `/* PERF-P0 v2: preload LCP-картинки ТОЛЬКО для бренда доставки.
   Кофейная марка — инлайн-SVG в шапке (предзагружать нечего, 404 устранён).
   Доставка: friday-logo.svg уходит в сеть параллельно со шрифтами. */
(function () {
  function detectBrand() {
    try {
      var qs = (location.search.match(/[?&]brand=([^&]+)/) || [])[1];
      if (qs === 'delivery' || qs === 'coffee') return qs;
      var ls = '';
      try { ls = localStorage.getItem('zt_brand') || ''; } catch (e) {}
      if (ls === 'delivery' || ls === 'coffee') return ls;
      return 'coffee';
    } catch (e) { return 'coffee'; }
  }
  if (detectBrand() !== 'delivery') return; /* coffee: LCP = инлайн-SVG/h1, запрос не нужен */
  var link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = '/friday-logo.svg';
  link.setAttribute('fetchpriority', 'high');
  link.onerror = function () { /* офлайн/блок: молча пропускаем, SW отдаст кэш */ };
  document.head.appendChild(link);
})();
`;

/* ══ 1b. Инжект тега lcp-preload.js в index.html (было упущено в v2) ══ */
function patchIndexHtml(text) {
  if (text.indexOf('/app/early/lcp-preload.js') !== -1) return text;

  const TAG = '<script src="/app/early/lcp-preload.js"></script>';
  // Ищем по строгому якорю charset (регистронезависимо, любой формат кавычек/self-close).
  const anchorRe = /<meta\s+charset\s*=\s*["']?UTF-8["']?\s*\/?>/i;
  if (anchorRe.test(text)) {
    return text.replace(anchorRe, (m) => m + '\n    ' + TAG);
  }
  // Fallback: сразу после открытия <head>
  const headRe = /<head[^>]*>/i;
  if (headRe.test(text)) {
    return text.replace(headRe, (m) => m + '\n    ' + TAG);
  }
  warnings.push('index.html: не найден якорь (<meta charset> / <head>) — тег lcp-preload не вставлен');
  return text;
}

/* ══ 2. Reload guard: без return — работает и в функции, и в top-level arrow ══ */
function makeReloadGuard(indent) {
  const pad = indent || '      ';
  return [
    '/* SW-RELOAD-GUARD v2: не чаще 1 reload за 10 с */',
    pad + 'try {',
    pad + '  var _lt = Number(sessionStorage.getItem(\'zt_sw_reload_ts\') || 0);',
    pad + '  if (Date.now() - _lt >= 10000) {',
    pad + '    sessionStorage.setItem(\'zt_sw_reload_ts\', String(Date.now()));',
    pad + '    location.reload();',
    pad + '  }',
    pad + '} catch (e) { location.reload(); }'
  ].join('\n');
}

function patchBoot(text) {
  if (text.indexOf('SW-RELOAD-GUARD v2') !== -1) return text;

  // Форма A: if (hadController) location.reload();   /   if (hadController) { location.reload(); }
  const reA = /if\s*\(\s*hadController\s*\)\s*\{?\s*location\.reload\(\);\s*\}?/;
  if (reA.test(text)) {
    return text.replace(reA, 'if (hadController) {\n' + makeReloadGuard('      ') + '\n    }');
  }

  // Форма B: controllerchange', function(...) { ... location.reload(); ...
  //   или:  controllerchange', (...) => { ... location.reload(); ...
  // ВАЖНО: параметры опциональны ([^)]*), стрелка — «=>», а не «=>?».
  const reB = /(controllerchange\s*,\s*(?:function\s*\([^)]*\)\s*\{?|\([^)]*\)\s*=>\s*\{?))([\s\S]{0,200}?)location\.reload\(\);/;
  if (reB.test(text)) {
    return text.replace(reB, (m, head, mid) => head + mid + makeReloadGuard('      '));
  }

  warnings.push('boot.js: паттерн reload при controllerchange не найден — guard не усилен (штатное поведение сохранено)');
  return text;
}

/* ══ Main ══ */
try {
  console.log('Task: PERF-P0 v3 (lcp-preload fix + index inject + SW reload guard)...\n');

  console.log('lcp-preload.js: перезапись на v2 (delivery-only)...');
  replaceFile('public/app/early/lcp-preload.js', LCP_PRELOAD_V2);

  console.log('index.html: инжект тега lcp-preload.js...');
  modifyFile('public/index.html', patchIndexHtml);

  console.log('boot.js: loop-breaker одноразового reload...');
  modifyFile('public/app/core/boot.js', patchBoot);

  console.log('sw.js: bump STATIC_CACHE...');
  modifyFile('public/sw.js', patchSwCache);

  if (warnings.length) {
    console.warn('\nПредупреждения:');
    warnings.forEach((w) => console.warn(' - ' + w));
  }
  if (changed.length) {
    console.log('\nИзменённые файлы:');
    changed.forEach((f) => console.log(' - ' + f));
  }
  console.log('\nГотово.\n');
  process.exit(0);
} catch (err) {
  console.error('\n❌ Ошибка скрипта:');
  console.error(err);
  process.exit(1);
}