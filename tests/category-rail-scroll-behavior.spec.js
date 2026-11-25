import { test, expect } from '@playwright/test';

const BRANDS = [
  { brand: 'coffee', rail: '#rail', active: '#rail button.on' },
  { brand: 'delivery', rail: '#deliveryRail', active: '#deliveryRail button.on' },
];

async function scrollPageAsUser(page, top) {
  await page.evaluate((nextTop) => {
    const deltaY = nextTop - window.scrollY;
    if (deltaY) {
      window.dispatchEvent(new WheelEvent('wheel', {
        deltaY,
        deltaMode: 0,
        bubbles: true,
        cancelable: true,
      }));
    }
    window.scrollTo({ top: nextTop, behavior: 'instant' });
  }, top);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(top);
}

for (const brand of BRANDS) {
  test(`${brand.brand}: tapping the selected category returns to the page top`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
    await page.goto('/?brand=' + brand.brand, { waitUntil: 'domcontentloaded' });
    await expect(page.locator(brand.active)).toBeVisible({ timeout: 15000 });
    const rail = page.locator(brand.rail);
    const cartFab = page.locator('#cartFab');
    if (brand.brand === 'delivery') {
      const card = page.locator('#deliveryGrid .card:not(.skeleton-card)').first();
      await expect(card).toBeVisible({ timeout: 15000 });
      const option = card.locator('.opts label.opt-btn, .opts button').first();
      if (await option.count()) await option.click();
      await card.locator('[data-add]').click();
      await expect(cartFab).toBeVisible();
    }

    await scrollPageAsUser(page, 700);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(300);
    await expect(rail).toHaveClass(/is-scroll-fading/);
    if (brand.brand === 'delivery') await expect(cartFab).toHaveClass(/is-scroll-fading/);

    await page.evaluate(() => {
      window.__scrollTopFadeStates = [];
      window.addEventListener('scroll', () => {
        window.__scrollTopFadeStates.push({
          rail: !!document.querySelector('#rail.is-scroll-fading, #deliveryRail.is-scroll-fading'),
          cart: !!document.querySelector('#cartFab.is-scroll-fading')
        });
      }, { passive: true });
    });
    await page.locator(brand.active).click();
    await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 5000 }).toBeLessThanOrEqual(80);
    const topScrollStates = await page.evaluate(() => window.__scrollTopFadeStates);
    expect(topScrollStates.length, 'scroll-to-top should produce observable scroll events').toBeGreaterThan(0);
    expect(topScrollStates.every(state => !state.rail && !state.cart),
      'neither floating control may fade during programmatic scroll-to-top').toBe(true);
    await expect(rail).not.toHaveClass(/is-scroll-fading/);
    await expect.poll(() => rail.evaluate(el => Number.parseFloat(getComputedStyle(el).opacity))).toBeGreaterThan(0.9);
    if (brand.brand === 'delivery') {
      await expect(cartFab).not.toHaveClass(/is-scroll-fading/);
      await expect.poll(() => cartFab.evaluate(el => Number.parseFloat(getComputedStyle(el).opacity))).toBeGreaterThan(0.9);
    }
    await testInfo.attach('category-scroll-' + brand.brand + '-category-to-top-390x844', {
      body: await page.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    });
    await expect(page.locator('#scrollTopBtn')).toHaveCount(0);
  });

  test(`${brand.brand}: scroll direction controls rail visibility with an 8px threshold`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
    await page.goto('/?brand=' + brand.brand, { waitUntil: 'domcontentloaded' });
    const rail = page.locator(brand.rail);
    const cartFab = page.locator('#cartFab');
    await expect(rail).toBeVisible({ timeout: 15000 });

    if (brand.brand === 'delivery') {
      const card = page.locator('#deliveryGrid .card:not(.skeleton-card)').first();
      await expect(card).toBeVisible({ timeout: 15000 });
      const option = card.locator('.opts label.opt-btn, .opts button').first();
      if (await option.count()) await option.click();
      await card.locator('[data-add]').click();
      await expect(cartFab).toBeVisible();
    }

    // Repeated layout alignment must not register another scroll handler.
    await page.evaluate(() => {
      window.alignRailWithCard();
      window.alignRailWithCard();
      window.alignRailWithCard();
    });

    const scrollTo = async (top) => scrollPageAsUser(page, top);

    await testInfo.attach(`${brand.brand}-rail-visible-initial-390x844`, {
      body: await page.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    });

    // Sub-threshold finger jitter in either direction must leave the rail visible.
    await scrollTo(4);
    await expect(rail).not.toHaveClass(/is-scroll-fading/);
    await scrollTo(7);
    await expect(rail).not.toHaveClass(/is-scroll-fading/);
    await scrollTo(4);
    await expect(rail).not.toHaveClass(/is-scroll-fading/);
    await scrollTo(0);
    await expect(rail).not.toHaveClass(/is-scroll-fading/);

    await scrollTo(700);
    await expect(rail).toHaveClass(/is-scroll-fading/);
    await expect.poll(() => rail.evaluate(el => Number.parseFloat(getComputedStyle(el).opacity)))
      .toBeLessThan(0.1);
    if (brand.brand === 'delivery') await expect(cartFab).toHaveClass(/is-scroll-fading/);

    // Stopping must preserve the hidden state; no timeout may reveal the rail.
    await page.waitForTimeout(650);
    await expect(rail).toHaveClass(/is-scroll-fading/);
    const documentHeightWhileHidden = await page.evaluate(() => document.documentElement.scrollHeight);
    await testInfo.attach(`${brand.brand}-rail-hidden-down-390x844`, {
      body: await page.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    });

    // Seven pixels upward is below threshold and must not flicker the rail.
    await scrollTo(695);
    await expect(rail).toHaveClass(/is-scroll-fading/);
    await scrollTo(693);
    await expect(rail).toHaveClass(/is-scroll-fading/);
    // The eighth pixel in the same direction reveals it.
    await scrollTo(692);
    await expect(rail).not.toHaveClass(/is-scroll-fading/);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight))
      .toBe(documentHeightWhileHidden);
    await expect.poll(() => rail.evaluate(el => Number.parseFloat(getComputedStyle(el).opacity)))
      .toBeGreaterThan(0.9);
    if (brand.brand === 'delivery') await expect(cartFab).not.toHaveClass(/is-scroll-fading/);

    await testInfo.attach(`${brand.brand}-rail-visible-up-390x844`, {
      body: await page.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    });
    await page.waitForTimeout(650);
    await expect(rail).not.toHaveClass(/is-scroll-fading/);

    // Fast reversal is handled once each direction crosses the same threshold.
    await scrollTo(696);
    await expect(rail).not.toHaveClass(/is-scroll-fading/);
    await scrollTo(700);
    await expect(rail).toHaveClass(/is-scroll-fading/);
    await scrollTo(696);
    await expect(rail).toHaveClass(/is-scroll-fading/);
    await scrollTo(692);
    await expect(rail).not.toHaveClass(/is-scroll-fading/);

    // Returning to the page top overrides the previous direction/state.
    await scrollTo(0);
    await expect(rail).not.toHaveClass(/is-scroll-fading/);
    await expect.poll(() => rail.evaluate(el => Number.parseFloat(getComputedStyle(el).opacity)))
      .toBeGreaterThan(0.9);
    await testInfo.attach(`${brand.brand}-rail-visible-at-top-390x844`, {
      body: await page.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    });
  });
}



