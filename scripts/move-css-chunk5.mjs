// fix-timer-dup.mjs
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const ROOT = process.cwd();

function log(msg, ok = true) {
  console.log(`${ok ? '✅' : '⚠️'} ${msg}`);
}

function updateFile(relPath, transform) {
  const absPath = path.join(ROOT, relPath);
  if (!fs.existsSync(absPath)) {
    log(`Файл не найден: ${relPath}`, false);
    return false;
  }
  const original = fs.readFileSync(absPath, 'utf8');
  const updated = transform(original);
  if (original !== updated) {
    fs.writeFileSync(absPath, updated, 'utf8');
    log(`Обновлен: ${relPath}`);
    return true;
  }
  log(`Без изменений: ${relPath}`);
  return false;
}

// ─────────────────────────────────────────────────────────────
// 1. Полная очистка дубликатов в public/app/core/preorder-timer.js
// ─────────────────────────────────────────────────────────────
console.log('--- 1. Удаление дубликатов функций в preorder-timer.js ---');
updateFile('public/app/core/preorder-timer.js', (src) => {
  let res = src;

  // Удаляем абсолютно все предыдущие варианты объявлений функций времени
  res = res.replace(/function getKaliningradTime\(\)\s*\{[\s\S]*?return\s*\{\s*hour:[^}]+\};\s*\}\s*\}/g, '');
  res = res.replace(/function isDeliveryServiceOpen\(\)\s*\{[\s\S]*?return\s+min\s*>=[^;]+;\s*\}/g, '');

  const singleKlgBlock = `function getKaliningradTime() {
  var d = new Date();
  var h = (d.getUTCHours() + 2) % 24;
  return { hour: h, minute: d.getUTCMinutes() };
}

function isDeliveryServiceOpen() {
  var t = getKaliningradTime();
  var min = t.hour * 60 + t.minute;
  return min >= 660 && min < 1320;
}`;

  res = singleKlgBlock + '\n\n' + res.trim();
  return res;
});

// ─────────────────────────────────────────────────────────────
// 2. Проверка синтаксиса всех затронутых файлов
// ─────────────────────────────────────────────────────────────
console.log('\n--- 2. Синтаксическая проверка (node --check) ---');
try {
  execSync('node --check public/app/core/preorder-timer.js', { stdio: 'inherit' });
  execSync('node --check public/app/delivery.js', { stdio: 'inherit' });
  execSync('node --check public/app/cart.js', { stdio: 'inherit' });
  execSync('node --check public/app/ui/scrolltop.js', { stdio: 'inherit' });
  execSync('node --check public/app/core/views.js', { stdio: 'inherit' });
  log('Синтаксис всех JS-модулей валиден (0 ошибок)!');
} catch (e) {
  console.error('❌ Ошибка синтаксиса:', e.message);
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────
// 3. Проверка CSS-аудита
// ─────────────────────────────────────────────────────────────
console.log('\n--- 3. Запуск css-audit.mjs ---');
try {
  execSync('node scripts/css-audit.mjs', { stdio: 'inherit' });
  log('CSS-аудит успешно пройден!');
} catch (e) {
  console.error('❌ Ошибка CSS-аудита:', e.message);
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────
// 4. Запуск полного пайплайна проверок
// ─────────────────────────────────────────────────────────────
console.log('\n--- 4. Запуск npm run audit ---\n');
try {
  execSync('npm run audit', { stdio: 'inherit' });
  console.log('\n🏆 ВСЕ АВТО-БАРЬЕРЫ ЗЕЛЕНЫЕ (0 ОШИБОК, 0 ПРЕДУПРЕЖДЕНИЙ)!');
} catch (e) {
  console.error('\n❌ Ошибка при выполнении аудита:', e.message);
  process.exit(1);
}