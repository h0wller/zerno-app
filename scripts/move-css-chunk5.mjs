/* F5.8h-fix2: coffeePool вызывала саму себя (RangeError: Maximum call stack size exceeded).
v2-скрипт вставил DEF с MENU.filter( ВНУТРИ и затем глобальной заменой MENU.filter( →
coffeePool().filter( попал в собственный DEF. Восстанавливаем MENU.filter в определении.
Регламент: глобальные замены не должны задевать только что вставленный текст —
вставлять DEF с плейсхолдером или менять до вставки. */
import fs from 'node:fs';
const P = 'public/app/menu.js';
let s = fs.readFileSync(P, 'utf8');
const BAD = 'function coffeePool() { return coffeePool().filter(';
if (!s.includes(BAD)) { console.log('⚠️ рекурсивное определение не найдено (уже починено?)'); process.exit(0); }
s = s.replace(BAD, 'function coffeePool() { return MENU.filter(');
fs.writeFileSync(P, s);
console.log('✅ menu.js: coffeePool больше не рекурсивна');