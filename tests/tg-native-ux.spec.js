// tests/tg-native-ux.spec.js
import { test, expect } from '@playwright/test';

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
    localStorage.setItem('zt_onb', '1');
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

  // 4. Тест BackButton: программно открываем профиль/авторизацию без блокировки клика оверлеем
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    const modal = document.querySelector('.modal.show, [id$="Modal"].show');
    if (!modal) {
      const btn = document.getElementById('profileTopBtn');
      if (btn) btn.click();
      else if (typeof openAuth === 'function') openAuth();
    }
  });
  await page.waitForTimeout(200);

  const backShown = await page.evaluate(() => window.__tgEvents.backShown);
  expect(backShown).toBe(true);

  const htmlHasClass = await page.evaluate(() => document.documentElement.classList.contains('tg-native-back'));
  expect(htmlHasClass).toBe(true);

  // 5. Тест закрытия через BackButton: вызываем closeTop
  await page.evaluate(() => window.TgUx.closeTop());
  await page.waitForTimeout(150);

  const backHidden = await page.evaluate(() => window.__tgEvents.backShown);
  expect(backHidden).toBe(false);

  // 6. Тест Haptic: клик по категории меню доставки
  await page.evaluate(() => {
    const btn = document.querySelector('#deliveryRail button, .rail button, [data-dcat]');
    if (btn) btn.click();
  });
  await page.waitForTimeout(100);

  const haptics = await page.evaluate(() => window.__tgEvents.hapticCalls);
  expect(haptics.length).toBeGreaterThan(0);

  // 7. Тест MainButton: при добавлении товара в корзину кнопка активируется с суммой (с доставкой 850 ₽)
  await page.evaluate(() => {
    window.cart = [{ id: 'test_pizza', name: 'Маргарита', price: 650, qty: 1 }];
    if (typeof window.renderCart === 'function') window.renderCart();
    window.TgUx.sync();
  });
  await page.waitForTimeout(150);

  const mainShown = await page.evaluate(() => window.__tgEvents.mainShown);
  const mainText = await page.evaluate(() => window.__tgEvents.mainText);
  expect(mainShown).toBe(true);
  expect(mainText).toContain('850');
});