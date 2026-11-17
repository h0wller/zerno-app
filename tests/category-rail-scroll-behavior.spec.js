import { test, expect } from '@playwright/test';

const BRANDS = [
  { brand: 'coffee', rail: '#rail', active: '#rail button.on' },
  { brand: 'delivery', rail: '#deliveryRail', active: '#deliveryRail button.on' },
];

for (const brand of BRANDS) {
  test(`${brand.brand}: tapping the selected category returns to the page top`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
    await page.goto('/?brand=' + brand.brand, { waitUntil: 'domcontentloaded' });
    await expect(page.locator(brand.active)).toBeVisible({ timeout: 15000 });
    await page.evaluate(() => window.scrollTo(0, 700));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(300);

    await page.locator(brand.active).click();
    await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 5000 }).toBeLessThanOrEqual(80);
    await expect(page.locator('#scrollTopBtn')).toHaveCount(0);
  });

  test(`${brand.brand}: category rail fades while scrolling and returns after scroll settles`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
    await page.goto('/?brand=' + brand.brand, { waitUntil: 'domcontentloaded' });
    const rail = page.locator(brand.rail);
    await expect(rail).toBeVisible({ timeout: 15000 });
    await page.evaluate(() => window.scrollTo(0, 700));

    await expect.poll(() => rail.evaluate(el => el.classList.contains('is-scroll-fading'))).toBe(true);
    await expect.poll(() => rail.evaluate(el => Number.parseFloat(getComputedStyle(el).opacity))).toBeLessThan(0.1);
    await expect.poll(() => rail.evaluate(el => getComputedStyle(el).pointerEvents)).toBe('auto');
    await testInfo.attach(`${brand.brand}-rail-faded-390x844`, {
      body: await page.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    });

    await expect.poll(() => rail.evaluate(el => el.classList.contains('is-scroll-fading')), { timeout: 5000 }).toBe(false);
    await expect.poll(() => rail.evaluate(el => Number.parseFloat(getComputedStyle(el).opacity))).toBeGreaterThan(0.9);
    await expect.poll(() => rail.evaluate(el => getComputedStyle(el).pointerEvents)).toBe('auto');
    await testInfo.attach(`${brand.brand}-rail-restored-390x844`, {
      body: await page.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    });
    if (brand.brand === 'delivery') {
      const subfilters = page.locator('#deliverySubFilter');
      await expect(subfilters).not.toHaveClass(/is-scroll-fading/);
      await expect.poll(() => subfilters.evaluate(el => Number.parseFloat(getComputedStyle(el).opacity))).toBeGreaterThan(0.9);
    }
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

      await page.evaluate(() => window.scrollTo(0, 700));
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(300);
      await page.evaluate(() => { window.__categoryScrollBehaviors = []; });

      const nextCategory = page.locator(brand.rail + ' button:not(.on)').first();
      await nextCategory.click();
      await expect(nextCategory).toHaveClass(/on/);
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
