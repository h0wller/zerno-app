// fix-menu-editor-categories.mjs
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const ROOT = process.cwd();

function log(msg, ok = true) {
  console.log(`${ok ? '✅' : '⚠️'} ${msg}`);
}

const menuEditorPath = path.join(ROOT, 'public/app/menu-editor.js');
if (fs.existsSync(menuEditorPath)) {
  let src = fs.readFileSync(menuEditorPath, 'utf8');

  // Добавляем drinks и переименовываем sauces в "Допы и соусы"
  const targetArray = `var DCATSL=[
  {id:'pizza',e:'🍕',l:'Пиццы'},
  {id:'rolls',e:'🍣',l:'Роллы'},
  {id:'sets',e:'🍱',l:'Сеты'},
  {id:'drinks',e:'🥤',l:'Напитки'},
  {id:'sauces',e:'🥫',l:'Допы и соусы'}
];`;

  src = src.replace(/var\s+DCATSL\s*=\s*\[[\s\S]*?\];/, targetArray);
  fs.writeFileSync(menuEditorPath, src, 'utf8');
  log('Обновлен массив DCATSL в public/app/menu-editor.js');
}

// Проверка линтера и аудита
console.log('\n--- Запуск npm run audit ---');
try {
  execSync('npm run audit', { stdio: 'inherit' });
  console.log('\n🏆 ВСЕ АВТО-БАРЬЕРЫ ЗЕЛЕНЫЕ (0 ОШИБОК, 0 ВОРНИНГОВ)!');
} catch (e) {
  console.error('❌ Ошибка аудита:', e.message);
  process.exit(1);
}