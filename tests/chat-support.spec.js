import { test, expect } from '@playwright/test';

async function skipSplash(page) {
  const sp = page.locator('#brandSplash');
  if (await sp.count()) await sp.locator('[data-go="coffee"]').click();
}

async function dismissAuthNudge(page) {
  // 1. Close the auth modal if it's visible
  const skipAuthBtn = page.locator('#skipAuth');
  if (await skipAuthBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await skipAuthBtn.click();
  }
  
  // 2. Wait for the blocking overlay to be completely hidden
  await expect(page.locator('#overlay.show')).toBeHidden({ timeout: 5000 });
}

test('обычное открытие чата — без оверлея', async ({ page }) => {
  await page.goto('/');
  await skipSplash(page);
  await dismissAuthNudge(page);
  
  // Now the overlay is gone, and the click will succeed
  await page.locator('#chatFab').click();
  await expect(page.locator('#supportChooseOverlay')).toHaveCount(0);
  await expect(page.locator('.chatHint').first()).toBeVisible({ timeout: 5000 });
});

test('вызов сотрудника требует подтверждения (два тапа)', async ({ page }) => {
  await page.goto('/');
  await skipSplash(page);
  await dismissAuthNudge(page);
  
  await page.locator('#chatFab').click();
  const call = page.locator('.chatHint', { hasText: 'Позвать сотрудника' });
  await call.click();
  await expect(page.locator('.chatHint', { hasText: 'Точно позвать' })).toBeVisible();
});
