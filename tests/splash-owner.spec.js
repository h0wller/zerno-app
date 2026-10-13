import { test, expect } from '@playwright/test';

test.describe('Splash Screen — Мобильные режимы (Web, TMA, Standalone PWA)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('1. Мобильный браузер: сплэш появляется при каждом открытии и обновлении вкладки', async ({ page }) => {
    await page.goto('/');

    const splash = page.locator('#brandSplashStatic, #brandSplash').first();
    await expect(splash).toBeVisible();

    // Выбираем «Пятницу»
    await splash.locator('[data-go="delivery"]').click();
    await expect(splash).toBeHidden();
    await expect(page.locator('html')).toHaveAttribute('data-brand', 'delivery');

    // Обновляем страницу — в обычном браузере сплэш обязан появиться снова
    await page.reload();
    const splashAfterReload = page.locator('#brandSplashStatic, #brandSplash').first();
    await expect(splashAfterReload).toBeVisible();
  });

  test('2. Telegram Mini App (TMA): сплэш встречает при каждом запуске мини-аппа', async ({ context, page }) => {
    // Эмулируем окружение Telegram WebApp на мобильном устройстве
    await context.addInitScript(() => {
      window.Telegram = {
        WebApp: {
          initData: 'query_id=AAHdF6IQAAAAAN0XohDhrOrc&user=%7B%22id%22%3A123456%2C%22first_name%22%3A%22Test%22%7D',
          initDataUnsafe: { query_id: 'AAHdF6IQAAAAAN0XohDhrOrc', user: { id: 123456, first_name: 'Test' } },
          platform: 'ios',
          ready() {},
          expand() {},
          enableClosingConfirmation() {},
          disableVerticalSwipes() {},
          BackButton: { show() {}, hide() {}, onClick() {} },
          MainButton: { show() {}, hide() {}, setText() {}, setParams() {}, onClick() {} },
          HapticFeedback: { impactOccurred() {}, notificationOccurred() {}, selectionChanged() {} }
        }
      };
    });

    // Первый холодный вход в TMA
    await page.goto('/?src=tg');
    const splash = page.locator('#brandSplashStatic, #brandSplash').first();
    await expect(splash).toBeVisible();

    // Выбираем «Кофейню»
    await splash.locator('[data-go="coffee"]').click();
    await expect(splash).toBeHidden();
    await expect(page.locator('html')).toHaveAttribute('data-brand', 'coffee');

    // Повторное открытие TMA (даже если WebView сохранил sessionStorage)
    await page.goto('/?src=tg');
    const splashSecondOpen = page.locator('#brandSplashStatic, #brandSplash').first();
    await expect(splashSecondOpen).toBeVisible();
  });

  test('3. Standalone PWA: сплэш живёт внутри сессии и появляется снова после выгрузки из недавних', async ({ context, page }) => {
    // Эмулируем установленную на рабочий стол iOS/Android PWA (display-mode: standalone)
    await context.addInitScript(() => {
      Object.defineProperty(window.navigator, 'standalone', {
        get: () => true,
        configurable: true
      });
      const origMatchMedia = window.matchMedia.bind(window);
      window.matchMedia = (query) => {
        if (query === '(display-mode: standalone)') {
          return {
            matches: true,
            media: query,
            onchange: null,
            addListener() {},
            removeListener() {},
            addEventListener() {},
            removeEventListener() {},
            dispatchEvent() { return false; }
          };
        }
        return origMatchMedia(query);
      };
    });

    // 1) Холодный старт PWA — сплэш виден
    await page.goto('/');
    const splash = page.locator('#brandSplashStatic, #brandSplash').first();
    await expect(splash).toBeVisible();

    // Выбираем «Пятницу»
    await splash.locator('[data-go="delivery"]').click();
    await expect(splash).toBeHidden();

    // Проверяем, что в режиме PWA флаг сохранился в sessionStorage
    const splashDoneFlag = await page.evaluate(() => sessionStorage.getItem('splashDone'));
    expect(splashDoneFlag).toBe('1');

    // 2) Перезагрузка внутри живой сессии PWA — сплэш НЕ показывается
    await page.reload();
    await expect(page.locator('#brandSplashStatic, #brandSplash')).toHaveCount(0);
    await expect(page.locator('html')).toHaveClass(/no-splash/);

    // 3) Пользователь смахнул PWA из недавних (sessionStorage очищен ОС)
    await page.evaluate(() => sessionStorage.clear());
    await page.reload();
    const splashAfterSwipeKill = page.locator('#brandSplashStatic, #brandSplash').first();
    await expect(splashAfterSwipeKill).toBeVisible();
  });

  test('4. Диплинк на конкретную вкладку/заказ пропускает сплэш', async ({ page }) => {
    await page.goto('/?tab=chat&ctx=delivery');
    await expect(page.locator('#brandSplashStatic, #brandSplash')).toHaveCount(0);
    await expect(page.locator('html')).toHaveClass(/no-splash/);
  });
});

// 👇 ДОБАВИТЬ ЗДЕСЬ: принудительно очищаем localStorage и sessionStorage
// перед каждым тестом в этом файле. Это гарантирует, что приложение
// увидит "первый визит" и отрисует #brandSplashStatic в DOM.
  test.use({ storageState: { cookies: [], origins: [] } });

test('splash: инлайн-владелец клика ведёт в приложение через ?brand=', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  
  await page.goto('/');
  
  await expect(page.locator('#brandSplashStatic')).toBeVisible({ timeout: 8000 });
  await page.locator('#brandSplashStatic [data-go="coffee"]').click();
  
  await page.waitForURL(/brand=coffee/, { timeout: 8000 });
  await expect(page.locator('#grid .card:not(.skeleton-card)').first()).toBeVisible({ timeout: 15000 });
  
  expect(errs).toEqual([]);
  
});
