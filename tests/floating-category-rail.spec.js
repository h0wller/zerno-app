import { test, expect } from '@playwright/test';

const BRANDS = [
  { brand: 'coffee', selector: '#rail', count: 6, grid: '#grid' },
  { brand: 'delivery', selector: '#deliveryRail', count: 5, grid: '#deliveryGrid' },
];
const VIEWPORTS = [
  { name: '320x740', width: 320, height: 740, railHeight: 56 },
  { name: '360x800', width: 360, height: 800, railHeight: 56 },
  { name: '390x844', width: 390, height: 844, railHeight: 56 },
  { name: '430x932', width: 430, height: 932, railHeight: 56 },
  { name: '844x390', width: 844, height: 390, railHeight: 48 },
  { name: '1024x390', width: 1024, height: 390, railHeight: 48 },
];

for (const brand of BRANDS) {
  for (const viewport of VIEWPORTS) {
    test(brand.brand + ': floating capsule geometry at ' + viewport.name, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.addInitScript(() => {
        sessionStorage.setItem('splashDone', '1');
        localStorage.setItem('zt_inst_hide', '1');
        localStorage.setItem('zt_ios_hide', '1');
      });
      await page.goto('/?brand=' + brand.brand, { waitUntil: 'domcontentloaded' });

      const rail = page.locator(brand.selector);
      await expect(rail).toBeVisible({ timeout: 15000 });
      await expect(rail).toHaveClass(/rail-position-ready/);
      const geometry = await rail.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const probe = document.createElement('div');
        probe.style.cssText = 'position:fixed;visibility:hidden;padding-bottom:env(safe-area-inset-bottom,0px)';
        document.body.appendChild(probe);
        const safeArea = parseFloat(getComputedStyle(probe).paddingBottom) || 0;
        probe.remove();
        return {
          position: getComputedStyle(element).position,
          bottomGap: window.innerHeight - rect.bottom,
          safeArea,
          left: rect.left,
          right: rect.right,
          width: rect.width,
          height: rect.height,
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          pageWidth: document.documentElement.clientWidth,
          pageScrollWidth: document.documentElement.scrollWidth,
          overflowX: getComputedStyle(element).overflowX,
          buttons: Array.from(element.querySelectorAll('button')).map(button => {
            const box = button.getBoundingClientRect();
            return {
              width: box.width,
              height: box.height,
              name: button.getAttribute('aria-label') || button.title || button.textContent.trim(),
              left: box.left,
              right: box.right
            };
          })
        };
      });
      await testInfo.attach(brand.brand + '-' + viewport.name + '-rail.png', {
        body: await page.screenshot({ animations: 'disabled' }),
        contentType: 'image/png'
      });
      await testInfo.attach(brand.brand + '-' + viewport.name + '-rail.json', {
        body: Buffer.from(JSON.stringify(geometry, null, 2)),
        contentType: 'application/json'
      });

      expect(geometry.position).toBe('fixed');
      expect(geometry.height).toBe(viewport.railHeight);
      expect(geometry.bottomGap).toBeGreaterThanOrEqual(10 + geometry.safeArea);
      expect(geometry.bottomGap).toBeLessThanOrEqual(12 + geometry.safeArea);
      expect(geometry.left).toBeGreaterThanOrEqual(12);
      expect(geometry.right).toBeLessThanOrEqual(viewport.width - 12);
      expect(geometry.width).toBeLessThanOrEqual(viewport.width - 24);
      expect(geometry.pageScrollWidth).toBeLessThanOrEqual(geometry.pageWidth);
      expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
      expect(geometry.overflowX).toBe('hidden');
      expect(geometry.buttons).toHaveLength(brand.count);
      expect(geometry.buttons.every(button => button.width >= 44 && button.height >= 44)).toBe(true);
      expect(geometry.buttons.every(button => button.name.length > 0)).toBe(true);
      expect(geometry.buttons.every(button =>
        button.left >= geometry.left - 1 && button.right <= geometry.right + 1
      )).toBe(true);
    });
  }
}

