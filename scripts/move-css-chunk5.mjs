/* Ф5.24: ngSave-catch принимает exists-fallthrough сервера (400 {error:'exists'})
наравне с 409: включаем поиск-фолбэк и показ существующей карточки вместо тоста 'exists'.
Валидационные 400 ('Введите имя'/'Введите номер полностью') остаются честным тостом:
сервер и клиент проверяют одинаково, дублей быть не должно. */
import fs from 'node:fs';
const P = 'public/app/cashier.js';
let s = fs.readFileSync(P, 'utf8');
const old = 'if (e.code === 409) {';
const neu = 'if (e.code === 409 || (e.code === 400 && /exists/i.test(e.message || \'\'))) { /* Ф5.24: exists-fallthrough сервера */';
if (s.includes('Ф5.24: exists-fallthrough')) { console.log('⚠️ уже применено'); process.exit(0); }
const n = (s.match(/if \(e\.code === 409\) \{/g) || []).length;
if (n !== 1) { console.error('❌ cashier.js: ожидано 1 вхождение условия 409, найдено ' + n); process.exit(1); }
s = s.replace(old, neu);
fs.writeFileSync(P, s);
console.log('✅ cashier.js: catch ngSave принимает 400-exists как 409');