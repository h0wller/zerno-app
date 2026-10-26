import { test, expect } from '@playwright/test';

test.describe('Splash Copy Suite (F3.65)', () => {
  test('splash button has clean title without quotes', async ({ page }) => {
    await page.goto('/?splash=1');
    const pizzaBtn = page.locator('.spBtn.spPizza .bt');
    await expect(pizzaBtn).toHaveText('Пятница');
  });

  test('no quoted brand titles in splash', async ({ page }) => {
    await page.goto('/?splash=1');
    const html = await page.locator('#brandSplashStatic').innerHTML();
    expect(html).not.toContain('«Пятница»');
    expect(html).not.toContain('«…и кофе»');
    await expect(page.locator('.spBtn.spCoffee .bt')).toHaveText('…и кофе');
  });
});