test('brand transitions retain the scroll state and reveal the newly active rail on upward scroll', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
  await page.goto('/?brand=coffee', { waitUntil: 'domcontentloaded' });
  const coffeeRail = page.locator('#rail');
  const deliveryRail = page.locator('#deliveryRail');
  await expect(coffeeRail).toBeVisible({ timeout: 15000 });

  await scrollPageAsUser(page, 700);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(700);
  await expect(coffeeRail).toHaveClass(/is-scroll-fading/);

  await page.locator('#venueToggle').click();
  await page.locator('#brandSeg [data-brand="delivery"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-brand', 'delivery');
  await expect(deliveryRail).toHaveClass(/is-scroll-fading/);
  await testInfo.attach('delivery-rail-hidden-after-brand-transition-390x844', {
    body: await page.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  });

  await page.locator('#venueToggle').click();
  await page.locator('#brandSeg [data-brand="coffee"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-brand', 'coffee');
  await expect(coffeeRail).toHaveClass(/is-scroll-fading/);

  await scrollPageAsUser(page, 680);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(680);
  await expect(coffeeRail).not.toHaveClass(/is-scroll-fading/);
  await expect.poll(() => coffeeRail.evaluate(el => Number.parseFloat(getComputedStyle(el).opacity)))
    .toBeGreaterThan(0.9);
  await testInfo.attach('coffee-rail-visible-after-brand-roundtrip-scroll-up-390x844', {
    body: await page.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  });
});

