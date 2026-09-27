/* Ф5.25: шимы stampIcon/cupWord из profile.js (владелец) для cashier.js (dotsHTML).
Тот же класс бага, что renderLog/cat/query: после Ф5.8f profile.js — module,
stampIcon/cupWord стали module-private, а dotsHTML зовёт голым. При 0 штампов
вызова нет → тесты были зелены; на карточке с штампами — ReferenceError. */
import fs from 'node:fs';
const P = 'public/app/profile.js';
let s = fs.readFileSync(P, 'utf8');
const add = [];
if (!/window\.stampIcon\s*=/.test(s)) add.push('window.stampIcon = stampIcon; /* Ф5.25: dotsHTML в cashier.js */');
if (!/window\.cupWord\s*=/.test(s)) add.push('window.cupWord = cupWord; /* Ф5.25: тексты списаний/подарков */');
if (!add.length) { console.log('⚠️ profile.js: шимы уже есть'); process.exit(0); }
s += '\n/* ── Ф5.25: ESM-шимы для кассира (точки штампов, склонения чашек) ── */\n' + add.join('\n') + '\n';
fs.writeFileSync(P, s);
console.log('✅ profile.js:', add.length, 'шим(а) добавлено');