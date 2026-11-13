import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

const ingredientIds = [
  'chicken',
  'pepperoni',
  'ham',
  'meat',
  'salmon',
  'tuna',
  'shrimp',
  'veggies',
];

const ingredientNames = [
  'Курица',
  'Пепперони',
  'Ветчина',
  'Мясная',
  'Лосось',
  'Тунец',
  'Креветки',
  'Овощная',
];

const items = ingredientNames.map((ingredient, index) => ({
  id: 'filter-cue-' + index,
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

for (const width of [320, 390]) {
  test(`delivery ingredient filters reveal horizontal overflow at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
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
    await expect(bar.locator('.subchip')).toHaveCount(ingredientIds.length + 1);
    await expect.poll(() => bar.evaluate((element) =>
      element.scrollWidth > element.clientWidth + 1
    )).toBe(true);

    await expect(bar).toHaveClass(/has-overflow/);
    const viewport = page.locator('#deliveryView .subfilter-viewport');
    await expect(viewport).toBeVisible();
    const cueMetrics = await viewport.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const barRect = element.querySelector('#deliverySubFilter').getBoundingClientRect();
      const style = getComputedStyle(element);
      const fade = getComputedStyle(element.parentElement, '::after');
      const arrow = getComputedStyle(element, '::before');
      return {
        position: style.position,
        left: rect.left,
        right: rect.right,
        barLeft: barRect.left,
        barRight: barRect.right,
        fadePosition: fade.position,
        fadeInsetEnd: fade.insetInlineEnd,
        fadeWidth: Number.parseFloat(fade.width),
        fadePointerEvents: fade.pointerEvents,
        arrowContent: arrow.content,
        arrowPointerEvents: arrow.pointerEvents,
      };
    });
    expect(cueMetrics.position).toBe('relative');
    expect(cueMetrics.fadePosition).toBe('absolute');
    expect(cueMetrics.fadeInsetEnd).toBe('0px');
    expect(cueMetrics.fadeWidth).toBeGreaterThanOrEqual(48);
    expect(cueMetrics.fadePointerEvents).toBe('none');
    expect(cueMetrics.arrowContent).not.toBe('none');
    expect(cueMetrics.arrowPointerEvents).toBe('none');
    expect(Math.abs(cueMetrics.left - cueMetrics.barLeft)).toBeLessThanOrEqual(1);
    expect(Math.abs(cueMetrics.right - cueMetrics.barRight)).toBeLessThanOrEqual(1);
    await expect.poll(() => bar.evaluate((element) =>
      getComputedStyle(element.parentElement, '::after').content
    )).not.toBe('none');
    await expect.poll(() => bar.evaluate((element) =>
      getComputedStyle(element.parentElement, '::after').opacity
    )).toBe('1');
    await expect.poll(() => bar.evaluate((element) =>
      getComputedStyle(element.parentElement, '::after').backgroundImage
    )).toContain('linear-gradient');
    await expect.poll(() => page.evaluate(() =>
      document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
    )).toBe(true);
    await testInfo.attach(`delivery-filter-cue-${width}px-start`, {
      body: await page.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    });

    await bar.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
    });
    await expect.poll(() => bar.evaluate((element) =>
      element.classList.contains('at-end')
    )).toBe(true);
    await expect.poll(() => bar.evaluate((element) =>
      getComputedStyle(element.parentElement, '::after').opacity
    )).toBe('0');
    await testInfo.attach(`delivery-filter-cue-${width}px-end`, {
      body: await page.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    });

    const finalFilter = bar.locator('button[data-ing="veggies"]');
    await finalFilter.click();
    await expect(finalFilter).toHaveClass(/on/);
    await expect(page.locator('#deliveryGrid [data-product-id="filter-cue-7"]')).toBeVisible();
    await expect(page.locator('#deliveryGrid [data-product-id="filter-cue-0"]')).toHaveCount(0);
  });
}