for (const brand of BRANDS) {
  test(`${brand.brand}: desktop sidebar remains visible in both scroll directions`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
    await page.goto('/?brand=' + brand.brand, { waitUntil: 'domcontentloaded' });
    const rail = page.locator(brand.rail);
    await expect(rail).toBeVisible({ timeout: 15000 });

    const maxScroll = await page.evaluate(() =>
      Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
    );
    const downPosition = Math.min(500, maxScroll - 16);
    expect(downPosition).toBeGreaterThan(8);
    await scrollPageAsUser(page, downPosition);
    await expect(rail).not.toHaveClass(/is-scroll-fading/);
    await scrollPageAsUser(page, downPosition - 12);
    await expect(rail).not.toHaveClass(/is-scroll-fading/);
    await expect.poll(() => page.evaluate(() =>
      document.documentElement.scrollWidth <= window.innerWidth
    )).toBe(true);
  });
}

for (const brand of BRANDS) {
  test(`${brand.brand}: reduced motion preserves direction behavior without rail animation`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
    await page.goto('/?brand=' + brand.brand, { waitUntil: 'domcontentloaded' });
    const rail = page.locator(brand.rail);
    await expect(rail).toBeVisible({ timeout: 15000 });
    await expect.poll(() => rail.evaluate(el => getComputedStyle(el).transitionDuration)).toBe('0s');

    await scrollPageAsUser(page, 700);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(700);
    await expect(rail).toHaveClass(/is-scroll-fading/);
    await scrollPageAsUser(page, 680);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(680);
    await expect(rail).not.toHaveClass(/is-scroll-fading/);
  });
}



for (const brand of BRANDS) {
  test(`${brand.brand}: switching category from a scrolled page does not fade the rail`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
    await page.goto('/?brand=' + brand.brand, { waitUntil: 'domcontentloaded' });
    const rail = page.locator(brand.rail);
    await expect(page.locator(brand.active)).toBeVisible({ timeout: 15000 });
    await page.evaluate(() => window.scrollToWithoutRailFade(700));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(300);
    await expect.poll(() => rail.evaluate(el => el.classList.contains('is-scroll-fading')), { timeout: 5000 }).toBe(false);

    await page.evaluate(() => {
      window.__categorySwitchFadeStates = [];
      window.addEventListener('scroll', () => {
        window.__categorySwitchFadeStates.push(!!document.querySelector('#rail.is-scroll-fading, #deliveryRail.is-scroll-fading'));
      }, { passive: true });
    });
    await rail.locator('button:not(.on)').first().click();
    await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 5000 }).not.toBe(700);
    await expect.poll(() => page.evaluate(() => window.__categorySwitchFadeStates.length)).toBeGreaterThan(0);
    const states = await page.evaluate(() => window.__categorySwitchFadeStates);
    expect(states.every(faded => !faded), 'rail must not fade while the app scrolls to the new category').toBe(true);
    await expect.poll(() => rail.evaluate(el => Number.parseFloat(getComputedStyle(el).opacity))).toBeGreaterThan(0.9);
  });
}


