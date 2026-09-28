/* Ф5.31: шапочный док ≥821px без ограничений колонки из Ф5.26.
max-width:72px срезал инлайн-ширину от syncHeaderCluster (уравнение краёв шапки),
flex-direction:column ставил контент столбиком на 821–1180px.
Оверрайд: width:auto (инлайн от JS решает), max-width:none, row-направление.
Мобайл ≤820 не трогаем: колонка 64px из Ф5.29 остаётся продуктовым видом. */
import fs from 'node:fs';
const TH = 'public/app/ui/theme-v2.css';
let t = fs.readFileSync(TH, 'utf8');
if (t.includes('Ф5.31')) { console.log('⚠️ theme-v2: блок Ф5.31 уже есть'); process.exit(0); }
t += '/* ── Ф5.31: док шапки ≥821: ширина из JS-уравнения, без капа 72px и колонки Ф5.26 ── */\n' +
  '@media (min-width: 821px) {\n' +
  '#mbonusBtn { width: auto; max-width: none; flex-direction: row; }\n' +
  '}\n';
fs.writeFileSync(TH, t);
console.log('✅ theme-v2: блок Ф5.31 (док шапки длиннее, по уравнению краёв)');