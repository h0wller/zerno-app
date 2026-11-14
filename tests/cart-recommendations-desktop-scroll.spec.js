import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

const MENU_ITEM = {
  id: 'scroll-test-pizza',
  section: 'delivery',
  cat: 'pizza',
  e: '🍕',
  name: 'Тестовая пицца',
  desc: 'Соус, сыр',
  comp: ['соус', 'сыр'],
  vol: '25 см',
  price: '0',
  on: 1,
  opts: [{ l: '25 см', w: '400 г', p: 500, sz: 25 }]
};

const RECOMMENDED_ITEMS = [
  { id: 'scroll-drink-1', cat: 'drinks', name: 'Лимонад', price: 180, on: 1, e: '🥤' },
  { id: 'scroll-drink-2', cat: 'drinks', name: 'Морс клюквенный', price: 160, on: 1, e: '🥤' },
  { id: 'scroll-drink-3', cat: 'drinks', name: 'Вода без газа', price: 90, on: 1, e: '💧' },
  { id: 'scroll-drink-4', cat: 'drinks', name: 'Кола', price: 120, on: 1, e: '🥤' },
  { id: 'scroll-sauce-1', cat: 'sauces', name: 'Соус сырный', price: 70, on: 1, e: '🥫' },
  { id: 'scroll-sauce-2', cat: 'sauces', name: 'Соус барбекю', price: 70, on: 1, e: '🥫' },
  { id: 'scroll-sauce-3', cat: 'sauces', name: 'Кетчуп', price: 50, on: 1, e: '🥫' },
  { id: 'scroll-sauce-4', cat: 'sauces', name: 'Соус чесночный', price: 70, on: 1, e: '🥫' }
];

test('desktop cart recommendations scroll horizontally with the mouse wheel', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    localStorage.setItem('zt_inst_hide', '1');
    localStorage.setItem('zt_cart', JSON.stringify([{
      key: 'scroll-test-pizza_0',
      id: 'scroll-test-pizza',
      oi: 0,
      name: 'Тестовая пицца',
      opt: '25 см',
      price: 500,
      sz: 25,
      qty: 1
    }]));
    localStorage.removeItem('zt_cartpromo');
    sessionStorage.setItem('splashDone', '1');
  });

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    let body = { ok: true, items: [], orders: [], pending: [], customers: [], threads: [], messages: [], promos: [] };

    if (url.pathname === '/api/dmenu') {
      body = { items: [MENU_ITEM, ...RECOMMENDED_ITEMS], updatedAt: '2026-11-14T08:00:00.000Z' };
    } else if (url.pathname === '/api/delivery/info') {
      body = {
        zones: [{ fee: 200, min: 0, places: ['Янтарный'] }],
        today: { isOpen: true, canAcceptAsap: true, open: 11, close: 22 },
        schedule: { open: 11, close: 22 },
        days: [{ offset: 0, date: '2026-11-14', isOpen: true, open: 11, close: 22 }],
        busySlots: [],
        weekPromo: null,
        pizzaMonth: null
      };
    } else if (url.pathname === '/api/me/free-delivery') {
      body = { code: '' };
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body)
    });
  });

  await page.goto('/?brand=delivery');
  await expect.poll(() => page.evaluate(() => Array.isArray(window.DMENU) && window.DMENU.length)).toBeGreaterThan(0);
  await page.evaluate(() => {
    if (typeof window.refreshDeliveryInfo === 'function') window.refreshDeliveryInfo();
    document.getElementById('cartPanel').classList.add('open');
    window.renderCart();
  });

  const recommendations = page.locator('#cartAddons');
  const rail = recommendations.locator('.ca-cards-scroll');
  await expect(recommendations.locator('.addon-pill-card')).toHaveCount(8);
  await expect(rail).toBeVisible();

  const initialMetrics = await rail.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    scrollLeft: element.scrollLeft,
    scrollbarWidth: getComputedStyle(element).scrollbarWidth
  }));
  expect(initialMetrics.scrollWidth).toBeGreaterThan(initialMetrics.clientWidth);
  expect(initialMetrics.scrollLeft).toBe(0);

  const box = await rail.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 360);

  await expect.poll(() => rail.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);

  const afterWheel = await rail.evaluate((element) => ({
    scrollLeft: element.scrollLeft,
    maxScroll: element.scrollWidth - element.clientWidth,
    scrollbarWidth: getComputedStyle(element).scrollbarWidth
  }));
  expect(afterWheel.scrollLeft).toBeLessThanOrEqual(afterWheel.maxScroll);

  await testInfo.attach('cart-recommendations-desktop-after-wheel', {
    body: await page.screenshot({ fullPage: false }),
    contentType: 'image/png'
  });
});
