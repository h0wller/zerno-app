/* Ф5.6-финал шаг 1-fix2: путь review.js в main.js → ./core/review.js.
404 на одном импорте роняет весь граф модулей (main.js не исполняется целиком).
Плюс превентивный чекер: каждый импорт main.js обязан существовать на диске. */
import fs from 'node:fs';
import path from 'node:path';
const MAIN = 'public/app/main.js';
let s = fs.readFileSync(MAIN, 'utf8');

if (s.includes("import './review.js';")) {
  s = s.replace("import './review.js';", "import './core/review.js';");
  fs.writeFileSync(MAIN, s);
  console.log('✅ main.js: ./review.js → ./core/review.js');
} else if (s.includes("import './core/review.js';")) {
  console.log('⚠️ путь уже верный');
} else {
  console.error('❌ импорт review.js не найден в main.js — покажи строку 42');
  process.exit(1);
}

/* Чекер: все импорты main.js резолвятся в существующие файлы */
const dir = path.dirname(MAIN);
const bad = [];
for (const m of s.matchAll(/import\s+'([^']+)';/g)) {
  const p = path.join(dir, m[1]);
  if (!fs.existsSync(p)) bad.push(m[1]);
}
if (bad.length) { console.error('❌ несуществующие импорты:', bad.join(', ')); process.exit(1); }
console.log('✅ все импорты main.js существуют на диске');