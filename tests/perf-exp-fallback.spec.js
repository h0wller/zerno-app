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
    test(variant + ' retries the ordinary selected-brand request after early ' + failure, async ({ page }) => {
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
      await expect(page.locator('#brandSplashStatic, #brandSplash').first()).toBeVisible();
      await expect.poll(() => menuRequests).toBe(1);

      // Call the same selected-brand priming entry point used by splash.js.
      // It must consume the failed early response and issue one normal request.
      const result = await page.evaluate(async () => {
        const response = await window.__ztPrimeMenuLcp('coffee');
        return { ok: response && response.ok, status: response && response.status };
      });
      expect(result).toEqual({ ok: true, status: 200 });
      await expect.poll(() => menuRequests).toBe(2);
      expect(menuRequests, 'early failure followed by exactly one normal request').toBe(2);
    });
  }
}

test('C8 creates only one first-category image preload after successful early JSON', async ({ page }) => {
  const apiRequests = [];
  const mediaRequests = [];
  await preparePage(page, 'C8');

  await page.route('**/api/menu', async (route) => {
    apiRequests.push('/api/menu');
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: menuItems('coffee'), updatedAt: Date.now() }),
    });
  });
  await page.route('**/api/dmenu', async (route) => {
    apiRequests.push('/api/dmenu');
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
  await expect(page.locator('#brandSplashStatic, #brandSplash').first()).toBeVisible();
  const preload = page.locator('head link#zt-menu-lcp-preload');
  await expect(preload).toBeAttached({ timeout: 10000 });
  await expect(preload).toHaveAttribute('rel', 'preload');
  await expect(preload).toHaveAttribute('as', 'image');
  await expect(preload).toHaveAttribute('href', /coffee-perf-exp-1\.webp/);
  expect(apiRequests).toEqual(['/api/menu']);
  expect(mediaRequests.some((pathname) => pathname === '/media/dishes/1-card.webp')).toBe(false);

  await page.locator('#brandSplashStatic [data-go="coffee"], #brandSplash [data-go="coffee"]').first().click();
  await expect(page.locator('#grid > .card').first()).toBeVisible({ timeout: 15000 });
  expect(apiRequests.filter((x) => x === '/api/menu')).toHaveLength(1);
  const firstImageRequests = mediaRequests.filter((pathname) => pathname.includes('coffee-perf-exp-1'));
  expect(firstImageRequests.length).toBeLessThanOrEqual(1);
  expect(mediaRequests.some((pathname) => pathname === '/media/dishes/1-card.webp')).toBe(false);
});

for (const variant of ['C7', 'C8']) {
  test(variant + ' does not preload a guessed hidden brand when zt_brand is absent', async ({ page }) => {
    const mediaRequests = [];
    await installHtmlVariantRoute(page, variant);
    await page.addInitScript(() => {
      localStorage.removeItem('zt_brand');
      localStorage.setItem('zt_onb', '1');
      localStorage.setItem('zt_inst_hide', '1');
      localStorage.removeItem('zt_user');
      sessionStorage.removeItem('splashDone');
    });
    await page.route('**/media/dishes/**', (route) => {
      mediaRequests.push(new URL(route.request().url()).pathname);
      return route.fulfill({ status: 200, contentType: 'image/webp', body: imageBytes });
    });

    await page.goto('/');
    const splash = page.locator('#brandSplashStatic, #brandSplash').first();
    await expect(splash).toBeVisible();
    await page.waitForTimeout(150);
    await expect(page.locator('head link#zt-menu-lcp-preload, head link#zt-delivery-lcp-preload')).toHaveCount(0);
    expect(mediaRequests).toEqual([]);

    await splash.locator('[data-go="delivery"]').click();
    await expect(page.locator('html')).toHaveAttribute('data-brand', 'delivery');
    await expect(page.locator('head link#zt-menu-lcp-preload')).toHaveCount(0);
    expect(mediaRequests.some((pathname) => pathname.includes('coffee') || pathname.includes('esp-card'))).toBe(false);
  });
}
