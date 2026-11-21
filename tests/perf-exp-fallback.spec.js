import { test, expect } from '@playwright/test';
import { installHtmlVariantRoute } from '../scripts/perf-exp/patch-html.mjs';

const imageBytes = Buffer.from(
  'UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAUAmJaQAA3AA/vz0AAA=',
  'base64',
);

function menuItems(brand) {
  const delivery = brand === 'delivery';
  return Array.from({ length: 6 }, (_, index) => ({
    id: brand + '-perf-exp-' + (index + 1),
    section: delivery ? 'delivery' : 'coffee',
    cat: delivery ? 'pizza' : 'coffee',
    e: delivery ? '🍕' : '☕',
    name: (delivery ? 'Тестовая пицца ' : 'Тестовый кофе ') + (index + 1),
    desc: 'Изолированная позиция для проверки fallback',
    comp: ['тест'],
    vol: delivery ? '25 см' : '200 мл',
    price: delivery ? '535' : '180',
    on: 1,
    opts: [],
    img: '/media/dishes/' + brand + '-perf-exp-' + (index + 1) + '.webp?v=1',
    imgSrcset: '/media/dishes/resized/' + brand + '-perf-exp-' + (index + 1) + '-300.webp?v=1 300w, ' +
      '/media/dishes/resized/' + brand + '-perf-exp-' + (index + 1) + '-600.webp?v=1 600w',
  }));
}

async function preparePage(page, variant) {
  await installHtmlVariantRoute(page, variant);
  await page.addInitScript(() => {
    localStorage.setItem('zt_brand', 'coffee');
    localStorage.setItem('zt_onb', '1');
    localStorage.setItem('zt_inst_hide', '1');
    localStorage.removeItem('zt_user');
    sessionStorage.removeItem('splashDone');
  });
  await page.route('**/media/dishes/**', (route) => route.fulfill({
    status: 200,
    contentType: 'image/webp',
    body: imageBytes,
  }));
}

for (const variant of ['C7', 'C8']) {
  for (const failure of ['http-503', 'network-reject']) {
    test(variant + ' falls back to the normal selected-brand request after ' + failure, async ({ page }) => {
      let menuRequests = 0;
      await preparePage(page, variant);
      await page.route('**/api/menu', async (route) => {
        menuRequests += 1;
        if (menuRequests === 1) {
          if (failure === 'http-503') {
            return route.fulfill({
              status: 503,
              contentType: 'application/json',
              body: JSON.stringify({ error: 'synthetic early catalog failure' }),
            });
          }
          return route.abort('failed');
        }
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: menuItems('coffee'), updatedAt: Date.now() }),
        });
      });
      await page.goto('/');
      const splash = page.locator('#brandSplashStatic, #brandSplash').first();
      await expect(splash).toBeVisible();
      await expect.poll(() => menuRequests).toBe(1);
      await splash.locator('[data-go="coffee"]').click();
      await expect(page.locator('#grid > .card').first()).toBeVisible({ timeout: 15000 });
      await expect.poll(() => menuRequests).toBe(2);
      await expect.poll(() => page.evaluate(() => Array.isArray(window.MENU) && window.MENU.length > 0)).toBe(true);
      expect(menuRequests, 'early request plus one ordinary fallback request').toBe(2);
    });
  }
}

test('C8 adds one first-category image preload after JSON and does not request the hidden delivery hero', async ({ page }) => {
  const mediaRequests = [];
  const menuRequests = [];
  await preparePage(page, 'C8');
  await page.route('**/api/menu', async (route) => {
    menuRequests.push('/api/menu');
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: menuItems('coffee'), updatedAt: Date.now() }),
    });
  });
  await page.route('**/api/dmenu', async (route) => {
    menuRequests.push('/api/dmenu');
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: menuItems('delivery'), updatedAt: Date.now() }),
    });
  });
  await page.route('**/media/dishes/**', async (route) => {
    mediaRequests.push(new URL(route.request().url()).pathname);
    return route.fulfill({ status: 200, contentType: 'image/webp', body: imageBytes });
  });

  await page.goto('/');
  const splash = page.locator('#brandSplashStatic, #brandSplash').first();
  await expect(splash).toBeVisible();
  const preload = page.locator('head link#zt-menu-lcp-preload');
  await expect(preload).toBeAttached({ timeout: 10000 });
  await expect(preload).toHaveAttribute('rel', 'preload');
  await expect(preload).toHaveAttribute('as', 'image');
  await expect(preload).toHaveAttribute('href', /coffee-perf-exp-1\.webp/);
  expect(menuRequests).toEqual(['/api/menu']);
  expect(mediaRequests.some((pathname) => pathname === '/media/dishes/1-card.webp')).toBe(false);

  await splash.locator('[data-go="coffee"]').click();
  await expect(page.locator('#grid > .card').first()).toBeVisible({ timeout: 15000 });
  expect(menuRequests).toEqual(['/api/menu']);
  const firstItemRequests = mediaRequests.filter((pathname) => pathname.includes('coffee-perf-exp-1'));
  expect(firstItemRequests.length).toBeLessThanOrEqual(1);
  expect(mediaRequests.some((pathname) => pathname === '/media/dishes/1-card.webp')).toBe(false);
});
