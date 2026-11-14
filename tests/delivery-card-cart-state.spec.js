import { test, expect } from '@playwright/test';

test.describe('Delivery card cart state', () => {
  test('adding an item does not increase card height or wrap the in-cart CTA', async ({ page }, testInfo) => {
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
    const firstOption = card.locator('.opts input[type="radio"]').first();
    if (await firstOption.count()) await firstOption.check();
    await add.click();
    await expect(add).toHaveClass(/incart/);
    await expect(card.locator('.steprow .step:not([hidden])')).toHaveCount(1);
    await expect(card.locator('.steprow .step[data-step="1"]')).toBeHidden();

    const after = await card.boundingBox();
    const button = await add.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return {
        height: rect.height,
        width: rect.width,
        clientWidth: node.clientWidth,
        scrollWidth: node.scrollWidth,
        whiteSpace: style.whiteSpace,
        lineHeight: style.lineHeight,
        text: node.textContent.trim(),
        ariaLabel: node.getAttribute('aria-label'),
        fontSize: style.fontSize
      };
    });

    expect(Math.abs(after.height - before.height), 'cart state must not grow the product card')
      .toBeLessThanOrEqual(1);
    expect(button.height, 'in-cart CTA must keep the standard control height').toBeLessThanOrEqual(48);
    expect(button.width, 'in-cart CTA remains a 44px hit target').toBeGreaterThanOrEqual(44);
    expect(button.whiteSpace, 'in-cart CTA label must stay on one line').toBe('nowrap');
    expect(parseFloat(button.fontSize), 'compact in-cart state remains legible').toBeGreaterThanOrEqual(14);
    expect(button.scrollWidth, 'in-cart CTA label must fit inside the button')
      .toBeLessThanOrEqual(button.clientWidth + 1);
    expect(button.text).toBe('✓');
    expect(button.ariaLabel).toBe('В корзине · 1. Добавить ещё');
    const stepRow = await card.locator('.steprow').evaluate(node => ({ width: node.clientWidth, scrollWidth: node.scrollWidth }));
    expect(stepRow.scrollWidth, 'quantity controls must stay inside the product card').toBeLessThanOrEqual(stepRow.width + 1);
    await expect(page.locator('#toasts .toast')).toHaveCount(0, { timeout: 3500 });
    await testInfo.attach('delivery-card-in-cart-cta-228px', {
      body: await add.screenshot(),
      contentType: 'image/png'
    });
    await testInfo.attach('delivery-card-in-cart-228px', {
      body: await page.screenshot({ fullPage: false }),
      contentType: 'image/png'
    });

    await add.click();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('zt_cart'))[0].qty)).toBe(2);
    await card.locator('.steprow [data-step="-1"]').click();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('zt_cart'))[0].qty)).toBe(1);
  });
});
