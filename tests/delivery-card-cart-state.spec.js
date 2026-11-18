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





test.describe('Card and stepper motion geometry', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('keeps card and 44px stepper geometry stable across both brands', async ({ page }, testInfo) => {
    for (const item of [{ brand: 'coffee', grid: '#grid' }, { brand: 'delivery', grid: '#deliveryGrid' }]) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.addInitScript(() => {
        localStorage.setItem('zt_onb', '1');
        localStorage.removeItem('zt_cart');
        sessionStorage.setItem('splashDone', '1');
      });
      await page.goto('/?brand=' + item.brand, { waitUntil: 'domcontentloaded' });
      const card = page.locator(item.grid + ' .card:not(.skeleton-card)').first();
      await expect(card).toBeVisible();
      await page.evaluate(() => document.fonts.ready);

      const initial = await card.boundingBox();
      expect(initial?.width).toBeGreaterThan(0);
      expect(initial?.height).toBeGreaterThan(0);
      await testInfo.attach(item.brand + '-card-390x844.png', {
        body: await page.screenshot({ fullPage: false }),
        contentType: 'image/png',
      });

      if (item.brand === 'delivery') {
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        const add = card.locator('[data-add]');
        const option = card.locator('.opts input[type="radio"]').first();
        if (await option.count()) await option.check();

        await add.click();
        await expect(add).toHaveClass(/incart/);
        const minus = card.locator('.steprow [data-step="-1"]');
        const plus = card.locator('.steprow [data-step="1"]');
        await expect(minus).toBeVisible();
        await expect(plus).toBeVisible();

        const added = await card.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const controls = Array.from(element.querySelectorAll('.steprow [data-step]')).map((button) => {
            const box = button.getBoundingClientRect();
            const style = getComputedStyle(button);
            return {
              width: box.width,
              height: box.height,
              transitionProperty: style.transitionProperty,
              transitionDuration: style.transitionDuration,
            };
          });
          return { width: rect.width, height: rect.height, controls };
        });
        expect(Math.abs(added.height - initial.height)).toBeLessThanOrEqual(1);
        expect(added.width).toBeCloseTo(initial.width, 1);
        expect(added.controls).toHaveLength(2);
        for (const control of added.controls) {
          expect(control.width).toBe(44);
          expect(control.height).toBe(44);
          expect(control.transitionDuration.split(',').every((duration) => duration.trim() === '0.12s')).toBe(true);
        }
        await testInfo.attach('delivery-stepper-390x844.png', {
          body: await page.screenshot({ fullPage: false }),
          contentType: 'image/png',
        });

        const cardBeforeQty = await card.boundingBox();
        await plus.click();
        await expect.poll(() => page.evaluate(() => {
          const cart = JSON.parse(localStorage.getItem('zt_cart') || '[]');
          return cart.reduce((sum, line) => sum + line.qty, 0);
        })).toBe(2);
        const cardAfterQty = await card.boundingBox();
        expect(Math.abs(cardAfterQty.height - cardBeforeQty.height)).toBeLessThanOrEqual(1);
        await testInfo.attach('delivery-stepper-quantity-2-390x844.png', {
          body: await page.screenshot({ fullPage: false }),
          contentType: 'image/png',
        });
      }

      const beforeReduced = await card.boundingBox();
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await expect.poll(() => page.evaluate(() =>
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      )).toBe(true);
      await expect(card).toHaveCSS('animation-name', 'none');
      await expect(card).toHaveCSS('transition-duration', '0s');
      if (item.brand === 'delivery') {
        await expect(card.locator('.steprow [data-step="-1"]')).toHaveCSS('transition-duration', '0s');
        await expect(card.locator('.steprow [data-step="1"]')).toHaveCSS('transition-duration', '0s');
      }
      const afterReduced = await card.boundingBox();
      expect(Math.abs(afterReduced.width - beforeReduced.width)).toBeLessThanOrEqual(1);
      expect(Math.abs(afterReduced.height - beforeReduced.height)).toBeLessThanOrEqual(1);
      await testInfo.attach(item.brand + '-reduced-motion-390x844.png', {
        body: await page.screenshot({ fullPage: false }),
        contentType: 'image/png',
      });
    }
  });
});
