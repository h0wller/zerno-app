/* Ф5.26-fix: резина шапки без дубля селектора (Правило 7 аудита).
Удаляем отдельное правило .topbar{height:auto;…}, вставленное Ф5.26, и переносим
резину ВНУТРЬ базового правила шапки: height:calc(…) → height:auto;min-height:calc(…).
Поведение то же (modeSeg во 2-м ряду грида ≥821 не выливается), селектор один. */
import fs from 'node:fs';
const P = 'public/app/core/views.js';
let s = fs.readFileSync(P, 'utf8');
let changed = false;

/* 1) убрать отдельное правило Ф5.26 */
const solo = /'\.topbar\{height:auto;min-height:calc\(var\(--topbar-h,64px\) \+ env\(safe-area-inset-top,0px\)\)\}',[^\n]*\n/;
if (solo.test(s)) { s = s.replace(solo, ''); changed = true; console.log('✅ views.js: отдельное правило .topbar удалено'); }
else console.log('⚠️ views.js: отдельное правило не найдено (уже удалено?)');

/* 2) резина внутри базового правила */
const baseOld = "height:calc(var(--topbar-h,64px) + var(--sat, env(safe-area-inset-top,0px)));padding:var(--sat";
const baseNew = "height:auto;min-height:calc(var(--topbar-h,64px) + var(--sat, env(safe-area-inset-top,0px)));padding:var(--sat";
const n = (s.split(baseOld).length - 1);
if (n === 1) { s = s.replace(baseOld, baseNew); changed = true; console.log('✅ views.js: базовое .topbar → height:auto + min-height'); }
else if (s.includes(baseNew)) console.log('⚠️ views.js: базовое правило уже резиновое');
else { console.error('❌ views.js: базовая декларация height шапки не найдена (вхождений: ' + n + ')'); process.exit(1); }

if (changed) fs.writeFileSync(P, s);