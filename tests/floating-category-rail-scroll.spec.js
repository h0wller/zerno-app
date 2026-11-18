import { test, expect } from '@playwright/test';

test('detached category rail remains fixed through active catalog scrolling for both brands', async ({ page }) => {
  for (const brand of ['coffee', 'delivery']) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
    await page.goto('/?brand=' + brand, { waitUntil: 'domcontentloaded' });
    const rail = page.locator(brand === 'coffee' ? '#rail' : '#deliveryRail');
    await expect(rail).toBeVisible();
    const before = await rail.boundingBox();
    await page.evaluate(() => window.scrollTo(0, 600));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
    const after = await rail.boundingBox();
    expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(after.height - before.height)).toBeLessThanOrEqual(1);
    await expect(rail).toHaveCSS('position', 'fixed');
  }
});
