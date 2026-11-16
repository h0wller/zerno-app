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
    test(`${brand.brand}: category rail floats as a detached capsule at ${viewport.name}`, async ({ page }, testInfo) => {
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
          bottomGap: window.innerHeight - rect.bottom,
          borderRadius: parseFloat(getComputedStyle(element).borderTopLeftRadius),
          overflowX: getComputedStyle(element).overflowX,
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
          activeBackground: getComputedStyle(element.querySelector('button.on')).backgroundColor,
          backdropFilter: getComputedStyle(element).backdropFilter,
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

      await testInfo.attach(`${brand.brand}-${viewport.name}-rail-before-redesign`, {
        body: await page.screenshot({ animations: 'disabled' }),
        contentType: 'image/png',
      });
      await testInfo.attach(`${brand.brand}-${viewport.name}-rail-geometry`, {
        body: Buffer.from(JSON.stringify(geometry, null, 2)),
        contentType: 'application/json',
      });

      expect(geometry.position, 'mobile rail is fixed independently of catalog scroll position').toBe('fixed');
      expect(geometry.bottomGap, 'floating rail keeps a 10–12px visual gap below the capsule')
        .toBeGreaterThanOrEqual(10);
      expect(geometry.bottomGap, 'floating rail does not drift too far from the viewport edge')
        .toBeLessThanOrEqual(12);
      expect(geometry.left, 'capsule has a 12px minimum horizontal inset').toBeGreaterThanOrEqual(12);
      expect(geometry.right, 'capsule has a 12px minimum horizontal inset').toBeLessThanOrEqual(geometry.viewportWidth - 12);
      expect(geometry.width, 'capsule stays within the viewport width minus 24px').toBeLessThanOrEqual(geometry.viewportWidth - 24);
      expect(geometry.borderRadius, 'rail uses a capsule corner radius').toBeGreaterThanOrEqual(24);
      expect(geometry.overflowX, 'long category sets scroll inside the rail').toBe('auto');
      expect(geometry.activeBackground, 'selected category uses a filled state').not.toBe('rgba(0, 0, 0, 0)');
      expect(geometry.backdropFilter, 'supported browsers enhance the surface with blur').toContain('blur');
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

test('delivery cart FAB sits above the bottom rail and remains fully tappable', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    sessionStorage.setItem('splashDone', '1');
    localStorage.setItem('zt_onb', '1');
    localStorage.setItem('zt_inst_hide', '1');
    localStorage.setItem('zt_ios_hide', '1');
    window.__bottomRailShifts = [];
    window.__bottomRailObserver = null;
    if (typeof PerformanceObserver === 'function') {
      window.__bottomRailObserver = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          window.__bottomRailShifts.push({
            value: entry.value,
            hadRecentInput: entry.hadRecentInput,
            startTime: entry.startTime,
            sources: (entry.sources || []).map(source => ({
              tagName: source.node?.tagName || null,
              id: source.node?.id || null,
              className: typeof source.node?.className === 'string' ? source.node.className : null,
              previousRect: source.previousRect,
              currentRect: source.currentRect,
            })),
          });
        }
      });
      window.__bottomRailObserver.observe({ type: 'layout-shift', buffered: true });
    }
  });
  await page.goto('/?brand=delivery', { waitUntil: 'domcontentloaded' });

  const rail = page.locator('#deliveryRail');
  const fab = page.locator('#cartFab');
  const firstCard = page.locator('#deliveryGrid .card:not(.skeleton-card)').first();
  // Toast-stack movement is a separate overlay concern; isolate catalog/rail CLS.
  await page.addStyleTag({ content: '.toast { display: none !important; }' });
  await expect(rail).toBeVisible({ timeout: 10000 });
  await expect(firstCard).toBeVisible({ timeout: 15000 });
  const fabUnavailable = await fab.evaluate(element =>
    element.hidden || getComputedStyle(element).display === 'none' ||
    !element.classList.contains('visible')
  );
  expect(fabUnavailable, 'empty-cart FAB follows cart.js hidden/display/.visible state').toBe(true);
  await testInfo.attach('delivery-cart-empty-390x844', {
    body: await page.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  });

  const option = firstCard.locator('.opts label.opt-btn').last();
  if (await option.count()) await option.click();
  await firstCard.locator('.steprow .cta, [data-add]').first().click();
  await expect.poll(() => fab.evaluate(element =>
    !element.hidden && getComputedStyle(element).display !== 'none' &&
    element.classList.contains('visible')
  ), { timeout: 7000 }).toBe(true);
  await testInfo.attach('delivery-cart-one-item-390x844', {
    body: await page.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  });

  await page.evaluate(() => {
    window.__bottomRailObserver?.disconnect();
    window.__bottomRailShifts = [];
    if (typeof PerformanceObserver === 'function') {
      window.__bottomRailObserver = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          window.__bottomRailShifts.push({
            value: entry.value,
            hadRecentInput: entry.hadRecentInput,
            startTime: entry.startTime,
            sources: (entry.sources || []).map(source => ({
              tagName: source.node?.tagName || null,
              id: source.node?.id || null,
              className: typeof source.node?.className === 'string' ? source.node.className : null,
              previousRect: source.previousRect,
              currentRect: source.currentRect,
            })),
          });
        }
      });
      window.__bottomRailObserver.observe({ type: 'layout-shift' });
    }
  });
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
      totalValue: Number((fab.querySelector('.cf-total')?.textContent || '').replace(/\D/g, '')),
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
  await page.waitForTimeout(100);
  const layoutShiftDiagnostics = await page.evaluate(() => ({
    entries: window.__bottomRailShifts,
    total: window.__bottomRailShifts.filter(entry => !entry.hadRecentInput)
      .reduce((sum, entry) => sum + entry.value, 0),
  }));
  await testInfo.attach('delivery-cart-live-update-layout-shifts.json', {
    body: Buffer.from(JSON.stringify(layoutShiftDiagnostics, null, 2)),
    contentType: 'application/json',
  });
  const layoutShiftTotal = layoutShiftDiagnostics.total;
  expect(layoutShiftTotal, 'cart amount updates do not introduce unexpected layout shift').toBeLessThan(0.01);
  expect(geometry.fabHeight).toBeGreaterThanOrEqual(48);
  expect(geometry.fabHeight).toBeLessThanOrEqual(64);
  expect(geometry.width).toBeLessThanOrEqual(geometry.viewportWidth - 24);
  expect(geometry.whiteSpace).toBe('nowrap');
  expect(geometry.totalValue,
    'cart total reaches five digits and remains visible as one line').toBeGreaterThanOrEqual(10000);
  expect(geometry.scrollHeight).toBeLessThanOrEqual(geometry.clientHeight + 1);
  expect(geometry.fabBottom + 8,
    'cart FAB must have a clear 8px gap above the rail').toBeLessThanOrEqual(geometry.railTop);
  expect(geometry.hit.every(Boolean),
    'the complete cart FAB hit area must resolve to the FAB').toBe(true);
  expect(geometry.text).toMatch(/\d/);
  await testInfo.attach('delivery-cart-long-total-390x844', {
    body: await page.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  });

  await fab.click();
  await expect(page.locator('#cartPanel')).toHaveClass(/open/);
  await expect(rail).toHaveCSS('visibility', 'hidden');
  await expect(rail).toHaveCSS('pointer-events', 'none');
  await expect(fab).toHaveCSS('visibility', 'hidden');
  await expect(fab).toHaveCSS('pointer-events', 'none');
  await testInfo.attach('delivery-cart-sheet-open-390x844', {
    body: await page.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  });
  await page.keyboard.press('Tab');
  const focusIsOutsideBottomControls = await page.evaluate(() => {
    const active = document.activeElement;
    return !active || !active.closest('#deliveryRail, #cartFab');
  });
  expect(focusIsOutsideBottomControls).toBe(true);
  await page.locator('#cartClose').click();
  await expect(page.locator('#cartPanel')).not.toHaveClass(/open/);
  await expect.poll(() => rail.evaluate(element => getComputedStyle(element).visibility)).toBe('visible');
});


