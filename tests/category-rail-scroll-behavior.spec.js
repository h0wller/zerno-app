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
  test(`${brand.brand}: repeated active-category scroll does not fade the rail`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
    await page.goto('/?brand=' + brand.brand, { waitUntil: 'domcontentloaded' });
    const rail = page.locator(brand.rail);
    await expect(rail).toBeVisible({ timeout: 15000 });
    await page.evaluate(() => window.scrollTo(0, 700));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(300);

    await page.locator(brand.active).click();
    await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 5000 }).toBeLessThanOrEqual(80);
    await expect(rail).not.toHaveClass(/is-scroll-fading/);
  });

  test(`${brand.brand}: desktop rail background does not stretch with the catalog`, async ({ page }) => {
    await page.setViewportSize({ width: 995, height: 858 });
    await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
    await page.goto('/?brand=' + brand.brand, { waitUntil: 'domcontentloaded' });
    const rail = page.locator(brand.rail);
    const catalog = page.locator(brand.brand === 'delivery' ? '#deliveryGrid' : '#grid');
    await expect(rail).toBeVisible({ timeout: 15000 });
    await expect.poll(() => rail.evaluate(el => getComputedStyle(el).alignSelf)).toBe('start');
    expect(await rail.evaluate(el => el.clientHeight)).toBeLessThan(await catalog.evaluate(el => el.scrollHeight));
  });
}

