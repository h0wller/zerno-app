import { test, expect } from '@playwright/test';

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