#!/usr/bin/env node
/**
 * fix-all-v6.mjs — центрируем логотип в шапке.
 *
 * Причина: grid-template-columns: minmax(0,1fr) auto auto auto
 *          → col-2 (brand) сдвинут вправо от центра, если левая
 *          группа шире правой.
 * Решение: 1fr auto 1fr + .topbar-right (mbonus+profile) как cluster.
 *          Обёртка .topbar-right живёт ТОЛЬКО на ≥821px; на мобиле
 *          разворачивается обратно (иначе в v2 пропадал профиль).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT  = path.dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--apply');
const STAMP = new Date().toISOString().replace(/[-:T]/g, '')
  .slice(0, 15).replace(/(\d{8})(\d{6})/, '$1-$2');

const log = [];
const ok = (s)   => log.push('  ✓ ' + s);
const warn = (s) => log.push('  ⚠ ' + s);
const skip = (s) => log.push('  · ' + s);

function readUtf8(rel) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) { warn('не найден: ' + rel); return null; }
  return { full, raw: fs.readFileSync(full, 'utf8') };
}
function writeUtf8(full, text, hadCRLF) {
  if (hadCRLF) text = text.replace(/\n/g, '\r\n');
  if (APPLY) {
    const b = full + '.pre-fix-' + STAMP;
    fs.copyFileSync(full, b);
    fs.writeFileSync(full, text, 'utf8');
    log.push('    backup: ' + path.relative(ROOT, b));
  }
}

/* ═══ [1] theme-v2.css — F5.63 центрирование brand ═════════════════════ */
{
  const r = readUtf8('public/app/ui/theme-v2.css');
  if (r) {
    let text = r.raw.replace(/\r\n/g, '\n');
    const hadCRLF = r.raw.includes('\r\n');
    const MARKER = '/* [fix-all v6] F5.63 */';
    if (text.includes(MARKER)) {
      skip('F5.63 уже присутствует');
    } else {
      const block = `

${MARKER}
/* ─────────────────────────────────────────────────────────────────────────
   F5.63 BRAND-CENTER: 1fr auto 1fr → brand всегда по центру topbar.
   mbonus+profile живут в .topbar-right (JS-обёртка, только ≥821px). */

@media (min-width: 821px) {
  body[data-brand] .topbar {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: center;
    gap: 8px;
  }
  body[data-brand] .topbar .venueWrap {
    grid-column: 1; grid-row: 1; justify-self: start; min-width: 0;
  }
  body[data-brand] .topbar .brand {
    grid-column: 2; grid-row: 1; justify-self: center; min-width: 0;
  }
  body[data-brand] .topbar .topbar-right {
    grid-column: 3; grid-row: 1; justify-self: end;
    display: flex; align-items: center; gap: 8px; min-width: 0;
  }
  body[data-brand] .topbar #modeSeg {
    grid-column: 1 / -1; grid-row: 2;
  }
  /* если JS не успел обернуть — не даём упасть раскладке */
  body[data-brand] .topbar #mbonusBtn { grid-column: 3; grid-row: 1; justify-self: end; margin-right: 56px; }
  body[data-brand] .topbar #profileTopBtn { grid-column: 3; grid-row: 1; justify-self: end; }
}
/* [fix-all v6] END F5.63 */
`;
      if (!text.endsWith('\n')) text += '\n';
      text += block;
      writeUtf8(r.full, text, hadCRLF);
      ok('[1] F5.63 добавлен в theme-v2.css');
    }
  }
}

/* ═══ [2] scrolltop.js — wrap .topbar-right только на ≥821 ═════════════ */
{
  const rel = 'public/app/ui/scrolltop.js';
  const r = readUtf8(rel);
  if (r) {
    let text = r.raw.replace(/\r\n/g, '\n');
    const hadCRLF = r.raw.includes('\r\n');
    const MARKER = '/* [fix-all v6] topbar-right wrap-toggle */';

    if (text.includes(MARKER)) {
      skip('wrap-toggle уже присутствует');
    } else {
      const block = `

${MARKER}
(function topbarRightToggle() {
  function unwrap() {
    var w = document.querySelector('.topbar-right');
    if (!w || !w.parentNode) return;
    var topbar = w.parentNode;
    while (w.firstChild) topbar.insertBefore(w.firstChild, w);
    w.remove();
  }
  function wrap() {
    var topbar = document.querySelector('.topbar');
    var profile = document.getElementById('profileTopBtn');
    var mbonus = document.getElementById('mbonusBtn');
    if (!topbar || !profile || !mbonus) return;
    if (mbonus.parentElement && mbonus.parentElement.classList.contains('topbar-right')) return;
    var w = document.createElement('div');
    w.className = 'topbar-right';
    mbonus.parentNode.insertBefore(w, mbonus);
    w.appendChild(mbonus);
    w.appendChild(profile);
  }
  function apply() {
    if (window.innerWidth >= 821) wrap();
    else unwrap();
  }
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', apply);
  else apply();
  window.addEventListener('resize', function () {
    clearTimeout(window.__tbT);
    window.__tbT = setTimeout(apply, 100);
  });
  setTimeout(apply, 200);
  setTimeout(apply, 1000);
})();
`;
      if (!text.endsWith('\n')) text += '\n';
      text += block;
      writeUtf8(r.full, text, hadCRLF);
      ok('[2] topbar-right wrap-toggle добавлен в scrolltop.js');
    }
  }
}

/* ═══ [3] sw.js bump ═══════════════════════════════════════════════════ */
{
  const rel = 'public/sw.js';
  const r = readUtf8(rel);
  if (r) {
    const hadCRLF = r.raw.includes('\r\n');
    let text = r.raw.replace(/\r\n/g, '\n');
    const before = text;
    text = text.replace(/zerno-static-v(\d+)/g, (_, n) => 'zerno-static-v' + (+n + 1));
    if (text !== before) {
      writeUtf8(r.full, text, hadCRLF);
      ok('[3] STATIC_CACHE +1');
    } else {
      skip('[3] sw.js — без изменений');
    }
  }
}

console.log('\n' + log.join('\n'));
console.log('');
if (!APPLY) { console.log('ℹ️  Dry-run. Применить: node fix-all-v6.mjs --apply\n'); process.exit(0); }
console.log('✅ v6 применено. Ctrl+Shift+R и проверить:');
console.log('   • 1243 / 1440, coffee и delivery: логотип ровно по центру шапки');
console.log('   • 821-1180: то же');
console.log('   • 390 / 512 / 554: как было — venue слева, brand центр, профиль справа');
console.log('');
console.log('   node --check public/app/ui/scrolltop.js');
console.log('   npm run pretest');