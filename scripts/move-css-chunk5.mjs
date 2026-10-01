#!/usr/bin/env node

/**
 * scripts/apply-layout-fix.mjs
 *
 * Применяет layout-fix для zerno-app:
 * - theme-v2.css
 * - views.js
 * - scrolltop.js
 * - panel.js
 * - swipe.js
 * - styles.js
 *
 * Перед применением:
 *   1. проверяет git-репозиторий;
 *   2. проверяет patch;
 *   3. создаёт git stash только при наличии незакоммиченных изменений;
 *   4. применяет patch;
 *   5. запускает npm run audit.
 *
 * Требование:
 *   zerno-layout-fix.patch должен находиться в корне проекта.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const PATCH = path.join(ROOT, 'zerno-layout-fix.patch');

const REQUIRED_FILES = [
  'package.json',
  'public/app/ui/theme-v2.css',
  'public/app/core/views.js',
  'public/app/ui/scrolltop.js',
  'public/app/core/panel.js',
  'public/app/core/swipe.js',
  'public/app/ui/styles.js',
];

function fail(message) {
  console.error(`\n❌ ${message}\n`);
  process.exit(1);
}

function run(command, args, options = {}) {
  console.log(`\n> ${command} ${args.join(' ')}`);

  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  });

  if (result.status !== 0) {
    fail(`Команда завершилась с кодом ${result.status}: ${command}`);
  }

  return result;
}

console.log('\n=== ZERNO APP / LAYOUT FIX ===\n');

//
// 1. Проверяем корень проекта
//

if (!fs.existsSync(path.join(ROOT, 'package.json'))) {
  fail(
    'Не найден package.json.\n' +
    'Запусти скрипт из корня проекта zerno-app.'
  );
}

//
// 2. Проверяем необходимые файлы
//

for (const file of REQUIRED_FILES) {
  const fullPath = path.join(ROOT, file);

  if (!fs.existsSync(fullPath)) {
    fail(`Не найден обязательный файл: ${file}`);
  }
}

console.log('✓ Структура проекта найдена');

//
// 3. Проверяем patch
//

if (!fs.existsSync(PATCH)) {
  fail(
    'Не найден zerno-layout-fix.patch.\n\n' +
    'Положи его рядом с package.json:\n\n' +
    'zerno-app/\n' +
    '├── package.json\n' +
    '├── zerno-layout-fix.patch\n' +
    '└── scripts/\n'
  );
}

console.log('✓ Patch найден');

//
// 4. Проверяем Git
//

const gitCheck = spawnSync(
  'git',
  ['rev-parse', '--show-toplevel'],
  {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  }
);

if (gitCheck.status !== 0) {
  fail(
    'Проект не является Git-репозиторием.\n' +
    'Этот способ применения патча рассчитан на Git.'
  );
}

//
// 5. Проверяем, что patch применим
//

console.log('\nПроверяю применимость патча...');

const check = spawnSync(
  'git',
  ['apply', '--check', PATCH],
  {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  }
);

if (check.status !== 0) {
  fail(
    'Patch не может быть применён к текущему состоянию проекта.\n\n' +
    'Это обычно означает, что исходный код уже отличается от версии, ' +
    'для которой был подготовлен patch.'
  );
}

console.log('✓ Patch применим');

//
// 6. Показываем текущие изменения
//

const status = spawnSync(
  'git',
  ['status', '--short'],
  {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  }
);

const dirty = status.stdout.trim();

if (dirty) {
  console.log(
    '\n⚠️ В рабочем дереве уже есть незакоммиченные изменения:\n'
  );
  console.log(dirty);

  console.log(
    '\nПатч НЕ будет применён автоматически поверх этих изменений.\n' +
    'Сначала закоммить их или сделай stash.'
  );

  process.exit(1);
}

//
// 7. Применяем
//

console.log('\nПрименяю layout fix...');

run('git', ['apply', PATCH]);

console.log('\n✓ Layout patch применён');

//
// 8. Проверяем изменённые файлы
//

const changed = spawnSync(
  'git',
  ['status', '--short'],
  {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  }
);

console.log('\nИзменённые файлы:\n');
console.log(changed.stdout);

//
// 9. Запускаем полный audit
//

console.log('\n=== RUNNING npm run audit ===\n');

const audit = spawnSync(
  process.platform === 'win32' ? 'npm.cmd' : 'npm',
  ['run', 'audit'],
  {
    cwd: ROOT,
    stdio: 'inherit',
    shell: false,
  }
);

if (audit.status !== 0) {
  console.error(
    '\n⚠️ npm run audit завершился с ошибками.\n' +
    'Изменения оставлены, чтобы можно было посмотреть конкретный failure.\n'
  );

  process.exit(audit.status ?? 1);
}

console.log('\n========================================');
console.log('✓ LAYOUT FIX APPLIED');
console.log('✓ npm run audit PASSED');
console.log('========================================\n');