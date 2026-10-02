// fix-smoke-and-sw.mjs
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const ROOT = process.cwd();

function log(msg, ok = true) {
  console.log(`${ok ? '✅' : '⚠️️'} ${msg}`);
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
// 1. Исправление scripts/contract-smoke.mjs (позиция шебанга и автостарт)
// ─────────────────────────────────────────────────────────────
console.log('--- 1. Исправление scripts/contract-smoke.mjs ---');
updateFile('scripts/contract-smoke.mjs', (src) => {
  let res = src;

  // 1. Полностью вырезаем все дубли шебанга со всех строк
  res = res.replace(/^#!.*$/gm, '').trim();

  // 2. Если автозапуск сервера ещё не был оформлен корректно
  if (!res.includes('spawnServerIfNeeded')) {
    const autoServerCode = `
import { spawn } from 'node:child_process';

let __serverProc = null;
async function spawnServerIfNeeded(url) {
  try {
    const ping = await fetch(url + '/api/health');
    if (ping.ok) return;
  } catch (_) {}

  console.log('⚡ Сервер не обнаружен на ' + url + '. Автозапуск для смоук-тестов...');
  __serverProc = spawn('node', ['server.js'], {
    env: {
      ...process.env,
      PORT: '3000',
      DB_PATH: process.env.DB_PATH || './zerno.db',
      ADMIN_CODE: process.env.ADMIN_CODE || '3364',
      CASHIER_CODE: process.env.CASHIER_CODE || '2468',
      DISPATCH_CODE: process.env.DISPATCH_CODE || '5719',
    },
    stdio: 'ignore'
  });

  const start = Date.now();
  while (Date.now() - start < 15000) {
    try {
      const ping = await fetch(url + '/api/health');
      if (ping.ok) {
        console.log('✅ Сервер успешно поднят для тестов');
        return;
      }
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('Не удалось запустить сервер за 15 секунд');
}

function cleanupServer() {
  if (__serverProc) {
    try {
      __serverProc.kill();
    } catch (_) {}
  }
}
process.on('exit', cleanupServer);
process.on('SIGINT', () => { cleanupServer(); process.exit(1); });
process.on('SIGTERM', () => { cleanupServer(); process.exit(1); });
`;
    res = autoServerCode.trim() + '\n\n' + res;
    res = res.replace(
      /(console\.log\(["']Контракт-смоук[^"']*["']\);?)/,
      '$1\nawait spawnServerIfNeeded("http://localhost:3000");'
    );
  }

  // 3. Ставим шебанг строго на первую строку файла
  return '#!/usr/bin/env node\n' + res.trim() + '\n';
});

// ─────────────────────────────────────────────────────────────
// 2. Очистка public/sw.js от несуществующего overlay.js
// ─────────────────────────────────────────────────────────────
console.log('\n--- 2. Очистка кэша sw.js от overlay.js ---');
updateFile('public/sw.js', (src) => {
  let res = src;
  
  // Удаляем строку с overlay.js (сохраняя overlay-core.js)
  res = res.replace(/[^\n]*overlay\.js[^\n]*,?\n?/g, (line) => {
    if (line.includes('overlay-core.js')) return line;
    log(`Удалена строка из кэша: ${line.trim()}`);
    return '';
  });

  // Инкремент STATIC_CACHE
  res = res.replace(/STATIC_CACHE\s*=\s*['"]zerno-static-v(\d+)['"]/, (_m, num) => {
    const next = parseInt(num, 10) + 1;
    log(`STATIC_CACHE: v${num} -> v${next}`);
    return `STATIC_CACHE = 'zerno-static-v${next}'`;
  });

  return res;
});

// ─────────────────────────────────────────────────────────────
// 3. Проверка синтаксиса и запуск смоук-тестов
// ─────────────────────────────────────────────────────────────
console.log('\n--- 3. Проверка синтаксиса (node --check) ---');
try {
  execSync('node --check scripts/contract-smoke.mjs', { stdio: 'inherit' });
  execSync('node --check public/sw.js', { stdio: 'inherit' });
  log('Синтаксис файлов корректен!');
} catch (e) {
  console.error('❌ Ошибка синтаксиса:', e.message);
  process.exit(1);
}

console.log('\n--- 4. Запуск контракт-смоука (node scripts/contract-smoke.mjs) ---');
try {
  execSync('node scripts/contract-smoke.mjs', { stdio: 'inherit' });
  log('Контракт-смоук успешно пройден!');
} catch (e) {
  console.error('❌ Ошибка смоука:', e.message);
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────
// 5. Запуск npm run audit
// ─────────────────────────────────────────────────────────────
console.log('\n--- 5. Полный аудит барьеров (npm run audit) ---');
try {
  execSync('npm run audit', { stdio: 'inherit' });
  console.log('\n🏆 ВСЕ БАРЬЕРЫ ЗЕЛЕНЫЕ (0 ОШИБОК, 0 ПРЕДУПРЕЖДЕНИЙ)!');
} catch (e) {
  console.error('❌ Ошибка аудита:', e.message);
  process.exit(1);
}