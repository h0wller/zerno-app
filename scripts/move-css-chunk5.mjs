/* F5.19b: удалить сиротский фрагмент в theme-v2.css — тело правила F5.18,
оставшееся без селектора после построчной чистки F5.18b (баланс скобок -1).
Хирургия построчно: ищем @media (max-width: 1180px) {, за которым СРАЗУ идут
декларации min-height: 104px / font-size: 11.5px и две закрывающие скобки. */
import fs from 'node:fs';
const P = 'public/app/ui/theme-v2.css';
let lines = fs.readFileSync(P, 'utf8').split('\n');
let at = -1;
for (let i = 0; i < lines.length - 4; i++) {
  if (lines[i].trim() === '@media (max-width: 1180px) {' &&
      lines[i + 1].trim().startsWith('min-height: 104px') &&
      lines[i + 2].trim().startsWith('font-size: 11.5px') &&
      lines[i + 3].trim() === '}' && lines[i + 4].trim() === '}') { at = i; break; }
}
if (at < 0) { console.error('❌ сиротский фрагмент не найден (уже удалён?)'); process.exit(1); }
lines.splice(at, 5);
const out = lines.join('\n');
fs.writeFileSync(P, out);

/* контроль баланса скобок вне комментариев */
const css = out.replace(/\/\*[\s\S]*?\*\//g, '');
let depth = 0;
for (const ch of css) { if (ch === '{') depth++; if (ch === '}') depth--; }
console.log('✅ сирота удалена (строки', at + 1, '–', at + 5, '); баланс скобок:', depth);
if (depth !== 0) { console.error('❌ баланс всё ещё ≠ 0 — покажи хвост файла'); process.exit(1); }