import { test, expect } from '@playwright/test';

test.describe('Splash Copy Suite (F3.65)', () => {
  test('splash button has clean title without quotes', async ({ page }) => {
    await page.goto('/?splash=1');
    const pizzaBtn = page.locator('.spBtn.spPizza .bt');
    await expect(pizzaBtn).toHaveText('Пятница');
  });
});
