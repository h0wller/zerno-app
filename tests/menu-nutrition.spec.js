import { test, expect } from '@playwright/test';

test.describe('Оценочный калькулятор КБЖУ в увеличенном просмотре', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('zt_onb', '1');
      sessionStorage.setItem('splashDone', '1');
    });
    await page.goto('/?brand=delivery', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#deliveryGrid [data-product-id="pz-marg"]')).toBeVisible();
  });

  async function openDeliveryItem(page, id) {
    await page.evaluate((productId) => {
      const product = window.DMENU.find((item) => String(item.id) === productId);
      if (!product) throw new Error('Тестовая позиция не найдена: ' + productId);
      window.openZoom('/test-' + productId + '-zoom.webp', product.name, '', product);
    }, id);
    await expect(page.locator('#itemZoomOverlay')).toBeVisible();
  }

  test('пицца показывает оценку, пересчитывает макросы при выборе размера и теста', async ({ page }) => {
    await openDeliveryItem(page, 'pz-marg');

    const nutrition = page.locator('#zoomKbjuBox');
    await expect(nutrition).toContainText('Пищевая ценность — оценка');
    await expect(nutrition.locator('[data-kbju-val="kcal"]')).toHaveText(/^\d+$/);
    await expect(nutrition.locator('[data-kbju-mode="portion"]')).toContainText('395 г');

    const initialCalories = await nutrition.locator('[data-kbju-val="kcal"]').textContent();
    await nutrition.locator('[data-kbju-option="1"]').click();

    await expect(nutrition.locator('[data-kbju-mode="portion"]')).toContainText('585 г');
    const largeCalories = await nutrition.locator('[data-kbju-val="kcal"]').textContent();
    expect(largeCalories).not.toBe(initialCalories);

    await nutrition.locator('[data-kbju-mode="portion"]').click();
    await expect(nutrition.locator('[data-kbju-val="kcal"]')).toHaveText(/^\d+$/);
  });

  test('цвета блока КБЖУ меняются вместе с токенами бренда', async ({ page }) => {
    await openDeliveryItem(page, 'pz-marg');

    const option = page.locator('#zoomKbjuBox [data-kbju-option="0"]');
    await expect(option).toHaveCSS('background-color', 'rgb(201, 158, 110)');
    await expect(option).toHaveCSS('border-top-color', 'rgb(192, 59, 42)');

    await page.evaluate(() => {
      document.documentElement.dataset.brand = 'coffee';
      document.body.dataset.brand = 'coffee';
    });

    await expect(option).toHaveCSS('background-color', 'rgb(234, 241, 249)');
    await expect(option).toHaveCSS('border-top-color', 'rgb(18, 58, 107)');

    const portionMode = page.locator('#zoomKbjuBox [data-kbju-mode="portion"]');
    await portionMode.click();
    await expect(portionMode).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(portionMode).toHaveCSS('color', 'rgb(16, 20, 24)');
  });

  test('бейджи состава ролла используют токены обоих брендов', async ({ page }) => {
    const cardChip = page.locator('#deliveryGrid [data-product-id="rl-phil-og"] .comp i').first();
    await expect(cardChip).toBeVisible();
    await expect(cardChip).toHaveCSS('background-color', 'rgb(239, 230, 216)');
    await expect(cardChip).toHaveCSS('border-top-color', 'rgb(201, 158, 110)');
    await expect(cardChip).toHaveCSS('color', 'rgb(58, 42, 28)');

    await openDeliveryItem(page, 'rl-phil-og');
    const zoomChip = page.locator('#itemZoomOverlay .zoom-composition-chip').first();
    await expect(zoomChip).toBeVisible();
    await expect(zoomChip).toHaveCSS('background-color', 'rgb(239, 230, 216)');

    await page.evaluate(() => {
      document.documentElement.dataset.brand = 'coffee';
      document.body.dataset.brand = 'coffee';
    });

    await expect(cardChip).toHaveCSS('background-color', 'rgb(234, 241, 249)');
    await expect(cardChip).toHaveCSS('border-top-color', 'rgba(62, 143, 208, 0.25)');
    await expect(cardChip).toHaveCSS('color', 'rgb(18, 58, 107)');
    await expect(zoomChip).toHaveCSS('background-color', 'rgb(234, 241, 249)');
  });

  test('ролл с полной ТТК показывает оценочные КБЖУ', async ({ page }) => {
    await openDeliveryItem(page, 'rl-phil-og');

    const nutrition = page.locator('#zoomKbjuBox');
    await expect(nutrition).toContainText('Пищевая ценность — оценка');
    await expect(nutrition.locator('[data-kbju-val="kcal"]')).toHaveText(/^\d+$/);
    await expect(nutrition).toContainText('на порцию (250 г)');
  });

  test('запечённый ролл с красным соусом в заготовке показывает полный расчёт', async ({ page }) => {
    await openDeliveryItem(page, 'rl-kioto-kr');

    const nutrition = page.locator('#zoomKbjuBox');
    await expect(nutrition).toContainText('Пищевая ценность — оценка');
    await expect(nutrition.locator('[data-kbju-val="kcal"]')).toHaveText(/^[0-9]+$/);
    await expect(nutrition).toContainText('на порцию (290 г)');
  });
});
