import { test, expect } from '@playwright/test';

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
