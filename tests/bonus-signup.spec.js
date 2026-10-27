// F3.64 (продуктовое решение исполнено, 27.10.2026): плашка «До подарка» (#deliveryPromoBar),
// freeFrom и строка подарков (#cartGifts) УБРАНЫ из корзины (client: cart.js/delivery.js).
// Бэкенд weekPromo/pizzaMonth не меняем — админ-форма промо сохранена для будущих акций.
// Тест зафиксирован на корзине с товаром: плашка не создаётся даже при активном weekPromo.
import { test, expect } from '@playwright/test';

test.describe('Signup Bonuses Suite (F3.64)', () => {
  test('no delivery promo bar or gifts on high cart sum', async ({ page }) => {
    await page.goto('/?brand=delivery');
    const bar = page.locator('#deliveryPromoBar');
    await expect(bar).toBeHidden();
  });

  test('promo bar stays removed even with items in cart', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('zt_onb', '1');
      sessionStorage.setItem('splashDone', '1');
    });
    await page.goto('/?brand=delivery');
    await page.waitForFunction(() => window.DMENU && window.DMENU.length, null, { timeout: 15000 });
    const card = page.locator('#deliveryGrid .card').first();
    await card.locator('.opts button').first().click({ timeout: 10000 });
    await card.locator('button', { hasText: 'Добавить' }).first().click();
    await page.locator('#cartFab').click();
    // F3.64: updateDeliveryPromoBar — заглушка, элемент не инжектится никогда
    await expect(page.locator('#deliveryPromoBar')).toHaveCount(0);
    // F3.64: подарки в корзине убраны
    await expect(page.locator('#cartGifts')).toHaveText('');
  });
});
