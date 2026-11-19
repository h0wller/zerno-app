import { test, expect } from '@playwright/test';

test('delivery selected category and cart CTA use the shared flame with chocolate outlines', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    localStorage.removeItem('zt_cart');
    sessionStorage.setItem('splashDone', '1');
  });
  await page.goto('/?brand=delivery', { waitUntil: 'domcontentloaded' });

  const pizzaCategory = page.locator('#deliveryRail [data-dcat="pizza"]');
  if (!(await pizzaCategory.evaluate((node) => node.classList.contains('on')))) {
    await pizzaCategory.click();
  }
  const activeSubfilter = page.locator('#deliverySubFilterViewport:not([hidden]) .subchip.on');
  await expect(activeSubfilter).toBeVisible({ timeout: 15000 });
  await expect.poll(() => activeSubfilter.evaluate((node) => {
    const style = getComputedStyle(node, '::before');
    return { background: style.backgroundColor, borderColor: style.borderTopColor };
  })).toEqual({ background: 'rgb(192, 59, 42)', borderColor: 'rgb(58, 42, 28)' });

  const activeCategoryIcon = page.locator('#deliveryRail button.on .re');
  await expect(activeCategoryIcon).toBeVisible({ timeout: 15000 });
  await expect.poll(() => activeCategoryIcon.evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      background: style.backgroundColor,
      borderWidth: style.borderTopWidth,
      borderStyle: style.borderTopStyle,
      borderColor: style.borderTopColor
    };
  })).toEqual({
    background: 'rgb(192, 59, 42)',
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: 'rgb(58, 42, 28)'
  });

  const card = page.locator('#deliveryGrid .card:not(.skeleton-card)').first();
  await expect(card).toBeVisible({ timeout: 15000 });
  const option = card.locator('.opts input[type="radio"]').first();
  if (await option.count()) await option.check();

  const add = card.locator('[data-add]');
  await add.click();
  await expect(add).toHaveClass(/added/);
  await expect(add).toHaveCSS('border-top-color', 'rgb(58, 42, 28)');
  await expect.poll(() => add.evaluate((node) => node.classList.contains('added'))).toBe(false);
  await expect(add).toHaveClass(/incart/);
  await expect(add).toHaveCSS('border-top-width', '2px');
  await expect(add).toHaveCSS('border-top-style', 'solid');
  await expect(add).toHaveCSS('border-top-color', 'rgb(58, 42, 28)');
  await expect(add).toHaveCSS('color', 'rgb(192, 59, 42)');
});
