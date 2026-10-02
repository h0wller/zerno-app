// fix-tg-redirect.mjs
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
// 1. Исправление public/app/core/auth.js (window.open -> window.location.href)
// ─────────────────────────────────────────────────────────────
console.log('--- 1. Исправление редиректа в auth.js ---');
updateFile('public/app/core/auth.js', (src) => {
  // Заменяем window.open(r.tgUrl, '_blank') на плавный переход по location.href
  const targetSnippet = "window.open(r.tgUrl, '_blank');";
  const replacementSnippet = `if (r && r.tgUrl) {
          toast('Открываем Telegram...', '🤖');
          setTimeout(function() {
            window.location.href = r.tgUrl;
          }, 250);
        }`;
  
  if (src.includes(targetSnippet)) {
    return src.replace(targetSnippet, replacementSnippet);
  }
  return src;
});

// ─────────────────────────────────────────────────────────────
// 2. Инкремент STATIC_CACHE в public/sw.js
// ─────────────────────────────────────────────────────────────
console.log('\n--- 2. Бамп версии кэша в sw.js ---');
updateFile('public/sw.js', (src) => {
  return src.replace(/STATIC_CACHE\s*=\s*['"]zerno-static-v(\d+)['"]/, (_m, num) => {
    const next = parseInt(num, 10) + 1;
    log(`STATIC_CACHE: v${num} -> v${next}`);
    return `STATIC_CACHE = 'zerno-static-v${next}'`;
  });
});

// ─────────────────────────────────────────────────────────────
// 3. Запуск полного контура аудита
// ─────────────────────────────────────────────────────────────
console.log('\n--- 3. Запуск npm run audit ---');
try {
  execSync('npm run audit', { stdio: 'inherit' });
  console.log('\n🏆 ВСЕ БАРЬЕРЫ ЗЕЛЕНЫЕ (0 ОШИБОК, 0 ВОРНИНГОВ)!');
} catch (e) {
  console.error('❌ Ошибка аудита:', e.message);
  process.exit(1);
}