/* Ф6.2: гигиена транзишенов по аудиту non-composited animations.
Одеяльные transition (.35s / .2s / all .2s / .25s) анимируют border-*, box-shadow,
font-size, z-index → non-composited → джанк и микро-шифты. Заменяем явными списками:
- .modal-card: только opacity+transform (визуально идентично открытию модалок)
- .btn: transform+opacity+box-shadow
- .venueToggle (Слой 2, views.js): background+transform+border-color вместо all
- .donoff input / ::after: background / left
- #cartPromo: transition:none (focus font-size больше не анимирует layout)
skeleton-shimmer не трогаем: paint-only, вне viewport-CLS. */
import fs from 'node:fs';
const TH = 'public/app/ui/theme-v2.css';
const VIEWS = 'public/app/core/views.js';
let t = fs.readFileSync(TH, 'utf8');
let n = 0;

/* modal-card: opacity+transform вместо всего */
if (t.includes('transition:.35s cubic-bezier(.2,1,.3,1)')) {
  t = t.replace('transition:.35s cubic-bezier(.2,1,.3,1)',
    'transition:opacity .35s cubic-bezier(.2,1,.3,1),transform .35s cubic-bezier(.2,1,.3,1)');
  n++; console.log('✅ theme-v2: .modal-card → opacity+transform');
}
/* .btn: явный список (внутри правила .btn{...}) */
t = t.replace(/(\.btn\{[^}]*?)transition:\.2s/, (m0, pre) => { n++; console.log('✅ theme-v2: .btn → явный список'); return pre + 'transition:transform .2s,opacity .2s,box-shadow .2s'; });
/* donoff: input → background, ::after → left (по порядку вхождений) */
let don = 0;
t = t.replace(/transition:\.25s/g, (m0) => { don++; return don === 1 ? 'transition:background .25s' : 'transition:left .25s'; });
if (don) { n++; console.log('✅ theme-v2: .donoff input/::after → background/left (' + don + ')'); }
/* cartPromo: без транзишенов вовсе */
if (!t.includes('#cartPromo{transition:none}')) {
  t += '\n/* ── Ф6.2: фокус промо-поля не анимирует font-size (микро-CLS/джанк) ── */\n#cartPromo{transition:none}\n';
  n++; console.log('✅ theme-v2: #cartPromo transition:none');
}
if (n) fs.writeFileSync(TH, t);

/* views.js: venueToggle transition:all .2s → явный список (Слой 2) */
let v = fs.readFileSync(VIEWS, 'utf8');
if (v.includes('transition:all .2s')) {
  const c = (v.match(/transition:all \.2s/g) || []).length;
  v = v.replace(/transition:all \.2s/g, 'transition:background .2s,transform .2s,border-color .2s');
  fs.writeFileSync(VIEWS, v);
  console.log('✅ views.js: venueToggle transition:all → явный список (' + c + ')');
} else console.log('⚠️ views.js: transition:all .2s не найден');