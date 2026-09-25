/* F5.9b-robust: поднять специфичность 5 селекторов в блоке F5.9 theme-v2.css.
Ищет по подстроке 'F5.9' в файле theme-v2.css. */
import fs from 'node:fs';
const P = 'public/app/ui/theme-v2.css';
const MAP = {
  '.stamp.f': '#pvBonus .stamp.f',
  '.stamp.e': '#pvBonus .stamp.e',
  '.freeCard': '#pvBonus .freeCard',
  '.freeCard b': '#pvBonus .freeCard b',
  '.freeCard button': '#pvBonus .freeCard button',
};

let s = fs.readFileSync(P, 'utf8');
const i = s.indexOf('F5.9');
if (i < 0) { console.error('❌ F5.9 не найден в theme-v2.css'); process.exit(1); }

/* Работаем только с хвостом файла от маркера */
const head = s.slice(0, i);
let n = 0;
const tail = s.slice(i).replace(/(^|[{}])\s*([^{}]+)\{/g, (m, brace, sel) => {
  const parts = sel.split(',');
  let changed = false;
  const np = parts.map((p) => {
    const clean = p.replace(/\/\*[\s\S]*?\*\//g, '').trim();
    if (MAP[clean]) { changed = true; n++; return ' ' + MAP[clean]; }
    return p;
  });
  return changed ? brace + np.join(',') + '{' : m;
});
fs.writeFileSync(P, head + tail);
console.log('✅ компенсировано селекторов:', n, '(ожидаем 5)');