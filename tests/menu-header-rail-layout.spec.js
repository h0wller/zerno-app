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
          scrollWidth: rail.scrollWidth,
          clientWidth: rail.clientWidth,
          viewportWidth: document.documentElement.clientWidth,
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
      expect(geometry.railHeight, brand.brand + ' tabs stay compact').toBeGreaterThanOrEqual(52);
      expect(geometry.railHeight, brand.brand + ' tabs do not create an oversized panel').toBeLessThanOrEqual(92);
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
        expect(button.radius, brand.brand + ' category is a flat tab, not a pill').toBe('0px');
        expect(button.background, brand.brand + ' category tabs are not filled cards').toBe('rgba(0, 0, 0, 0)');
        expect(button.borderTop, brand.brand + ' category tabs do not have an enclosing outline').toBe('0px');
        expect(button.iconBackground, brand.brand + ' icon has no nested badge').toBe('rgba(0, 0, 0, 0)');
        expect(button.iconBorder, brand.brand + ' icon has no nested border').toBe('0px');
        expect(button.iconRadius, brand.brand + ' icon has no badge radius').toBe('0px');
      }

      expect(geometry.activeBackground, brand.brand + ' active state remains unfilled').toBe('rgba(0, 0, 0, 0)');
      expect(geometry.activeBorderBottom).toBe('3px');
      expect(geometry.activeBorderBottomStyle).toBe('solid');
      expect(geometry.activeBorderBottomColor).toBe(brand.brand === 'coffee' ? 'rgb(18, 58, 107)' : 'rgb(192, 59, 42)');

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


