// fix-zoom-color.mjs
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

console.log('--- 1. Исправление цвета стоимости в зуме (menu.js) ---');
updateFile('public/app/menu.js', (src) => {
  let res = src;

  // 1. Заменяем жестко зашитый синий цвет #2E6F8E на динамический:
  // для бренда доставки — фирменный #C03B2A, для кофейни — классический #2E6F8E
  const dynamicColorExpr = "color:' + ((typeof brand !== 'undefined' && brand === 'delivery') ? '#C03B2A' : '#2E6F8E') + '";

  if (res.includes('color:#2E6F8E')) {
    res = res.replace(/color:#2E6F8E/g, dynamicColorExpr);
    log('Цвет цены в openZoom переведен на динамический брендовый');
  }

  // 2. Убеждаемся, что оверлей зума имеет id="itemZoomOverlay" и класс цены
  if (res.includes('openZoom') && !res.includes("w.id = 'itemZoomOverlay'")) {
    res = res.replace(
      /(function\s+openZoom\s*\([^)]*\)\s*\{[\s\S]*?const\s+w\s*=\s*document\.createElement\('div'\);)/,
      "$1\n    w.id = 'itemZoomOverlay';"
    );
  }

  return res;
});

console.log('\n--- 2. Гарантированный бамп версии STATIC_CACHE в sw.js ---');
updateFile('public/sw.js', (src) => {
  return src.replace(/(zerno-static-v)(\d+)/g, (_match, prefix, num) => {
    const next = parseInt(num, 10) + 1;
    log(`STATIC_CACHE: ${prefix}${num} -> ${prefix}${next}`);
    return `${prefix}${next}`;
  });
});

console.log('\n--- 3. Проверка синтаксиса и запуск аудита ---');
try {
  execSync('node --check public/app/menu.js', { stdio: 'inherit' });
  execSync('npm run audit', { stdio: 'inherit' });
  console.log('\n🏆 ВСЕ БАРЬЕРЫ ЗЕЛЕНЫЕ (0 ОШИБОК, 0 ВОРНИНГОВ)!');
} catch (e) {
  console.error('❌ Ошибка аудита:', e.message);
  process.exit(1);
}