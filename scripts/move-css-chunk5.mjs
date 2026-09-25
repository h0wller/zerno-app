/* F5.11b: растворение residual-блока Слоя 0 (4 правила с !important).
3 системных/layout → views.js однострочными; .ava.pulse-hint → theme-v2 без !important.
Блок и маркер удаляются из index.html. Идемпотентно. */
import fs from 'node:fs';
const IDX = 'public/index.html';
const THEME = 'public/app/ui/theme-v2.css';
const VIEWS = 'public/app/core/views.js';

let idx = fs.readFileSync(IDX, 'utf8');
const m = idx.indexOf('ждут ручной доработки (F5.11)');
if (m < 0) { console.error('❌ residual не найден (уже удалён?)'); process.exit(1); }
const commentStart = idx.lastIndexOf('/*', m);
const closeStyle = idx.indexOf('</style>', m);
if (commentStart < 0 || closeStyle < 0) { console.error('❌ не найдены границы residual'); process.exit(1); }
idx = idx.slice(0, commentStart) + idx.slice(closeStyle);
fs.writeFileSync(IDX, idx);
console.log('✅ index.html: residual-блок удалён');

/* Слой 1: состояние модуля без !important */
let th = fs.readFileSync(THEME, 'utf8');
if (!th.includes('.ava.pulse-hint{')) {
  let add = '\n/* ── F5.11b: подсветка-подсказка аватара (состояние; было residual Слоя 0, !important снят: специфичность .ava.pulse-hint выше .ava и бренд-правил) ── */\n.ava.pulse-hint{animation:pulse-hint 2s infinite;border:2px solid #e8a13a;background:#e8a13a;color:#fff}\n';
  if (!th.includes('@keyframes pulse-hint')) {
    add += '@keyframes pulse-hint{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}\n';
    console.log('⚠️ @keyframes pulse-hint не найдены в theme-v2 — добавлен фолбэк-пульс');
  }
  fs.writeFileSync(THEME, th + add);
  console.log('✅ theme-v2.css: .ava.pulse-hint добавлена');
} else console.log('⚠️ .ava.pulse-hint уже в theme-v2 — пропуск');

/* Слой 2: системные/layout правила, однострочные */
let vw = fs.readFileSync(VIEWS, 'utf8');
if (vw.includes('F5.11b')) { console.log('⚠️ F5.11b уже в views.js — пропуск'); }
else {
  const anchor = vw.indexOf('css.textContent = rules.join');
  if (anchor < 0) { console.error('❌ views.js: якорь css.textContent не найден'); process.exit(1); }
  const close = vw.lastIndexOf('];', anchor);
  if (close < 0) { console.error('❌ views.js: не найден ]; перед якорем'); process.exit(1); }
  const lines = [
    '@media(min-width:1181px){body.is-cashier .panel{display:none}body.is-cashier .wrap{grid-template-columns:1fr}.topbar > :last-child{margin-left:0!important}#profileTopBtn{margin-left:auto;width:46px;height:46px;font-size:18px}}',
    '@media(max-width:640px){#modeSeg button,.modes button,.seg button{padding:6px 7px;font-size:10px}#profileTopBtn{width:44px!important;height:44px!important;min-width:44px!important;flex:0 0 44px!important}.wrap{padding:14px}.grid{grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:11px}.media{position:relative;overflow:hidden;height:120px}.chat{right:8px}.mh-right{margin-left:0;width:100%}}',
    '@media(hover:none) and (pointer:coarse){input,select,textarea{font-size:16px!important}}',
  ].map((r) => "'" + r + "',").join('\n');
  vw = vw.slice(0, close) +
    '/* ── F5.11b: системные правила из residual Слоя 0 (кассир-десктоп, мобильный компакт, анти-zoom iOS) ── */\n' +
    lines + '\n' + vw.slice(close);
  fs.writeFileSync(VIEWS, vw);
  console.log('✅ views.js: 3 системных правила вставлены');
}