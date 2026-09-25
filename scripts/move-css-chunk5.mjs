/* F5.10: механический перенос секции «кассир» из inline <style> index.html
в theme-v2.css (Слой 1) и views.js (Слой 2).
Предохранители F5.9: якорь ]; перед css.textContent; бренд-строки однострочные;
!important без карты специфичности НЕ переносится (остаётся в Слое 0 списком). */
import fs from 'node:fs';

const IDX = 'public/index.html';
const THEME = 'public/app/ui/theme-v2.css';
const VIEWS = 'public/app/core/views.js';
const M_START = '/* ══ кассир ══ */';
const M_END = '/* ══ служебное ══ */';

/* Карта специфичности вместо !important. Пустая на первом прогоне:
если skipped непустой — досылаем записи отдельным фиксом (как fix-chunk4-spec). */
const SPEC_MAP = {
  // '.selector': '#ancestor .selector',
};

let idx = fs.readFileSync(IDX, 'utf8');
const s = idx.indexOf(M_START);
const e = idx.indexOf(M_END);
if (s < 0 || e < 0 || e < s) {
  console.error('❌ Маркеры секций не найдены. Доступные:');
  console.error((idx.match(/\/\* ══.+?══ \*\//g) || []).join('\n'));
  process.exit(1);
}
const block = idx.slice(s, e);

function splitRules(css) {
  const out = []; let depth = 0, cur = '', inC = false;
  for (let i = 0; i < css.length; i++) {
    const ch = css[i], nx = css[i + 1];
    if (inC) { cur += ch; if (ch === '*' && nx === '/') { cur += nx; i++; inC = false; } continue; }
    if (ch === '/' && nx === '*') { inC = true; cur += ch + nx; i++; continue; }
    if (ch === '{') depth++;
    if (ch === '}') { depth--; cur += ch; if (depth === 0) { out.push(cur.trim()); cur = ''; } continue; }
    cur += ch;
  }
  return out.filter(r => r.replace(/\/\*[\s\S]*?\*\//g, '').trim());
}

const base = [], brand = [], skipped = [];
for (const rule of splitRules(block)) {
  if (rule.trimStart().startsWith('[data-brand')) { brand.push(rule); continue; }
  if (rule.includes('!important')) {
    const bi = rule.indexOf('{');
    const parts = rule.slice(0, bi).trim().split(',').map(x => x.trim());
    if (!parts.every(p => SPEC_MAP[p])) { skipped.push(rule); continue; }
    base.push(parts.map(p => SPEC_MAP[p]).join(',') + ' ' + rule.slice(bi).replace(/!important/g, ''));
  } else base.push(rule);
}

/* Слой 0: секцию вырезаем, skipped-правила оставляем на месте */
const residual = skipped.length
  ? '/* ══ кассир: правила с !important, ждут ручной доработки (F5.10) ══ */\n' + skipped.join('\n') + '\n'
  : '';
idx = idx.slice(0, s) + residual + idx.slice(e);

/* Слой 1 */
fs.appendFileSync(THEME,
  '\n/* ── F5.10 чанк 5: база кассира (было inline <style> index.html) ── */\n' +
  base.join('\n') + '\n');

/* Слой 2: якорь — ]; ПЕРЕД css.textContent = rules.join */
if (brand.length) {
  let vw = fs.readFileSync(VIEWS, 'utf8');
  const anchor = vw.indexOf('css.textContent = rules.join');
  if (anchor < 0) { console.error('❌ views.js: якорь css.textContent не найден'); process.exit(1); }
  const close = vw.lastIndexOf('];', anchor);
  if (close < 0) { console.error('❌ views.js: не найден ]; перед якорем'); process.exit(1); }
  const lines = brand.map(r => "'" + r.replace(/\s*\n\s*/g, ' ').replace(/'/g, "\\'") + "',").join('\n');
  vw = vw.slice(0, close) +
    '/* ── F5.10 чанк 5: брендовый кассир (было inline <style> index.html) ── */\n' +
    lines + '\n' + vw.slice(close);
  fs.writeFileSync(VIEWS, vw);
}
fs.writeFileSync(IDX, idx);

console.log('✅ Перенесено: база →', base.length, '| бренд →', brand.length);
if (skipped.length) {
  console.log('⚠️ Оставлено в Слое 0 (!important без компенсации):', skipped.length);
  skipped.forEach(r => console.log('   ', r.split('{')[0].trim()));
} else console.log('✅ Хвостов не осталось');