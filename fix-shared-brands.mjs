// fix-ci-smoke.mjs
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
// 1. Автозапуск сервера в scripts/contract-smoke.mjs для GitHub CI
// ─────────────────────────────────────────────────────────────
console.log('--- 1. Надежное внедрение автозапуска в contract-smoke.mjs ---');
updateFile('scripts/contract-smoke.mjs', (src) => {
  let res = src;

  // Очищаем старые попытки внедрения функции
  res = res.replace(/let __serverProc[\s\S]*?process\.on\('SIGTERM', cleanupServer\);\n?/g, '');
  res = res.replace(/await spawnServerIfNeeded\([^)]*\);\n?/g, '');
  res = res.replace(/import\s*\{\s*spawn\s*\}\s*from\s*['"]node:child_process['"];?\n?/g, '');

  // Формируем чистый блок гарантированного старта сервера
  const autoServerCode = `import { spawn } from 'node:child_process';

let __ciServer = null;
async function _ensureServerUp() {
  const target = 'http://localhost:3000/api/health';
  try {
    const ping = await fetch(target);
    if (ping.ok) return; // Сервер уже запущен (например, локально в VS Code)
  } catch (_) {}

  console.log('⚡ Сервер не найден на localhost:3000. Запуск server.js для смоука...');
  __ciServer = spawn('node', ['server.js'], {
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

  const startTime = Date.now();
  while (Date.now() - startTime < 15000) {
    try {
      const ping = await fetch(target);
      if (ping.ok) {
        console.log('✅ Сервер запущен в фоне (PID: ' + __ciServer.pid + ')');
        return;
      }
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Таймаут запуска server.js (15 сек)');
}

function _killCiServer() {
  if (__ciServer) {
    try { __ciServer.kill('SIGTERM'); } catch (_) {}
    __ciServer = null;
  }
}
process.on('exit', _killCiServer);
process.on('SIGINT', () => { _killCiServer(); process.exit(1); });
process.on('SIGTERM', () => { _killCiServer(); process.exit(1); });

await _ensureServerUp();
`;

  // Вставляем строго после шебанга (если есть) на первую исполняемую строку
  if (res.startsWith('#!')) {
    const nl = res.indexOf('\n');
    res = res.slice(0, nl + 1) + autoServerCode + '\n' + res.slice(nl + 1);
  } else {
    res = autoServerCode + '\n' + res;
  }

  return res;
});

// ─────────────────────────────────────────────────────────────
// 2. Очистка public/sw.js от несуществующего /app/core/overlay.js
// ─────────────────────────────────────────────────────────────
console.log('\n--- 2. Удаление битого overlay.js из кэша sw.js ---');
updateFile('public/sw.js', (src) => {
  let res = src;
  res = res.replace(/[^\n]*\/app\/core\/overlay\.js[^\n]*,?\n?/g, '');
  return res;
});

// ─────────────────────────────────────────────────────────────
// 3. Бамп версии STATIC_CACHE в sw.js
// ─────────────────────────────────────────────────────────────
console.log('\n--- 3. Бамп версии кэша в sw.js ---');
updateFile('public/sw.js', (src) => {
  return src.replace(/STATIC_CACHE\s*=\s*['"]zerno-static-v(\d+)['"]/, (_m, num) => {
    const next = parseInt(num, 10) + 1;
    log(`STATIC_CACHE: v${num} -> v${next}`);
    return `STATIC_CACHE = 'zerno-static-v${next}'`;
  });
});

// ─────────────────────────────────────────────────────────────
// 4. Проверка синтаксиса и локальный прогон смоука
// ─────────────────────────────────────────────────────────────
console.log('\n--- 4. Проверка запуска смоук-теста ---');
try {
  execSync('node --check scripts/contract-smoke.mjs', { stdio: 'inherit' });
  execSync('node scripts/contract-smoke.mjs', { stdio: 'inherit' });
  log('Смоук-тест успешно пройден!');
} catch (e) {
  console.error('❌ Ошибка смоука:', e.message);
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────
// 5. Полный аудит перед пушем
// ─────────────────────────────────────────────────────────────
console.log('\n--- 5. Полный аудит барьеров (npm run audit) ---');
try {
  execSync('npm run audit', { stdio: 'inherit' });
  console.log('\n🏆 ВСЕ БАРЬЕРЫ ЗЕЛЕНЫЕ (0 ОШИБОК)!');
} catch (e) {
  console.error('❌ Ошибка аудита:', e.message);
  process.exit(1);
}