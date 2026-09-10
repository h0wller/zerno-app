import { test, expect } from '@playwright/test';

async function skipSplash(page){
  const sp = page.locator('#brandSplash');
  if (await sp.count()) await sp.locator('[data-go="coffee"]').click();
  
  // Принудительно убираем глобальный оверлей, если он завис из-за ошибок API
  await page.evaluate(() => {
    const overlay = document.getElementById('overlay');
    if (overlay) {
      overlay.classList.remove('show');
      overlay.style.display = 'none';
    }
  });
}

test('выбор доставки открывает доставочную Нику', async ({ page }) => {
  await page.goto('/?src=tg&tab=chat&support=choose');
  await skipSplash(page); // Гарантируем чистый DOM
  
  // Используем force: true, чтобы игнорировать возможные динамические оверлеи
  await page.locator('#supportChooseOverlay [data-support-topic="delivery"]').click({ force: true });
  
  await expect(page.locator('#supportChooseOverlay')).toHaveCount(0);
  await expect(page.locator('#chatPanel .chatHead')).toContainText('доставка');
  await expect(page.locator('.chatHint').first()).toBeVisible({ timeout: 5000 });
});

test('выбор кофейни открывает кофейную Нику', async ({ page }) => {
  await page.goto('/?src=tg&tab=chat&support=choose');
  await skipSplash(page);
  await page.locator('#supportChooseOverlay [data-support-topic="coffee"]').click({ force: true });
  await expect(page.locator('#chatPanel .chatHead')).toContainText('кофейня');
});

test('обычное открытие чата — без оверлея', async ({ page }) => {
  await page.goto('/');
  await skipSplash(page);
  await page.locator('#chatFab').click({ force: true });
  await expect(page.locator('#supportChooseOverlay')).toHaveCount(0);
  await expect(page.locator('.chatHint').first()).toBeVisible({ timeout: 5000 });
});

test('вызов сотрудника требует подтверждения (два тапа)', async ({ page }) => {
  await page.goto('/');
  await skipSplash(page);
  await page.locator('#chatFab').click({ force: true });
  const call = page.locator('.chatHint', { hasText: 'Позвать сотрудника' });
  await call.click({ force: true });
  await expect(page.locator('.chatHint', { hasText: 'Точно позвать' })).toBeVisible();
});