test('bottom rail leaves the last card CTA scrollable and keeps empty-cart reserve compact', async ({ page }, testInfo) => {
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
    const emptyReserve = await grid.evaluate((element, railSelector) => {
      const rail = document.querySelector(railSelector);
      const style = getComputedStyle(element);
      const root = getComputedStyle(document.documentElement);
      const matchedRules = Array.from(document.styleSheets).flatMap(sheet => {
        try { return Array.from(sheet.cssRules); } catch { return []; }
      }).filter(rule => rule.selectorText && rule.selectorText.includes(element.id) &&
        rule.style && rule.style.paddingBottom)
        .map(rule => ({ selector: rule.selectorText, paddingBottom: rule.style.paddingBottom }));
      return {
        padding: parseFloat(style.paddingBottom),
        railTotal: rail.getBoundingClientRect().height,
        railTotalVariable: root.getPropertyValue('--rail-total-h').trim(),
        inlinePaddingBottom: element.style.paddingBottom,
        matchedRules,
      };
    }, railSelector);
    await page.evaluate(() => window.scrollTo(0, 0));
    await testInfo.attach(brand + '-empty-cart-scroll-reserve.json', {
      body: Buffer.from(JSON.stringify(emptyReserve, null, 2)),
      contentType: 'application/json',
    });
    expect(emptyReserve.padding).toBeGreaterThanOrEqual(emptyReserve.railTotal + 15);
    expect(emptyReserve.padding).toBeLessThanOrEqual(emptyReserve.railTotal + 17);

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const lastCard = page.locator(gridSelector + ' > .card:not(.skeleton-card)').last();
    await expect(lastCard).toBeVisible({ timeout: 15000 });
    if (brand === 'delivery') {
      const lastCta = lastCard.locator('.steprow .cta, [data-add]').last();
      await expect(lastCta).toBeVisible({ timeout: 15000 });
    }
    const clearance = await page.evaluate(({ railSelector, gridSelector, brand }) => {
      const rail = document.querySelector(railSelector).getBoundingClientRect();
      const cards = Array.from(document.querySelectorAll(gridSelector + ' > .card:not(.skeleton-card)'));
      const last = cards[cards.length - 1];
      const cta = last && last.querySelector('.steprow .cta, [data-add]');
      return {
        railTop: rail.top,
        lastCardBottom: last ? last.getBoundingClientRect().bottom : Infinity,
        ctaBottom: cta ? cta.getBoundingClientRect().bottom : null,
        brand,
      };
    }, { railSelector, gridSelector, brand });
    expect(clearance.lastCardBottom, 'last card is fully above the fixed rail').toBeLessThanOrEqual(clearance.railTop);
    if (brand === 'delivery') {
      expect(clearance.ctaBottom, 'last delivery card CTA is fully above the fixed rail').toBeLessThanOrEqual(clearance.railTop);
    }
    const buttonHitTargets = await rail.evaluate(element => Array.from(element.querySelectorAll('button')).every(button => {
      const rect = button.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return hit === button || button.contains(hit);
    }));
    expect(buttonHitTargets, 'all active category buttons remain unobstructed').toBe(true);
  }
});


