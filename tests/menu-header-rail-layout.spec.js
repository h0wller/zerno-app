import { test, expect } from '@playwright/test';

const CASES = [
  { brand: 'coffee', head: '#menuView .menu-head', rail: '#rail', tickerBg: 'rgb(18, 58, 107)' },
  { brand: 'delivery', head: '#deliveryView .menu-head', rail: '#deliveryRail', tickerBg: 'rgb(58, 42, 28)' },
];

const VIEWPORTS = [
  { name: 'narrow mobile', width: 320, height: 740 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
];

for (const brand of CASES) {
  for (const viewport of VIEWPORTS) {
    test(`${brand.brand}: menu header geometry and card-aligned rail at ${viewport.name}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
      await page.goto(`/?brand=${brand.brand}`, { waitUntil: 'domcontentloaded' });
      if (brand.brand === 'delivery' && viewport.width === 390) {
        await page.addStyleTag({ content: ':root { --sat: 47px; }' });
      }

      const menuHead = page.locator(brand.head);
      const rail = page.locator(brand.rail);
      const ticker = page.locator('.ticker');

      await expect(menuHead).toBeVisible({ timeout: 10000 });
      await expect(rail).toBeVisible({ timeout: 10000 });
      await expect(rail).toHaveClass(/rail-position-ready/);
      await expect(ticker).toHaveCSS('display', 'flex');
      const topbar = page.locator('header.topbar');
      if (viewport.width <= 820) {
        await expect(topbar).toHaveCSS('border-bottom-width', '0px');
      }
      if (brand.brand === 'delivery') {
        await expect(page.locator('#deliveryGrid .card').first()).toBeVisible({ timeout: 15000 });
        await expect.poll(() => page.evaluate(() => {
          const grid = document.querySelector('#deliveryGrid').getBoundingClientRect();
          const rail = document.querySelector('#deliveryRail').getBoundingClientRect();
          return Math.abs(rail.top - grid.top);
        }), { timeout: 5000 }).toBeLessThanOrEqual(2);
      } else if (viewport.width <= 820) {
        const searchGap = await page.evaluate(({ headSelector, railSelector }) => {
          const head = document.querySelector(headSelector);
          const rail = document.querySelector(railSelector);
          const searchRow = head.querySelector('.mh-right');
          return rail.getBoundingClientRect().top - searchRow.getBoundingClientRect().bottom;
        }, { headSelector: brand.head, railSelector: brand.rail });
        expect(searchGap, 'coffee rail starts below search/support row').toBeGreaterThanOrEqual(10);
      } else {
        await expect(page.locator('#grid .card').first()).toBeVisible({timeout:15000});
        const delta=await page.evaluate(selector=>{
          const rail=document.querySelector(selector).getBoundingClientRect();
          const grid=document.querySelector('#grid').getBoundingClientRect();
          return Math.abs(rail.top-grid.top);
        },brand.rail);
        expect(delta,'coffee desktop rail aligns with first catalog row').toBeLessThanOrEqual(2);
      }
      await expect.poll(() => ticker.evaluate((el) => getComputedStyle(el).backgroundColor), { timeout: 5000 }).toBe(brand.tickerBg);

      const layout = await page.evaluate(({ headSelector, railSelector }) => {
        const head = document.querySelector(headSelector);
        const railEl = document.querySelector(railSelector);
        const wrap = document.querySelector('.wrap');
        const wrapRect = wrap.getBoundingClientRect();
        const wrapStyle = getComputedStyle(wrap);
        const headRect = head.getBoundingClientRect();
        const railRect = railEl.getBoundingClientRect();
        return {
          headLeft: headRect.left,
          headRight: headRect.right,
          railTop: railRect.top,
          railPosition: getComputedStyle(railEl).position,
          headBottom: headRect.bottom,
          contentLeft: wrapRect.left + parseFloat(wrapStyle.borderLeftWidth) + parseFloat(wrapStyle.paddingLeft),
          contentRight: wrapRect.right - parseFloat(wrapStyle.borderRightWidth) - parseFloat(wrapStyle.paddingRight),
          documentWidth: document.documentElement.clientWidth,
          documentScrollWidth: document.documentElement.scrollWidth,
        };
      }, { headSelector: brand.head, railSelector: brand.rail });

      const floatingViewport = viewport.width <= 820
        || (viewport.width >= 821 && viewport.height <= 480 && viewport.width > viewport.height);
      if (floatingViewport) {
        expect(layout.railPosition, 'mobile and compact-landscape rail is a fixed floating capsule').toBe('fixed');
        expect(layout.headLeft, 'catalog occupies the full content column without a legacy rail track').toBeGreaterThanOrEqual(layout.contentLeft - 1);
        expect(layout.headRight).toBeLessThanOrEqual(layout.contentRight + 1);
      } else if (viewport.width <= 1180) {
        expect(layout.railPosition, 'desktop/tablet rail remains in-flow').toBe('relative');
        expect(Math.abs(layout.headLeft - layout.contentLeft), 'menu-head starts at the content column').toBeLessThanOrEqual(1);
      }
      expect(layout.documentScrollWidth, 'menu-head must not create horizontal page overflow').toBeLessThanOrEqual(layout.documentWidth + 1);

      const tickerLayout = await page.evaluate(() => {
        const tickerEl = document.querySelector('.ticker');
        const viewportEl = tickerEl.querySelector('.tickerViewport');
        const trackEl = tickerEl.querySelector('#tickerTrack');
        const topbarEl = document.querySelector('header.topbar');
        return {
          tickerWidth: tickerEl.getBoundingClientRect().width,
          viewportWidth: viewportEl.getBoundingClientRect().width,
          tickerTop: tickerEl.getBoundingClientRect().top,
          topbarBottom: topbarEl.getBoundingClientRect().bottom,
          tickerBackground: getComputedStyle(tickerEl).backgroundColor,
          trackBackground: getComputedStyle(trackEl).backgroundColor,
          trackWidth: trackEl.getBoundingClientRect().width,
        };
      });
      expect(tickerLayout.viewportWidth).toBeCloseTo(tickerLayout.tickerWidth, 0);
      expect(tickerLayout.tickerBackground).toBe(brand.tickerBg);
      expect(tickerLayout.trackBackground).toBe('rgba(0, 0, 0, 0)');
      expect(tickerLayout.trackWidth).toBeGreaterThanOrEqual(tickerLayout.viewportWidth);
      expect(Math.abs(tickerLayout.tickerTop - tickerLayout.topbarBottom)).toBeLessThanOrEqual(1);

      await page.evaluate(() => window.scrollTo(0, 500));
      if (floatingViewport) {
        await expect.poll(() => page.locator(brand.rail).evaluate(el => getComputedStyle(el).position)).toBe('fixed');
        await expect.poll(() => page.locator(brand.rail).evaluate(el => {
          const rect = el.getBoundingClientRect();
          return Math.abs(rect.bottom - (window.innerHeight - 10));
        })).toBeLessThanOrEqual(2);
        await testInfo.attach(`${brand.brand}-floating-rail-${viewport.width}x${viewport.height}`, {
          body: await page.screenshot({ animations: 'disabled' }),
          contentType: 'image/png',
        });
      } else {
        const gridSelector = brand.brand === 'delivery' ? '#deliveryGrid' : '#grid';
        await expect.poll(() => page.evaluate(({ railSelector, gridSelector }) => {
          const grid = document.querySelector(gridSelector).getBoundingClientRect();
          const rail = document.querySelector(railSelector).getBoundingClientRect();
          return Math.max(Math.abs(rail.top - grid.top), Math.abs(rail.bottom - grid.bottom));
        }, { railSelector: brand.rail, gridSelector }), { timeout: 5000 }).toBeLessThanOrEqual(4);
      }
    });
  }
}


test('menu headings stay compact without the removed descriptor badge', async ({ page }) => {
  for (const brand of ['coffee', 'delivery']) {
    for (const viewport of [
      { width: 320, height: 740 },
      { width: 390, height: 844 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
      await page.goto('/?brand=' + brand, { waitUntil: 'domcontentloaded' });
      const view = brand === 'coffee' ? '#menuView' : '#deliveryView';
      const heading = page.locator(view + ' .menu-head h1');
      await expect(heading).toBeVisible();
      if (brand === 'coffee') {
        const brandTitle = page.locator('#brandTitle');
        await expect(brandTitle).toBeVisible();
        await expect(brandTitle).toHaveAttribute('aria-label', '…и кофе');
        const logoBox = await brandTitle.boundingBox();
        expect(logoBox && logoBox.width, 'coffee wordmark must retain visible width beside its logo mark').toBeGreaterThan(0);
      } else {
        await expect(page.locator('#deliveryView .menu-head')).toHaveCSS('padding', '8px 16px');
      }
      const geometry = await heading.evaluate((element, view) => {
        const rect = element.getBoundingClientRect();
        const menuHead = element.closest('.menu-head');
        const menuHeadRect = menuHead?.getBoundingClientRect();
        const tagline = element.querySelector('em');
        const taglineRect = tagline?.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          width: rect.width,
          menuHeadLeft: menuHeadRect?.left ?? 0,
          menuHeadRight: menuHeadRect?.right ?? document.documentElement.clientWidth,
          viewportWidth: document.documentElement.clientWidth,
          title: element.childNodes[0]?.textContent?.trim(),
          taglineVisible: !!tagline && getComputedStyle(tagline).display !== 'none' && taglineRect.width > 0,
        };
      }, view);
      expect(geometry.left).toBeGreaterThanOrEqual(0);
      expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth + 1);
      expect(geometry.title).toBe('Меню');
      expect(geometry.taglineVisible, 'the removed descriptor badge stays absent at every width').toBe(false);
      expect(geometry.left).toBeGreaterThanOrEqual(geometry.menuHeadLeft + 8);
      expect(geometry.right).toBeLessThanOrEqual(geometry.menuHeadRight - 8);
    }
  }
});

test('coffee: category rail never covers menu title or search input on mobile', async ({ page }, testInfo) => {
  for (const viewport of [
    { width: 320, height: 740 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
      sessionStorage.setItem('splashDone', '1');
    });
    await page.goto('/?brand=coffee', { waitUntil: 'domcontentloaded' });

    const heading = page.locator('#menuView .menu-head h1');
    const searchInput = page.locator('#menuView .coffee-menu-search input');
    const rail = page.locator('#rail');
    await expect(heading).toBeVisible({ timeout: 10000 });
    await expect(searchInput).toBeVisible({ timeout: 10000 });
    await expect(rail).toBeVisible({ timeout: 10000 });

    const intersections = await page.evaluate(() => {
      const headingElement = document.querySelector('#menuView .menu-head h1');
      const range = document.createRange();
      range.selectNodeContents(headingElement);
      const headingText = range.getBoundingClientRect();
      const search = document.querySelector('#menuView .coffee-menu-search input').getBoundingClientRect();
      const buttons = Array.from(document.querySelectorAll('#rail button')).map((button) => {
        const rect = button.getBoundingClientRect();
        return { label: button.textContent.trim(), left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
      });
      const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      return {
        headingText: { left: headingText.left, right: headingText.right, top: headingText.top, bottom: headingText.bottom },
        search: { left: search.left, right: search.right, top: search.top, bottom: search.bottom },
        headingOverlaps: buttons.filter((button) => overlaps(button, headingText)).map((button) => button.label),
        searchOverlaps: buttons.filter((button) => overlaps(button, search)).map((button) => button.label),
      };
    });

    expect(intersections.headingOverlaps, 'category buttons must not cover the visible menu title').toEqual([]);
    expect(intersections.searchOverlaps, 'category buttons must not cover the search input').toEqual([]);
    await testInfo.attach(`coffee-search-rail-clearance-${viewport.width}px`, {
      body: await page.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    });
  }
});


test('coffee rail aligns to its menu card and delivery rail aligns to product cards', async ({ page }) => {
  for (const brand of CASES) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
    await page.goto('/?brand=' + brand.brand, { waitUntil: 'domcontentloaded' });
    if (brand.brand === 'delivery') {
      await expect(page.locator('#deliveryGrid .card').first()).toBeVisible({ timeout: 15000 });
      await expect.poll(() => page.evaluate(() => {
        const grid = document.querySelector('#deliveryGrid').getBoundingClientRect();
        const rail = document.querySelector('#deliveryRail').getBoundingClientRect();
        return Math.abs(rail.top - grid.top);
      }), { timeout: 5000 }).toBeLessThanOrEqual(2);
    } else {
      const searchGap = await page.evaluate(() => {
        const search = document.querySelector('#menuView .menu-head .mh-right').getBoundingClientRect();
        const rail = document.querySelector('#rail').getBoundingClientRect();
        return rail.top - search.bottom;
      });
      expect(searchGap, 'coffee rail starts below its menu controls').toBeGreaterThanOrEqual(10);
    }
    const geometry = await page.locator(brand.rail).evaluate(rail => {
      const buttons = [...rail.querySelectorAll('button')];
      const rects = buttons.map(button => button.getBoundingClientRect());
      return {
        positions: rects.map(rect => ({ top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: rect.width, height: rect.height })),
        overflowX: rail.scrollWidth > rail.clientWidth + 1,
        labels: buttons.map(button => button.getAttribute('aria-label')),
        pressed: buttons.map(button => button.getAttribute('aria-pressed')),
      };
    });
    expect(geometry.overflowX, brand.brand + ' category capsule has no horizontal scrolling').toBe(false);
    expect(geometry.positions.every(rect => rect.width >= 44 && rect.height >= 44), brand.brand + ' category targets remain at least 44x44').toBe(true);
    expect(geometry.labels.every(Boolean), brand.brand + ' categories have accessible names').toBe(true);
    expect(geometry.pressed.every(value => value === 'true' || value === 'false'), brand.brand + ' categories expose pressed state').toBe(true);
    expect(geometry.positions.every(rect => Math.abs(rect.top - geometry.positions[0].top) <= 1), brand.brand + ' category buttons share one horizontal row').toBe(true);
  }
});


test('floating rail and catalog reserve stay correct across portrait and compact landscape', async ({ page }, testInfo) => {
  for (const brand of CASES) {
    for (const viewport of [
      { width: 320, height: 740 },
      { width: 390, height: 844 },
      { width: 844, height: 390 },
      { width: 1024, height: 390 },
    ]) {
      await page.setViewportSize(viewport);
      await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
      await page.goto('/?brand=' + brand.brand, { waitUntil: 'domcontentloaded' });
      const rail = page.locator(brand.rail);
      await expect(rail).toBeVisible({ timeout: 15000 });
      await expect.poll(() => rail.evaluate(el => getComputedStyle(el).position)).toBe('fixed');
      const metrics = await rail.evaluate(el => {
        const rect = el.getBoundingClientRect();
        const buttons = [...el.querySelectorAll('button')].map(button => {
          const box = button.getBoundingClientRect();
          return { width: box.width, height: box.height, top: box.top };
        });
        const grid = document.querySelector(document.documentElement.dataset.brand === 'delivery' ? '#deliveryGrid' : '#grid');
        return {
          rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, height: rect.height },
          width: window.innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          buttons,
          catalogPaddingBottom: parseFloat(getComputedStyle(grid).paddingBottom),
        };
      });
      expect(metrics.rect.left).toBeGreaterThanOrEqual(0);
      expect(metrics.rect.right).toBeLessThanOrEqual(viewport.width);
      expect(metrics.rect.bottom).toBeLessThan(viewport.height);
      expect(metrics.rect.height).toBeLessThanOrEqual(56);
      expect(metrics.scrollWidth).toBeLessThanOrEqual(viewport.width + 1);
      expect(metrics.buttons.every(button => button.width >= 44 && button.height >= 44)).toBe(true);
      expect(metrics.buttons.every(button => Math.abs(button.top - metrics.buttons[0].top) <= 1)).toBe(true);
      expect(metrics.catalogPaddingBottom).toBeGreaterThanOrEqual(metrics.rect.height + 20);
      await testInfo.attach(brand.brand + '-floating-' + viewport.width + 'x' + viewport.height, {
        body: await page.screenshot({ animations: 'disabled' }),
        contentType: 'image/png',
      });
    }
  }
});

test('both brand rails align to the catalog row on desktop', async ({page}) => {
  for (const brand of CASES) {
    await page.setViewportSize({width:1440,height:900});
    await page.addInitScript(() => sessionStorage.setItem('splashDone','1'));
    await page.goto('/?brand='+brand.brand,{waitUntil:'domcontentloaded'});
    const gridSelector=brand.brand==='coffee'?'#grid':'#deliveryGrid';
    await expect(page.locator(gridSelector+' .card').first()).toBeVisible({timeout:15000});
    await expect.poll(()=>page.locator(brand.rail).evaluate(el=>el.classList.contains('rail-position-ready'))).toBe(true);
    const m=await page.evaluate(({railSelector,gridSelector})=>{
      const grid=document.querySelector(gridSelector).getBoundingClientRect();
      const rail=document.querySelector(railSelector),rect=rail.getBoundingClientRect();
      return {gt:grid.top,gb:grid.bottom,rt:rect.top,rb:rect.bottom,pos:getComputedStyle(rail).position,align:getComputedStyle(rail).alignSelf};
    },{railSelector:brand.rail,gridSelector});
    expect(Math.abs(m.rt-m.gt)).toBeLessThanOrEqual(2);
    expect(Math.abs(m.rb-m.gb)).toBeLessThanOrEqual(4);
    expect(m.pos).toBe('relative');
    expect(m.align).toBe('stretch');
  }
});

test('coffee wordmark “и кофе” remains visible beside the logo on mobile and tablet', async ({ page }) => {
  for (const width of [390, 820, 1024]) {
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
    await page.goto('/?brand=coffee', { waitUntil: 'domcontentloaded' });
    const title = page.locator('header.topbar #brandTitle');
    await expect(title).toBeAttached();
    await expect(title).toBeVisible();
    await expect(title).toHaveAttribute('aria-label', '…и кофе');
    const bounds = await title.boundingBox();
    expect(bounds?.width ?? 0).toBeGreaterThan(20);
    expect(bounds?.height ?? 0).toBeGreaterThan(10);
  }
});

test('delivery: pizza option labels use compact typography only at 320px', async ({ page }) => {
  for (const viewport of [
    { width: 320, height: 740, expected: { size: 10, crust: 8, weight: 8.5, price: 10.5 } },
    { width: 390, height: 844, expected: { size: 12.5, crust: 11, weight: 10.5, price: 13 } },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
    await page.goto('/?brand=delivery', { waitUntil: 'domcontentloaded' });

    const options = page.locator('#deliveryGrid .card .opts').first();
    await expect(options).toBeVisible({ timeout: 15000 });
    await expect(options.locator('.opt-size').first()).toBeVisible();

    const fontSizes = await options.evaluate((fieldset) => {
      const size = (selector) => {
        const element = fieldset.querySelector(selector);
        return element ? Number.parseFloat(getComputedStyle(element).fontSize) : null;
      };
      return {
        size: size('.opt-size'),
        crust: size('.opt-crust'),
        weight: size('.opt-weight'),
        price: size('.opt-price'),
        crustsFit: [...fieldset.querySelectorAll('.opt-crust')].every((element) => element.scrollWidth <= element.clientWidth),
      };
    });
    expect(fontSizes).toEqual({ ...viewport.expected, crustsFit: true });
  }
});
