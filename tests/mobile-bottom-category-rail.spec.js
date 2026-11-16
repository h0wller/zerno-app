import { test, expect } from '@playwright/test';

const CASES = [
  { brand: 'coffee', rail: '#rail' },
  { brand: 'delivery', rail: '#deliveryRail' },
];

const VIEWPORTS = [
  { name: 'portrait-320', width: 320, height: 740, expectedHeight: 56 },
  { name: 'portrait-360', width: 360, height: 800, expectedHeight: 56 },
  { name: 'portrait-390', width: 390, height: 844, expectedHeight: 56 },
  { name: 'portrait-430', width: 430, height: 932, expectedHeight: 56 },
  { name: 'compact-landscape-844', width: 844, height: 390, expectedHeight: 48 },
  { name: 'compact-landscape-1024', width: 1024, height: 390, expectedHeight: 48 },
];

for (const brand of CASES) {
  for (const viewport of VIEWPORTS) {
    test(`${brand.brand}: category rail is docked to the bottom at ${viewport.name}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.addInitScript(() => {
        sessionStorage.setItem('splashDone', '1');
        localStorage.setItem('zt_onb', '1');
        localStorage.setItem('zt_inst_hide', '1');
        localStorage.setItem('zt_ios_hide', '1');
      });
      await page.goto(`/?brand=${brand.brand}`, { waitUntil: 'domcontentloaded' });

      const rail = page.locator(brand.rail);
      await expect(rail).toBeVisible({ timeout: 10000 });
      await expect(rail).toHaveClass(/rail-position-ready/);

      const geometry = await page.evaluate((selector) => {
        const element = document.querySelector(selector);
        const rect = element.getBoundingClientRect();
        const ancestors = [];
        for (let node = element; node && node instanceof HTMLElement; node = node.parentElement) {
          const style = getComputedStyle(node);
          const box = node.getBoundingClientRect();
          ancestors.push({
            tag: node.tagName,
            id: node.id || null,
            className: typeof node.className === 'string' ? node.className : '',
            position: style.position,
            transform: style.transform,
            filter: style.filter,
            perspective: style.perspective,
            contain: style.contain,
            willChange: style.willChange,
            overflowX: style.overflowX,
            overflowY: style.overflowY,
            rect: { top: box.top, right: box.right, bottom: box.bottom, left: box.left },
          });
        }
        const buttons = Array.from(element.querySelectorAll('button'));
        return {
          position: getComputedStyle(element).position,
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left,
          right: rect.right,
          width: rect.width,
          height: rect.height,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          scrollY: window.scrollY,
          safeAreaBottom: getComputedStyle(document.documentElement).getPropertyValue('--sab').trim(),
          buttonHeights: buttons.map(button => button.getBoundingClientRect().height),
          pinClass: element.classList.contains('rail-is-pinned'),
          spacerCount: element.parentElement.querySelectorAll(':scope > .rail-pin-spacer').length,
          ancestors,
        };
      }, brand.rail);

      await testInfo.attach(`${brand.brand}-${viewport.name}-rail-geometry`, {
        body: Buffer.from(JSON.stringify(geometry, null, 2)),
        contentType: 'application/json',
      });

      expect(geometry.position, 'mobile rail is fixed independently of catalog scroll position').toBe('fixed');
      expect(Math.abs(geometry.bottom - geometry.viewportHeight),
        'rail surface is aligned with the viewport bottom edge').toBeLessThanOrEqual(1);
      expect(geometry.height, 'rail uses the compact or regular mobile height')
        .toBe(viewport.expectedHeight);
      expect(geometry.buttonHeights.length).toBeGreaterThan(0);
      expect(geometry.buttonHeights.every(height => height >= 44),
        'category buttons retain at least 44px hit targets').toBe(true);
      expect(geometry.pinClass, 'legacy top-pinning state is not used').toBe(false);
      expect(geometry.spacerCount, 'bottom rail does not leave a top-pin flow spacer').toBe(0);

      const beforeScroll = await rail.boundingBox();
      await page.evaluate(() => window.scrollTo(0, 600));
      await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 5000 })
        .toBeGreaterThan(100);
      const afterScroll = await rail.boundingBox();
      expect(Math.abs(afterScroll.y - beforeScroll.y),
        'rail stays at the same viewport coordinate during catalog scrolling').toBeLessThanOrEqual(1);
      expect(Math.abs(afterScroll.height - beforeScroll.height)).toBeLessThanOrEqual(1);
    });
  }
}

test('delivery cart FAB sits above the bottom rail and remains fully tappable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    sessionStorage.setItem('splashDone', '1');
    localStorage.setItem('zt_onb', '1');
    localStorage.setItem('zt_inst_hide', '1');
    localStorage.setItem('zt_ios_hide', '1');
  });
  await page.goto('/?brand=delivery', { waitUntil: 'domcontentloaded' });

  const rail = page.locator('#deliveryRail');
  const fab = page.locator('#cartFab');
  const firstCard = page.locator('#deliveryGrid .card:not(.skeleton-card)').first();
  await expect(rail).toBeVisible({ timeout: 10000 });
  await expect(firstCard).toBeVisible({ timeout: 15000 });
  const fabUnavailable = await fab.evaluate(element =>
    element.hidden || getComputedStyle(element).display === 'none' ||
    !element.classList.contains('visible')
  );
  expect(fabUnavailable, 'empty-cart FAB follows cart.js hidden/display/.visible state').toBe(true);

  const option = firstCard.locator('.opts label.opt-btn').first();
  if (await option.count()) await option.click();
  await firstCard.locator('.steprow .cta, [data-add]').first().click();
  await expect.poll(() => fab.evaluate(element =>
    !element.hidden && getComputedStyle(element).display !== 'none' &&
    element.classList.contains('visible')
  ), { timeout: 7000 }).toBe(true);

  const railBeforeLiveUpdates = await rail.boundingBox();
  for (let i = 0; i < 13; i += 1) {
    await firstCard.locator('.steprow .cta, [data-add]').first().click();
  }
  const secondCard = page.locator('#deliveryGrid .card:not(.skeleton-card)').nth(1);
  const secondOption = secondCard.locator('.opts label.opt-btn').first();
  if (await secondOption.count()) await secondOption.click();
  await secondCard.locator('.steprow .cta, [data-add]').first().click();

  const geometry = await page.evaluate(() => {
    const rail = document.querySelector('#deliveryRail').getBoundingClientRect();
    const fab = document.querySelector('#cartFab');
    const rect = fab.getBoundingClientRect();
    const sample = [
      [rect.left + rect.width / 2, rect.top + 2],
      [rect.left + rect.width / 2, rect.bottom - 2],
      [rect.left + 2, rect.top + rect.height / 2],
      [rect.right - 2, rect.top + rect.height / 2],
    ];
    return {
      railTop: rail.top,
      fabTop: rect.top,
      fabBottom: rect.bottom,
      fabHeight: rect.height,
      text: fab.innerText,
      whiteSpace: getComputedStyle(fab).whiteSpace,
      display: getComputedStyle(fab).display,
      visibility: getComputedStyle(fab).visibility,
      scrollHeight: fab.scrollHeight,
      clientHeight: fab.clientHeight,
      width: rect.width,
      viewportWidth: window.innerWidth,
      hit: sample.map(([x, y]) => {
        const element = document.elementFromPoint(x, y);
        return !!element && (element === fab || fab.contains(element));
      }),
    };
  });

  const railAfterLiveUpdates = await rail.boundingBox();
  expect(Math.abs(railAfterLiveUpdates.y - railBeforeLiveUpdates.y),
    'live cart updates do not move the fixed rail').toBeLessThanOrEqual(1);
  expect(Math.abs(railAfterLiveUpdates.height - railBeforeLiveUpdates.height)).toBeLessThanOrEqual(1);
  expect(geometry.fabHeight).toBeGreaterThanOrEqual(48);
  expect(geometry.fabHeight).toBeLessThanOrEqual(64);
  expect(geometry.width).toBeLessThanOrEqual(geometry.viewportWidth - 24);
  expect(geometry.whiteSpace).toBe('nowrap');
  expect(geometry.scrollHeight).toBeLessThanOrEqual(geometry.clientHeight + 1);
  expect(geometry.fabBottom + 8,
    'cart FAB must have a clear 8px gap above the rail').toBeLessThanOrEqual(geometry.railTop);
  expect(geometry.hit.every(Boolean),
    'the complete cart FAB hit area must resolve to the FAB').toBe(true);
  expect(geometry.text).toMatch(/\d/);
});


test('bottom rail leaves the last card CTA scrollable and keeps empty-cart reserve compact', async ({ page }) => {
  for (const brand of ['coffee', 'delivery']) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      sessionStorage.setItem('splashDone', '1');
      localStorage.setItem('zt_onb', '1');
      localStorage.setItem('zt_inst_hide', '1');
      localStorage.setItem('zt_ios_hide', '1');
    });
    await page.goto('/?brand=' + brand, { waitUntil: 'domcontentloaded' });
    const railSelector = brand === 'coffee' ? '#rail' : '#deliveryRail';
    const gridSelector = brand === 'coffee' ? '#grid' : '#deliveryGrid';
    const grid = page.locator(gridSelector);
    const rail = page.locator(railSelector);
    await expect(rail).toBeVisible();
    const emptyReserve = await grid.evaluate(element => {
      const railTotal = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--rail-total-h')) ||
        parseFloat(getComputedStyle(document.querySelector(brand === 'coffee' ? '#rail' : '#deliveryRail')).height);
      return { padding: parseFloat(getComputedStyle(element).paddingBottom), railTotal };
    }, brand);
    expect(emptyReserve.padding).toBeLessThanOrEqual(emptyReserve.railTotal + 17);

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const lastCta = page.locator(gridSelector + ' .card:not(.skeleton-card) .steprow .cta, ' +
      gridSelector + ' .card:not(.skeleton-card) [data-add]').last();
    await expect(lastCta).toBeVisible({ timeout: 15000 });
    const clearance = await page.evaluate(({ railSelector, ctaSelector }) => {
      const rail = document.querySelector(railSelector).getBoundingClientRect();
      const cta = document.querySelector(ctaSelector).getBoundingClientRect();
      return { railTop: rail.top, ctaBottom: cta.bottom };
    }, { railSelector, ctaSelector: gridSelector + ' .card:not(.skeleton-card) .steprow .cta, ' +
      gridSelector + ' .card:not(.skeleton-card) [data-add]' });
    expect(clearance.ctaBottom, 'last card CTA is fully above the fixed rail').toBeLessThanOrEqual(clearance.railTop);
    const buttonHitTargets = await rail.evaluate(element => Array.from(element.querySelectorAll('button')).every(button => {
      const rect = button.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return hit === button || button.contains(hit);
    }));
    expect(buttonHitTargets, 'all active category buttons remain unobstructed').toBe(true);
  }
});
