// scripts/fix-tg-main-button.mjs
// Исправление расчёта totalNow() для Telegram MainButton + обновление теста
// Запуск: node scripts/fix-tg-main-button.mjs

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const OVERLAY_FILE = path.resolve('public/app/core/overlay.js');
const TEST_FILE = path.resolve('tests/tg-native-ux.spec.js');
const SW_FILE = path.resolve('public/sw.js');

function readNorm(P) {
  const raw = fs.readFileSync(P, 'utf8');
  const isCRLF = raw.indexOf('\r\n') !== -1;
  return { content: raw.replace(/\r\n/g, '\n'), isCRLF, raw };
}

function writeNorm(P, content, isCRLF) {
  fs.writeFileSync(P, isCRLF ? content.replace(/\n/g, '\r\n') : content, 'utf8');
}

// ── 1. Патч totalNow() в overlay.js ──
const overlayData = readNorm(OVERLAY_FILE);

const FROM_TOTAL = [
  "  function totalNow() {",
  "    var el = document.getElementById('cartTotal');",
  "    if (el) {",
  "      var raw = String(el.textContent || '').replace(/[^0-9]/g, '');",
  "      if (raw) return Number(raw) || 0;",
  "    }",
  "    var list = (typeof window.cart !== 'undefined' && Array.isArray(window.cart)) ? window.cart : [];",
  "    return list.reduce(function (a, c) {",
  "      return a + ((Number(c.price) || 0) * (Number(c.qty) || 1));",
  "    }, 0);",
  "  }"
].join('\n');

const TO_TOTAL = [
  "  function totalNow() {",
  "    if (typeof window.totalsNow === 'function') {",
  "      try {",
  "        var t = window.totalsNow();",
  "        if (t && typeof t.total !== 'undefined' && Number(t.total) > 0) return Number(t.total);",
  "      } catch (e) {}",
  "    }",
  "    var el = document.getElementById('cartTotal');",
  "    if (el) {",
  "      var raw = String(el.textContent || '').replace(/[^0-9]/g, '');",
  "      var num = Number(raw) || 0;",
  "      if (num > 0) return num;",
  "    }",
  "    var list = (typeof window.cart !== 'undefined' && Array.isArray(window.cart)) ? window.cart : [];",
  "    return list.reduce(function (a, c) {",
  "      return a + ((Number(c.price) || 0) * (Number(c.qty) || 1));",
  "    }, 0);",
  "  }"
].join('\n');

if (!overlayData.content.includes(FROM_TOTAL)) {
  console.error('Якорь totalNow не найден в overlay.js.');
  process.exit(1);
}

const patchedOverlay = overlayData.content.replace(FROM_TOTAL, TO_TOTAL);
writeNorm(OVERLAY_FILE, patchedOverlay, overlayData.isCRLF);
console.log('✔ public/app/core/overlay.js: логика totalNow() исправлена.');

// ── 2. Обновление tests/tg-native-ux.spec.js ──
const TEST_CODE = `import { test, expect } from '@playwright/test';

test('Telegram Mini App: BackButton, MainButton и Haptic', async ({ page }) => {
  // 1. Блокируем перезапись мока внешним скриптом Telegram SDK в тестах
  await page.route('**/telegram-web-app.js', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: '/* mocked tg sdk */'
    });
  });

  // 2. Мокаем Telegram WebApp окружение ДО загрузки страницы
  await page.addInitScript(() => {
    window.__isTgMiniApp = true;
    window.__tgEvents = { backShown: false, mainShown: false, mainText: '', hapticCalls: [] };

    window.Telegram = {
      WebApp: {
        initData: 'query_id=test_query&user=%7B%22id%22%3A123%2C%22first_name%22%3A%22Alex%22%7D',
        initDataUnsafe: { user: { id: 123, first_name: 'Alex' } },
        ready() {},
        expand() {},
        BackButton: {
          show() { window.__tgEvents.backShown = true; },
          hide() { window.__tgEvents.backShown = false; },
          onClick(fn) { this._cb = fn; }
        },
        MainButton: {
          show() { window.__tgEvents.mainShown = true; },
          hide() { window.__tgEvents.mainShown = false; },
          setText(t) { window.__tgEvents.mainText = t; },
          onClick(fn) { this._cb = fn; }
        },
        HapticFeedback: {
          impactOccurred(style) { window.__tgEvents.hapticCalls.push(style); },
          notificationOccurred(style) { window.__tgEvents.hapticCalls.push(style); }
        }
      }
    };
  });

  // 3. Открываем сайт
  await page.goto('/?src=tg&brand=delivery');
  await page.waitForLoadState('domcontentloaded');

  const hasSdkScript = await page.evaluate(() => {
    return !!document.querySelector('script[src*="telegram-web-app.js"]');
  });
  expect(hasSdkScript).toBe(true);

  // 4. Тест BackButton: кликаем на профиль -> открывается authModal или panel
  await page.click('#profileTopBtn');
  await page.waitForTimeout(200);

  const backShown = await page.evaluate(() => window.__tgEvents.backShown);
  expect(backShown).toBe(true);

  const htmlHasClass = await page.evaluate(() => document.documentElement.classList.contains('tg-native-back'));
  expect(htmlHasClass).toBe(true);

  // 5. Тест закрытия через BackButton: вызываем closeTop
  await page.evaluate(() => window.TgUx.closeTop());
  await page.waitForTimeout(100);

  const backHidden = await page.evaluate(() => window.__tgEvents.backShown);
  expect(backHidden).toBe(false);

  // 6. Тест Haptic: клик по категории меню доставки
  await page.evaluate(() => {
    const btn = document.querySelector('#deliveryRail button, .rail button');
    if (btn) btn.click();
  });
  await page.waitForTimeout(100);

  const haptics = await page.evaluate(() => window.__tgEvents.hapticCalls);
  expect(haptics.length).toBeGreaterThan(0);

  // 7. Тест MainButton: при добавлении товара в корзину кнопка активируется с суммой
  await page.evaluate(() => {
    window.cart = [{ id: 'test_pizza', name: 'Маргарита', price: 650, qty: 1 }];
    if (typeof window.renderCart === 'function') window.renderCart();
    window.TgUx.sync();
  });
  await page.waitForTimeout(150);

  const mainShown = await page.evaluate(() => window.__tgEvents.mainShown);
  const mainText = await page.evaluate(() => window.__tgEvents.mainText);
  expect(mainShown).toBe(true);
  expect(mainText).toContain('650');
});
`;

fs.writeFileSync(TEST_FILE, TEST_CODE, 'utf8');
console.log('✔ tests/tg-native-ux.spec.js: обновлён.');

// ── 3. Инкремент STATIC_CACHE в sw.js ──
const swData = readNorm(SW_FILE);
const swMatch = swData.content.match(/zerno-static-v(\d+)/);
if (swMatch) {
  const oldVer = swMatch[0];
  const newVer = 'zerno-static-v' + (parseInt(swMatch[1], 10) + 1);
  const patchedSw = swData.content.replace(oldVer, newVer);
  writeNorm(SW_FILE, patchedSw, swData.isCRLF);
  console.log(`✔ public/sw.js: кэш обновлён ${oldVer} -> ${newVer}`);
}

// ── 4. Проверка синтаксиса ──
try {
  execSync('node --check ' + OVERLAY_FILE, { stdio: 'pipe' });
  console.log('✔ Синтаксис overlay.js корректен.');
} catch (e) {
  console.error('Ошибка синтаксиса:', e.message);
  process.exit(1);
}