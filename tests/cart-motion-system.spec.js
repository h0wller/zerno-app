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

async function prepareCart(page, brand, viewport) {
  await page.setViewportSize(viewport);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript((item) => {
    localStorage.setItem('zt_onb', '1');
    localStorage.setItem('zt_inst_hide', '1');
    localStorage.setItem('zt_cart', JSON.stringify([item]));
    sessionStorage.setItem('splashDone', '1');
  }, CART_ITEM);

  await page.goto('/?brand=' + brand);
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
    };
  });

  expect(geometry.transitionDuration).toMatch(/^(0s|0\.01ms)(,\s*(0s|0\.01ms))*$/);
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
}

test('reduced motion opens and closes the cart sheet without spatial travel', async ({ page }, testInfo) => {
  const video = page.video();
  const viewports = [
    { width: 390, height: 844 },
    { width: 1024, height: 768 },
  ];

  // The floating cart and cart sheet are delivery-only components.
  for (const brand of ['delivery']) {
    for (const viewport of viewports) {
      const { panel, fab } = await prepareCart(page, brand, viewport);

      await fab.click();
      await expect(panel).toHaveClass(/open/);
      await expectCartAtRest(panel, viewport, true);

      await page.locator('#cartClose').click();
      await expect(panel).not.toHaveClass(/open/);
      await expectCartAtRest(panel, viewport, false);
    }
  }

  await page.close();
  if (video) {
    await testInfo.attach('cart-motion-reduced.webm', {
      path: await video.path(),
      contentType: 'video/webm',
    });
  }
});

test('cart sheet can be interrupted by rapid close and reopen without stale geometry', async ({ page }, testInfo) => {
  const video = page.video();
  const viewport = { width: 390, height: 844 };
  const { panel, fab } = await prepareCart(page, 'delivery', viewport);

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await fab.click();
  await expect(panel).toHaveClass(/open/);
  await page.locator('#cartTopClose').click();
  await expect(panel).not.toHaveClass(/open/);
  await expect(fab).toBeVisible();
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

  await page.close();
  if (video) {
    await testInfo.attach('cart-motion-interrupted.webm', {
      path: await video.path(),
      contentType: 'video/webm',
    });
  }
});