test('selected mobile category remains accessible and repeated selection scrolls content to top', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
  await page.goto('/?brand=coffee', { waitUntil: 'domcontentloaded' });
  const rail = page.locator('#rail');
  await expect(rail).toBeVisible();
  const selected = rail.locator('button.on').first();
  await expect(selected).toHaveAttribute('aria-pressed', 'true');
  await selected.evaluate(element => element.click());
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(rail).toHaveCSS('position', 'fixed');
});

test('desktop category sidebar remains in-flow and vertically aligned', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
  for (const brand of ['coffee', 'delivery']) {
    await page.goto('/?brand=' + brand, { waitUntil: 'domcontentloaded' });
    const selector = brand === 'coffee' ? '#rail' : '#deliveryRail';
    const rail = page.locator(selector);
    await expect(rail).toBeVisible();
    await expect(rail).toHaveCSS('position', 'relative');
    await expect(rail).toHaveClass(/rail-position-ready/);
    const alignment = await page.evaluate(brandName => {
      const rail = document.querySelector(brandName === 'coffee' ? '#rail' : '#deliveryRail').getBoundingClientRect();
      const grid = document.querySelector(brandName === 'coffee' ? '#grid' : '#deliveryGrid').getBoundingClientRect();
      return Math.abs(rail.top - grid.top);
    }, brand);
    expect(alignment).toBeLessThanOrEqual(4);
  }
});

const CART_OPEN_VIEWPORTS = [
  { name: '844x390', width: 844, height: 390 },
  { name: '1024x390', width: 1024, height: 390 },
];

