import { test, expect } from '@playwright/test';

const CASES = [
  { brand: 'coffee', head: '#menuView .menu-head', rail: '#rail', tickerBg: 'rgb(18, 58, 107)' },
  { brand: 'delivery', head: '#deliveryView .menu-head', rail: '#deliveryRail', tickerBg: 'rgb(58, 42, 28)' },
];

function usesHorizontalRail(viewport) {
  return viewport.width <= 820 ||
    (viewport.width >= 821 && viewport.width > viewport.height && viewport.height <= 480);
}

const VIEWPORTS = [
  { name: 'narrow mobile', width: 320, height: 740 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'tablet edge 820', width: 820, height: 1024 },
  { name: 'breakpoint edge', width: 821, height: 900 },
  { name: 'compact landscape 844', width: 844, height: 390 },
  { name: 'wide compact landscape 1024', width: 1024, height: 390 },
  { name: 'small desktop', width: 1024, height: 768 },
  { name: 'laptop', width: 1181, height: 820 },
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'wide desktop', width: 1600, height: 1000 },
];

for (const brand of CASES) {
  for (const viewport of VIEWPORTS) {
    test(`${brand.brand}: menu header geometry and card-aligned rail at ${viewport.name}`, async ({ page }, testInfo) => {
      const horizontalRail = usesHorizontalRail(viewport);
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
      if (brand.brand === 'delivery' && viewport.width > 820 && !horizontalRail) {
        await expect(page.locator('#deliveryGrid .card').first()).toBeVisible({ timeout: 15000 });
        await expect.poll(() => page.evaluate(() => {
          const grid = document.querySelector('#deliveryGrid').getBoundingClientRect();
          const rail = document.querySelector('#deliveryRail').getBoundingClientRect();
          return Math.abs(rail.top - grid.top);
        }), { timeout: 5000 }).toBeLessThanOrEqual(2);
      } else if (horizontalRail) {
        const searchGap = await page.evaluate(({ headSelector, railSelector }) => {
          const head = document.querySelector(headSelector);
          const rail = document.querySelector(railSelector);
          const searchRow = head.querySelector('.mh-right');
          return rail.getBoundingClientRect().top - searchRow.getBoundingClientRect().bottom;
        }, { headSelector: brand.head, railSelector: brand.rail });
        expect(searchGap, 'coffee rail starts below search/support row').toBeGreaterThanOrEqual(10);
      } else {
        await expect(page.locator('#grid .card').first()).toBeVisible({timeout:15000});
        await page.waitForLoadState('load');
        await page.evaluate(() => document.fonts && document.fonts.ready);
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

      if (horizontalRail) {
        expect(layout.railPosition, 'mobile rail stays in its catalog position before scrolling').toBe('relative');
        expect(Math.abs(layout.headLeft - layout.contentLeft), 'mobile menu-head starts at the left edge of the complete menu area').toBeLessThanOrEqual(1);
        expect(Math.abs(layout.headRight - layout.contentRight), 'mobile menu-head spans rail and content columns').toBeLessThanOrEqual(1);
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

      await testInfo.attach(`${brand.brand}-${horizontalRail ? 'horizontal-rail' : 'desktop-sidebar'}-${viewport.width}x${viewport.height}`, {
        body: await page.screenshot({ animations: 'disabled' }),
        contentType: 'image/png',
      });

      const railTopBeforeScroll = await rail.evaluate(el => el.getBoundingClientRect().top);
      await page.evaluate(() => window.scrollTo(0, 500));
      if (viewport.width <= 820) {
        await expect.poll(() => page.evaluate(selector => {
          const element = document.querySelector(selector);
          const rect = element.getBoundingClientRect();
          const topbar = document.querySelector('header.topbar');
          const style = topbar && getComputedStyle(topbar);
          const topbarSticky = !!(style && (style.position === 'sticky' || style.position === 'fixed'));
          const expectedTop = topbarSticky ? topbar.getBoundingClientRect().height : 12;
          return {
            topDelta: Math.abs(rect.top - expectedTop),
            position: getComputedStyle(element).position,
            bottom: rect.bottom,
          };
        }, brand.rail), { timeout: 5000 }).toMatchObject({
          position: 'sticky',
        });
        await expect.poll(() => page.evaluate(selector => {
          const element = document.querySelector(selector);
          const rect = element.getBoundingClientRect();
          const topbar = document.querySelector('header.topbar');
          const style = topbar && getComputedStyle(topbar);
          const topbarSticky = !!(style && (style.position === 'sticky' || style.position === 'fixed'));
          return Math.abs(rect.top - (topbarSticky ? topbar.getBoundingClientRect().height : 12));
        }, brand.rail), { timeout: 5000 }).toBeLessThanOrEqual(2);
        await testInfo.attach(`${brand.brand}-sticky-rail-${viewport.width}px`, {
          body: await page.screenshot({ animations: 'disabled' }),
          contentType: 'image/png',
        });
      } else if (horizontalRail) {
        await expect.poll(() => rail.evaluate(el => el.getBoundingClientRect().top))
          .toBeLessThan(railTopBeforeScroll - 20);
        await expect.poll(() => rail.evaluate(el => getComputedStyle(el).position))
          .not.toBe('sticky');
        await testInfo.attach(`${brand.brand}-short-landscape-scrolled-${viewport.width}px`, {
          body: await page.screenshot({ animations: 'disabled' }),
          contentType: 'image/png',
        });
      } else {
        const gridSelector = brand.brand === 'delivery' ? '#deliveryGrid' : '#grid';
        await expect.poll(() => page.evaluate(({ railSelector, gridSelector }) => {
          const grid = document.querySelector(gridSelector).getBoundingClientRect();
          const rail = document.querySelector(railSelector).getBoundingClientRect();
          return Math.abs(rail.top - grid.top);
        }, { railSelector: brand.rail, gridSelector }), { timeout: 5000 }).toBeLessThanOrEqual(2);
        await expect.poll(() => rail.evaluate(el => el.getBoundingClientRect().height))
          .toBeLessThan(480);
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
          viewportWidth: window.innerWidth,
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


test('mobile category tabs match the catalog width and distribute evenly for both brands', async ({ page }, testInfo) => {
  const viewports = [
    { name: '320 narrow', width: 320, height: 740 },
    { name: '360 mobile', width: 360, height: 800 },
    { name: '375 mobile', width: 375, height: 812 },
    { name: '390 mobile', width: 390, height: 844 },
    { name: '414 mobile', width: 414, height: 896 },
    { name: '520 two-card threshold', width: 520, height: 900 },
    { name: '690 tablet', width: 690, height: 960 },
    { name: '768 tablet', width: 768, height: 1024 },
    { name: '820 breakpoint', width: 820, height: 1024 },
  ];

  for (const brand of CASES) {
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.addInitScript(() => {
        localStorage.clear();
        sessionStorage.clear();
        sessionStorage.setItem('splashDone', '1');
      });
      await page.goto('/?brand=' + brand.brand, { waitUntil: 'domcontentloaded' });

      const rail = page.locator(brand.rail);
      const grid = page.locator(brand.brand === 'coffee' ? '#grid' : '#deliveryGrid');
      await expect(page.locator(brand.head)).toBeVisible({ timeout: 10000 });
      await expect(rail).toBeVisible({ timeout: 10000 });
      await expect(grid.locator('.card').first()).toBeVisible({ timeout: 15000 });

      const geometry = await page.evaluate(({ railSelector, gridSelector, headSelector, brandName }) => {
        const rail = document.querySelector(railSelector);
        const grid = document.querySelector(gridSelector);
        const head = document.querySelector(headSelector);
        const railRect = rail.getBoundingClientRect();
        const gridRect = grid.getBoundingClientRect();
        const headRect = head.getBoundingClientRect();
        const railStyle = getComputedStyle(rail);
        const buttons = [...rail.querySelectorAll('button')].map((button) => {
          const rect = button.getBoundingClientRect();
          const style = getComputedStyle(button);
          const icon = button.querySelector('.re');
          const iconStyle = icon ? getComputedStyle(icon) : null;
          return {
            left: rect.left,
            right: rect.right,
            width: rect.width,
            height: rect.height,
            direction: style.flexDirection,
            background: style.backgroundColor,
            radius: style.borderTopLeftRadius,
            borderTop: style.borderTopWidth,
            borderBottom: style.borderBottomWidth,
            borderBottomColor: style.borderBottomColor,
            borderBottomStyle: style.borderBottomStyle,
            iconBackground: iconStyle?.backgroundColor ?? null,
            iconBorder: iconStyle?.borderTopWidth ?? null,
            iconRadius: iconStyle?.borderTopLeftRadius ?? null,
            fontFamily: style.fontFamily,
            active: button.getAttribute('aria-pressed') === 'true',
          };
        });
        const active = buttons.length
          ? [...rail.querySelectorAll('button')].find((button) => button.getAttribute('aria-pressed') === 'true')
          : null;
        const activeStyle = active ? getComputedStyle(active) : null;
        const filter = brandName === 'delivery' ? document.querySelector('#deliverySubFilterViewport') : null;
        const filterRect = filter && !filter.hidden ? filter.getBoundingClientRect() : null;
        return {
          parentIsView: rail.parentElement === document.querySelector(brandName === 'coffee' ? '#menuView' : '#deliveryView'),
          direction: railStyle.flexDirection,
          background: railStyle.backgroundColor,
          border: railStyle.borderTopWidth,
          shadow: railStyle.boxShadow,
          railLeft: railRect.left,
          railRight: railRect.right,
          railWidth: railRect.width,
          gridLeft: gridRect.left,
          gridRight: gridRect.right,
          gridWidth: gridRect.width,
          headBottom: headRect.bottom,
          railTop: railRect.top,
          railBottom: railRect.bottom,
          railHeight: railRect.height,
          railRadius: railStyle.borderTopLeftRadius,
          railOverflow: railStyle.overflow,
          scrollWidth: rail.scrollWidth,
          clientWidth: rail.clientWidth,
          viewportWidth: window.innerWidth,
          documentWidth: document.documentElement.scrollWidth,
          buttonCount: buttons.length,
          buttons,
          activeBackground: activeStyle?.backgroundColor ?? null,
          activeBorderBottom: activeStyle?.borderBottomWidth ?? null,
          activeBorderBottomColor: activeStyle?.borderBottomColor ?? null,
          activeBorderBottomStyle: activeStyle?.borderBottomStyle ?? null,
          filterTop: filterRect?.top ?? null,
        };
      }, {
        railSelector: brand.rail,
        gridSelector: brand.brand === 'coffee' ? '#grid' : '#deliveryGrid',
        headSelector: brand.head,
        brandName: brand.brand,
      });

      expect(geometry.parentIsView, brand.brand + ' rail stays below the search in its menu view').toBe(true);
      expect(geometry.direction, brand.brand + ' categories form one horizontal row').toBe('row');
      expect(Math.abs(geometry.railLeft - geometry.gridLeft), brand.brand + ' rail background starts at the catalog edge').toBeLessThanOrEqual(1);
      expect(Math.abs(geometry.railRight - geometry.gridRight), brand.brand + ' rail background ends at the catalog edge').toBeLessThanOrEqual(1);
      expect(Math.abs(geometry.railWidth - geometry.gridWidth), brand.brand + ' rail background matches the current card-grid width, not the viewport').toBeLessThanOrEqual(1);
      expect(geometry.railTop, brand.brand + ' categories follow the search block').toBeGreaterThan(geometry.headBottom);
      expect(geometry.railHeight, brand.brand + ' mobile rail uses the shared 64px height').toBe(64);
      expect(geometry.railRadius, brand.brand + ' rail surface has rounded corners like its tabs').toBe('16px');
      expect(geometry.railOverflow, brand.brand + ' rail background is clipped to its rounded surface').toBe('hidden');
      expect(geometry.background, brand.brand + ' uses its own category surface').not.toBe('rgba(0, 0, 0, 0)');
      expect(geometry.border, brand.brand + ' rail has no heavy enclosing frame').toBe('0px');
      expect(geometry.shadow, brand.brand + ' rail has no decorative shadow').toBe('none');
      expect(geometry.scrollWidth, brand.brand + ' categories all fit without a second horizontal scroll area').toBeLessThanOrEqual(geometry.clientWidth + 1);
      expect(geometry.documentWidth, brand.brand + ' menu does not create page-wide horizontal overflow').toBeLessThanOrEqual(geometry.viewportWidth + 1);
      expect(geometry.buttonCount).toBeGreaterThan(1);

      const buttonWidths = geometry.buttons.map((button) => button.width);
      expect(Math.max(...buttonWidths) - Math.min(...buttonWidths), brand.brand + ' category cells share the available width equally').toBeLessThanOrEqual(1.5);
      expect(Math.abs(geometry.buttons[0].left - geometry.railLeft), brand.brand + ' first category starts at the rail edge').toBeLessThanOrEqual(1);
      expect(Math.abs(geometry.buttons.at(-1).right - geometry.railRight), brand.brand + ' last category ends at the rail edge').toBeLessThanOrEqual(1);

      for (const button of geometry.buttons) {
        expect(button.direction, brand.brand + ' icon sits above its category label').toBe('column');
        expect(button.height, brand.brand + ' category is a usable tap target').toBeGreaterThanOrEqual(44);
        expect(button.radius, brand.brand + ' category cells share the same rounded geometry').toBe('12px');
        if (!button.active) {
          expect(button.background, brand.brand + ' inactive category remains visually quiet').toBe('rgba(0, 0, 0, 0)');
        }
        expect(button.borderTop, brand.brand + ' category has no extra top border').toBe('0px');
        expect(button.iconBackground, brand.brand + ' icon keeps its brand surface').not.toBe('rgba(0, 0, 0, 0)');
        expect(button.iconBorder, brand.brand + ' icon uses a restrained one-pixel border').toBe('1px');
        expect(button.iconRadius, brand.brand + ' icon keeps its brand-specific shape')
          .toBe(brand.brand === 'coffee' ? '50%' : '8px');
      }

      expect(
        geometry.activeBackground,
        brand.brand + ' active state uses a visible brand surface'
      ).not.toBe('rgba(0, 0, 0, 0)');
      expect(geometry.activeBorderBottom).toBe('3px');
      expect(geometry.activeBorderBottomStyle).toBe('solid');
      expect(
        geometry.activeBorderBottomColor.replace('rgba(', '').replace('rgb(', '').replace(')', '').split(',').slice(0, 3).map(value => Number(value.trim())).join(','),
        brand.brand + ' keeps its brand accent hue'
      ).toBe(brand.brand === 'coffee' ? '18,58,107' : '192,59,42');

      if (geometry.filterTop !== null) {
        expect(geometry.railBottom, 'delivery primary categories remain above their secondary filters').toBeLessThanOrEqual(geometry.filterTop + 1);
      }

      await testInfo.attach(brand.brand + '-' + viewport.name.replaceAll(' ', '-') + '-category-tabs', {
        body: await page.screenshot({ animations: 'disabled' }),
        contentType: 'image/png',
      });
    }
  }
});


test('desktop category navigation uses one brand frame and a single active tab surface', async ({ page }, testInfo) => {
  const viewports = [
    { width: 1024, height: 768, columns: 2 },
    { width: 1440, height: 900, columns: 3 },
    { width: 1600, height: 1000, columns: 4 },
  ];

  for (const brand of CASES) {
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
      await page.goto('/?brand=' + brand.brand, { waitUntil: 'domcontentloaded' });

      const rail = page.locator(brand.rail);
      const grid = page.locator(brand.brand === 'coffee' ? '#grid' : '#deliveryGrid');
      await expect(rail).toBeVisible({ timeout: 10000 });
      await expect(grid.locator('.card').first()).toBeVisible({ timeout: 15000 });
      await expect.poll(() => rail.evaluate((element) => getComputedStyle(element).flexDirection), { timeout: 10000 })
        .toBe('column');

      const layout = await rail.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const active = element.querySelector('button.on');
        const activeStyle = getComputedStyle(active);
        const iconStyle = getComputedStyle(active.querySelector('.re'));
        const rgb = (value) => {
          const match = value.match(/[0-9.]+/g);
          return match ? match.slice(0, 3).map(Number) : [255, 255, 255];
        };
        const luminance = (value) => rgb(value).map((channel) => {
          const normalized = channel / 255;
          return normalized <= .04045 ? normalized / 12.92 : ((normalized + .055) / 1.055) ** 2.4;
        }).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
        const background = activeStyle.backgroundColor.includes(', 0)')
          ? style.backgroundColor
          : activeStyle.backgroundColor;
        const values = [luminance(activeStyle.color), luminance(background)].sort((a,b) => b-a);
        return {
          position: style.position,
          width: rect.width,
          height: rect.height,
          railBackground: style.backgroundColor,
          railBorder: style.borderTopWidth,
          radius: style.borderTopLeftRadius,
          activeBackground: activeStyle.backgroundColor,
          activeBorder: activeStyle.borderTopWidth,
          activeRadius: activeStyle.borderTopLeftRadius,
          contrast: (values[0] + .05) / (values[1] + .05),
          iconBackground: iconStyle.backgroundColor,
          iconRadius: iconStyle.borderTopLeftRadius,
        };
      });

      const columns = await grid.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length);
      expect(layout.position).toBe('relative');
      expect(layout.height).toBeLessThan(480);
      expect(layout.railBackground).not.toBe('rgba(0, 0, 0, 0)');
      expect(layout.railBorder).toBe('1px');
      expect(layout.radius).toBe('16px');
      expect(layout.activeBackground).not.toBe('rgba(0, 0, 0, 0)');
      expect(layout.activeBorder).toBe('1px');
      expect(layout.activeRadius).toBe('12px');
      expect(layout.contrast, brand.brand + ' selected desktop category text keeps WCAG AA contrast').toBeGreaterThanOrEqual(4.5);
      expect(layout.iconBackground).not.toBe('rgba(0, 0, 0, 0)');
      expect(layout.iconRadius).toBe(brand.brand === 'coffee' ? '50%' : '8px');
      expect(columns).toBe(viewport.columns);

      await testInfo.attach(brand.brand + '-desktop-' + viewport.width + 'x' + viewport.height + '-single-frame-rail', {
        body: await page.screenshot({ animations: 'disabled' }),
        contentType: 'image/png',
      });
    }
  }
});


test('short landscape category tabs align to the catalog instead of filling the device width', async ({ page }, testInfo) => {
  for (const brand of CASES) {
    for (const viewport of [
      { width: 844, height: 390 },
      { width: 1024, height: 390 },
    ]) {
      await page.setViewportSize(viewport);
      await page.addInitScript(() => {
        localStorage.clear();
        sessionStorage.clear();
        sessionStorage.setItem('splashDone', '1');
      });
      await page.goto('/?brand=' + brand.brand, { waitUntil: 'domcontentloaded' });

      const rail = page.locator(brand.rail);
      const grid = page.locator(brand.brand === 'coffee' ? '#grid' : '#deliveryGrid');
      await expect(rail).toBeVisible({ timeout: 10000 });
      await expect(grid.locator('.card').first()).toBeVisible({ timeout: 15000 });

      const layout = await page.evaluate(({ railSelector, gridSelector }) => {
        const rail = document.querySelector(railSelector);
        const grid = document.querySelector(gridSelector);
        const railRect = rail.getBoundingClientRect();
        const gridRect = grid.getBoundingClientRect();
        const style = getComputedStyle(rail);
        return {
          parentIsMenu: rail.parentElement.id === (railSelector === '#rail' ? 'menuView' : 'deliveryView'),
          direction: style.flexDirection,
          railLeft: railRect.left,
          railRight: railRect.right,
          gridLeft: gridRect.left,
          gridRight: gridRect.right,
          buttonWidths: [...rail.querySelectorAll('button')].map((button) => button.getBoundingClientRect().width),
          scrollWidth: rail.scrollWidth,
          clientWidth: rail.clientWidth,
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: document.documentElement.clientWidth,
        };
      }, { railSelector: brand.rail, gridSelector: brand.brand === 'coffee' ? '#grid' : '#deliveryGrid' });

      expect(layout.parentIsMenu).toBe(true);
      expect(layout.direction).toBe('row');
      expect(Math.abs(layout.railLeft - layout.gridLeft)).toBeLessThanOrEqual(1);
      expect(Math.abs(layout.railRight - layout.gridRight)).toBeLessThanOrEqual(1);
      expect(Math.max(...layout.buttonWidths) - Math.min(...layout.buttonWidths)).toBeLessThanOrEqual(1.5);
      expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
      expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);

      await testInfo.attach(brand.brand + '-short-landscape-' + viewport.width + 'x' + viewport.height + '-category-tabs', {
        body: await page.screenshot({ animations: 'disabled' }),
        contentType: 'image/png',
      });
    }
  }
});


test('category rail relocates on rotation and restores the vertical desktop sidebar', async ({ page }, testInfo) => {
  for (const brand of CASES) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
      sessionStorage.setItem('splashDone', '1');
    });
    await page.goto('/?brand=' + brand.brand, { waitUntil: 'domcontentloaded' });
    const rail = page.locator(brand.rail);
    const viewSelector = brand.brand === 'coffee' ? '#menuView' : '#deliveryView';

    await expect(rail).toBeVisible({ timeout: 10000 });
    await expect.poll(() => rail.evaluate((el) => el.parentElement.id)).toBe(viewSelector.slice(1));
    await expect.poll(() => rail.evaluate((el) => getComputedStyle(el).flexDirection)).toBe('row');
    await testInfo.attach(brand.brand + '-390x844-before-rotation', {
      body: await page.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    });

    await page.setViewportSize({ width: 844, height: 390 });
    await expect.poll(() => rail.evaluate((el) => el.parentElement.id)).toBe(viewSelector.slice(1));
    await expect.poll(() => rail.evaluate((el) => getComputedStyle(el).flexDirection)).toBe('row');
    await testInfo.attach(brand.brand + '-844x390-after-rotation', {
      body: await page.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    });

    await page.setViewportSize({ width: 821, height: 900 });
    await expect.poll(() => rail.evaluate((el) => el.parentElement.classList.contains('wrap'))).toBe(true);
    await expect.poll(() => rail.evaluate((el) => getComputedStyle(el).flexDirection)).toBe('column');
    await testInfo.attach(brand.brand + '-821x900-desktop-after-rotation', {
      body: await page.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    });
  }
});