for (const brand of BRANDS) {
  test(`${brand.brand}: landscape layout keeps the category rail visible`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
    await page.goto('/?brand=' + brand.brand, { waitUntil: 'domcontentloaded' });
    const rail = page.locator(brand.rail);
    await expect(rail).toBeVisible({ timeout: 15000 });
    await expect(rail).not.toHaveClass(/is-scroll-fading/);
    await testInfo.attach(`${brand.brand}-rail-landscape-844x390`, {
      body: await page.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    });
  });
}


for (const brand of BRANDS) {
  for (const reducedMotion of ['no-preference', 'reduce']) {
    test(`${brand.brand}: changing category aligns new content below the topbar (${reducedMotion})`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.emulateMedia({ reducedMotion });
      await page.addInitScript(() => {
        sessionStorage.setItem('splashDone', '1');
        const nativeScrollTo = window.scrollTo.bind(window);
        window.__categoryScrollBehaviors = [];
        window.scrollTo = function (...args) {
          const options = args[0];
          window.__categoryScrollBehaviors.push(
            options && typeof options === 'object' ? (options.behavior || 'auto') : 'instant'
          );
          return nativeScrollTo(...args);
        };
      });
      await page.goto('/?brand=' + brand.brand, { waitUntil: 'domcontentloaded' });
      await expect(page.locator(brand.active)).toBeVisible({ timeout: 15000 });
      await expect(page.locator(brand.brand === 'coffee' ? '#grid .card' : '#deliveryGrid .card').first())
        .toBeVisible({ timeout: 15000 });

      await scrollPageAsUser(page, 700);
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(300);
      await page.evaluate(() => { window.__categoryScrollBehaviors = []; });

      const nextCategory = page.locator(brand.rail + ' button:not(.on)').first();
      const nextCategoryId = await nextCategory.getAttribute(brand.brand === 'coffee' ? 'data-cat' : 'data-dcat');
      await nextCategory.click();
      await expect(page.locator(brand.active)).toHaveAttribute(
        brand.brand === 'coffee' ? 'data-cat' : 'data-dcat',
        nextCategoryId
      );
      const contentSelector = brand.brand === 'coffee'
        ? '#grid'
        : '#deliverySubFilterViewport:not([hidden]), #deliveryGrid';
      await expect.poll(() => page.evaluate((selector) => {
        const content = document.querySelector(selector);
        const topbar = document.querySelector('header.topbar');
        if (!content || !topbar) return null;
        return Math.abs(content.getBoundingClientRect().top - topbar.getBoundingClientRect().bottom - 12);
      }, contentSelector), { timeout: 10000 }).toBeLessThanOrEqual(3);

      await expect.poll(() => page.evaluate(() => window.__categoryScrollBehaviors.at(-1)), {
        timeout: 5000
      }).toBe(reducedMotion === 'reduce' ? 'auto' : 'smooth');
    });
  }
}


test('delivery subfilters remain visible while the primary category rail fades during scroll', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
  await page.goto('/?brand=delivery', { waitUntil: 'domcontentloaded' });

  const pizza = page.locator('#deliveryRail [data-dcat="pizza"]');
  if (!(await pizza.evaluate(element => element.classList.contains('on')))) {
    await pizza.click();
  }
  const subfilters = page.locator('#deliverySubFilterViewport:not([hidden])');
  await expect(subfilters).toBeVisible({ timeout: 10000 });
  const firstSubfilter = subfilters.locator('button').first();
  await expect(firstSubfilter).toBeVisible();

  await page.evaluate(() => window.scrollTo({ top: 500, behavior: 'instant' }));
  await expect(page.locator('#deliveryRail')).toHaveCSS('opacity', '0.06');
  await expect(subfilters).toHaveCSS('opacity', '1');
  await expect(firstSubfilter).toHaveCSS('opacity', '1');
});


