/* Откат product-отклонённых экспериментов F5.18/F5.18b/F5.19 в theme-v2.css:
1) сиротский фрагмент F5.18 (декларации без селектора, баланс -1) — если ещё жив;
2) media-блок F5.18 с .mbonus left:8px/::before (сломанный бейдж-колонка);
3) всё, что дописано после маркера F5.18b (рейл ×2 и бейдж-круг F5.19).
Итог: mbonus = F5.16b (компакт по центру над FAB) + IO F5.17; рейл = F5.17.
JS-хвосты (dataset.st/free в profile.js, дефолт в panel.js) инертны — не трогаем. */
import fs from 'node:fs';
const P = 'public/app/ui/theme-v2.css';
let lines = fs.readFileSync(P, 'utf8').split('\n');

/* 1) сирота F5.18 */
for (let i = 0; i < lines.length - 4; i++) {
  if (lines[i].trim() === '@media (max-width: 1180px) {' &&
      lines[i + 1].trim().startsWith('min-height: 104px') &&
      lines[i + 3].trim() === '}' && lines[i + 4].trim() === '}') {
    lines.splice(i, 5); console.log('✅ сиротский фрагмент удалён'); break;
  }
}
/* 2) media-блок F5.18 с бейджем-колонкой (11 строк) */
for (let i = 0; i < lines.length - 10; i++) {
  if (lines[i].trim() === '@media (max-width: 820px) {' &&
      lines[i + 1].trim() === '.mbonus {' &&
      lines[i + 2].includes('left: 8px') &&
      lines[i + 10].trim() === '}') {
    lines.splice(i, 11); console.log('✅ бейдж-колонка F5.18 удалён'); break;
  }
}
/* 3) всё после маркера F5.18b (рейл ×2 + бейдж-круг F5.19) */
const j = lines.findIndex(l => l.includes('F5.18b:'));
if (j >= 0) { lines = lines.slice(0, j); console.log('✅ хвост F5.18b/F5.19 обрезан'); }

const out = lines.join('\n');
fs.writeFileSync(P, out);
const css = out.replace(/\/\*[\s\S]*?\*\//g, '');
let depth = 0; for (const ch of css) { if (ch === '{') depth++; if (ch === '}') depth--; }
console.log('баланс скобок:', depth);
if (depth !== 0 || /\[data-brand\s*=/.test(css)) { console.error('❌ баланс/Правило 2 не чисты — покажи хвост'); process.exit(1); }