test.describe('floating rail clearances and overlay ownership', () => {
  for (const viewport of VIEWPORTS) {
    test('delivery: first card CTA scrolls into an unobstructed area and adds one item at ' + viewport.name, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.addInitScript(() => {
        sessionStorage.setItem('splashDone', '1');
        localStorage.setItem('zt_onb', '1');
        localStorage.setItem('zt_inst_hide', '1');
        localStorage.setItem('zt_ios_hide', '1');
      });
      await page.goto('/?brand=delivery', { waitUntil: 'domcontentloaded' });

      const rail = page.locator('#deliveryRail');
      const firstCard = page.locator('#deliveryGrid .card:not(.skeleton-card)').first();
      await expect(rail).toBeVisible({ timeout: 15000 });
      await expect(firstCard).toBeVisible({ timeout: 15000 });

      const option = firstCard.locator('.opts label.opt-btn').first();
      await expect(option).toBeVisible();
      await option.click();

      const firstAction = firstCard.locator('.steprow .cta[data-add], [data-add]').first();
      await expect(firstAction).toBeVisible();
      // Bring the real control into the working viewport; the fixed rail must not cover it after scrolling.
      await firstAction.evaluate(element => element.scrollIntoView({
        block: 'center',
        inline: 'nearest',
        behavior: 'instant',
      }));
      const geometry = await page.evaluate(() => {
        const railRect = document.querySelector('#deliveryRail').getBoundingClientRect();
        const card = document.querySelector('#deliveryGrid .card:not(.skeleton-card)');
        const action = card && card.querySelector('.steprow .cta[data-add], [data-add]');
        const actionRect = action && action.getBoundingClientRect();
        const hit = actionRect && document.elementFromPoint(
          actionRect.left + actionRect.width / 2,
          actionRect.top + actionRect.height / 2
        );
        return {
          rail: { top: railRect.top, bottom: railRect.bottom, left: railRect.left, right: railRect.right },
          action: actionRect && {
            top: actionRect.top, bottom: actionRect.bottom,
            left: actionRect.left, right: actionRect.right,
          },
          viewport: { width: innerWidth, height: innerHeight },
          hitTarget: !!hit && hit.closest('[data-add]') === action,
        };
      });
      await testInfo.attach('delivery-' + viewport.name + '-first-cta-clearance.json', {
        body: Buffer.from(JSON.stringify(geometry, null, 2)),
        contentType: 'application/json',
      });
      await testInfo.attach('delivery-' + viewport.name + '-first-cta-clearance.png', {
        body: await page.screenshot({ animations: 'disabled' }),
        contentType: 'image/png',
      });

      expect(geometry.action, 'the real first-card add control must exist').not.toBeNull();
      expect(
        geometry.action.bottom <= geometry.rail.top || geometry.action.top >= geometry.rail.bottom,
        'after scrolling, the first card CTA must be outside the fixed rail hit area'
      ).toBe(true);
      expect(geometry.hitTarget, 'the center of the first card CTA must receive its own hit test').toBe(true);

      await firstAction.click();
      await expect(firstCard.locator('.step[data-step="1"]').first()).toBeVisible({ timeout: 7000 });
      await expect.poll(() => page.evaluate(() => Array.isArray(window.cart) ? window.cart.reduce(
        (sum, item) => sum + (Number(item.qty) || 0), 0
      ) : 0)).toBe(1);
    });
  }

  test('floating rail keeps the last catalog action reachable for both brands', async ({ page }, testInfo) => {
    for (const brand of BRANDS) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.addInitScript(() => {
        sessionStorage.setItem('splashDone', '1');
        localStorage.setItem('zt_onb', '1');
        localStorage.setItem('zt_inst_hide', '1');
        localStorage.setItem('zt_ios_hide', '1');
      });
      await page.goto('/?brand=' + brand.brand, { waitUntil: 'domcontentloaded' });

      const grid = page.locator(brand.grid);
      const rail = page.locator(brand.selector);
      await expect(rail).toBeVisible({ timeout: 15000 });
      await expect.poll(() => grid.locator('> .card:not(.skeleton-card)').count()).toBeGreaterThan(0);

      const reserve = await grid.evaluate(element => {
        const probe = document.createElement('div');
        probe.style.cssText = 'position:fixed;visibility:hidden;width:0;height:var(--rail-total-h)';
        document.body.appendChild(probe);
        const railTotal = probe.getBoundingClientRect().height;
        probe.remove();
        return {
          paddingBottom: parseFloat(getComputedStyle(element).paddingBottom),
          railTotal,
        };
      });
      expect(reserve.paddingBottom).toBeGreaterThanOrEqual(reserve.railTotal + 15);
      expect(reserve.paddingBottom).toBeLessThanOrEqual(reserve.railTotal + 17);

      const lastCard = grid.locator('> .card:not(.skeleton-card)').last();
      const lastAction = brand.brand === 'delivery'
        ? lastCard.locator('.steprow .cta[data-add], [data-add]').last()
        : lastCard.locator('.cfoot');
      await lastAction.scrollIntoViewIfNeeded();

      const geometry = await page.evaluate(({ gridSelector, railSelector, actionSelector }) => {
        const rail = document.querySelector(railSelector).getBoundingClientRect();
        const action = document.querySelector(actionSelector);
        const rect = action && action.getBoundingClientRect();
        const hit = rect && document.elementFromPoint(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2
        );
        return {
          railTop: rail.top,
          actionBottom: rect ? rect.bottom : null,
          hitTarget: !!(action && hit && (hit === action || action.contains(hit))),
        };
      }, {
        gridSelector: brand.grid,
        railSelector: brand.selector,
        actionSelector: brand.brand === 'delivery'
          ? brand.grid + ' > .card:not(.skeleton-card):last-child .steprow .cta[data-add]'
          : brand.grid + ' > .card:not(.skeleton-card):last-child .cfoot',
      });

      await testInfo.attach(brand.brand + '-last-action-clearance.json', {
        body: Buffer.from(JSON.stringify({ reserve, geometry }, null, 2)),
        contentType: 'application/json',
      });
      await testInfo.attach(brand.brand + '-last-action-clearance.png', {
        body: await page.screenshot({ animations: 'disabled' }),
        contentType: 'image/png',
      });

      expect(geometry.actionBottom, brand.brand + ' last catalog action remains above the fixed rail')
        .not.toBeNull();
      expect(geometry.actionBottom).toBeLessThanOrEqual(geometry.railTop);
      expect(geometry.hitTarget, brand.brand + ' last catalog action receives its own hit test').toBe(true);
    }
  });

  for (const viewport of CART_OPEN_VIEWPORTS) {
    test('delivery: cart FAB and category rail use separate lanes, then hide under cart sheet at ' + viewport.name, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.addInitScript(() => {
        sessionStorage.setItem('splashDone', '1');
        localStorage.setItem('zt_onb', '1');
        sessionStorage.setItem('splashDone', '1');
        localStorage.setItem('zt_inst_hide', '1');
        localStorage.setItem('zt_ios_hide', '1');
      });
      await page.goto('/?brand=delivery', { waitUntil: 'domcontentloaded' });

      const rail = page.locator('#deliveryRail');
      const fab = page.locator('#cartFab');
      const cartPanel = page.locator('#cartPanel');
      const firstCard = page.locator('#deliveryGrid .card:not(.skeleton-card)').first();
      await expect(rail).toBeVisible({ timeout: 15000 });
      await expect(firstCard).toBeVisible({ timeout: 15000 });
      const option = firstCard.locator('.opts label.opt-btn').first();
      if (await option.count()) await option.click();
      await firstCard.locator('.steprow .cta[data-add], [data-add]').first().click();
      await expect.poll(() => fab.evaluate(element =>
        !element.hidden && getComputedStyle(element).display !== 'none' &&
        element.classList.contains('visible')
      ), { timeout: 7000 }).toBe(true);

      const lanes = await page.evaluate(() => {
        const railRect = document.querySelector('#deliveryRail').getBoundingClientRect();
        const fabRect = document.querySelector('#cartFab').getBoundingClientRect();
        return {
          railTop: railRect.top,
          fabBottom: fabRect.bottom,
          fabHeight: fabRect.height,
          viewportWidth: innerWidth,
          fabWidth: fabRect.width,
          hitTarget: document.elementFromPoint(
            fabRect.left + fabRect.width / 2,
            fabRect.top + fabRect.height / 2
          )?.closest('#cartFab') === document.querySelector('#cartFab'),
        };
      });
      expect(lanes.fabHeight).toBeGreaterThanOrEqual(48);
      expect(lanes.fabWidth).toBeLessThanOrEqual(lanes.viewportWidth - 24);
      expect(lanes.fabBottom + 8).toBeLessThanOrEqual(lanes.railTop);
      expect(lanes.hitTarget).toBe(true);
      await testInfo.attach('delivery-' + viewport.name + '-cart-fab-lane.png', {
        body: await page.screenshot({ animations: 'disabled' }),
        contentType: 'image/png',
      });

      await fab.click();
      await expect(cartPanel).toHaveClass(/open/);
      await expect(rail).toHaveCSS('visibility', 'hidden');
      await expect(rail).toHaveCSS('pointer-events', 'none');
      await expect(fab).toBeHidden();
      await expect(fab).toHaveCSS('pointer-events', 'none');
      await testInfo.attach('delivery-' + viewport.name + '-cart-open.png', {
        body: await page.screenshot({ animations: 'disabled' }),
        contentType: 'image/png',
      });

      await page.locator('#cartClose').click();
      await expect(cartPanel).not.toHaveClass(/open/);
      await expect(rail).toHaveCSS('visibility', 'visible');
      await expect(fab).toBeVisible();
    });

    test('coffee: guest profile button opens auth modal without creating delivery cart FAB at ' + viewport.name, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.addInitScript(() => {
        sessionStorage.setItem('splashDone', '1');
        localStorage.setItem('zt_inst_hide', '1');
        localStorage.setItem('zt_ios_hide', '1');
      });
      await page.goto('/?brand=coffee', { waitUntil: 'domcontentloaded' });

      const rail = page.locator('#rail');
      const fab = page.locator('#cartFab');
      const profileButton = page.locator('#profileTopBtn');
      const authModal = page.locator('#authModal');
      await expect(rail).toBeVisible({ timeout: 15000 });
      await expect(fab).toBeHidden();
      await expect(profileButton).toBeVisible();

      await profileButton.click();
      await expect(authModal).toHaveClass(/show/);
      await expect(fab).toBeHidden();
      await expect(rail).toHaveCSS('visibility', 'visible');
      await testInfo.attach('coffee-' + viewport.name + '-auth-modal-open.png', {
        body: await page.screenshot({ animations: 'disabled' }),
        contentType: 'image/png',
      });
      await page.locator('#skipAuth').click();
      await expect(authModal).not.toHaveClass(/show/);
      await expect(rail).toBeVisible();
    });
  }
});