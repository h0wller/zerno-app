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
