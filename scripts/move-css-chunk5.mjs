/* Ф6.1: CLS-резервы по трейсу 27.09 (CLS 0.26, worst 0.2551).
1) theme-v2 (Слой 1): min-height карточке модалки стафф-чата — асинхронный loadScList
   не двигает геометрию и кнопку закрытия (шифты 0.2551/0.1818/0.1734).
2) delivery.js: skelCards получает .skeleton-foot (резерв строки цены/кнопки) —
   реальные карточки не толкают footer.siteFooter (шифт 0.1180).
Габариты марки/авы не трогаем: владелец — critical-блок, вклад 0.0214 ниже шума. */
import fs from 'node:fs';
const TH = 'public/app/ui/theme-v2.css';
const DEL = 'public/app/delivery.js';

let th = fs.readFileSync(TH, 'utf8');
if (!th.includes('Ф6.1')) {
  th += '\n/* ── Ф6.1: CLS-резервы (трейс 27.09): модалка стафф-чата не прыгает при loadScList ── */\n' +
    '#scModal .modal-card { min-height: min(70vh, 380px); box-sizing: border-box; }\n' +
    '.skeleton-foot { height: 46px; margin-top: 10px; border-radius: 12px; }\n';
  fs.writeFileSync(TH, th);
  console.log('✅ theme-v2: min-height #scModal .modal-card + .skeleton-foot');
} else console.log('⚠️ theme-v2: Ф6.1 уже есть');

let d = fs.readFileSync(DEL, 'utf8');
if (!d.includes('skeleton-foot')) {
  const re = /(var c\s*=\s*'<div class="card skeleton-card">[\s\S]*?)(<\/div>';)/;
  if (!re.test(d)) { console.error('❌ delivery.js: шаблон skelCards не найден'); process.exit(1); }
  d = d.replace(re, '$1<div class="skeleton-foot"></div>$2');
  fs.writeFileSync(DEL, d);
  console.log('✅ delivery.js: skelCards + .skeleton-foot (резерв cfoot)');
} else console.log('⚠️ delivery.js: skeleton-foot уже есть');