test('desktop category rails use one visual layer and retain brand-specific icon identity', async ({ page }, testInfo) => {
  for (const brand of CASES) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.setItem('splashDone', '1');
    });
    await page.goto('/?brand=' + brand.brand, { waitUntil: 'domcontentloaded' });

    const rail = page.locator(brand.rail);
    await expect(rail).toBeVisible({ timeout: 10000 });
    const style = await rail.evaluate((element) => {
      const railStyle = getComputedStyle(element);
      const buttons = [...element.querySelectorAll('button')];
      const active = buttons.find(button => button.getAttribute('aria-pressed') === 'true');
      const buttonStyle = getComputedStyle(active);
      const iconStyle = getComputedStyle(active.querySelector('.re'));
      return {
        railBackground: railStyle.backgroundColor,
        railBorder: railStyle.borderTopWidth,
        railShadow: railStyle.boxShadow,
        buttonBackground: buttonStyle.backgroundColor,
        buttonBorder: buttonStyle.borderTopWidth,
        buttonShadow: buttonStyle.boxShadow,
        iconBackground: iconStyle.backgroundColor,
        iconRadius: iconStyle.borderTopLeftRadius,
        buttonHeight: active.getBoundingClientRect().height,
      };
    });

    expect(style.railBackground, brand.brand + ' desktop has one light brand surface').not.toBe('rgba(0, 0, 0, 0)');
    expect(style.railBorder, brand.brand + ' desktop rail uses a restrained one-pixel edge').toBe('1px');
    expect(style.railShadow, brand.brand + ' desktop rail avoids a heavy decorative shadow').toBe('none');
    expect(style.buttonBackground, brand.brand + ' active category has one contained surface').not.toBe('rgba(0, 0, 0, 0)');
    expect(style.buttonBorder, brand.brand + ' active category has a restrained outline').toBe('1px');
    expect(style.buttonShadow, brand.brand + ' active category avoids a second heavy shadow').toBe('none');
    expect(style.iconBackground, brand.brand + ' active icon carries the selected state').not.toBe('rgba(0, 0, 0, 0)');
    expect(style.iconRadius, brand.brand + ' icon retains its brand-specific silhouette')
      .toBe(brand.brand === 'coffee' ? '50%' : '8px');
    expect(style.buttonHeight).toBe(64);

    await testInfo.attach(brand.brand + '-desktop-flat-rail', {
      body: await page.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    });
  }
});

