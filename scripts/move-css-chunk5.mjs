/* F5.13b: слить два правила [data-brand="delivery"] .topbar .brand .mark в views.js.
Каскад до чанка 8: старое правило views.js побеждало конфликты (инжект позже большого <style>),
уникальные декларации большого стиля применялись. Слияние = union, старое перебивает конфликты. */
import fs from 'node:fs';
const P = 'public/app/core/views.js';
const SEL = '[data-brand="delivery"] .topbar .brand .mark';
let s = fs.readFileSync(P, 'utf8');

const anchor = s.indexOf('css.textContent = rules.join');
const close = s.lastIndexOf('];', anchor);
const region = s.slice(0, close);
const lines = region.split('\n');

const hits = [];
lines.forEach((l, i) => {
  const t = l.trim();
  if (!t.startsWith("'")) return;
  const unq = t.slice(1).replace(/\\'/g, "'");
  const bi = unq.indexOf('{');
  if (bi < 0) return;
  if (unq.slice(0, bi).trim() === SEL) hits.push(i);
});
if (hits.length !== 2) {
  console.error('❌ ожидалось 2 вхождения, найдено:', hits.length);
  hits.forEach(i => console.error('   ', lines[i].slice(0, 120)));
  process.exit(1);
}
const [iOld, iNew] = hits;
const bodyOf = (line) => {
  const u = line.trim().slice(1);
  return u.slice(u.indexOf('{') + 1, u.lastIndexOf('}'));
};
const decls = (b) => b.split(';').map(d => d.trim()).filter(Boolean);
const map = {};
decls(bodyOf(lines[iNew])).forEach(d => { map[d.slice(0, d.indexOf(':')).trim()] = d; });
decls(bodyOf(lines[iOld])).forEach(d => { map[d.slice(0, d.indexOf(':')).trim()] = d; }); // старое перебивает
const merged = Object.values(map).join(';');
const selRaw = lines[iOld].trim().slice(1);
lines[iOld] = "'" + selRaw.slice(0, selRaw.indexOf('{')) + '{' + merged + "}',";
lines.splice(iNew, 1);
s = lines.join('\n') + s.slice(close);
fs.writeFileSync(P, s);
console.log('✅ слито: деклараций было', decls(bodyOf(lines[iOld])).length, '+', decls(bodyOf(lines[iNew])).length, '→ стало', Object.keys(map).length);