for (const width of [390, 820, 1024]) {
  test(`delivery scroll spy exposes the visible category without changing filter selection at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
    await page.goto('/?brand=delivery', { waitUntil: 'domcontentloaded' });
    const rail = page.locator('#deliveryRail');
    await expect(rail.locator('button[data-dcat]')).toHaveCount(5, { timeout: 15000 });
    await expect(rail.locator('button[aria-pressed="true"]')).toHaveCount(1);
    const selectedBeforeScroll = await rail.locator('button[aria-pressed="true"]').getAttribute('data-dcat');
    expect(selectedBeforeScroll).toBeTruthy();

    await page.evaluate(() => {
      window.scrollTo(0, Math.min(900, document.documentElement.scrollHeight));
      window.__syncDeliveryScrollSpy?.();
    });

    await expect.poll(() => rail.locator('button[aria-current="location"]').count()).toBe(1);
    const current = rail.locator('button[aria-current="location"]');
    await expect(current).toHaveClass(/on/);
    await expect(current).toHaveAttribute('data-dcat');
    await expect(rail.locator('button[aria-pressed="true"]')).toHaveAttribute('data-dcat', selectedBeforeScroll);
    await expect(rail.locator('button[aria-pressed="true"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(rail.locator('button[aria-current="location"]')).toHaveCount(1);
  });
}

for (const brand of ['coffee', 'delivery']) {
  test(`${brand} category selection exposes one pressed control and clears stale current state`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
    await page.goto('/?brand=' + brand, { waitUntil: 'domcontentloaded' });
    const rail = page.locator(brand === 'coffee' ? '#rail' : '#deliveryRail');
    const dataAttribute = brand === 'coffee' ? 'data-cat' : 'data-dcat';
    await expect(rail.locator('button[aria-pressed="true"]')).toHaveCount(1, { timeout: 15000 });
    const next = rail.locator('button:not(.on)').first();
    const nextId = await next.getAttribute(dataAttribute);
    const selectedTarget = rail.locator(`button[${dataAttribute}="${nextId}"]`);
    await next.click();
    await expect(rail.locator('button[aria-pressed="true"]')).toHaveCount(1);
    await expect(rail.locator('button[aria-current="location"]')).toHaveCount(1);
    await expect(rail.locator('button[aria-pressed="true"]')).toHaveAttribute(dataAttribute, nextId);
    await expect(selectedTarget).toHaveAttribute('aria-current', 'location');
  });
}


for (const brand of ['coffee', 'delivery']) {
  test(`${brand} category rail supports keyboard selection with an accessible current state`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
    await page.goto('/?brand=' + brand, { waitUntil: 'domcontentloaded' });
    const rail = page.locator(brand === 'coffee' ? '#rail' : '#deliveryRail');
    const attribute = brand === 'coffee' ? 'data-cat' : 'data-dcat';
    const target = rail.locator('button:not(.on)').first();
    const targetId = await target.getAttribute(attribute);
    const selectedTarget = rail.locator(`button[${attribute}="${targetId}"]`);
    await target.focus();
    await target.press('Enter');
    await expect(rail.locator('button[aria-pressed="true"]')).toHaveAttribute(attribute, targetId);
    await expect(rail.locator('button[aria-current="location"]')).toHaveAttribute(attribute, targetId);
    await expect(selectedTarget).toHaveAttribute('aria-current', 'location');
  });
}

test('delivery category rail remains operable by touch', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.use.hasTouch, 'Touch input is exercised in the Mobile Chrome project');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
  await page.goto('/?brand=delivery', { waitUntil: 'domcontentloaded' });
  const rail = page.locator('#deliveryRail');
  const target = rail.locator('button:not(.on)').first();
  const targetId = await target.getAttribute('data-dcat');
  await target.tap();
  await expect(rail.locator('button[aria-pressed="true"]')).toHaveAttribute('data-dcat', targetId);
  await expect(rail.locator('button[aria-current="location"]')).toHaveAttribute('data-dcat', targetId);
});
