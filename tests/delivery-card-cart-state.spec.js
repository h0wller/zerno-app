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
    await expect(card.locator('.steprow .step:visible')).toHaveCount(1);
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
    expect(button.height, 'in-cart CTA must keep the standard 44px control height').toBe(44);
    expect(button.width, 'in-cart CTA remains a 44px hit target').toBeGreaterThanOrEqual(44);
    expect(button.whiteSpace, 'in-cart CTA label must stay on one line').toBe('nowrap');
    expect(parseFloat(button.fontSize), 'restored quantity label uses the compact typography').toBe(11);
    expect(button.scrollWidth, 'in-cart CTA label must fit inside the button')
      .toBeLessThanOrEqual(button.clientWidth + 1);
    expect(button.text).toBe('В корзине · 1');
    expect(button.ariaLabel).toBe('В корзине · 1. Добавить ещё');
    const stepRow = await card.locator('.steprow').evaluate(node => ({ width: node.clientWidth, scrollWidth: node.scrollWidth }));
    expect(stepRow.scrollWidth, 'quantity controls must stay inside the product card').toBeLessThanOrEqual(stepRow.width + 1);
    const rowBounds = await card.evaluate(node => {
      const row = node.querySelector('.steprow');
      const cardRect = node.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();
      return { cardLeft: cardRect.left, cardRight: cardRect.right, rowLeft: rowRect.left, rowRight: rowRect.right };
    });
    expect(rowBounds.rowLeft, 'quantity row must stay inside card left border').toBeGreaterThanOrEqual(rowBounds.cardLeft - 1);
    expect(rowBounds.rowRight, 'quantity row must stay inside card right border').toBeLessThanOrEqual(rowBounds.cardRight + 1);
    await expect(page.locator('#toasts .toast')).toHaveCount(0, { timeout: 3500 });
    await add.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -90));
    const unobscured = await page.evaluate(() => {
      const cta = document.querySelector('#deliveryGrid [data-add].incart').getBoundingClientRect();
      const fab = document.querySelector('#cartFab').getBoundingClientRect();
      return !(cta.left < fab.right && cta.right > fab.left && cta.top < fab.bottom && cta.bottom > fab.top);
    });
    expect(unobscured, 'in-cart CTA must be scrollable clear of the fixed cart FAB').toBe(true);
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


test('card entrance uses backwards fill and releases the desktop hover lift in both brands', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    localStorage.removeItem('zt_cart');
    sessionStorage.setItem('splashDone', '1');
    window.__cardMotionEvents = [];
    document.addEventListener('animationstart', (event) => {
      if (!event.target || !event.target.matches || !event.target.matches('.card')) return;
      const style = getComputedStyle(event.target);
      window.__cardMotionEvents.push({
        phase: 'start',
        animationName: event.animationName,
        productId: event.target.getAttribute('data-product-id') || event.target.getAttribute('data-item-id') || event.target.id || event.target.className,
        fillMode: style.animationFillMode,
        duration: style.animationDuration
      });
    }, true);
    document.addEventListener('animationend', (event) => {
      if (!event.target || !event.target.matches || !event.target.matches('.card')) return;
      window.__cardMotionEvents.push({
        phase: 'end',
        animationName: event.animationName,
        productId: event.target.getAttribute('data-product-id') || event.target.getAttribute('data-item-id') || event.target.id || event.target.className
      });
    }, true);
  });

  for (const storefront of [
    { brand: 'coffee', grid: '#grid' },
    { brand: 'delivery', grid: '#deliveryGrid' }
  ]) {
    await page.goto('/?brand=' + storefront.brand, { waitUntil: 'domcontentloaded' });
    const card = page.locator(storefront.grid + ' > .card:not(.skeleton-card)').first();
    await expect(card).toBeVisible({ timeout: 15000 });
    const productId = await card.evaluate(element => element.getAttribute('data-product-id') || element.getAttribute('data-item-id') || element.id || element.className);

    await expect.poll(() => page.evaluate((id) => window.__cardMotionEvents.some((event) =>
      event.phase === 'start' && event.animationName === 'card-enter' &&
      event.productId === id && event.fillMode === 'backwards' &&
      event.duration === '0.18s'
    ), productId)).toBe(true);
    await expect.poll(() => page.evaluate((id) => window.__cardMotionEvents.some((event) =>
      event.phase === 'end' && event.animationName === 'card-enter' && event.productId === id
    ), productId)).toBe(true);

    await card.hover();
    await expect.poll(() => card.evaluate((element) => {
      const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
      return matrix.m42;
    })).toBeLessThan(-1);
  }
});

