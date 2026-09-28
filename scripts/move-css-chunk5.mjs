// scripts/fix-tg-allowed-updates.mjs
// Автоматическая установка и валидация allowed_updates в tgEnsureWebhook.
// Запуск из корня проекта: node scripts/fix-tg-allowed-updates.mjs

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const TARGET_FILE = path.resolve('server/services/telegram.js');
const BAK_FILE = TARGET_FILE + '.bak-allowed-updates';
const MARKER = '// [tg-ensure-webhook-allowed-updates-v1]';

function readNorm(P) {
  const raw = fs.readFileSync(P, 'utf8');
  const isCRLF = raw.indexOf('\r\n') !== -1;
  return { content: raw.replace(/\r\n/g, '\n'), isCRLF, raw };
}

function writeNorm(P, content, isCRLF) {
  fs.writeFileSync(P, isCRLF ? content.replace(/\n/g, '\r\n') : content, 'utf8');
}

if (!fs.existsSync(TARGET_FILE)) {
  console.error('Ошибка: файл не найден: ' + TARGET_FILE);
  process.exit(1);
}

const { content, isCRLF, raw } = readNorm(TARGET_FILE);

// 1. Проверка идемпотентности
if (content.indexOf(MARKER) !== -1) {
  console.log('server/services/telegram.js: уже пропатчено (' + MARKER + ').');
  process.exit(0);
}

// 2. Поиск точного строкового якоря
const FROM = "    if (info.ok && info.result && info.result.url === want) { console.log('[tg] webhook уже наш:', want); return; }\n    const body = { url: want, allowed_updates: ['message'] };";

const TO = "    // [tg-ensure-webhook-allowed-updates-v1]\n    const hasUpdates = Array.isArray(info.result?.allowed_updates) &&\n      ['message', 'callback_query', 'edited_message'].every(x => info.result.allowed_updates.includes(x));\n    if (info.ok && info.result && info.result.url === want && hasUpdates) { console.log('[tg] webhook уже наш и актуален:', want); return; }\n    const body = { url: want, allowed_updates: ['message', 'callback_query', 'edited_message'] };";

const count = content.split(FROM).length - 1;
if (count === 0) {
  console.error('Ошибка: якорь не найден в server/services/telegram.js:');
  console.error(FROM);
  process.exit(1);
}

if (count > 1) {
  console.error('Ошибка: найдено более одного вхождения якоря (' + count + '). Замена отменена.');
  process.exit(1);
}

// 3. Создание бэкапа
fs.writeFileSync(BAK_FILE, raw, 'utf8');

// 4. Замена
const patched = content.split(FROM).join(TO);
writeNorm(TARGET_FILE, patched, isCRLF);

// 5. Проверка синтаксиса
try {
  execSync('node --check ' + TARGET_FILE, { stdio: 'pipe' });
  console.log('Синтаксис корректен (node --check passed).');
} catch (e) {
  console.error('Синтаксис сломан:');
  console.error((e.stderr || '').toString());
  console.error('Откат: copy ' + BAK_FILE + ' ' + TARGET_FILE);
  fs.writeFileSync(TARGET_FILE, raw, 'utf8');
  process.exit(1);
}

console.log('Успешно: allowed_updates закреплены в tgEnsureWebhook().');
console.log('Создан бэкап: ' + BAK_FILE);