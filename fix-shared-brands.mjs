#!/usr/end/env node
/* fix-phase-d-safe.mjs — безопасная проверка синтаксиса (только JS) */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
let cur = path.dirname(__filename);
let ROOT = null;
for (let i = 0; i < 10; i++) {
  if (existsSync(path.join(cur, 'public', 'index.html'))) { ROOT = cur; break; }
  const parent = path.dirname(cur);
  if (parent === cur) break;
  cur = parent;
}
if (!ROOT) { console.error('❌ Не найден корень проекта'); process.exit(1); }

let changes = 0;
const ok = (m) => { changes++; console.log('✅', m); };
const skip = (m) => console.log('⏭ ', m);

function read(p) { return readFileSync(p, 'utf8'); }
function write(p, content) { writeFileSync(p, content, 'utf8'); }

/* 1. theme-v2.css: адаптивная высота контейнера бренда */
(function fixMobileBrandContainer() {
  const p = path.join(ROOT, 'public', 'app', 'ui', 'theme-v2.css');
  let s = read(p);

  const oldBrandRule = /header\.topbar div#headerBrand\.brand\s*\{([\s\S]*?)height:\s*44px;/;
  if (oldBrandRule.test(s)) {
    s = s.replace(oldBrandRule, 'header.topbar div#headerBrand.brand {\n$1min-height: 44px;\n    height: auto;');
    write(p, s);
    ok('theme-v2.css: headerBrand.brand переведён на min-height: 44px; height: auto');
  } else {
    skip('theme-v2.css: контейнер бренда уже адаптирован');
  }
})();

/* 2. tests/ui-baseline.spec.js: корректный assertion геометрии */
(function fixTestAssertion() {
  const p = path.join(ROOT, 'tests', 'ui-baseline.spec.js');
  if (!existsSync(p)) return;
  let s = read(p);

  const oldTest = /test\('baseline: масштабирование Фазы D \(бренд test\)'[\s\S]*?\n\}\);/;
  const cleanTest = `test('baseline: масштабирование Фазы D (бренд test)', async ({ page }) => {
  await page.goto('/?brand=test');
  await page.waitForFunction(() => typeof window.sv === 'function');

  await page.evaluate(() => { window.brand = 'test'; window.sv(); });
  await page.waitForTimeout(100);

  const brandAttr = await page.evaluate(() => document.documentElement.getAttribute('data-brand'));
  expect(brandAttr).toBe('test');

  const box = await page.locator('#brandMark img, #brandMark svg').first().boundingBox();
  expect(box).not.toBeNull();
  expect(box.width).toBeGreaterThanOrEqual(50);
  expect(box.width).toBeLessThanOrEqual(64);
  expect(box.height).toBeGreaterThanOrEqual(50);
  expect(box.height).toBeLessThanOrEqual(64);
});`;

  if (oldTest.test(s)) {
    s = s.replace(oldTest, cleanTest);
    write(p, s);
    ok('tests/ui-baseline.spec.js: тест Фазы D обновлён');
  } else {
    skip('tests/ui-baseline.spec.js: тест уже актуален');
  }
})();

/* 3. sw.js: бамп STATIC_CACHE */
(function bumpSw() {
  const p = path.join(ROOT, 'public', 'sw.js');
  let s = read(p);
  const cacheRe = /const\s+STATIC_CACHE\s*=\s*['"]zerno-static-v(\d+)['"]/;
  const m = s.match(cacheRe);
  if (m) {
    const next = parseInt(m[1], 10) + 1;
    s = s.replace(cacheRe, `const STATIC_CACHE = 'zerno-static-v${next}'`);
    write(p, s);
    ok(`sw.js: STATIC_CACHE инкрементирован до v${next}`);
  }
})();

console.log('\n🔍 Валидация синтаксиса JS-файлов...');
// Проверяем ТОЛЬКО JavaScript файлы, исключая CSS
for (const f of ['public/sw.js']) {
  execSync('node --check ' + f, { stdio: 'inherit', cwd: ROOT });
}
console.log('✅ Синтаксис JS валиден.');

console.log('\n🚀 Запуск npm run pretest & npm run test:e2e...');
execSync('npm run pretest', { stdio: 'inherit', cwd: ROOT });
execSync('npm run test:e2e', { stdio: 'inherit', cwd: ROOT });
console.log('\n🎉 Фаза D полностью завершена, все тесты пройдены!');