test('quantity stepper has 120ms press feedback without changing its hit target', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    localStorage.removeItem('zt_cart');
    sessionStorage.setItem('splashDone', '1');
  });
  await page.goto('/?brand=delivery', { waitUntil: 'domcontentloaded' });

  const card = page.locator('#deliveryGrid .card:not(.skeleton-card)')
    .filter({ has: page.locator('.opts input[type="radio"]') })
    .first();
  await expect(card).toBeVisible({ timeout: 15000 });
  const option = card.locator('.opts input[type="radio"]').first();
  if (await option.count()) await option.check();
  await card.locator('[data-add]').click();

  const step = card.locator('.steprow .step:visible').first();
  await expect(step).toBeVisible();
  const box = await step.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.width).toBeGreaterThanOrEqual(44);

  await step.hover();
  await page.mouse.down();
  await expect.poll(() => step.evaluate((element) => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
    return matrix.m11;
  })).toBeLessThan(0.97);
  const pressed = await step.evaluate((element) => {
    const style = getComputedStyle(element);
    const matrix = new DOMMatrixReadOnly(style.transform);
    return {
      duration: style.transitionDuration,
      scaleX: matrix.m11,
      scaleY: matrix.m22,
      filter: style.filter
    };
  });
  await page.mouse.up();

  expect(pressed.duration.split(',').map(value => value.trim())).toEqual(['0.12s', '0.12s']);
  expect(pressed.scaleX).toBeCloseTo(0.96, 2);
  expect(pressed.scaleY).toBeCloseTo(0.96, 2);
  expect(pressed.filter).toContain('brightness(0.96)');
});


test('delivery option validation keeps its message but removes shake under reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    localStorage.removeItem('zt_cart');
    sessionStorage.setItem('splashDone', '1');
  });
  await page.goto('/?brand=delivery');
  await page.waitForFunction(() =>
    window.brand === 'delivery' &&
    typeof window.renderDeliveryMenu === 'function'
  );

  const card = page.locator('#deliveryGrid .card:not(.skeleton-card)')
    .filter({ has: page.locator('.opts input[type="radio"]') })
    .first();
  await expect(card).toBeVisible();
  const options = card.locator('.opts');
  const addButton = card.locator('[data-add]');

  await addButton.click();
  await expect(options.locator('.opts-error')).toBeVisible();
  await expect(options).toHaveClass(/shake/);
  await expect.poll(() => options.evaluate((element) => getComputedStyle(element).animationName))
    .toBe('shake');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => options.evaluate((element) => getComputedStyle(element).animationName))
    .toBe('none');
  await expect(options.locator('.opts-error')).toBeVisible();
});

for (const storefront of [
  { brand: 'coffee', grid: '#grid' },
  { brand: 'delivery', grid: '#deliveryGrid' }
]) {
  test(`${storefront.brand}: card entrance and hover stop when reduced motion is enabled at runtime`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.addInitScript(() => {
      localStorage.setItem('zt_onb', '1');
      localStorage.removeItem('zt_cart');
      sessionStorage.setItem('splashDone', '1');
    });
    await page.goto('/?brand=' + storefront.brand, { waitUntil: 'domcontentloaded' });

    const card = page.locator(storefront.grid + ' > .card:not(.skeleton-card)').first();
    await expect(card).toBeVisible({ timeout: 15000 });
    await expect.poll(() => card.evaluate(element => getComputedStyle(element).animationName))
      .toBe('card-enter');

    await card.hover();
    await expect.poll(() => card.evaluate(element => {
      const transform = new DOMMatrixReadOnly(getComputedStyle(element).transform);
      return transform.m42;
    })).toBeLessThan(-1);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect.poll(() => card.evaluate(element => ({
      animationName: getComputedStyle(element).animationName,
      transitionDuration: getComputedStyle(element).transitionDuration,
      transform: getComputedStyle(element).transform,
    }))).toEqual({
      animationName: 'none',
      transitionDuration: '0s',
      transform: 'none',
    });

    await testInfo.attach(storefront.brand + '-card-reduced-motion-1440x900', {
      body: await page.screenshot({ fullPage: false, animations: 'disabled' }),
      contentType: 'image/png',
    });
  });
}

test('delivery quantity stepper stops press scaling under runtime reduced motion and remains usable', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    localStorage.removeItem('zt_cart');
    sessionStorage.setItem('splashDone', '1');
  });
  await page.goto('/?brand=delivery', { waitUntil: 'domcontentloaded' });

  const card = page.locator('#deliveryGrid .card:not(.skeleton-card)')
    .filter({ has: page.locator('.opts input[type="radio"]') })
    .first();
  await expect(card).toBeVisible({ timeout: 15000 });
  const option = card.locator('.opts input[type="radio"]').first();
  if (await option.count()) await option.check();
  await card.locator('[data-add]').click();

  const step = card.locator('.steprow .step[data-step="-1"]:visible');
  await expect(step).toBeVisible();
  const hitArea = await step.boundingBox();
  expect(hitArea.width).toBeGreaterThanOrEqual(44);
  expect(hitArea.height).toBeGreaterThanOrEqual(44);

  await step.hover();
  await page.mouse.down();
  await expect.poll(() => step.evaluate(element => {
    return new DOMMatrixReadOnly(getComputedStyle(element).transform).m11;
  })).toBeLessThan(0.97);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => step.evaluate(element => ({
    transform: getComputedStyle(element).transform,
    transitionDuration: getComputedStyle(element).transitionDuration,
    filter: getComputedStyle(element).filter,
  }))).toEqual({
    transform: 'none',
    transitionDuration: '0s',
    filter: 'brightness(0.96)',
  });
  // Releasing the active press dispatches the click. The quantity-one item
  // must be removed even though reduced motion cancelled the visual press.
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() =>
    JSON.parse(localStorage.getItem('zt_cart') || '[]')
  )).toEqual([]);
  await expect(card.locator('[data-add]')).not.toHaveClass(/incart/);

  await testInfo.attach('delivery-stepper-reduced-motion-390x844', {
    body: await page.screenshot({ fullPage: false, animations: 'disabled' }),
    contentType: 'image/png',
  });
});
