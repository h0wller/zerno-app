/* Ф5.8f-fix: lastOrderNo отделить от window.ordersPoll.
Составное объявление `var ordersPoll = null, lastOrderNo = 0;` после замены первого
декларатора оставило голое присваивание в strict-модуле → ReferenceError на eval.
lastOrderNo приватный для orders.js → module-private let. */
import fs from 'node:fs';
const P = 'public/app/orders.js';
let s = fs.readFileSync(P, 'utf8');
const re = /window\.ordersPoll = null,\s*lastOrderNo = 0;/;
if (!re.test(s)) { console.error('❌ составная строка не найдена (уже починено?)'); process.exit(1); }
s = s.replace(re, 'window.ordersPoll = null;\nlet lastOrderNo = 0; /* Ф5.8f-fix: module-private */');
fs.writeFileSync(P, s);
console.log('✅ orders.js: lastOrderNo → module-private let');