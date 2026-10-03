#!/usr/bin/env node
/**
 * scripts/revert-lcp-inline-desc.mjs — откат inline CSS для .card .desc (регресс LCP +2232ms, TBT +998ms)
 *
 * Что делает: удаляет <style id="lcp-inline-desc-css"> из index.html.
 * Что НЕ трогает: inline CSS для <h1> (работает), views.js, theme-v2.css.
 *
 * Использование:
 *   node scripts/revert-lcp-inline-desc.mjs            # dry-run
 *   node scripts/revert-lcp-inline-desc.mjs --write    # применить
 */
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
function findProjectRoot() {
  const candidates = [path.resolve(__dirname, '..'), __dirname, process.cwd(), path.resolve(process.cwd(), '..')];
  for (const c of candidates) if (fsSync.existsSync(path.join(c, 'public', 'index.html'))) return c;
  return null;
}
const ROOT = findProjectRoot();
if (!ROOT) { console.error('\x1b[31m✗\x1b[0m Не найден корень проекта'); process.exit(1); }
const WRITE = process.argv.includes('--write');
const C = { g: '\x1b[32m', y: '\x1b[33m', d: '\x1b[2m', rst: '\x1b[0m' };
const ok = (m) => console.log(`${C.g}✓${C.rst} ${m}`);
function backup(p, tag) { const b = `${p}.bak-${tag}`; if (!fsSync.existsSync(b)) fsSync.copyFileSync(p, b); }

async function bumpSw() {
  const F = path.join(ROOT, 'public', 'sw.js');
  const src = await fs.readFile(F, 'utf8');
  const re = /const STATIC_CACHE = 'zerno-static-v(\d+)\s*';/;
  const m = src.match(re);
  if (!m) return;
  const next = String(Number(m[1]) + 1);
  if (WRITE) await fs.writeFile(F, src.replace(re, `const STATIC_CACHE = 'zerno-static-v${next}';`), 'utf8');
  console.log(`${C.g}~${C.rst} sw.js: zerno-static-v${m[1]} → v${next}`);
}

const MARKER = 'LCP-INLINE-DESC v1';

(async () => {
  const F = path.join(ROOT, 'public', 'index.html');
  let src = await fs.readFile(F, 'utf8');
  
  if (!src.includes(MARKER)) { ok('index.html: LCP-INLINE-DESC v1 не применён'); return; }
  
  const startTag = '<style id="lcp-inline-desc-css">';
  const s = src.indexOf(startTag);
  const e = src.indexOf('</style>', s);
  
  if (s === -1 || e === -1) { ok('inline-desc не найден — нечего удалять'); return; }
  
  const out = src.slice(0, s) + src.slice(e + '</style>'.length);
  
  if (!WRITE) {
    console.log(`${C.d}plan:${C.rst} index.html: удалить <style id="lcp-inline-desc-css"> (+бамп sw.js)`);
    console.log(`${C.d}Применить: node scripts/revert-lcp-inline-desc.mjs --write${C.rst}`);
    return;
  }
  
  backup(F, 'revertinlinedesc');
  await fs.writeFile(F, out, 'utf8');
  ok('index.html: LCP-INLINE-DESC v1 удалён (.bak-revertinlinedesc)');
  await bumpSw();
})().catch((e) => { console.error('\n💥', e); process.exit(1); });