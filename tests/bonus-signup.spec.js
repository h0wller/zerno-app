import { test, expect } from '@playwright/test';

test.describe('Signup Bonuses Suite (F3.64)', () => {
  test('no delivery promo bar or gifts on high cart sum', async ({ page }) => {
    await page.goto('/?brand=delivery');
    const bar = page.locator('#deliveryPromoBar');
    await expect(bar).toBeHidden();
  });
});
