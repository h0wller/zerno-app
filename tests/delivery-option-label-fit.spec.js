import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

const options = [
  { l: '25 см, пышное', w: '510 г', p: 740, sz: 25 },
  { l: '35 см, пышное', w: '930 г', p: 1140, sz: 35 },
  { l: '25 см, тонкое', w: '430 г', p: 640, sz: 25 },
  { l: '35 см, тонкое', w: '780 г', p: 1040, sz: 35 },
];

const item = {
  id: 'pz-mobile-option-fit',
  section: 'delivery',
  cat: 'pizza',
  e: '🍕',
  name: 'Пицца Маргарита',
  desc: 'Красный соус, моцарелла',
  comp: ['красный соус', 'моцарелла'],
  vol: '25/35 см',
  price: '0',
  on: 1,
  img: '/media/dishes/1-card.webp',
  opts: options,
};

for (const width of [320, 360, 390]) {
  test(`delivery pizza option labels fit on a ${width}px viewport`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('zt_onb', '1');
      sessionStorage.setItem('splashDone', '1');
    });

    await page.route('**/dmenu**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [item] }),
    }));
    await page.route('**/api/delivery/info', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ today: { open: 11, close: 22 }, days: [], zones: [], busySlots: [] }),
    }));
    await page.route(/\\/media\\/dishes\\/.*$/, (route) => route.fulfill({
      status: 200,
      contentType: 'image/gif',
      body: Buffer.from('R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=', 'base64'),
    }));

    await page.goto('/?brand=delivery', { waitUntil: 'domcontentloaded' });
    const card = page.locator('#deliveryGrid .card[data-product-id="pz-mobile-option-fit"]');
    await expect(card).toBeVisible();
    const crustLabels = card.locator('.opts .opt-crust');
    await expect(crustLabels).toHaveCount(4);

    const metrics = await crustLabels.evaluateAll((nodes) => nodes.map((node) => {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return {
        text: node.textContent.trim(),
        clientWidth: node.clientWidth,
        scrollWidth: node.scrollWidth,
        fontSize: style.fontSize,
        right: rect.right,
        left: rect.left,
        truncated: node.scrollWidth > node.clientWidth + 1,
      };
    }));

    await testInfo.attach(`delivery-option-labels-${width}px`, {
      body: await page.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    });

    expect(metrics.filter((metric) => metric.truncated), 'crust names should not be shortened with an ellipsis')
      .toEqual([]);
    expect(await page.evaluate(() =>
      document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
    )).toBe(true);
  });
}
