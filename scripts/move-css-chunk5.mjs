/* Ф5.6-финал шаг 3 (v2): utils/api/ui/auth/panel → module-импорты в ГОЛОВУ main.js.
v1 упал на ложном контракте: window.api объявляет ui.js (Ф5.2), а core/api.js (F1.2)
экспортирует API_BASE/fetchJSON через Object.assign. Контракты исправлены по бандлу.
Порядок головы = прежний документ-порядок (utils→api→ui→auth→panel): auth на eval
зовёт bindMask (utils), views/overlay/boot зовут setTab/closePanel (panel) в рантайме. */
import fs from 'node:fs';
const MAIN = 'public/app/main.js';
const IDX = 'public/index.html';
const FILES = [
  { rel: './core/utils.js', tag: 'app/core/utils.js', contract: 'Object.assign(window,' },
  { rel: './core/api.js',   tag: 'app/core/api.js',   contract: 'fetchJSON' },
  { rel: './core/ui.js',    tag: 'app/core/ui.js',    contract: 'window.toast' },
  { rel: './core/auth.js',  tag: 'app/core/auth.js',  contract: 'window.openAuth' },
  { rel: './core/panel.js', tag: 'app/core/panel.js', contract: 'window.setTab' },
];
let m = fs.readFileSync(MAIN, 'utf8');
const first = m.indexOf("import './core/catalog.js';");
if (first < 0) { console.error('❌ main.js: якорь import catalog.js не найден'); process.exit(1); }
let ins = '';
for (const f of FILES) {
  const src = fs.readFileSync('public/' + f.tag, 'utf8');
  if (!src.includes(f.contract)) { console.error('❌ ' + f.tag + ': нет контракта ' + f.contract); process.exit(1); }
  if (m.includes("import '" + f.rel + "';")) { console.log('⚠️ ' + f.rel + ': уже импортируется'); continue; }
  ins += "import '" + f.rel + "'; /* Ф5.6-финал шаг 3 */\n";
}
m = m.slice(0, first) + ins + m.slice(first);
fs.writeFileSync(MAIN, m);
console.log('✅ main.js: импорты core-5 в голове списка');

let idx = fs.readFileSync(IDX, 'utf8');
for (const f of FILES) {
  const re = new RegExp('<script[^>]*src="[^"]*' + f.tag.replace(/[./]/g, '\\$&') + '"[^>]*><\\/script>[ \\t]*\\r?\\n?');
  if (re.test(idx)) { idx = idx.replace(re, ''); console.log('✅ index.html: тег ' + f.tag + ' удалён'); }
  else console.log('⚠️ index.html: тег ' + f.tag + ' не найден');
}
fs.writeFileSync(IDX, idx);