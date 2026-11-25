import { test, expect } from '@playwright/test';

const coffeeMenu = {
  items: [{
    id: 'coffee-probe',
    name: 'Probe Coffee',
    cat: 'coffee',
    on: 1,
    img: '/media/dishes/probe.webp',
    price: 250
  }],
  updatedAt: Date.now()
};

test.describe('Item deep-link catalog request lifecycle', () => {
  test.use({ serviceWorkers: 'block' });

  test('cold guest ?item=probe skips splash and sends exactly one GET /api/menu', async ({ page }) => {
    const menuRequests = [];
    let menuResponseFinished = false;

    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('zt_brand', 'coffee');
      localStorage.setItem('zt_onb', '1');
      localStorage.setItem('zt_inst_hide', '1');
    });

    page.on('request', request => {
      const url = new URL(request.url());
      if (url.pathname === '/api/menu' && request.method() === 'GET') {
        menuRequests.push(request.url());
      }
    });

    // One dispatcher keeps the delayed menu mock from being shadowed by a broad API route.
    await page.route('**/api/**', async route => {
      const request = route.request();
      const pathname = new URL(request.url()).pathname;

      if (pathname === '/api/menu' && request.method() === 'GET') {
        await new Promise(resolve => setTimeout(resolve, 900));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(coffeeMenu)
        });
        menuResponseFinished = true;
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          items: [],
          orders: [],
          customers: [],
          threads: [],
          messages: []
        })
      });
    });

    await page.goto('/?item=probe', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('html')).not.toHaveClass(/brand-splash-pending/);
    await expect(page.locator('#brandSplashStatic, #brandSplash')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => window.__brandSplashPending)).toBe(false);

    // The card is rendered only after the catalog response has been consumed by boot.
    await expect(page.locator('#grid > .card[data-item-id="coffee-probe"]')).toBeVisible();
    await expect.poll(() => menuResponseFinished).toBe(true);
    await expect.poll(() => page.evaluate(() =>
      document.documentElement.hasAttribute('data-staff-ready')
    )).toBe(true);

    expect(menuRequests).toHaveLength(1);
  });

  test('ordinary cold guest startup keeps splash C8 prefetch and reuses its menu response', async ({ page }) => {
    const menuRequests = [];
    let menuResponseFinished = false;

    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('zt_brand', 'coffee');
      localStorage.setItem('zt_onb', '1');
      localStorage.setItem('zt_inst_hide', '1');
    });

    page.on('request', request => {
      const url = new URL(request.url());
      if (url.pathname === '/api/menu' && request.method() === 'GET') {
        menuRequests.push(request.url());
      }
    });

    await page.route('**/api/**', async route => {
      const request = route.request();
      const pathname = new URL(request.url()).pathname;

      if (pathname === '/api/menu' && request.method() === 'GET') {
        await new Promise(resolve => setTimeout(resolve, 900));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(coffeeMenu)
        });
        menuResponseFinished = true;
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          items: [],
          orders: [],
          customers: [],
          threads: [],
          messages: []
        })
      });
    });

    await page.goto('/');
    await expect(page.locator('#brandSplashStatic, #brandSplash')).toBeVisible();
    await expect.poll(() => menuRequests.length).toBe(1);
    await expect.poll(() => menuResponseFinished).toBe(true);

    await page.locator('#brandSplashStatic [data-go="coffee"], #brandSplash [data-go="coffee"]').first().click();
    await expect(page.locator('#grid > .card[data-item-id="coffee-probe"]')).toBeVisible();
    await expect.poll(() => page.evaluate(() =>
      document.documentElement.hasAttribute('data-staff-ready')
    )).toBe(true);

    expect(menuRequests).toHaveLength(1);
  });
});
