import { test, expect } from '@playwright/test';

test.describe('Состав в карточках доставки', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('zt_onb', '1');
      sessionStorage.setItem('splashDone', '1');
    });
    await page.goto('/?brand=delivery', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#deliveryGrid [data-product-id="pz-marg"]')).toBeVisible();
  });

  test('пицца показывает текстовый состав один раз в карточке и увеличенном просмотре', async ({ page }) => {
    const pizza = page.locator('#deliveryGrid [data-product-id="pz-marg"]');

    await expect(pizza.locator('.desc')).toHaveText('Красный соус, моцарелла');
    await expect(pizza.locator('.comp')).toHaveCount(0);

    await page.evaluate(() => {
      const item = window.DMENU.find((entry) => entry.id === 'pz-marg');
      window.openZoom('/pz-marg-zoom.webp', item.name, '', item);
    });

    const zoom = page.locator('#itemZoomOverlay');
    await expect(zoom.locator('.zoom-desc')).toHaveText('Красный соус, моцарелла');
    await expect(zoom.locator('.comp')).toHaveCount(0);
  });

  test('оптимизированный рендер первой карточки использует то же правило', async ({ page }) => {
    await page.evaluate(() => {
      const item = window.DMENU.find((entry) => entry.id === 'pz-marg');
      item.img = '/test-pizza-card.webp';

      const card = document.querySelector('#deliveryGrid [data-product-id="pz-marg"]');
      const image = document.createElement('img');
      image.setAttribute('src', item.img);
      card.querySelector('.media').appendChild(image);

      window.renderDeliveryMenu();
    });

    const pizza = page.locator('#deliveryGrid [data-product-id="pz-marg"]');
    await expect(pizza.locator('.desc')).toHaveText('Красный соус, моцарелла');
    await expect(pizza.locator('.comp')).toHaveCount(0);
  });

  test('роллы сохраняют чипсы состава', async ({ page }) => {
    await page.evaluate(() => {
      window.dcat = 'rolls';
      window.renderDeliveryMenu();
    });

    const roll = page.locator('#deliveryGrid [data-product-id="rl-hos-og"]');
    await expect(roll).toBeVisible();
    await expect(roll.locator('.desc')).toHaveCount(0);
    await expect(roll.locator('.comp')).toContainText('микрозелень');
  });
});
