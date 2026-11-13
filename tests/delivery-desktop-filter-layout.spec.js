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
    const aligned = await page.evaluate(() => {
      const grid = document.querySelector('#deliveryGrid').getBoundingClientRect();
      const head = document.querySelector('#deliveryView .menu-head').getBoundingClientRect();
      const filters = document.querySelector('#deliveryView #deliverySubFilter').getBoundingClientRect();
      return { gridLeft:grid.left, gridRight:grid.right, headLeft:head.left, headRight:head.right, filterLeft:filters.left, filterRight:filters.right };
    });
    expect(Math.abs(aligned.headLeft-aligned.gridLeft), 'delivery menu head starts with first card').toBeLessThanOrEqual(2);
    expect(Math.abs(aligned.headRight-aligned.gridRight), 'delivery menu head ends with last card').toBeLessThanOrEqual(2);
    expect(Math.abs(aligned.filterLeft-aligned.gridLeft), 'delivery filters start with first card').toBeLessThanOrEqual(2);
    expect(Math.abs(aligned.filterRight-aligned.gridRight), 'delivery filters end with last card').toBeLessThanOrEqual(2);
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
      .toBeGreaterThan(geometry.clientWidth);
    expect(await page.evaluate(() =>
      document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
    )).toBe(true);

    await expect(bar).toHaveClass(/has-overflow/);
    await expect.poll(() => bar.evaluate((element) =>
      getComputedStyle(element, '::after').backgroundImage
    )).toContain('linear-gradient');
    await expect.poll(() => bar.evaluate((element) =>
      getComputedStyle(element, '::after').opacity
    )).toBe('1');

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
    await expect.poll(() => bar.evaluate((element) =>
      element.classList.contains('at-end')
    )).toBe(true);
    await expect.poll(() => bar.evaluate((element) =>
      getComputedStyle(element, '::after').opacity
    )).toBe('0');

    await testInfo.attach(`delivery-filter-rail-${width}px-end`, {
      body: await page.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    });

    await bar.evaluate((element) => { element.scrollLeft = 0; });
    await expect.poll(() => bar.evaluate((element) =>
      element.classList.contains('at-end')
    )).toBe(false);
    await expect.poll(() => bar.evaluate((element) =>
      getComputedStyle(element, '::after').opacity
    )).toBe('1');

    const lastFilter = chips.last();
    await bar.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
    await lastFilter.click();
    await expect(lastFilter).toHaveClass(/on/);
    await expect(page.locator('#deliveryGrid [data-product-id="desktop-filter-cheese"]')).toBeVisible();
    await expect(page.locator('#deliveryGrid [data-product-id="desktop-filter-chicken"]')).toHaveCount(0);
  });
}


test('delivery header uses brand typography on desktop and logo-only on mobile', async ({page}) => {
  for (const width of [320, 390, 820, 821, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => { sessionStorage.setItem('splashDone', '1'); localStorage.clear(); });
    await page.goto('/?brand=delivery', { waitUntil: 'domcontentloaded' });
    const brand = page.locator('header.topbar #headerBrand');
    await expect(brand).toBeVisible();
    const details=await brand.evaluate(el=>{
      const text=el.querySelector('small#brandSub'),title=el.querySelector('#brandTitle'),mark=el.querySelector('.mark'),r=el.getBoundingClientRect();
      return {tv:!!text&&getComputedStyle(text).display!=='none',titleVisible:!!title&&getComputedStyle(title).display!=='none',
        font:text&&getComputedStyle(text).fontFamily,color:text&&getComputedStyle(text).color,
        markVisible:!!mark&&getComputedStyle(mark).display!=='none',center:r.left+r.width/2};
    });
    expect(details.markVisible).toBe(true);
    if(width<=820){
      expect(details.tv).toBe(false);
      expect(details.titleVisible).toBe(false);
      expect(Math.abs(details.center-width/2)).toBeLessThanOrEqual(1);
    } else {
      expect(details.tv).toBe(true);
      expect(details.font).toContain('Unbounded');
      expect(details.color).toBe('rgb(58, 42, 28)');
    }
    const cart = page.locator('#cartFab');
    await expect(cart).toBeAttached();
    await cart.evaluate((el) => { el.hidden = false; el.classList.add('visible'); });
    await expect(cart).toBeVisible();
    const cartGeometry = await cart.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        position: getComputedStyle(element).position,
        center: rect.left + rect.width / 2,
        viewportCenter: document.documentElement.clientWidth / 2,
      };
    });
    expect(cartGeometry.position).toBe('fixed');
    expect(Math.abs(cartGeometry.center - cartGeometry.viewportCenter),
      'cart pill must be visually centered in the viewport').toBeLessThanOrEqual(1);
    const active = page.locator('#deliverySubFilter .subchip.on');
    await expect(active).toBeVisible();
    const activeStyles = await active.evaluate(el => ({ bg:getComputedStyle(el, '::before').backgroundColor, color:getComputedStyle(el).color }));
    expect(activeStyles.bg).toBe('rgb(192, 59, 42)');
    expect(activeStyles.color).toBe('rgb(255, 255, 255)');
  }
});
