import { test, expect } from '@playwright/test';

test('coffee brand switcher exposes a selected state and intrinsic mobile button width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
  await page.goto('/?brand=delivery', { waitUntil: 'domcontentloaded' });

  await page.locator('#venueToggle').click();
  const coffeeButton = page.locator('#brandSeg button[data-brand="coffee"]');
  await expect(coffeeButton).toBeVisible();
  await coffeeButton.click();
  await expect(coffeeButton).toHaveClass(/on/);

  const state = await coffeeButton.evaluate(button => {
    const style = getComputedStyle(button);
    const rect = button.getBoundingClientRect();
    const text = button.textContent.trim();
    const range = document.createRange();
    range.selectNodeContents(button);
    const textWidth = range.getBoundingClientRect().width;
    return {
      background: style.backgroundColor,
      color: style.color,
      width: rect.width,
      contentWidth: textWidth,
      padding: parseFloat(style.paddingLeft) + parseFloat(style.paddingRight),
      flex: style.flex,
      brand: document.documentElement.dataset.brand,
    };
  });

  expect(state.brand).toBe('coffee');
  expect(state.background, 'coffee selection must have a visible active surface').not.toBe('rgba(0, 0, 0, 0)');
  expect(state.color).not.toBe('rgba(0, 0, 0, 0)');
  expect(state.width).toBeLessThanOrEqual(state.contentWidth + state.padding + 3);
  expect(state.width).toBeGreaterThan(state.contentWidth);
});

test('coffee category switch scrolls the new catalog column into view smoothly while rail is pinned', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
  await page.goto('/?brand=coffee', { waitUntil: 'domcontentloaded' });

  const rail = page.locator('#rail');
  await expect(rail).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 700));
  await expect(rail).toHaveClass(/rail-is-pinned/);

  const category = page.locator('#rail button[data-cat]').nth(1);
  await category.click();

  await expect(category).toHaveClass(/on/);
  await expect.poll(() => page.evaluate(() => {
    const rail = document.querySelector('#rail');
    const grid = document.querySelector('#grid');
    if (!rail || !grid) return Infinity;
    return Math.abs(grid.getBoundingClientRect().top - rail.getBoundingClientRect().bottom - 8);
  }), { timeout: 8000 }).toBeLessThanOrEqual(3);
});