test('category tabs expose their selected state and remain keyboard reachable', async ({ page }) => {
  for (const brand of CASES) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
    await page.goto('/?brand=' + brand.brand, { waitUntil: 'domcontentloaded' });

    const rail = page.locator(brand.rail);
    await expect(rail).toBeVisible({ timeout: 10000 });
    await expect(rail).toHaveAttribute('role', 'group');
    await expect(rail).toHaveAttribute('aria-label', 'Категории меню');
    await expect(rail).not.toHaveAttribute('tabindex', '0');
    await expect(rail.locator('button').first()).toHaveAttribute('type', 'button');
    await expect(rail.locator('button[aria-pressed="true"]')).toHaveCount(1);

    const tabs = rail.locator('button');
    for (let i = 0; i < await tabs.count(); i += 1) {
      await expect(tabs.nth(i)).toHaveAttribute('aria-pressed', i === 0 ? 'true' : 'false');
    }

    await tabs.nth(0).focus();
    await page.keyboard.press('Tab');
    await expect(tabs.nth(1)).toBeFocused();
    await tabs.last().click();
    await expect(tabs.last()).toHaveAttribute('aria-pressed', 'true');
    await expect(rail.locator('button[aria-pressed="true"]')).toHaveCount(1);
    await expect.poll(() => rail.evaluate((el) => el.scrollLeft)).toBe(0);
  }
});


