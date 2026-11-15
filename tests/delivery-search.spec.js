import { test, expect } from '@playwright/test';

test.describe('Поиск в меню доставки', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('zt_onb', '1');
      sessionStorage.setItem('splashDone', '1');
    });
    await page.goto('/?brand=delivery', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#deliveryGrid [data-product-id="pz-marg"]')).toBeVisible();
  });

  test('подключает существующий #dSearch и ищет по структурированному составу', async ({ page }) => {
    const search = page.locator('#deliveryView #dSearch');
    await expect(search).toHaveCount(1);
    await expect(search).toBeVisible();

    await page.evaluate(() => {
      window.dcat = 'rolls';
      window.renderDeliveryMenu();
    });

    const roll = page.locator('#deliveryGrid [data-product-id="rl-hos-og"]');
    await expect(roll).toBeVisible();
    await expect(roll.locator('.comp')).toContainText('микрозелень');

    await search.fill('микрозелень');
    await expect(roll).toBeVisible();

    await search.fill('позиция-которой-нет');
    await expect(roll).toBeHidden();
  });

  test('поиск по названию и описанию остаётся доступен', async ({ page }) => {
    const search = page.locator('#deliveryView #dSearch');
    const pizza = page.locator('#deliveryGrid [data-product-id="pz-marg"]');

    await search.fill('маргарита');
    await expect(pizza).toBeVisible();

    await search.fill('позиция-которой-нет');
    await expect(pizza).toBeHidden();
  });
});