test('bottom rail category buttons remain keyboard operable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
  await page.goto('/?brand=coffee', { waitUntil: 'domcontentloaded' });
  const rail = page.locator('#rail');
  await expect(rail).toBeVisible();
  const nextCategory = rail.locator('button').nth(1);
  await nextCategory.focus();
  await expect(nextCategory).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(nextCategory).toHaveAttribute('aria-pressed', 'true');
  await expect(rail).toHaveCSS('position', 'fixed');
  await expect.poll(() => rail.evaluate(element => element.getBoundingClientRect().bottom)).toBe(844);
});

test('checkout address suggestions remain usable with the bottom rail hidden under the cart sheet', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    sessionStorage.setItem('splashDone', '1');
    localStorage.setItem('zt_onb', '1');
    localStorage.setItem('zt_inst_hide', '1');
    localStorage.setItem('zt_ios_hide', '1');
  });
  await page.goto('/?brand=delivery', { waitUntil: 'domcontentloaded' });
  const firstCard = page.locator('#deliveryGrid .card:not(.skeleton-card)').first();
  const option = firstCard.locator('.opts label.opt-btn').first();
  if (await option.count()) await option.click();
  await firstCard.locator('.steprow .cta, [data-add]').first().click();
  const fab = page.locator('#cartFab');
  await expect.poll(() => fab.evaluate(element =>
    !element.hidden && getComputedStyle(element).display !== 'none' &&
    element.classList.contains('visible')
  ), { timeout: 7000 }).toBe(true);
  await fab.click();

  const rail = page.locator('#deliveryRail');
  await expect(page.locator('#cartPanel')).toHaveClass(/open/);
  await testInfo.attach('delivery-cart-sheet-open-390x844', {
    body: await page.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  });
  await expect(rail).toHaveCSS('visibility', 'hidden');
  await expect(rail).toHaveCSS('pointer-events', 'none');
  await expect(fab).toHaveCSS('visibility', 'hidden');

  await page.evaluate(() => {
    window.AddressModule = window.AddressModule || {};
    window.AddressModule.getStreets = () => ['Советская', 'Балтийская'];
  });
  const place = page.locator('#checkoutPlace');
  await place.selectOption({ label: 'Янтарный' });
  const street = page.locator('#checkoutStreet');
  await street.focus();
  await expect(street).toBeFocused();
  await page.keyboard.type('Совет');
  const suggestions = page.locator('.addr-dropdown');
  await expect(suggestions).toBeVisible();
  await expect(suggestions.locator('.addr-item')).toHaveCount(1);
  await expect(suggestions.locator('.addr-item')).toContainText('Советская');
  await testInfo.attach('delivery-checkout-address-suggestions-390x844', {
    body: await page.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  });

  await page.keyboard.press('Tab');
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).not.toBe('checkoutStreet');
  await expect(rail).toHaveCSS('visibility', 'hidden');
  await page.setViewportSize({ width: 390, height: 520 });
  await expect(page.locator('#cartPanel')).toHaveClass(/open/);
  await expect(rail).toHaveCSS('visibility', 'hidden');
  await expect(fab).toHaveCSS('visibility', 'hidden');
});