test('switching delivery categories preserves the current rail and page position', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
  await page.goto('/?brand=delivery', { waitUntil: 'domcontentloaded' });

  const rail = page.locator('#deliveryRail');
  const tabs = rail.locator('button');
  await expect(rail).toBeVisible({ timeout: 10000 });
  await expect(tabs).toHaveCount(5);
  await expect(page.locator('#deliveryGrid .card').first()).toBeVisible({ timeout: 15000 });

  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    // Keep the viewport away from the document's maximum scroll so a shorter
    // category cannot clamp scrollY and masquerade as a rail-position regression.
    window.scrollTo({ top: 120, behavior: 'instant' });
  });
  await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 3000 })
    .toBeGreaterThan(0);

  const before = await page.evaluate(() => ({
    scrollY: window.scrollY,
    railTop: document.querySelector('#deliveryRail').getBoundingClientRect().top,
  }));
  await testInfo.attach('delivery-category-switch-before', {
    body: await page.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  });

  await tabs.nth(1).click();
  await expect(tabs.nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#deliveryGrid .card').first()).toBeVisible({ timeout: 15000 });

  const after = await page.evaluate(() => ({
    scrollY: window.scrollY,
    railTop: document.querySelector('#deliveryRail').getBoundingClientRect().top,
  }));
  await testInfo.attach('delivery-category-switch-after', {
    body: await page.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  });

  expect(Math.abs(after.scrollY - before.scrollY)).toBeLessThanOrEqual(1);
  expect(Math.abs(after.railTop - before.railTop)).toBeLessThanOrEqual(1);
});

