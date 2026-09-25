/* F5.9b-robust: схлопнуть переводы строк внутри строковых литералов бренд-правил.
Ищет по подстроке 'F5.9' в файле views.js. */
import fs from 'node:fs';
const P = 'public/app/core/views.js';
let s = fs.readFileSync(P, 'utf8');

/* Находим строку-комментарий с F5.9 */
const lines = s.split('\n');
let startLine = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('F5.9')) { startLine = i; break; }
}
if (startLine < 0) {
  console.error('❌ F5.9 не найден в views.js. Первые 30 строк после вставки:');
  const sample = s.indexOf('[data-brand="delivery"]');
  if (sample >= 0) console.error(s.slice(Math.max(0, sample - 100), sample + 400));
  process.exit(1);
}

/* Конец массива rules — первая ]; после startLine */
let endLine = -1;
for (let i = startLine; i < lines.length; i++) {
  if (/^\s*\];\s*$/.test(lines[i])) { endLine = i; break; }
}
if (endLine < 0) { console.error('❌ не найден конец массива rules'); process.exit(1); }

const region = lines.slice(startLine, endLine).join('\n');
const fixed = region.replace(/\s*\n\s*/g, ' ');
const out = lines.slice(0, startLine).join('\n') + '\n' + fixed + '\n' + lines.slice(endLine).join('\n');
fs.writeFileSync(P, out);
console.log('✅ views.js: схлопнуто строк в регионе:', endLine - startLine);