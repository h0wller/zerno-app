import { test, expect } from '@playwright/test';

test.describe('Item deep-link catalog request lifecycle', () => {
  test.use({ serviceWorkers: 'block' });
  test('cold guest ?item=probe sends exactly one coffee menu request', async ({ page }) => {
    const menuRequests = [];
    await page.addInitScript(() => {
      localStorage.clear(); sessionStorage.clear();
      localStorage.setItem('zt_brand', 'coffee'); localStorage.setItem('zt_onb', '1'); localStorage.setItem('zt_inst_hide', '1');
    });
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.pathname === '/api/menu' && request.method() === 'GET') menuRequests.push(request.url());
    });
    await page.route('**/api/menu', async route => {
      await new Promise(resolve => setTimeout(resolve, 350));
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], updatedAt: Date.now() }) });
    });
    await page.route('**/api/**', route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ ok: true, items: [], orders: [], customers: [], threads: [], messages: [] })
    }));
    await page.goto('/?item=probe', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => menuRequests.length, { timeout: 10000 }).toBe(1);
    await page.waitForTimeout(500);
    expect(menuRequests).toHaveLength(1);
    await expect(page.locator('html')).not.toHaveClass(/brand-splash-pending/);
    await expect(page.locator('#brandSplashStatic, #brandSplash')).toHaveCount(0);
  });
});
