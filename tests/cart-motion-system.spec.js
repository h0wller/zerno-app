import { test, expect } from '@playwright/test';

test.use({
  serviceWorkers: 'block',
  video: 'on',
});

const CART_ITEM = {
  key: 'motion-cart-item_1',
  id: 'motion-cart-item',
  oi: 1,
  name: 'Тестовый товар',
  opt: 'Стандартный вариант',
  price: 500,
  qty: 1,
};

async function prepareCart(page, viewport) {
  await page.setViewportSize(viewport);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    localStorage.setItem('zt_inst_hide', '1');
    sessionStorage.setItem('splashDone', '1');
  });

  await page.goto('/?brand=delivery');
  await page.waitForFunction(() => typeof window.replaceCartItems === 'function');
  await page.evaluate((item) => window.replaceCartItems([item]), CART_ITEM);

  const panel = page.locator('#cartPanel');
  const fab = page.locator('#cartFab');
  await expect(panel).toBeAttached();
  await expect(fab).toBeVisible({ timeout: 10000 });
  await expect(panel).not.toHaveClass(/open/);
  return { panel, fab };
}

async function expectCartAtRest(panel, viewport, open) {
  const geometry = await panel.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
      transitionDuration: style.transitionDuration,
      transitionProperty: style.transitionProperty,
      visibility: style.visibility,
      display: style.display,
      pointerEvents: style.pointerEvents,
    };
  });

  expect(geometry.transitionDuration).toMatch(/^(0s|0\.01ms)(,\s*(0s|0\.01ms))*$/);
  expect(geometry.display).toBe('flex');
  expect(geometry.visibility).toBe(open ? 'visible' : 'hidden');
  if (viewport.width <= 820) {
    if (open) {
      expect(Math.abs(geometry.bottom - viewport.height)).toBeLessThanOrEqual(1);
      expect(geometry.top).toBeGreaterThanOrEqual(-1);
    } else {
      expect(geometry.top).toBeGreaterThanOrEqual(viewport.height - 1);
    }
  } else if (open) {
    expect(Math.abs(geometry.right - viewport.width)).toBeLessThanOrEqual(1);
    expect(geometry.width).toBeCloseTo(430, 0);
  } else {
    expect(geometry.left).toBeGreaterThanOrEqual(viewport.width - 1);
  }

  expect(geometry.width).toBeGreaterThan(0);
  expect(geometry.height).toBeGreaterThan(0);
  expect(geometry.visibility).toBe(open ? 'visible' : 'hidden');
  expect(geometry.pointerEvents).toBe(open ? 'auto' : 'none');
}

test('reduced motion opens and closes the cart sheet without spatial travel', async ({ page }) => {
  const viewports = [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 1024, height: 768 },
  ];

  // The floating cart and cart sheet are delivery-only components.
  for (const viewport of viewports) {
    const { panel, fab } = await prepareCart(page, viewport);

    await fab.click();
    await expect(panel).toHaveClass(/open/);
    await expectCartAtRest(panel, viewport, true);

    await page.locator('#cartClose').click();
    await expect(panel).not.toHaveClass(/open/);
    await expect(panel).toBeHidden();
    await expect(page.locator('#overlay')).not.toHaveClass(/show/);
    await expect(page.locator('body')).not.toHaveClass(/cart-open/);
    await expectCartAtRest(panel, viewport, false);
  }
});

test('cart sheet can be interrupted by rapid close and reopen without stale geometry', async ({ page }) => {
  const viewport = { width: 390, height: 844 };
  const { panel, fab } = await prepareCart(page, viewport);

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await fab.click();
  await expect(panel).toHaveClass(/open/);
  await page.locator('#cartTopClose').click();
  await expect(panel).not.toHaveClass(/open/);
  await expect(panel).toHaveCSS('visibility', 'visible');
  await expect(fab).toBeVisible();
  await page.waitForTimeout(100);
  await expect(panel).toHaveCSS('visibility', 'visible');
  await fab.click();
  await expect(panel).toHaveClass(/open/);

  await expect.poll(() => panel.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return Math.abs(rect.bottom - window.innerHeight);
  })).toBeLessThanOrEqual(1);
  const overflow = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
    body: document.body.scrollWidth,
  }));
  expect(overflow.document).toBeLessThanOrEqual(overflow.viewport + 1);
  expect(overflow.body).toBeLessThanOrEqual(overflow.viewport + 1);

});

test('cart sheet remains visible during normal exit and hides after its spatial transition', async ({ page }) => {
  const viewport = { width: 390, height: 844 };
  const { panel, fab } = await prepareCart(page, viewport);

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await fab.click();
  await expect(panel).toHaveClass(/open/);
  await expect(panel).toHaveCSS('visibility', 'visible');
  await page.locator('#cartClose').click();
  await expect(panel).not.toHaveClass(/open/);
  await expect(panel).toHaveCSS('visibility', 'visible');
  await expect.poll(() => panel.evaluate((element) => getComputedStyle(element).visibility))
    .toBe('hidden');

});

test('cart FAB fades without moving or resizing its hit target', async ({ page }) => {
  const viewport = { width: 390, height: 844 };
  const { fab } = await prepareCart(page, viewport);

  for (const reducedMotion of ['no-preference', 'reduce']) {
    await page.emulateMedia({ reducedMotion });

    await page.evaluate(() => window.replaceCartItems([]));
    await expect(fab).toBeHidden();
    await fab.evaluate((element) => { element.hidden = false; });
    const hiddenState = await fab.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        transform: style.transform,
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      };
    });

    await page.evaluate((item) => window.replaceCartItems([item]), CART_ITEM);
    await expect(fab).toBeVisible();
    const initial = await fab.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        transform: style.transform,
        transitionProperty: style.transitionProperty,
        transitionDuration: style.transitionDuration,
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      };
    });

    expect(initial.transform).toBe(hiddenState.transform);
    expect(initial.left).toBeCloseTo(hiddenState.left, 2);
    expect(initial.top).toBeCloseTo(hiddenState.top, 2);
    expect(initial.width).toBeCloseTo(hiddenState.width, 2);
    expect(initial.height).toBeCloseTo(hiddenState.height, 2);
    expect(initial.transitionProperty.split(',').map((value) => value.trim()))
      .not.toContain('transform');
    if (reducedMotion === 'reduce') {
      expect(initial.transitionDuration.split(',').every((value) => Number.parseFloat(value) === 0)).toBe(true);
    } else {
      expect(initial.transitionProperty).toContain('opacity');
      expect(initial.transitionDuration).toContain('0.18s');
    }

    await page.mouse.move(initial.left + initial.width / 2, initial.top + initial.height / 2);
    const hovered = await fab.boundingBox();
    expect(hovered).toEqual({
      x: initial.left,
      y: initial.top,
      width: initial.width,
      height: initial.height,
    });

    await page.mouse.down();
    const pressed = await fab.boundingBox();
    expect(pressed).toEqual({
      x: initial.left,
      y: initial.top,
      width: initial.width,
      height: initial.height,
    });
    // Release outside the button so this interaction probe does not open the cart.
    await page.mouse.move(0, 0);
    await page.mouse.up();
  }
});
