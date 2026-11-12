import { test, expect } from '@playwright/test';

test.describe('Delivery card cart state', () => {
  test('adding an item does not increase card height or wrap the in-cart CTA', async ({ page }) => {
    await page.setViewportSize({ width: 228, height: 571 });
    await page.addInitScript(() => {
      localStorage.setItem('zt_onb', '1');
      localStorage.removeItem('zt_cart');
      sessionStorage.setItem('splashDone', '1');
    });
    await page.goto('/?brand=delivery', { waitUntil: 'domcontentloaded' });
    const card = page.locator('#deliveryGrid .card:not(.skeleton-card)').first();
    await expect(card).toBeVisible();
    await page.evaluate(() => document.fonts.ready);

    const before = await card.boundingBox();
    const add = card.locator('[data-add]');
    await add.click();
    await expect(add).toHaveClass(/incart/);
    await expect(card.locator('.steprow .step:not([hidden])')).toHaveCount(2);

    const after = await card.boundingBox();
    const button = await add.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return {
        height: rect.height,
        clientWidth: node.clientWidth,
        scrollWidth: node.scrollWidth,
        whiteSpace: style.whiteSpace,
        lineHeight: style.lineHeight,
        text: node.textContent.trim()
      };
    });

    expect(Math.abs(after.height - before.height), 'cart state must not grow the product card')
      .toBeLessThanOrEqual(1);
    expect(button.height, 'in-cart CTA must keep the standard control height').toBeLessThanOrEqual(48);
    expect(button.whiteSpace, 'in-cart CTA label must stay on one line').toBe('nowrap');
    expect(button.scrollWidth, 'in-cart CTA label must fit inside the button')
      .toBeLessThanOrEqual(button.clientWidth + 1);
    expect(button.text).toMatch(/^В корзине\s*·\s*1$/);
  });
});
