// fix-server-crashes.mjs
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const ROOT = process.cwd();

function log(msg, ok = true) {
  console.log(`${ok ? '✅' : '⚠️'} ${msg}`);
}

function updateFile(relPath, transform) {
  const absPath = path.join(ROOT, relPath);
  if (!fs.existsSync(absPath)) return;
  const original = fs.readFileSync(absPath, 'utf8');
  const updated = transform(original);
  if (original !== updated) {
    fs.writeFileSync(absPath, updated, 'utf8');
    log(`Обновлен: ${relPath}`);
  } else {
    log(`Без изменений: ${relPath}`);
  }
}

// ─────────────────────────────────────────────────────────────
// 1. Принудительное завершение зависшего сервера на порту 3000
// ─────────────────────────────────────────────────────────────
console.log('--- 1. Проверка и освобождение порта 3000 в Windows ---');
try {
  const netstat = execSync('netstat -ano', { encoding: 'utf8' });
  const lines = netstat.split('\n');
  for (const line of lines) {
    if (line.includes(':3000') && line.includes('LISTENING')) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== '0') {
        try {
          execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
          log(`Завершен фоновый процесс (PID: ${pid}) на порту 3000`);
        } catch (_) {}
      }
    }
  }
} catch (_) {}

// ─────────────────────────────────────────────────────────────
// 2. Исправление server/routes/staff.js (удаление мертвого импорта)
// ─────────────────────────────────────────────────────────────
console.log('\n--- 2. Исправление server/routes/staff.js ---');
updateFile('server/routes/staff.js', (src) => {
  return src
    .replace(/import\s*\{\s*_?ph10\s*\}\s*from\s*['"][^'"]+phone\.js['"];?\n?/g, '')
    .replace(/_?ph10\s*,\s*/g, '')
    .replace(/,\s*_?ph10/g, '');
});

// ─────────────────────────────────────────────────────────────
// 3. Исправление server/routes/orders.js (удаление мертвого импорта)
// ─────────────────────────────────────────────────────────────
console.log('\n--- 3. Исправление server/routes/orders.js ---');
updateFile('server/routes/orders.js', (src) => {
  return src
    .replace(/import\s*\{\s*_?getKlgHour\s*\}\s*from\s*['"][^'"]+['"];?\n?/g, '')
    .replace(/_?getKlgHour\s*,\s*/g, '')
    .replace(/,\s*_?getKlgHour/g, '');
});

// ─────────────────────────────────────────────────────────────
// 4. Проверка синтаксиса и чистоты импортов
// ─────────────────────────────────────────────────────────────
console.log('\n--- 4. Проверка валидности server.js и роутеров ---');
try {
  execSync('node --check server.js', { stdio: 'inherit' });
  execSync('node --check server/routes/staff.js', { stdio: 'inherit' });
  execSync('node --check server/routes/orders.js', { stdio: 'inherit' });
  log('Синтаксис файлов валиден!');
} catch (e) {
  console.error('❌ Ошибка синтаксиса:', e.message);
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────
// 5. Запуск полного контура аудита (npm run audit)
// ─────────────────────────────────────────────────────────────
console.log('\n--- 5. Запуск npm run audit с поднятием сервера с нуля ---\n');
try {
  execSync('npm run audit', { stdio: 'inherit' });
  console.log('\n🏆 ВСЕ АВТО-БАРЬЕРЫ ЗЕЛЕНЫЕ (СЕРВЕР ПОДНЯЛСЯ И ПРОШЕЛ СМОУК)!');
} catch (e) {
  console.error('\n❌ Ошибка аудита:', e.message);
  process.exit(1);
}