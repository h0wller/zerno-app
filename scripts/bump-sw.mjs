import fs from 'node:fs';
import path from 'node:path';

const SW_PATH = path.resolve('public/sw.js');

if (!fs.existsSync(SW_PATH)) {
  console.error(`❌ Файл не найден: ${SW_PATH}`);
  process.exit(1);
}

let content = fs.readFileSync(SW_PATH, 'utf8');

// Ищем объявление константы STATIC_CACHE (с любыми кавычками)
const cacheRegex = /(STATIC_CACHE\s*=\s*['"])([^'"]+)(['"])/;
const match = content.match(cacheRegex);

if (!match) {
  console.error('❌ Переменная STATIC_CACHE не найдена в public/sw.js');
  process.exit(1);
}

const [, prefix, oldVal, suffix] = match;

// Находим последнее число в значении версии (например, 'zt-v71' -> '71' или 'static-2026-10' -> '11')
const numMatch = oldVal.match(/(\d+)(?!.*\d)/);

let newVal;
if (numMatch) {
  const oldNum = numMatch[0];
  const newNum = String(parseInt(oldNum, 10) + 1).padStart(oldNum.length, '0');
  const startIdx = numMatch.index;
  newVal = oldVal.slice(0, startIdx) + newNum + oldVal.slice(startIdx + oldNum.length);
} else {
  // Фолбэк, если в строке изначально не было чисел
  newVal = `${oldVal}-2`;
}

content = content.replace(cacheRegex, `${prefix}${newVal}${suffix}`);
fs.writeFileSync(SW_PATH, content, 'utf8');

console.log(`✅ STATIC_CACHE в public/sw.js обновлён: "${oldVal}" → "${newVal}"`);