test('delivery desktop rail keeps its initial catalog-row anchor across category changes', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
  await page.goto('/?brand=delivery', { waitUntil: 'domcontentloaded' });

  const rail = page.locator('#deliveryRail');
  const tabs = rail.locator('button');
  const grid = page.locator('#deliveryGrid');
  await expect(rail).toBeVisible({ timeout: 10000 });
  await expect(tabs).toHaveCount(5);
  await expect(grid.locator('.card').first()).toBeVisible({ timeout: 15000 });

  const initial = await page.evaluate(() => ({
    railTop: document.querySelector('#deliveryRail').getBoundingClientRect().top,
    gridTop: document.querySelector('#deliveryGrid').getBoundingClientRect().top,
  }));
  expect(Math.abs(initial.railTop - initial.gridTop)).toBeLessThanOrEqual(2);
  await testInfo.attach('delivery-desktop-rail-before-category-switch', {
    body: await page.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  });

  await tabs.nth(2).click();
  await expect(tabs.nth(2)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#deliverySubFilter')).toBeHidden();
  await expect(grid.locator('.card').first()).toBeVisible({ timeout: 15000 });

  const after = await page.evaluate(() => ({
    railTop: document.querySelector('#deliveryRail').getBoundingClientRect().top,
    gridTop: document.querySelector('#deliveryGrid').getBoundingClientRect().top,
  }));
  expect(Math.abs(after.railTop - initial.railTop), 'category switching must not move the sidebar').toBeLessThanOrEqual(1);
  expect(after.gridTop).toBeLessThan(initial.gridTop - 40);
  await testInfo.attach('delivery-desktop-rail-after-category-switch', {
    body: await page.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  });
});

test('category navigation keeps secondary delivery filters separate from primary tabs', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
  await page.goto('/?brand=delivery', { waitUntil: 'domcontentloaded' });

  const rail = page.locator('#deliveryRail');
  const filters = page.locator('#deliverySubFilter .subchip').first();
  await expect(rail).toBeVisible({ timeout: 10000 });
  await expect(filters).toBeVisible({ timeout: 15000 });
  await expect(rail.locator('button')).toHaveCount(5);
  const filterPillRadius = await filters.evaluate((element) => getComputedStyle(element, '::before').borderTopLeftRadius);
  expect(filterPillRadius).toContain('999');
  await expect(filters).toHaveCSS('min-height', '44px');

  const [railRect, filterRect] = await Promise.all([
    rail.boundingBox(),
    filters.boundingBox(),
  ]);
  expect(railRect && filterRect && filterRect.y).toBeGreaterThan(railRect.y + railRect.height - 1);
});



test('delivery: optional filters expand below a stable desktop rail anchor', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
  await page.goto('/?brand=delivery', { waitUntil: 'domcontentloaded' });

  const rail = page.locator('#deliveryRail');
  const grid = page.locator('#deliveryGrid');
  const viewport = page.locator('#deliverySubFilterViewport');
  await expect(rail).toBeVisible({ timeout: 10000 });
  await expect(grid.locator('.card').first()).toBeVisible({ timeout: 15000 });

  const measure = () => page.evaluate(() => ({
    railTop: document.querySelector('#deliveryRail').getBoundingClientRect().top,
    gridTop: document.querySelector('#deliveryGrid').getBoundingClientRect().top,
    scrollY: window.scrollY,
    viewportHidden: document.querySelector('#deliverySubFilterViewport').hidden,
  }));
  const initial = await measure();
  expect(Math.abs(initial.railTop - initial.gridTop)).toBeLessThanOrEqual(2);

  await rail.locator('[data-dcat="sauces"]').click();
  await expect(page.locator('#deliverySubFilter')).toBeVisible();
  await expect(viewport).toBeVisible();
  const sauces = await measure();
  await testInfo.attach('delivery-sauces-category-geometry', {
    body: await page.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  });

  await rail.locator('[data-dcat="drinks"]').click();
  await expect(page.locator('#deliverySubFilter')).toBeHidden();
  await expect(viewport).toBeHidden();
  const drinks = await measure();
  await testInfo.attach('delivery-drinks-category-geometry', {
    body: await page.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  });

  expect(initial.viewportHidden).toBe(false);
  expect(sauces.viewportHidden).toBe(false);
  expect(drinks.viewportHidden).toBe(true);
  expect(Math.abs(sauces.railTop - initial.railTop), 'the rail stays at the first catalog row while filters are present').toBeLessThanOrEqual(1);
  expect(Math.abs(drinks.railTop - initial.railTop), 'the rail stays at the same catalog anchor after filters disappear').toBeLessThanOrEqual(1);
  expect(Math.abs(sauces.gridTop - initial.gridTop), 'switching between categories with filters keeps the catalog row stable').toBeLessThanOrEqual(2);
  expect(drinks.gridTop).toBeLessThan(initial.gridTop - 40);
  expect(Math.abs(drinks.scrollY - initial.scrollY)).toBeLessThanOrEqual(1);
});

