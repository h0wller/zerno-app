import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const stamp = new Date().toISOString().replace(/[:T]/g, '-').replace(/\..+$/, '');
const changed = [];

function backup(abs) {
  const b = `${abs}.bak-${stamp}`;
  fs.copyFileSync(abs, b);
  return path.basename(b);
}

function modify(rel, fn) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) { console.warn('⚠️ не найден:', rel); return; }
  const src = fs.readFileSync(abs, 'utf8');
  const eol = src.includes('\r\n') ? '\r\n' : '\n';
  const out = fn(src.replace(/\r\n/g, '\n'));
  if (out === src.replace(/\r\n/g, '\n')) { console.log('· без изменений:', rel); return; }
  const bak = backup(abs);
  fs.writeFileSync(abs, eol === '\r\n' ? out.replace(/\n/g, '\r\n') : out, 'utf8');
  const chk = spawnSync(process.execPath, ['--check', abs], { encoding: 'utf8' });
  if (chk.status !== 0) { fs.copyFileSync(path.join(root, rel + '.bak-' + stamp), abs); throw new Error('syntax: ' + rel + '\n' + chk.stderr); }
  console.log('✔ Изменён:', rel, '| backup:', bak);
  changed.push(rel);
}

/* ── 1. views.js: setMode('cashier') → loadPending отдельно от renderLog ── */
modify('public/app/core/views.js', (t) => {
  if (t.includes('CASHIER-PENDING-ROBUST v1')) return t;
  // Ищем: if (m === 'cashier' && typeof renderLog === 'function') renderLog();
  // Допускаем вариации с двойными/одинарными кавычками и пробелами
  const re = /(\n\s*)if\s*\(\s*m\s*===\s*['"]cashier['"]\s*&&\s*typeof\s+renderLog\s*===\s*['"]function['"]\s*\)\s*renderLog\s*\(\s*\)\s*;/;
  if (!re.test(t)) {
    console.warn('⚠️ views.js: не найден шаблон вызова renderLog() в setMode');
    return t;
  }
  return t.replace(re, (m, indent) =>
    `${indent}/* CASHIER-PENDING-ROBUST v1: pending грузим независимо от renderLog */` +
    `${indent}if (m === 'cashier' && typeof window.loadPending === 'function') window.loadPending();` +
    `${indent}if (m === 'cashier' && typeof renderLog === 'function') renderLog();`
  );
});

/* ── 2. cashier.js: loadPending() ВНЕ try/catch, до api('/staff/log') ── */
modify('public/app/cashier.js', (t) => {
  if (t.includes('CASHIER-LOG-PENDING-DECOUPLE v1')) return t;
  // Ищем строку "window.loadPending();" вместе с комментарием внутри try в renderLog
  const re = /(\n\s*)window\.loadPending\(\);\s*\/\*\s*Ф5\.6-финал[^\n]*\*\//;
  if (!re.test(t)) {
    console.warn('⚠️ cashier.js: не найден window.loadPending() в renderLog');
    return t;
  }
  return t.replace(re, (m, indent) => `${indent}/* CASHIER-LOG-PENDING-DECOUPLE v1: вынесено из try */`);
  // Дополнительно: добавляем early вызов перед try
});

/* ── 3. cashier.js: добавить ранний вызов loadPending перед try в renderLog ── */
modify('public/app/cashier.js', (t) => {
  if (t.includes('/* EARLY-PENDING v1 */')) return t;
  const re = /(async\s+function\s+renderLog\s*\(\s*\)\s*\{\s*)(\n\s*)try\s*\{/;
  if (!re.test(t)) {
    console.warn('⚠️ cashier.js: не найден "async function renderLog() { try {"');
    return t;
  }
  return t.replace(re, (m, head, nl) =>
    `${head}${nl}  /* EARLY-PENDING v1: pending рисуем до api('/staff/log'), не зависит от его успеха */` +
    `${nl}  try { if (typeof window.loadPending === 'function') await window.loadPending(); } catch (_) {}` +
    `${nl}  try {`
  );
});

/* ── 4. sw.js: bump STATIC_CACHE ── */
modify('public/sw.js', (t) => {
  let found = false;
  const out = t.replace(/(zerno-static-v)(\d+)/, (m, p, n) => { found = true; const nn = Number(n) + 1; console.log(`   STATIC_CACHE: ${p}${n} → ${p}${nn}`); return p + nn; });
  return found ? out : t;
});

console.log('\nИзменённые файлы:');
changed.forEach(f => console.log(' - ' + f));
console.log('\nДалее: npx playwright test tests/ui-baseline.spec.js -g "pending"\n');