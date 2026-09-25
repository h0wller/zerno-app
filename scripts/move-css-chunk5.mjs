/* Ф5.8a-fix: два рантайм-падения после конверсии листьев.
1) fx.js: топ-левельный window.fitFx() → fitFx() (вызов исполняется ДО шима в конце модуля;
   TypeError обрывал модуль: resize-слушатель и window.confetti не выставлялись).
2) review.js: шим window.maybeAskReview (boot.js зовёт голой; после module-конверсии
   функция стала module-private → ReferenceError в буте). */
import fs from 'node:fs';
const FX = 'public/app/core/fx.js';
const RV = 'public/app/core/review.js';

let f = fs.readFileSync(FX, 'utf8');
if (f.includes('window.fitFx();')) {
  f = f.replace('window.fitFx();', 'fitFx(); /* Ф5.8a-fix: локальный инициализационный вызов — шим присваивается ниже */');
  fs.writeFileSync(FX, f);
  console.log('✅ fx.js: window.fitFx() → fitFx()');
} else console.log('⚠️ fx.js: строка window.fitFx(); не найдена — проверь вручную');

let r = fs.readFileSync(RV, 'utf8');
if (!r.includes('window.maybeAskReview =')) {
  r += '\n/* ── Ф5.8a-fix: ESM-шим: boot.js зовёт maybeAskReview голым идентификатором ── */\nwindow.maybeAskReview = maybeAskReview;\n';
  fs.writeFileSync(RV, r);
  console.log('✅ review.js: шим maybeAskReview добавлен');
} else console.log('⚠️ review.js: шим уже есть');