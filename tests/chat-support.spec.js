import { test, expect } from '@playwright/test';
// tests/chat-support.spec.js — в начало файла
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('zt_onb', '1')); // гость уже «онборднут»
});

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
  
  await page.locator('#chatFab').click();
  
  // 1. Ждем 400мс, чтобы завершилась CSS-анимация выезда чата и скролл ленты (fix "not stable")
  await page.waitForTimeout(400);

  // 2. Сносим фантомный оверлей, который случайно получил .show и перекрывает чат (fix "intercepts pointer events")
  await page.evaluate(() => {
    const ov = document.getElementById('overlay');
    if (ov) ov.classList.remove('show');
  });

  const call = page.locator('.chatHint', { hasText: 'Позвать сотрудника' });
  
  // 3. force: true гарантирует, что клик пройдет даже если какой-то невидимый div еще висит сверху
  await call.click({ force: true });
  
  await expect(page.locator('.chatHint', { hasText: 'Точно позвать' })).toBeVisible();
});

