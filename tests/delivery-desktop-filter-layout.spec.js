import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

const items = [
  ['chicken', 'Курица'],
  ['pepperoni', 'Пепперони'],
  ['ham', 'Ветчина'],
  ['meat', 'Мясная'],
  ['salmon', 'Лосось'],
  ['tuna', 'Тунец'],
  ['shrimp', 'Креветки'],
  ['cheese', 'Моцарелла'],
].map(([id, ingredient], index) => ({
  id: 'desktop-filter-' + id,
  cat: 'pizza',
  section: 'delivery',
  name: 'Пицца ' + ingredient,
  desc: '',
  comp: [ingredient],
  opts: [],
  price: 400 + index,
  e: '🍕',
  on: 1,
  img: '',
}));

for (const width of [1024, 1440]) {
  test(`delivery ingredient filters stay in one horizontal rail at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('zt_onb', '1');
      sessionStorage.setItem('splashDone', '1');
    });
    await page.route('**/api/dmenu*', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items }),
    }));

    await page.goto('/?brand=delivery', { waitUntil: 'domcontentloaded' });

    const bar = page.locator('#deliveryView #deliverySubFilter');
    await expect(bar).toBeVisible();
    const chips = bar.locator('.subchip');
    await expect(chips).toHaveCount(9);

    const geometry = await bar.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const chipRects = Array.from(element.querySelectorAll('.subchip')).map((chip) => {
        const box = chip.getBoundingClientRect();
        return { left: box.left, right: box.right, top: box.top };
      });
      const rows = new Set(chipRects.map((box) => Math.round(box.top)));
      return {
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        scrollLeft: element.scrollLeft,
        height: rect.height,
        rows: rows.size,
        chipRects,
        left: rect.left,
        right: rect.right,
        overflowX: getComputedStyle(element).overflowX,
        flexWrap: getComputedStyle(element).flexWrap,
      };
    });

    expect(geometry.rows, 'the filters must stay on one horizontal line').toBe(1);
    expect(geometry.flexWrap).toBe('nowrap');
    expect(geometry.overflowX).toBe('auto');
    expect(geometry.scrollWidth, 'the full filter set should be reachable by horizontal scrolling')
      .toBeGreaterThan(geometry.clientWidth + 1);
    expect(await page.evaluate(() =>
      document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
    )).toBe(true);

    await testInfo.attach(`delivery-filter-rail-${width}px-start`, {
      body: await page.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    });

    const scrollState = await bar.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
      return {
        scrollLeft: element.scrollLeft,
        maxScroll: element.scrollWidth - element.clientWidth,
      };
    });
    expect(scrollState.maxScroll).toBeGreaterThan(0);
    expect(scrollState.scrollLeft).toBeGreaterThan(0);
    expect(scrollState.scrollLeft).toBeGreaterThanOrEqual(scrollState.maxScroll - 2);

    await testInfo.attach(`delivery-filter-rail-${width}px-end`, {
      body: await page.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    });

    const lastFilter = chips.last();
    await lastFilter.click();
    await expect(lastFilter).toHaveClass(/on/);
    await expect(page.locator('#deliveryGrid [data-product-id="desktop-filter-cheese"]')).toBeVisible();
    await expect(page.locator('#deliveryGrid [data-product-id="desktop-filter-chicken"]')).toHaveCount(0);
  });
}
