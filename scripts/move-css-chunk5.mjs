/* Ф5.6.2e: конверсия staffpin.js в ESM-модуль.
window-шимы для классик-потребителей: overlay-core.js (Escape/popstate голыми closePin()),
CLOSE-карта overlay.js (window[fn]), внутренние обработчики кластера.
Тег → type="module" НА ТОЙ ЖЕ ПОЗИЦИИ: модуль исполняется в defer-порядке ПОСЛЕ
classic-кластеров (armPw из editor.js уже существует к моменту вызова openPin). Идемпотентно. */
import fs from 'node:fs';
const P = 'public/app/core/staffpin.js';
const IDX = 'public/index.html';
const EXPORTS = ['openPin', 'closePin', 'tryActivate'];

let s = fs.readFileSync(P, 'utf8');
if (!s.includes('window.openPin =')) {
  s += '\n/* ── Ф5.6.2e: ESM-шим: явные window-экспорты для классик-потребителей ── */\n' +
    EXPORTS.map(n => 'window.' + n + ' = ' + n + ';').join('\n') + '\n';
  fs.writeFileSync(P, s);
  console.log('✅ staffpin.js: шимы', EXPORTS.join(', '));
} else console.log('⚠️ staffpin.js: шимы уже есть');

let idx = fs.readFileSync(IDX, 'utf8');
const oldTag = '<script src="./app/core/staffpin.js"></script>';
const newTag = '<script type="module" src="./app/core/staffpin.js"></script>';
if (idx.includes(newTag)) console.log('⚠️ index.html: тег уже module');
else if (!idx.includes(oldTag)) { console.error('❌ тег staffpin.js не найден'); process.exit(1); }
else { fs.writeFileSync(IDX, idx.replace(oldTag, newTag)); console.log('✅ index.html: staffpin.js → type="module"'); }