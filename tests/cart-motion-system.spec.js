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
  const fabMotion = await fab.evaluate((element) => {
    const style = getComputedStyle(element);
    const transform = new DOMMatrixReadOnly(style.transform);
    return {
      transitionDuration: style.transitionDuration,
      scaleX: transform.a,
      scaleY: transform.d,
      translateX: transform.m41,
      halfWidth: element.getBoundingClientRect().width / 2,
    };
  });
  expect(fabMotion.transitionDuration).toBe('0s');
  expect(fabMotion.scaleX).toBeCloseTo(1, 3);
  expect(fabMotion.scaleY).toBeCloseTo(1, 3);
  expect(fabMotion.translateX).toBeCloseTo(-fabMotion.halfWidth, 1);
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
      layoutViewportRight: document.documentElement.getBoundingClientRect().right,
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
    expect(Math.abs(geometry.right - geometry.layoutViewportRight)).toBeLessThanOrEqual(1);
    expect(geometry.width).toBeGreaterThan(0);
    expect(geometry.width).toBeLessThanOrEqual(Math.min(430, viewport.width));
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
    await expect(panel).toHaveCSS('visibility', 'hidden');
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
