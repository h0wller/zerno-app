/* Ф5.6.2b: конверсия catalog.js в ESM-модуль.
window-шимы для классик-потребителей (boot/views/cashier-log/admin-extra);
тег → type="module" НА ТОЙ ЖЕ ПОЗИЦИИ (модули идут в общем defer-порядке,
порядок относительно defer-классиков сохранён). Идемпотентно. */
import fs from 'node:fs';
const CAT = 'public/app/core/catalog.js';
const IDX = 'public/index.html';
const EXPORTS = ['loadMenu', 'renderModes', 'setMode', 'syncBrandViews'];

let cat = fs.readFileSync(CAT, 'utf8');
if (!cat.includes('window.loadMenu =')) {
  cat += '\n/* ── Ф5.6.2b: ESM-шим: явные window-экспорты для классик-потребителей ── */\n' +
    EXPORTS.map(n => 'window.' + n + ' = ' + n + ';').join('\n') + '\n';
  fs.writeFileSync(CAT, cat);
  console.log('✅ catalog.js: window-шимы', EXPORTS.join(', '));
} else console.log('⚠️ catalog.js: шимы уже есть');

let idx = fs.readFileSync(IDX, 'utf8');
const oldTag = '<script src="./app/core/catalog.js"></script>';
const newTag = '<script type="module" src="./app/core/catalog.js"></script>';
if (idx.includes(newTag)) console.log('⚠️ index.html: тег уже module');
else if (!idx.includes(oldTag)) { console.error('❌ тег catalog.js не найден'); process.exit(1); }
else { fs.writeFileSync(IDX, idx.replace(oldTag, newTag)); console.log('✅ index.html: catalog.js → type="module"'); }