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
  test(`delivery ingredient filters reveal horizontal overflow at ${width}px`, async ({ page }) => {
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
    await expect.poll(() => bar.evaluate((element) =>
      getComputedStyle(element, '::after').content
    )).not.toBe('none');
    await expect.poll(() => bar.evaluate((element) =>
      getComputedStyle(element, '::after').opacity
    )).toBe('1');

    await bar.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
    });
    await expect.poll(() => bar.evaluate((element) =>
      element.classList.contains('at-end')
    )).toBe(true);
    await expect.poll(() => bar.evaluate((element) =>
      getComputedStyle(element, '::after').opacity
    )).toBe('0');

    const finalFilter = bar.locator('button[data-ing="veggies"]');
    await finalFilter.click();
    await expect(finalFilter).toHaveClass(/on/);
    await expect(page.locator('#deliveryGrid [data-product-id="filter-cue-7"]')).toBeVisible();
    await expect(page.locator('#deliveryGrid [data-product-id="filter-cue-0"]')).toHaveCount(0);
  });
}
