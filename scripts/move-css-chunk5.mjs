/* Ф5.6.1: вербатим-вынос INLINE #4 (>10k символов) в public/app/core/legacy-core.js
с заменой тега НА ТОЙ ЖЕ ПОЗИЦИИ (тайминг классик-скрипта идентичен).
INLINE #2 (gesture-guard) дословно докладывается в state.js.
Ноль семантических изменений. Идемпотентно (аборт, если legacy-core.js уже есть). */
import fs from 'node:fs';
const IDX = 'public/index.html';
const STATE = 'public/app/core/state.js';
const OUT = 'public/app/core/legacy-core.js';

let idx = fs.readFileSync(IDX, 'utf8');
const re = /<script(?![^>]*\bsrc\b)[^>]*>([\s\S]*?)<\/script>/g;
let m, big = null, bigStart = -1, bigEnd = -1, gest = null, gStart = -1, gEnd = -1;
while ((m = re.exec(idx))) {
  const body = m[1];
  if (big === null && body.length > 10000) { big = body; bigStart = m.index; bigEnd = m.index + m[0].length; }
  else if (gest === null && /gesturestart/.test(body)) { gest = body; gStart = m.index; gEnd = m.index + m[0].length; }
}
if (!big) { console.error('❌ INLINE #4 не найден'); process.exit(1); }
if (fs.existsSync(OUT)) { console.error('❌ legacy-core.js уже существует — аборт (идемпотентность)'); process.exit(1); }

fs.writeFileSync(OUT, big.trim() + '\n');
idx = idx.slice(0, bigStart) + '<script src="./app/core/legacy-core.js"></script>' + idx.slice(bigEnd);

if (gest && gEnd < bigStart) {
  let st = fs.readFileSync(STATE, 'utf8');
  st += '\n/* ── Ф5.6.1: iOS gesture-guard (было INLINE #2 index.html, дословно) ── */\n' + gest.trim() + '\n';
  fs.writeFileSync(STATE, st);
  idx = idx.slice(0, gStart) + idx.slice(gEnd);   // gEnd < bigStart → индексы валидны после первого среза
  console.log('✅ INLINE #2 дословно долит в state.js и удалён из index.html');
} else console.log('⚠️ INLINE #2 (gesturestart) не найден или порядок срезов небезопасен — пропуск');

fs.writeFileSync(IDX, idx);
console.log('✅ INLINE #4 →', OUT, '(' + big.length + ' символов, тег заменён на той же позиции)');