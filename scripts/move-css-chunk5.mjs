#!/usr/bin/env node
/**
 * scripts/fix-tg-syntax-and-tests.mjs
 * SYNTAX-FIX v1: исправляет 'Unexpected token ||' в TG-OFFLOAD inline-скрипте
 * + проверяет применение патча ZERNO_STAFF_CODE в ui-baseline.spec.js
 * + bump STATIC_CACHE
 * Запуск: node scripts/fix-tg-syntax-and-tests.mjs && npx playwright test
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const stamp = new Date().toISOString().replace(/[:T]/g, '-').replace(/\..+$/, '');
const changed = [], warnings = [];

const resolvePath = (p) => path.join(root, p);
function backupFile(abs) {
  if (!fs.existsSync(abs)) return null;
  let c = abs + '.bak-' + stamp, i = 1;
  while (fs.existsSync(c)) c = abs + '.bak-' + stamp + '-' + (i++);
  fs.copyFileSync(abs, c); return c;
}
function readLf(abs) {
  const raw = fs.readFileSync(abs, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  return { text: raw.replace(/\r\n/g, '\n'), eol };
}
function writeEol(abs, text, eol) {
  fs.writeFileSync(abs, eol === '\r\n' ? text.replace(/\n/g, '\r\n') : text, 'utf8');
}
function modifyFile(rel, fn) {
  const abs = resolvePath(rel);
  if (!fs.existsSync(abs)) { warnings.push('Файл не найден: ' + rel); return false; }
  const { text, eol } = readLf(abs);
  const out = fn(text);
  if (typeof out !== 'string' || out === text) return false;
  const bak = backupFile(abs);
  writeEol(abs, out, eol);
  changed.push(rel);
  console.log('✔ Изменён: ' + rel + (bak ? ' (backup: ' + path.basename(bak) + ')' : ''));
  return true;
}
function patchSwCache(text) {
  let found = false;
  const out = text.replace(/(STATIC_CACHE\s*=\s*['"])([^'"]+)(['"])/, function (m, pre, val, q) {
    found = true;
    const next = /\d/.test(val) ? val.replace(/(\d+)(?=[^\d]*$)/, function (_, n) { return String(Number(n) + 1); }) : val + '-2';
    console.log('   STATIC_CACHE: ' + val + ' -> ' + next);
    return pre + next + q;
  });
  if (!found) warnings.push('sw.js: STATIC_CACHE не найден');
  return found ? out : text;
}

/* ── 1. Исправление синтаксиса '||' в index.html ── */
function patchIndexSyntax(text) {
  /* Паттерн: строка заканчивается ';', следующая начинается с '||' */
  const bad = /(!!window\.TelegramWebAppProxy \|\| !!window\.TelegramGameProxy);[\s\n]+(\|\| !?\(window\.Telegram)/;
  if (bad.test(text)) {
    return text.replace(bad, '$1 ||\n       $2');
  }
  /* Альтернатива: если патч v2 уже был применён корректно, проверяем наличие */
  if (text.indexOf('!!(window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData)') === -1) {
    warnings.push('index.html: патч TG-OFFLOAD v2 (initData detect) не найден');
  }
  return text;
}

/* ── 2. Проверка патча ZERNO_STAFF_CODE в ui-baseline.spec.js ── */
function patchBaselineSpec(text) {
  if (text.indexOf("process.env.ZERNO_STAFF_CODE") !== -1) return text;
  const out = text.replace(/(['"])1234\1/g, "(process.env.ZERNO_STAFF_CODE || '1234') /* SYNTAX-FIX v1 */");
  if (out === text) warnings.push('ui-baseline.spec.js: литерал 1234 не найден');
  return out;
}

try {
  console.log('Task: SYNTAX-FIX v1 (|| token + staff code env)...\n');

  console.log('index.html: исправление синтаксиса || в TG-OFFLOAD...');
  modifyFile('public/index.html', patchIndexSyntax);

  console.log('ui-baseline.spec.js: ZERNO_STAFF_CODE из env...');
  modifyFile('tests/ui-baseline.spec.js', patchBaselineSpec);

  console.log('sw.js: bump STATIC_CACHE...');
  modifyFile('public/sw.js', patchSwCache);

  if (warnings.length) { console.warn('\nПредупреждения:'); warnings.forEach(function (w) { console.warn(' - ' + w); }); }
  if (changed.length) { console.log('\nИзменённые файлы:'); changed.forEach(function (f) { console.log(' - ' + f); }); }
  console.log('\nГотово. Далее: npx playwright test\n');
  process.exit(0);
} catch (err) {
  console.error('\n❌ Ошибка скрипта:');
  console.error(err);
  process.exit(1);
}