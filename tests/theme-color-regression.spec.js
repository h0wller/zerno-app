import { test, expect } from '@playwright/test';

test.describe('theme-color brand lifecycle', () => {
  test.use({ serviceWorkers: 'block' });

  async function setColdBrand(page, brand) {
    await page.addInitScript((selectedBrand) => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('zt_brand', selectedBrand);
      localStorage.setItem('zt_onb', '1');
      localStorage.setItem('zt_inst_hide', '1');
      sessionStorage.setItem('splashDone', '1');
    }, brand);
  }

  async function holdBundle(page, url) {
    let releaseBundle;
    const bundleGate = new Promise((resolve) => { releaseBundle = resolve; });
    await page.route('**/dist/main.bundle.js*', (route) => bundleGate.then(() => route.continue()));
    await page.goto(url, { waitUntil: 'commit' });
    await expect(page.locator('#zt-early-chrome-guard')).toBeAttached();
    await page.waitForFunction(() => window.__ztBrandLogoPrimed === true);
    return releaseBundle;
  }

  async function readThemeColor(page) {
    return page.evaluate(() => ({
      brand: window.brand || document.documentElement.getAttribute('data-brand'),
      colors: Array.from(document.querySelectorAll('meta[name="theme-color"]')).map((meta) => meta.content)
    }));
  }

  async function expectThemeColor(page, brand) {
    const expected = brand === 'delivery' ? '#C99E6E' : '#FFFFFF';
    const actual = await readThemeColor(page);
    expect(actual.brand).toBe(brand);
    expect(actual.colors).toEqual([expected]);
  }

  async function switchBrand(page, brand) {
    const toggle = page.locator('#venueToggle');
    await expect(toggle).toBeVisible();
    await toggle.click();
    const option = page.locator(`#brandSeg [data-brand="${brand}"]`);
    await expect(option).toBeVisible();
    await option.click();
    await expectThemeColor(page, brand);
  }

  for (const initialBrand of ['coffee', 'delivery']) {
    test(`initial ${initialBrand} paints correct theme-color before hydration and keeps it through round-trip`, async ({ page }) => {
      await setColdBrand(page, initialBrand);
      const releaseBundle = await holdBundle(page, `/?brand=${initialBrand}`);
      await expectThemeColor(page, initialBrand);
      expect(await page.locator('meta[name="theme-color"]').count()).toBe(1);

      releaseBundle();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForFunction(() => typeof window.syncBrandViews === 'function');
      await expectThemeColor(page, initialBrand);
      await switchBrand(page, initialBrand === 'coffee' ? 'delivery' : 'coffee');
      await switchBrand(page, initialBrand);
    });
  }

  test('splash selection synchronously updates theme-color, then switcher returns to coffee', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('zt_onb', '1');
      localStorage.setItem('zt_inst_hide', '1');
    });
    await page.goto('/');
    await expect(page.locator('#brandSplashStatic')).toBeVisible();
    await page.waitForFunction(() => typeof window.syncBrandViews === 'function');
    await page.locator('#brandSplashStatic [data-go="delivery"]').click();
    await expectThemeColor(page, 'delivery');
    expect(await page.locator('meta[name="theme-color"]').count()).toBe(1);
    await switchBrand(page, 'coffee');
  });

  test('brand deep link initializes delivery theme-color and leaves exactly one meta element', async ({ page }) => {
    await setColdBrand(page, 'coffee');
    await page.goto('/?brand=delivery&tab=chat');
    await page.waitForFunction(() => typeof window.syncBrandViews === 'function');
    await expect(page.locator('html')).toHaveAttribute('data-brand', 'delivery');
    await expectThemeColor(page, 'delivery');
    expect(await page.locator('meta[name="theme-color"]').count()).toBe(1);
  });
});