test('delivery desktop single-meta cards keep equal description and composition slots across categories', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
  await page.goto('/?brand=delivery', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#deliveryRail')).toBeVisible({ timeout: 10000 });

  const fixtures = [
    ...Array.from({ length: 4 }, (_, index) => ({
      id: 'fixture-drink-' + index,
      cat: 'drinks',
      name: 'Холодный чай ' + index,
      desc: 'Чёрный чай, натуральный лимонный сок, тростниковый сахар, свежая мята и лёд. Освежающий напиток для жаркого дня.',
      comp: [],
      vol: '500 мл',
      price: '250',
      opts: [],
      on: true,
    })),
    ...Array.from({ length: 4 }, (_, index) => ({
      id: 'fixture-set-' + index,
      cat: 'sets',
      name: 'Сет роллов ' + index,
      desc: '',
      comp: ['Филадельфия', 'Калифорния', 'Угорь', 'Лосось'],
      vol: '32 шт.',
      price: '1290',
      opts: [],
      on: true,
    })),
  ];

  await page.evaluate((items) => { window.DMENU = items; }, fixtures);

  const measure = async (category) => {
    await page.locator('#deliveryRail [data-dcat="' + category + '"]').click();
    await expect(page.locator('#deliveryGrid .card').first()).toContainText(
      category === 'drinks' ? 'Холодный чай' : 'Сет роллов',
      { timeout: 10000 }
    );
    return page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('#deliveryGrid > .card'));
      const first = cards[0];
      const firstTop = first.getBoundingClientRect().top;
      const secondRow = cards.find(card => card.getBoundingClientRect().top > firstTop + 1);
      const desc = first.querySelector('.cbody > .desc');
      const comp = first.querySelector('.cbody > .comp');
      return {
        cardHeight: first.getBoundingClientRect().height,
        secondRowTop: secondRow ? secondRow.getBoundingClientRect().top : null,
        descHeight: desc ? desc.getBoundingClientRect().height : null,
        compHeight: comp ? comp.getBoundingClientRect().height : null,
        descText: desc ? desc.textContent.trim() : null,
        compHasChips: !!(comp && comp.children.length),
      };
    });
  };

  const drinks = await measure('drinks');
  await testInfo.attach('delivery-drinks-stable-card-slots', {
    body: await page.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  });
  const sets = await measure('sets');
  await testInfo.attach('delivery-sets-stable-card-slots', {
    body: await page.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  });

  expect(drinks.descHeight).toBe(37);
  expect(sets.descHeight).toBe(37);
  expect(drinks.compHeight).toBe(100);
  expect(sets.compHeight).toBe(100);
  expect(drinks.compHasChips).toBe(false);
  expect(sets.compHasChips).toBe(true);
  expect(Math.abs(drinks.cardHeight - sets.cardHeight), 'description length must not change the category row height').toBeLessThanOrEqual(1);
  expect(Math.abs(drinks.secondRowTop - sets.secondRowTop), 'the second row must not jump between drinks and sets').toBeLessThanOrEqual(1);
});

test('delivery desktop rail keeps its captured anchor when filters disappear during viewport resize', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
  await page.goto('/?brand=delivery', { waitUntil: 'domcontentloaded' });
  const rail = page.locator('#deliveryRail');
  await expect(rail).toBeVisible({ timeout: 10000 });

  const fixtures = [
    ...Array.from({ length: 4 }, (_, index) => ({
      id: 'anchor-sauce-' + index,
      cat: 'sauces',
      name: 'Соус тестовый ' + index,
      desc: '',
      comp: ['томат', 'специи'],
      vol: '40 г',
      price: '80',
      opts: [],
      on: true,
    })),
    ...Array.from({ length: 4 }, (_, index) => ({
      id: 'anchor-drink-' + index,
      cat: 'drinks',
      name: 'Холодный чай тестовый ' + index,
      desc: 'Чёрный чай, лимонный сок, тростниковый сахар и свежая мята.',
      comp: [],
      vol: '500 мл',
      price: '250',
      opts: [],
      on: true,
    })),
  ];
  await page.evaluate((items) => { window.DMENU = items; }, fixtures);

  const measure = () => page.evaluate(() => ({
    railTop: document.querySelector('#deliveryRail').getBoundingClientRect().top,
    gridTop: document.querySelector('#deliveryGrid').getBoundingClientRect().top,
    railMarginTop: getComputedStyle(document.querySelector('#deliveryRail')).marginTop,
    viewportWidth: document.documentElement.clientWidth,
  }));

  await rail.locator('[data-dcat="sauces"]').click();
  await expect(page.locator('#deliveryGrid .card').first()).toContainText('Соус тестовый', { timeout: 10000 });
  await expect(page.locator('#deliverySubFilterViewport')).toBeVisible();
  const sauces = await measure();
  await testInfo.attach('delivery-rail-anchor-before-filter-removal', {
    body: await page.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  });

  await rail.locator('[data-dcat="drinks"]').click();
  await expect(page.locator('#deliveryGrid .card').first()).toContainText('Холодный чай тестовый', { timeout: 10000 });
  await expect(page.locator('#deliverySubFilterViewport')).toBeHidden();
  const drinks = await measure();

  await page.setViewportSize({ width: 1100, height: 768 });
  await page.evaluate(() => new Promise(resolve =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  ));
  const resized = await measure();
  await testInfo.attach('delivery-rail-anchor-after-filter-removal-and-resize', {
    body: await page.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  });

  expect(Math.abs(drinks.railTop - sauces.railTop), 'category switching must not move the desktop rail').toBeLessThanOrEqual(1);
  expect(Math.abs(resized.railTop - sauces.railTop), 'resizing within desktop mode must preserve the captured rail anchor').toBeLessThanOrEqual(1);
  expect(drinks.gridTop).toBeLessThan(sauces.gridTop - 40);
  expect(resized.viewportWidth).toBe(1100);
});

