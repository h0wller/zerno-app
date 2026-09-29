#!/usr/bin/env node
/**
 * scripts/perf-p0-final.mjs
 * PERF-P0 v4 (финал быстрых побед):
 *  1) index.html: внешний lcp-preload.js -> critical inline №4 (0 запросов, 0 blocking).
 *  2) sw.js: убрать '/app/early/lcp-preload.js' из STATIC_ASSETS + bump STATIC_CACHE.
 *  3) boot.js: хук ?nosw=1 (PERF-MEASURE v1) — пропуск регистрации SW для замеров.
 *  4) ui.js: in-flight дедуп одинаковых GET (4× /api/orders/mine и др.).
 *  5) Орфан public/app/early/lcp-preload.js переименовывается в .bak-<stamp>.
 * Запуск: node scripts/perf-p0-final.mjs
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

/* ══ 1. Inline-версия preload (critical inline №4) ══ */
const INLINE_PRELOAD =
'<script>/* PERF-P0 v4: critical inline №4 — preload LCP-логотипа доставки без внешнего запроса */\n' +
"(function(){var b='coffee';try{var q=(location.search.match(/[?&]brand=([^&]+)/)||[])[1];" +
"if(q==='delivery'||q==='coffee'){b=q;}else{var l=localStorage.getItem('zt_brand')||'';if(l==='delivery'||l==='coffee'){b=l;}}}catch(e){}\n" +
"if(b!=='delivery')return;var l=document.createElement('link');l.rel='preload';l.as='image';" +
"l.href='/friday-logo.svg';l.setAttribute('fetchpriority','high');document.head.appendChild(l);})();\n" +
'</script>';

function patchIndexHtml(text) {
  if (text.indexOf('PERF-P0 v4') !== -1) return text;
  const tagRe = /<script src=["']\/app\/early\/lcp-preload\.js["']><\/script>(<!--[^>]*-->)?[ \t]*\n?/;
  if (!tagRe.test(text)) { warnings.push('index.html: тег lcp-preload.js не найден (уже инлайн?)'); return text; }
  return text.replace(tagRe, INLINE_PRELOAD + '\n');
}

/* ══ 2. sw.js: убрать орфан-ассет + bump ══ */
function patchSw(text) {
  let out = text.replace(/[ \t]*'\/app\/early\/lcp-preload\.js',\n/g, '\n');
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

/* ══ 3. boot.js: ?nosw=1 для замеров ══ */
function patchBoot(text) {
  if (text.indexOf('PERF-MEASURE v1') !== -1) return text;
  const re = /if\s*\(\s*['"]serviceWorker['"]\s+in\s+navigator\s*\)/;
  if (!re.test(text)) { warnings.push('boot.js: guard регистрации SW не найден'); return text; }
  return text.replace(re, function (m) {
    return 'window.__ztNoSW = /[?&]nosw=1/.test(location.search); /* PERF-MEASURE v1: замеры без SW */\n  ' +
           m.replace(/\)\s*$/, ') && !window.__ztNoSW');
  });
}

/* ══ 4. ui.js: in-flight дедуп GET ══ */
const DEDUP_BLOCK = `
/* PERF-P0 v3: in-flight дедуп одинаковых GET (4× /api/orders/mine и т.п.) */
(function () {
  if (typeof api !== 'function' || api.__dedup) return;
  var orig = api;
  var inflight = {};
  var wrapped = function (path, opts) {
    var m = (opts && opts.method) || 'GET';
    if (m !== 'GET' || (opts && opts.headers)) return orig.apply(this, arguments);
    var k = String(path);
    if (inflight[k]) return inflight[k];
    var p = orig.apply(this, arguments);
    p.then(function () { delete inflight[k]; }, function () { delete inflight[k]; });
    inflight[k] = p;
    return p;
  };
  wrapped.__dedup = true;
  window.api = wrapped;
})();
`;
function patchUi(text) {
  if (text.indexOf('PERF-P0 v3') !== -1) return text;
  return text.trimEnd() + '\n' + DEDUP_BLOCK;
}

/* ══ Main ══ */
try {
  console.log('Task: PERF-P0 v4 (inline preload + nosw hook + api dedup)...\n');

  console.log('index.html: inline critical №4 вместо внешнего lcp-preload.js...');
  modifyFile('public/index.html', patchIndexHtml);

  console.log('sw.js: убрать орфан-ассет + bump...');
  modifyFile('public/sw.js', patchSw);

  console.log('boot.js: хук ?nosw=1...');
  modifyFile('public/app/core/boot.js', patchBoot);

  console.log('ui.js: in-flight дедуп GET...');
  modifyFile('public/app/core/ui.js', patchUi);

  const orphan = resolvePath('public/app/early/lcp-preload.js');
  if (fs.existsSync(orphan)) {
    fs.renameSync(orphan, orphan + '.bak-' + stamp);
    console.log('✔ Орфан переименован: lcp-preload.js -> lcp-preload.js.bak-' + stamp);
  }

  if (warnings.length) { console.warn('\nПредупреждения:'); warnings.forEach(function (w) { console.warn(' - ' + w); }); }
  if (changed.length) { console.log('\nИзменённые файлы:'); changed.forEach(function (f) { console.log(' - ' + f); }); }
  console.log('\nГотово. Замеры: npx lighthouse "http://localhost:3000/?brand=delivery&nosw=1" ...\n');
  process.exit(0);
} catch (err) {
  console.error('\n❌ Ошибка скрипта:');
  console.error(err);
  process.exit(1);
}