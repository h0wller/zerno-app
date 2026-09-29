#!/usr/bin/env node
/**
 * scripts/fix-address-btn-native.mjs
 * ADDR-BTN-NATIVE v1: кнопка «Мои адреса» в родном стиле доставки.
 *  1) address-book.js: кнопка создаётся с системными классами "btn ghost addr-book-btn"
 *     (цвета/бордеры наследует от дизайн-системы, бренд перекрашивает сам).
 *  2) theme-v2.css: brace-matching удаляет ВСЕ поколения правил .addr-book-btn,
 *     взамен — только геометрия (align-self/width/margin), без цветов.
 *  3) sw.js: bump STATIC_CACHE.
 * Запуск: node scripts/fix-address-btn-native.mjs
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

/* ── 1. address-book.js: системные классы кнопки ── */
function patchAddressBook(text) {
  if (text.indexOf('ADDR-BTN-NATIVE v1') !== -1) return text;
  let out = text;
  const re = /btn\.className = 'addr-book-btn';/;
  if (re.test(out)) {
    out = out.replace(re, "btn.className = 'btn ghost addr-book-btn'; /* ADDR-BTN-NATIVE v1 */");
  } else {
    warnings.push('address-book.js: строка создания класса кнопки не найдена');
  }
  return out;
}

/* ── 2. theme-v2.css: вырез всех .addr-book-btn + геометрия без цветов ── */
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\s+/g, ' ').trim();

function dropBtnRules(css) {
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
    const body = css.slice(open + 1, j - 1);
    pos = j;
    if (/^@media/i.test(sel) || /^@supports/i.test(sel)) {
      const inner = dropBtnRules(body);
      if (inner.trim()) out += sel + ' {' + inner + '}\n';
    } else if (/^@/.test(sel)) {
      out += sel + ' {' + body + '}\n';
    } else {
      const parts = sel.split(',')
        .map(function (p) { return p.trim(); })
        .filter(function (p) { return p && !/^\.addr-book-btn\b/.test(stripComments(p)); });
      if (parts.length) out += parts.join(',\n') + ' {' + body + '}\n';
    }
  }
  return out;
}

const BTN_CANON = `
/* ── ADDR-BTN-NATIVE v1: «Мои адреса» = системная .btn.ghost, здесь только геометрия ── */
.addr-book-btn {
  align-self: flex-start;
  width: fit-content;
  max-width: 100%;
  margin-bottom: 8px;
}
`;

function patchThemeCss(text) {
  let out = dropBtnRules(text);
  if (out.indexOf('ADDR-BTN-NATIVE v1') === -1) out = out.trimEnd() + '\n' + BTN_CANON;
  return out;
}

try {
  console.log('Task: ADDR-BTN-NATIVE v1 (родной стиль кнопки «Мои адреса»)...\n');

  console.log('address-book.js: системные классы btn ghost...');
  modifyFile('public/app/core/address-book.js', patchAddressBook);

  console.log('theme-v2.css: вырез цветов кнопки + геометрия...');
  modifyFile('public/app/ui/theme-v2.css', patchThemeCss);

  console.log('sw.js: bump STATIC_CACHE...');
  modifyFile('public/sw.js', patchSwCache);

  if (warnings.length) { console.warn('\nПредупреждения:'); warnings.forEach(function (w) { console.warn(' - ' + w); }); }
  if (changed.length) { console.log('\nИзменённые файлы:'); changed.forEach(function (f) { console.log(' - ' + f); }); }
  console.log('\nГотово.\n');
  process.exit(0);
} catch (err) {
  console.error('\n❌ Ошибка скрипта:');
  console.error(err);
  process.exit(1);
}