test('delivery wrapper keeps full horizontal width when switching categories at 1000px', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1000, height: 834 });
  await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
  await page.goto('/?brand=delivery', { waitUntil: 'domcontentloaded' });

  const rail = page.locator('#deliveryRail');
  const grid = page.locator('#deliveryGrid');
  await expect(rail).toBeVisible({ timeout: 10000 });
  await expect(grid.locator('.card').first()).toBeVisible({ timeout: 15000 });

  const measure = () => page.evaluate(() => {
    const wrap = document.querySelector('body > div.wrap');
    const rect = wrap.getBoundingClientRect();
    return {
      left: rect.left,
      width: rect.width,
      clientWidth: document.documentElement.clientWidth,
    };
  });

  const initial = await measure();
  expect(Math.abs(initial.left)).toBeLessThanOrEqual(1);
  expect(Math.abs(initial.width - initial.clientWidth)).toBeLessThanOrEqual(1);

  for (const category of ['sauces', 'drinks']) {
    await rail.locator('[data-dcat="' + category + '"]').click();
    await expect(rail.locator('[data-dcat="' + category + '"]')).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () =>
      await grid.locator('.card:not(.skeleton-card)').count() + await grid.locator('.gempty').count(),
      { timeout: 15000 }
    ).toBeGreaterThan(0);

    const current = await measure();
    expect(Math.abs(current.left), category + ': wrapper must stay flush with the viewport').toBeLessThanOrEqual(1);
    expect(Math.abs(current.width - current.clientWidth), category + ': wrapper must keep the viewport width').toBeLessThanOrEqual(1);
    await testInfo.attach('delivery-' + category + '-wrapper-geometry-1000x834', {
      body: await page.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    });
  }
});



test('category rail uses one surface, an active icon chip and a separate underline', async ({ page }) => {
  for (const brand of ['coffee', 'delivery']) {
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 820, height: 1024 },
      { width: 844, height: 390 },
      { width: 1024, height: 390 },
      { width: 821, height: 900 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
      await page.goto('/?brand=' + brand, { waitUntil: 'domcontentloaded' });

      const rail = page.locator(brand === 'coffee' ? '#rail' : '#deliveryRail');
      await expect(rail).toBeVisible({ timeout: 10000 });
      const target = rail.locator('button').nth(1);
      await target.evaluate((element) => { window.__originalCategoryTab = element; });
      await target.click();
      await expect(target).toHaveAttribute('aria-pressed', 'true');
      await expect.poll(() => target.evaluate((element) => element === window.__originalCategoryTab)).toBe(true);

      const styles = await rail.evaluate((element) => {
        const button = element.querySelector('button.on');
        const inactive = element.querySelector('button:not(.on)');
        const icon = button.querySelector('.re');
        const inactiveIcon = inactive.querySelector('.re');
        const rect = icon.getBoundingClientRect();
        const pseudo = getComputedStyle(button, '::after');
        const buttonStyle = getComputedStyle(button);
        const inactiveStyle = getComputedStyle(inactive);
        const iconStyle = getComputedStyle(icon);
        const inactiveIconStyle = getComputedStyle(inactiveIcon);
        const railStyle = getComputedStyle(element);
        return {
          iconRect: { width: rect.width, height: rect.height },
          iconBackground: iconStyle.backgroundColor,
          iconRadius: iconStyle.borderRadius,
          inactiveIconBackground: inactiveIconStyle.backgroundColor,
          inactiveIconBorder: inactiveIconStyle.borderWidth,
          buttonBackground: buttonStyle.backgroundColor,
          buttonBorder: buttonStyle.borderWidth,
          buttonBorderBottom: buttonStyle.borderBottomWidth,
          buttonRadius: buttonStyle.borderRadius,
          inactiveBackground: inactiveStyle.backgroundColor,
          inactiveBorder: inactiveStyle.borderWidth,
          pseudo: {
            content: pseudo.content,
            display: pseudo.display,
            width: pseudo.width,
            height: pseudo.height,
            background: pseudo.backgroundColor,
            radius: pseudo.borderRadius,
          },
          railBackground: railStyle.backgroundColor,
          fontFamily: buttonStyle.fontFamily,
          fontSize: parseFloat(buttonStyle.fontSize),
          railHeight: element.getBoundingClientRect().height,
          buttonHeight: button.getBoundingClientRect().height,
        };
      });

      expect(styles.iconRect.width, brand + ' icon chip must have a fixed square width').toBeGreaterThanOrEqual(30);
      expect(styles.iconRect.width, brand + ' icon chip must be square').toBeCloseTo(styles.iconRect.height, 1);
      expect(styles.inactiveIconBackground, brand + ' inactive icon must not have a chip').toBe('rgba(0, 0, 0, 0)');
      expect(styles.inactiveIconBorder, brand + ' inactive icon must not have a border').toBe('0px');
      expect(styles.buttonBackground, brand + ' active tab must not have a filled surface').toBe('rgba(0, 0, 0, 0)');
      expect(styles.buttonBorder, brand + ' active tab must not have a frame').toBe('0px');
      expect(styles.buttonBorderBottom, brand + ' active tab must use ::after, not border-bottom').toBe('0px');
      expect(styles.buttonRadius, brand + ' active tab must not be a pill').toBe('0px');
      expect(styles.inactiveBackground, brand + ' inactive tab must not have a fill').toBe('rgba(0, 0, 0, 0)');
      expect(styles.inactiveBorder, brand + ' inactive tab must not have a frame').toBe('0px');
      expect(styles.pseudo.content).not.toBe('none');
      expect(styles.pseudo.display).not.toBe('none');
      expect(parseFloat(styles.pseudo.width)).toBe(28);
      expect(parseFloat(styles.pseudo.height)).toBe(3);
      expect(styles.pseudo.radius).toBe('2px');
      expect(styles.fontFamily).toMatch(/system-ui|sans-serif/);
      expect(styles.fontSize).toBeGreaterThanOrEqual(brand === 'coffee' ? 10 : 10);
      if (viewport.width <= 820 || viewport.height <= 480) {
        expect(Math.abs(styles.railHeight - styles.buttonHeight)).toBeLessThanOrEqual(0.5);
      }
    }
  }
});


