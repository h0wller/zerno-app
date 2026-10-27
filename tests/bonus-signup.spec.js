// F3.64 (2.1/2.2/2.3): плашка «до подарка» и freeFrom убраны; первая доставка бесплатна по персональному коду.
import { test, expect } from '@playwright/test';

test.describe('Signup Bonuses Suite (F3.64)', () => {
  test('no delivery promo bar, gift line or free-from hint on a big cart', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('zt_onb', '1');
      sessionStorage.setItem('splashDone', '1');
    });
    await page.goto('/?brand=delivery');
    const card = page.locator('#deliveryGrid .card').first();
    await card.locator('.opts button', { hasText: '35 см' }).first().click({ timeout: 10000 });
    await card.locator('button', { hasText: 'Добавить' }).first().click();
    await page.locator('#cartFab').click();
    await page.evaluate(() => {
      cart.forEach((c) => { c.qty = 10; });
      window.renderCart();
    });
    await expect(page.locator('#deliveryPromoBar')).toHaveCount(0);
    await expect(page.locator('#cartPanel')).not.toContainText('Подарок добавлен');
    await expect(page.locator('#cartPanel')).not.toContainText('бесплатно от');
    await expect(page.locator('#cartFee')).not.toContainText('Бесплатно');
  });
});
