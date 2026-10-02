// fix-fitsearch.mjs
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const ROOT = process.cwd();
const viewsPath = path.join(ROOT, 'public/app/core/views.js');

if (!fs.existsSync(viewsPath)) {
  console.error('❌ views.js не найден');
  process.exit(1);
}

let src = fs.readFileSync(viewsPath, 'utf8');

// Исправляем необъявленную переменную i в fitSearch и по всему views.js
const fixed = src.replace(/for\s*\(\s*i\s*=\s*0;/g, 'for (let i = 0;');

if (src !== fixed) {
  fs.writeFileSync(viewsPath, fixed, 'utf8');
  console.log('✅ views.js: "for (i = 0;" заменено на безопасный блочный "for (let i = 0;"');
} else {
  // Если объявление выглядело иначе, находим функцию fitSearch и явно объявляем let i
  const fitSearchRegex = /function\s+fitSearch\s*\([^)]*\)\s*\{/;
  if (fitSearchRegex.test(src)) {
    src = src.replace(fitSearchRegex, '$&\n  let i = 0;');
    fs.writeFileSync(viewsPath, src, 'utf8');
    console.log('✅ views.js: переменная let i объявлена в начале fitSearch');
  }
}

// 1. Проверка синтаксиса
console.log('\n--- 1. Проверка синтаксиса (node --check) ---');
try {
  execSync('node --check public/app/core/views.js', { stdio: 'inherit' });
  console.log('✅ Синтаксис views.js корректен!');
} catch (e) {
  console.error('❌ Ошибка синтаксиса:', e.message);
  process.exit(1);
}

// 2. Проверка линтера и аудита
console.log('\n--- 2. Запуск npm run audit ---');
try {
  execSync('npm run audit', { stdio: 'inherit' });
  console.log('\n🏆 ВСЕ БАРЬЕРЫ ЗЕЛЕНЫЕ (0 ОШИБОК, 0 ВОРНИНГОВ)!');
} catch (e) {
  console.error('❌ Ошибка аудита:', e.message);
  process.exit(1);
}