// Horizontal rail baseline diagnostics for the two-phase CI capture.
test('horizontal rail baseline diagnostics and first-paint geometry', async ({ browser }, testInfo) => {
  const context = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    viewport: testInfo.project.use.viewport,
    deviceScaleFactor: testInfo.project.use.deviceScaleFactor,
    isMobile: testInfo.project.use.isMobile,
    hasTouch: testInfo.project.use.hasTouch,
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  const viewports = [
    { width: 390, height: 844, name: '390x844' },
    { width: 820, height: 1024, name: '820x1024' },
    { width: 844, height: 390, name: '844x390' },
    { width: 1024, height: 390, name: '1024x390' },
  ];
  const reports = [];

  for (const brand of CASES) {
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
      let releaseStyles;
      const stylesGate = new Promise(resolve => { releaseStyles = resolve; });
      const heldRequests = [];
      await page.route('**/*', async route => {
        const url = route.request().url();
        if (url.includes('/app/ui/theme/') || url.includes('/app/ui/brand-tokens.css')) {
          heldRequests.push(url);
          await stylesGate;
        }
        await route.continue();
      });

      await page.goto(`/?brand=${brand.brand}`, { waitUntil: 'domcontentloaded' });
      const rail = page.locator(brand.rail);
      await expect(rail).toBeVisible({ timeout: 10000 });
      await expect.poll(() => rail.locator('button').count()).toBeGreaterThan(0);
      const selectors = {
        rail: brand.rail,
        button: brand.rail + ' button',
        active: brand.rail + ' button.on',
        inactive: brand.rail + ' button:not(.on)',
        icon: brand.rail + ' .re',
        activeIcon: brand.rail + ' button.on .re',
        inactiveIcon: brand.rail + ' button:not(.on) .re',
      };
      const titleSelector = brand.brand === 'coffee'
        ? '#grid > .card:not(.skeleton-card) .cbody > h3'
        : '#deliveryGrid > .card:not(.skeleton-card) .cbody > h3';
      const measure = () => page.evaluate(({ selectors, headSelector, titleSelector }) => {
        const css = selector => {
          const el=document.querySelector(selector);
          if(!el) return null;
          const s=getComputedStyle(el), r=el.getBoundingClientRect();
          return {
            rect:{x:r.x,y:r.y,width:r.width,height:r.height,top:r.top,bottom:r.bottom},
            display:s.display, flexDirection:s.flexDirection, gap:s.gap,
            borderTopWidth:s.borderTopWidth,borderRightWidth:s.borderRightWidth,
            borderBottomWidth:s.borderBottomWidth,borderLeftWidth:s.borderLeftWidth,
            borderTopColor:s.borderTopColor,borderBottomColor:s.borderBottomColor,
            borderRadius:s.borderRadius,backgroundColor:s.backgroundColor,color:s.color,
            fontFamily:s.fontFamily,fontSize:s.fontSize,lineHeight:s.lineHeight,
            padding:s.padding,margin:s.margin,transition:s.transition,
            minHeight:s.minHeight, outline:s.outline,
          };
        };
        const railEl=document.querySelector(selectors.rail);
        const buttons=Array.from(railEl ? railEl.querySelectorAll('button') : []);
        const iconTops=buttons.map(button=>button.querySelector('.re')?.getBoundingClientRect().top).filter(Number.isFinite);
        const rect=selector=>{
          const el=document.querySelector(selector); if(!el) return null;
          const r=el.getBoundingClientRect(); return {top:r.top,bottom:r.bottom,height:r.height};
        };
        const title=document.querySelector(titleSelector);
        const tr=title?.getBoundingClientRect();
        const cardSelector = selectors.rail.includes('deliveryRail') ? '#deliveryGrid > .card' : '#grid > article.card';
        const firstCard=document.querySelector(cardSelector);
        const cr=firstCard?.getBoundingClientRect();
        const active=document.querySelector(selectors.active);
        const after=active ? getComputedStyle(active,'::after') : null;
        const fontFaces=Array.from(document.fonts || []).map(face => ({
          family:face.family, weight:face.weight, style:face.style, status:face.status,
        }));
        return {
          computed:Object.fromEntries(Object.entries(selectors).map(([key,selector])=>[key,css(selector)])),
          activeAfter:after ? {
            content:after.content, display:after.display, width:after.width, height:after.height,
            backgroundColor:after.backgroundColor, borderRadius:after.borderRadius,
          } : null,
          fonts:{
            golosText:document.fonts ? document.fonts.check('12px "Golos Text"') : false,
            unbounded:document.fonts ? document.fonts.check('12px "Unbounded"') : false,
            loadedFaces:fontFaces,
          },
          firstCardTitleText:title?.textContent?.trim() || null,
          firstCardRect:cr ? {top:cr.top,bottom:cr.bottom,height:cr.height,width:cr.width} : null,
          firstCardTitleRect:tr ? {top:tr.top,bottom:tr.bottom,height:tr.height} : null,
          buttons:buttons.map(button=>{const r=button.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};}),
          iconTops,iconTopSpread:iconTops.length?Math.max(...iconTops)-Math.min(...iconTops):null,
          regions:{
            topbar:rect('header.topbar'),ticker:rect('.ticker'),
            menuHead:rect(headSelector),rail:rect(selectors.rail),
            subfilter:rect('#deliverySubFilterViewport, #subFilterViewport, .subfilter-viewport'),
            firstCardTitle:tr?{top:tr.top,bottom:tr.bottom,height:tr.height}:null,
          },
          viewport:{width:innerWidth,height:innerHeight,scrollY},
        };
      }, { selectors, headSelector:brand.head, titleSelector });

      expect(heldRequests.some(url => url.includes('/app/ui/theme/')), 'theme CSS must be held before first-frame measurement').toBe(true);
      expect(heldRequests.some(url => url.includes('/app/ui/brand-tokens.css')), 'brand tokens must be held before first-frame measurement').toBe(true);
      const firstFrame=await measure();
      releaseStyles();
      await expect.poll(() => page.evaluate(() => Array.from(document.querySelectorAll('link[rel="stylesheet"]')).some(link =>
        link.href.includes('/app/ui/theme/150-rail.css') && link.media==='all'
      )), { timeout:15000 }).toBe(true);
      await page.evaluate(() => document.fonts && document.fonts.ready);
      await expect(page.locator(titleSelector).first()).toBeVisible({ timeout: 15000 });
      await page.addStyleTag({ content: '*,:before,:after{transition:none!important;animation:none!important}' });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const hydrated=await measure();
      await page.waitForTimeout(200);
      const hydratedAfter200ms=await measure();
      await testInfo.attach(`${brand.brand}-horizontal-rail-${viewport.name}-before`, {
        body:await page.screenshot({animations:'disabled'}),contentType:'image/png',
      });
      reports.push({brand:brand.brand,viewport,heldStylesheetRequests:heldRequests,firstFrame,hydrated,hydratedAfter200ms});

      expect.soft(Math.abs(hydrated.computed.rail.rect.height-hydrated.computed.button.rect.height),
        `${brand.brand} ${viewport.name}: rail and button heights must match`).toBeLessThanOrEqual(0.5);
      expect.soft(hydrated.computed.active.borderBottomWidth,
        `${brand.brand} ${viewport.name}: active tab must not use bottom border`).toBe('0px');
      expect.soft(hydrated.iconTopSpread,
        `${brand.brand} ${viewport.name}: all icon tops must align`).toBeLessThanOrEqual(1);
      expect.soft(parseFloat(hydrated.computed.button.fontSize),
        `${brand.brand} ${viewport.name}: label font size minimum`).toBeGreaterThanOrEqual(brand.brand==='coffee'?10:9.5);
    }
  }
  await context.close();
  await testInfo.attach('horizontal-rail-baseline-diagnostics.json',{
    body:Buffer.from(JSON.stringify(reports,null,2)),contentType:'application/json',
  });
});
