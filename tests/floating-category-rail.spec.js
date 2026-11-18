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
    const alignment = await page.evaluate(brandName => {
      const rail = document.querySelector(brandName === 'coffee' ? '#rail' : '#deliveryRail').getBoundingClientRect();
      const grid = document.querySelector(brandName === 'coffee' ? '#grid' : '#deliveryGrid').getBoundingClientRect();
      return Math.abs(rail.top - grid.top);
    }, brand);
    expect(alignment).toBeLessThanOrEqual(4);
  }
});
