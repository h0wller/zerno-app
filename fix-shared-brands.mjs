// integrate-smoke-audit.mjs
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const ROOT = process.cwd();

function log(msg, ok = true) {
  console.log(`${ok ? '✅' : '⚠️'} ${msg}`);
}

// ─────────────────────────────────────────────────────────────
// 1. Встраивание `npm run smoke` в `npm run audit` в package.json
// ─────────────────────────────────────────────────────────────
console.log('--- 1. Обновление package.json (включение smoke в audit) ---');
const pkgPath = path.join(ROOT, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

if (!pkg.scripts.audit.includes('npm run smoke')) {
  pkg.scripts.audit = pkg.scripts.audit + ' && npm run smoke';
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  log('npm run smoke успешно добавлен в цепочку audit!');
} else {
  log('npm run smoke уже присутствует в audit');
}

// ─────────────────────────────────────────────────────────────
// 2. Улучшение scripts/contract-smoke.mjs (логи сервера + 127.0.0.1)
// ─────────────────────────────────────────────────────────────
console.log('\n--- 2. Исправление scripts/contract-smoke.mjs ---');
const smokePath = path.join(ROOT, 'scripts/contract-smoke.mjs');
let smokeSrc = fs.readFileSync(smokePath, 'utf8');

// Полностью переписываем блок запуска сервера с перехватом stdout/stderr и двойной проверкой портов
const reliableServerStarter = `import { spawn } from 'node:child_process';

let __ciServer = null;
async function _ensureServerUp() {
  const checkHealth = async () => {
    try {
      const res = await fetch('http://127.0.0.1:3000/api/health');
      if (res.ok) return true;
    } catch (_) {}
    try {
      const res = await fetch('http://localhost:3000/api/health');
      if (res.ok) return true;
    } catch (_) {}
    return false;
  };

  if (await checkHealth()) return;

  console.log('⚡ Сервер не найден на localhost:3000. Запуск server.js...');
  __ciServer = spawn(process.execPath, ['server.js'], {
    env: {
      ...process.env,
      PORT: '3000',
      DB_PATH: process.env.DB_PATH || './zerno.db',
      ADMIN_CODE: process.env.ADMIN_CODE || '3364',
      CASHIER_CODE: process.env.CASHIER_CODE || '2468',
      DISPATCH_CODE: process.env.DISPATCH_CODE || '5719',
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let serverOutput = '';
  __ciServer.stdout?.on('data', (d) => { serverOutput += d.toString(); });
  __ciServer.stderr?.on('data', (d) => { serverOutput += d.toString(); });

  let hasExited = false;
  let exitCode = null;
  __ciServer.on('exit', (code) => {
    hasExited = true;
    exitCode = code;
  });

  const startTime = Date.now();
  while (Date.now() - startTime < 15000) {
    if (hasExited) {
      throw new Error('server.js аварийно завершился при старте (код ' + exitCode + '):\\n' + serverOutput);
    }
    if (await checkHealth()) {
      console.log('✅ Сервер запущен в фоне (PID: ' + __ciServer.pid + ')');
      return;
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  throw new Error('Таймаут запуска server.js (15 сек). Логи сервера:\\n' + (serverOutput || '(пусто)'));
}

function _killCiServer() {
  if (__ciServer && !__ciServer.killed) {
    try { __ciServer.kill('SIGTERM'); } catch (_) {}
    __ciServer = null;
  }
}
process.on('exit', _killCiServer);
process.on('SIGINT', () => { _killCiServer(); process.exit(1); });
process.on('SIGTERM', () => { _killCiServer(); process.exit(1); });

await _ensureServerUp();
`;

// Заменяем верхний блок до первого консоль лога
smokeSrc = smokeSrc.replace(/import\s*\{\s*spawn\s*\}[\s\S]*?await\s+_ensureServerUp\(\);?\n?/m, '');
if (smokeSrc.startsWith('#!')) {
  const nl = smokeSrc.indexOf('\n');
  smokeSrc = smokeSrc.slice(0, nl + 1) + reliableServerStarter + '\n' + smokeSrc.slice(nl + 1).trimStart();
} else {
  smokeSrc = reliableServerStarter + '\n' + smokeSrc;
}

fs.writeFileSync(smokePath, smokeSrc, 'utf8');
log('scripts/contract-smoke.mjs обновлен: добавлена диагностика и IPv4/IPv6 фолбэк');

// ─────────────────────────────────────────────────────────────
// 3. Локальный прогон полного аудита с интегрированным смоуком
// ─────────────────────────────────────────────────────────────
console.log('\n--- 3. Проверка обновленного npm run audit ---\n');
try {
  execSync('npm run audit', { stdio: 'inherit' });
  console.log('\n🏆 ВСЕ БАРЬЕРЫ ЗЕЛЕНЫЕ (ВКЛЮЧАЯ СМОУК-КОНТРАКТ)!');
} catch (e) {
  console.error('\n❌ Ошибка аудита:', e.message);
  process.exit(1);
}