test('desktop category navigation remains a compact vertical sidebar while the catalog keeps its responsive column count', async ({ page }, testInfo) => {
  const viewports = [
    { width: 1024, height: 768, columns: 2 },
    { width: 1440, height: 900, columns: 3 },
    { width: 1600, height: 1000, columns: 4 },
  ];

  for (const brand of CASES) {
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
      await page.goto('/?brand=' + brand.brand, { waitUntil: 'domcontentloaded' });

      const rail = page.locator(brand.rail);
      const grid = page.locator(brand.brand === 'coffee' ? '#grid' : '#deliveryGrid');
      await expect(rail).toBeVisible({ timeout: 10000 });
      await expect(grid.locator('.card').first()).toBeVisible({ timeout: 15000 });
      await expect.poll(() => rail.evaluate((element) => getComputedStyle(element).flexDirection), { timeout: 10000 })
        .toBe('column');

      const layout = await page.evaluate(({ railSelector, gridSelector }) => {
        const rail = document.querySelector(railSelector);
        const rect = rail.getBoundingClientRect();
        const style = getComputedStyle(rail);
        const gridStyle = getComputedStyle(document.querySelector(gridSelector));
        const activeButton = rail.querySelector('button.on');
        const activeStyle = activeButton ? getComputedStyle(activeButton) : null;
        const activeBackground = activeStyle && activeStyle.backgroundColor !== 'rgba(0, 0, 0, 0)'
          ? activeStyle.backgroundColor
          : getComputedStyle(rail).backgroundColor;
        const rgb = (value) => {
          const match = value.match(/[\d.]+/g);
          return match ? match.slice(0, 3).map(Number) : [0, 0, 0];
        };
        const luminance = (value) => {
          const channels = rgb(value).map((channel) => {
            const normalized = channel / 255;
            return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
          });
          return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
        };
        const contrast = activeStyle
          ? (() => {
              const values = [luminance(activeStyle.color), luminance(activeBackground)].sort((a, b) => b - a);
              return (values[0] + 0.05) / (values[1] + 0.05);
            })()
          : 0;
        return {
          parentIsWrap: rail.parentElement === document.querySelector('.wrap'),
          activeColor: activeStyle ? activeStyle.color : null,
          activeBackground,
          contrast,
          direction: style.flexDirection,
          position: style.position,
          width: rect.width,
          height: rect.height,
          gridColumns: gridStyle.gridTemplateColumns.split(' ').filter(Boolean).length,
        };
      }, {
        railSelector: brand.rail,
        gridSelector: brand.brand === 'coffee' ? '#grid' : '#deliveryGrid',
      });

      expect(layout.parentIsWrap, brand.brand + ' desktop rail belongs to the desktop sidebar grid').toBe(true);
      expect(layout.direction, brand.brand + ' desktop categories remain vertical').toBe('column');
      expect(layout.position).toBe('relative');
      expect(layout.height, brand.brand + ' sidebar is sized to its own categories').toBeLessThan(480);
      expect(layout.contrast, brand.brand + ' selected desktop category text has WCAG AA contrast on its active surface').toBeGreaterThanOrEqual(4.5);
      expect(layout.gridColumns).toBe(viewport.columns);

      await testInfo.attach(brand.brand + '-desktop-' + viewport.width + 'x' + viewport.height + '-vertical-categories', {
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
    window.scrollTo({ top: 460, behavior: 'instant' });
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

test('delivery desktop rail realigns with the filtered catalog after category changes', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
  await page.goto('/?brand=delivery', { waitUntil: 'domcontentloaded' });

  const rail = page.locator('#deliveryRail');
  const tabs = rail.locator('button');
  const grid = page.locator('#deliveryGrid');
  await expect(rail).toBeVisible({ timeout: 10000 });
  await expect(tabs).toHaveCount(5);
  await expect(grid.locator('.card').first()).toBeVisible({ timeout: 15000 });
  await testInfo.attach('delivery-desktop-rail-before-category-switch', {
    body: await page.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  });

  // Sets contain four products, so the secondary ingredient filter is absent.
  // This keeps the catalog populated while exercising the rail's vertical realignment.
  await tabs.nth(2).click();
  await expect(tabs.nth(2)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#deliverySubFilter')).toBeHidden();
  await expect(grid.locator('.card').first()).toBeVisible({ timeout: 15000 });
  await testInfo.attach('delivery-desktop-rail-after-category-switch', {
    body: await page.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  });

  await expect.poll(async () => {
    const [railBox, gridBox] = await Promise.all([rail.boundingBox(), grid.boundingBox()]);
    return railBox && gridBox ? Math.abs(railBox.y - gridBox.y) : Number.POSITIVE_INFINITY;
  }, { timeout: 3000 }).toBeLessThanOrEqual(1);
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



test('delivery: switching sauces and drinks keeps the subfilter slot and desktop rail anchored', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
  await page.goto('/?brand=delivery', { waitUntil: 'domcontentloaded' });

  const rail = page.locator('#deliveryRail');
  const grid = page.locator('#deliveryGrid');
  await expect(rail).toBeVisible({ timeout: 10000 });
  await expect(grid.locator('.card').first()).toBeVisible({ timeout: 15000 });

  const measure = () => page.evaluate(() => {
    const railRect = document.querySelector('#deliveryRail').getBoundingClientRect();
    const gridRect = document.querySelector('#deliveryGrid').getBoundingClientRect();
    const slot = document.querySelector('#deliverySubFilterViewport');
    const slotRect = slot.getBoundingClientRect();
    return {
      railTop: railRect.top,
      gridTop: gridRect.top,
      slotTop: slotRect.top,
      slotHeight: slotRect.height,
      slotDisplay: getComputedStyle(slot).display,
    };
  });

  await rail.locator('[data-dcat="sauces"]').click();
  await expect(page.locator('#deliverySubFilter')).toBeVisible();
  await expect(grid.locator('.card').first()).toBeVisible({ timeout: 15000 });
  const sauces = await measure();
  await testInfo.attach('delivery-sauces-category-geometry', {
    body: await page.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  });

  await rail.locator('[data-dcat="drinks"]').click();
  await expect(page.locator('#deliverySubFilter')).toBeHidden();
  // The test seed may intentionally have no drinks; category emptiness must not affect layout.
  await expect(grid).toBeVisible();
  const drinks = await measure();
  await testInfo.attach('delivery-drinks-category-geometry', {
    body: await page.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  });

  expect(sauces.slotDisplay).not.toBe('none');
  expect(drinks.slotDisplay).not.toBe('none');
  expect(drinks.slotHeight).toBeGreaterThanOrEqual(68);
  expect(Math.abs(drinks.gridTop - sauces.gridTop), 'the catalog must not jump when secondary filters disappear').toBeLessThanOrEqual(1);
  expect(Math.abs(drinks.railTop - sauces.railTop), 'the desktop category rail must remain anchored').toBeLessThanOrEqual(1);
});
