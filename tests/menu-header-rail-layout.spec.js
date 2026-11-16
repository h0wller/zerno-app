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
          railBottom: railRect.bottom,
          railHeight: railRect.height,
          railLeft: railRect.left,
          railRight: railRect.right,
          railWidth: railRect.width,
          railBottomGap: window.innerHeight - railRect.bottom,
          safeAreaInset: (() => {
            const probe = document.createElement('div');
            probe.style.cssText = 'position:fixed;visibility:hidden;padding-bottom:env(safe-area-inset-bottom,0px)';
            document.body.appendChild(probe);
            const value = parseFloat(getComputedStyle(probe).paddingBottom) || 0;
            probe.remove();
            return value;
          })(),
          railTotalHeight: (() => {
            const probe = document.createElement('div');
            probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;width:0;height:var(--rail-total-h)';
            document.body.appendChild(probe);
            const value = probe.getBoundingClientRect().height;
            probe.remove();
            return value;
          })(),
          viewportHeight: window.innerHeight,
          railPosition: getComputedStyle(railEl).position,
          headBottom: headRect.bottom,
          contentLeft: wrapRect.left + parseFloat(wrapStyle.borderLeftWidth) + parseFloat(wrapStyle.paddingLeft),
          contentRight: wrapRect.right - parseFloat(wrapStyle.borderRightWidth) - parseFloat(wrapStyle.paddingRight),
          documentWidth: document.documentElement.clientWidth,
          documentScrollWidth: document.documentElement.scrollWidth,
        };
      }, { headSelector: brand.head, railSelector: brand.rail });

      if (horizontalRail) {
        expect(layout.railPosition, 'mobile and short-landscape rail is fixed to the viewport')
          .toBe('fixed');
        expect(layout.railBottomGap, 'floating rail keeps a 10–12px gap plus safe-area')
          .toBeGreaterThanOrEqual(10 + layout.safeAreaInset);
        expect(layout.railBottomGap).toBeLessThanOrEqual(12 + layout.safeAreaInset);
        expect(layout.railLeft).toBeGreaterThanOrEqual(12);
        expect(layout.railRight).toBeLessThanOrEqual(layout.documentWidth - 12);
        expect(layout.railWidth).toBeLessThanOrEqual(layout.documentWidth - 24);
        expect(layout.railTotalHeight).toBeCloseTo(layout.railHeight + layout.railBottomGap, 0);
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

      await page.evaluate(() => window.scrollTo(0, 500));
      if (horizontalRail) {
        await expect.poll(() => page.evaluate(selector => {
          const element = document.querySelector(selector);
          const rect = element.getBoundingClientRect();
          const probe = document.createElement('div');
          probe.style.cssText = 'position:fixed;visibility:hidden;padding-bottom:env(safe-area-inset-bottom,0px)';
          document.body.appendChild(probe);
          const safeAreaInset = parseFloat(getComputedStyle(probe).paddingBottom) || 0;
          probe.remove();
          return {
            position: getComputedStyle(element).position,
            bottomGap: window.innerHeight - rect.bottom,
            safeAreaInset,
            left: rect.left,
            right: rect.right,
            height: rect.height,
            pinClass: element.classList.contains('rail-is-pinned'),
            spacerCount: element.parentElement.querySelectorAll(':scope > .rail-pin-spacer').length,
          };
        }, brand.rail), { timeout: 5000 }).toMatchObject({
          position: 'fixed',
          height: viewport.height <= 480 ? 48 : 56,
          pinClass: false,
          spacerCount: 0,
        });
        const floatingState = await rail.evaluate(element => {
          const rect = element.getBoundingClientRect();
          const probe = document.createElement('div');
          probe.style.cssText = 'position:fixed;visibility:hidden;padding-bottom:env(safe-area-inset-bottom,0px)';
          document.body.appendChild(probe);
          const safeAreaInset = parseFloat(getComputedStyle(probe).paddingBottom) || 0;
          probe.remove();
          return { bottomGap: window.innerHeight - rect.bottom, safeAreaInset, left: rect.left, right: rect.right };
        });
        expect(floatingState.bottomGap).toBeGreaterThanOrEqual(10 + floatingState.safeAreaInset);
        expect(floatingState.bottomGap).toBeLessThanOrEqual(12 + floatingState.safeAreaInset);
        expect(floatingState.left).toBeGreaterThanOrEqual(12);
        expect(floatingState.right).toBeLessThanOrEqual(viewport.width - 12);
        const fixedTopAt500 = await rail.evaluate(el => el.getBoundingClientRect().top);
        await page.evaluate(() => window.scrollTo(0, 700));
        await expect.poll(() => rail.evaluate(el => el.getBoundingClientRect().top), { timeout: 5000 })
          .toBeCloseTo(fixedTopAt500, 0);
        await expect(rail).toBeVisible();
        await expect(rail).not.toHaveClass(/rail-is-pinned/);
        await expect(rail).toHaveCSS('position', 'fixed');
        await expect(rail).not.toHaveCSS('transform', 'none');
        await testInfo.attach(brand.brand + '-bottom-rail-' + viewport.width + 'x' + viewport.height, {
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
          railOverflowX: railStyle.overflowX,
          railOverflowY: railStyle.overflowY,
          scrollWidth: rail.scrollWidth,
          clientWidth: rail.clientWidth,
          bottomGap: window.innerHeight - railRect.bottom,
          safeAreaInset: (() => {
            const probe = document.createElement('div');
            probe.style.cssText = 'position:fixed;visibility:hidden;padding-bottom:env(safe-area-inset-bottom,0px)';
            document.body.appendChild(probe);
            const value = parseFloat(getComputedStyle(probe).paddingBottom) || 0;
            probe.remove();
            return value;
          })(),
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          documentWidth: document.documentElement.scrollWidth,
          buttonCount: buttons.length,
          buttons,
          activeBackground: activeStyle?.backgroundColor ?? null,
          activeBorderBottom: activeStyle?.borderBottomWidth ?? null,
          activeBorderBottomColor: activeStyle?.borderBottomColor ?? null,
          activeBorderBottomStyle: activeStyle?.borderBottomStyle ?? null,
          filterTop: filterRect?.top ?? null,
          filterBottom: filterRect?.bottom ?? null,
        };
      }, {
        railSelector: brand.rail,
        gridSelector: brand.brand === 'coffee' ? '#grid' : '#deliveryGrid',
        headSelector: brand.head,
        brandName: brand.brand,
      });

      expect(geometry.parentIsView, brand.brand + ' rail stays below the search in its menu view').toBe(true);
      expect(geometry.direction, brand.brand + ' categories form one horizontal row').toBe('row');
      expect(geometry.railLeft, brand.brand + ' capsule keeps a 12px viewport inset').toBeGreaterThanOrEqual(12);
      expect(geometry.railRight, brand.brand + ' capsule keeps a 12px viewport inset').toBeLessThanOrEqual(geometry.viewportWidth - 12);
      expect(geometry.railWidth, brand.brand + ' capsule is capped to viewport width minus 24px').toBeLessThanOrEqual(geometry.viewportWidth - 24);
      expect(geometry.bottomGap, brand.brand + ' capsule floats 10–12px above safe-area').toBeGreaterThanOrEqual(10 + geometry.safeAreaInset);
      expect(geometry.bottomGap).toBeLessThanOrEqual(12 + geometry.safeAreaInset);
      expect(geometry.railHeight).toBe(geometry.viewportHeight <= 480 ? 48 : 56);
      expect(geometry.railRadius, brand.brand + ' rail uses a capsule surface').toBe('26px');
      expect(geometry.railOverflowX).toBe('auto');
      expect(geometry.railOverflowY).toBe('hidden');
      expect(geometry.background, brand.brand + ' uses its own category surface').not.toBe('rgba(0, 0, 0, 0)');
      expect(geometry.border, brand.brand + ' rail has no enclosing frame').toBe('0px');
      expect(geometry.shadow, brand.brand + ' floating capsule has subtle elevation').not.toBe('none');
      expect(geometry.scrollWidth, brand.brand + ' rail content is at least as wide as its visible viewport').toBeGreaterThanOrEqual(geometry.clientWidth);
      expect(geometry.documentWidth, brand.brand + ' menu does not create page-wide horizontal overflow').toBeLessThanOrEqual(geometry.viewportWidth + 1);
      expect(geometry.buttonCount).toBeGreaterThan(1);

      const buttonWidths = geometry.buttons.map((button) => button.width);
      expect(Math.min(...buttonWidths), brand.brand + ' category targets keep a 60px minimum width').toBeGreaterThanOrEqual(60);
      expect(geometry.buttons[0].left, brand.brand + ' first category sits inside the capsule padding').toBeGreaterThanOrEqual(geometry.railLeft + 5);

      for (const button of geometry.buttons) {
        expect(button.direction, brand.brand + ' icon sits above its category label').toBe('column');
        expect(button.height, brand.brand + ' category is a usable tap target').toBeGreaterThanOrEqual(44);
        expect(button.radius, brand.brand + ' category uses a compact selected-state pill shape').toBe('20px');
        if (!button.active) {
          expect(button.background, brand.brand + ' inactive category remains visually quiet').toBe('rgba(0, 0, 0, 0)');
        } else {
          expect(button.background, brand.brand + ' selected category uses a filled state').not.toBe('rgba(0, 0, 0, 0)');
        }
        expect(button.borderTop, brand.brand + ' category has no extra top border').toBe('0px');
        expect(button.iconBackground, brand.brand + ' icon does not carry a duplicate selected chip').toBe('rgba(0, 0, 0, 0)');
        expect(button.iconBorder, brand.brand + ' icon has no frame').toBe('0px');
        expect(button.iconRadius, brand.brand + ' icon keeps its brand-specific shape')
          .toBe(brand.brand === 'coffee' ? '50%' : '8px');
      }

      expect(geometry.activeBackground, brand.brand + ' selected tab is filled').not.toBe('rgba(0, 0, 0, 0)');
      expect(geometry.activeBorderBottom, brand.brand + ' selected tab has no legacy underline').toBe('0px');

      if (geometry.filterTop !== null) {
        expect(geometry.filterBottom, 'delivery secondary filters remain above the floating rail').toBeLessThanOrEqual(geometry.railTop + 1);
      }

      await testInfo.attach(brand.brand + '-' + viewport.name.replaceAll(' ', '-') + '-category-tabs', {
        body: await page.screenshot({ animations: 'disabled' }),
        contentType: 'image/png',
      });
    }
  }
});


test('desktop category navigation uses one rail surface and a selected icon chip', async ({ page }, testInfo) => {
  const viewports = [
    { width: 821, height: 900, columns: 3 },
    { width: 1024, height: 768, columns: 3 },
    { width: 1180, height: 900, columns: 3 },
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
          iconWidth: active.querySelector('.re').getBoundingClientRect().width,
          iconHeight: active.querySelector('.re').getBoundingClientRect().height,
        };
      });

      const columns = await grid.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length);
      expect(layout.position).toBe('relative');
      expect(layout.width).toBeLessThanOrEqual(80);
      expect(layout.height).toBeLessThan(480);
      expect(layout.railBackground).not.toBe('rgba(0, 0, 0, 0)');
      expect(layout.railBorder).toBe('0px');
      expect(layout.radius).toBe('16px');
      expect(layout.activeBackground).toBe('rgba(0, 0, 0, 0)');
      expect(layout.activeBorder).toBe('0px');
      expect(layout.activeRadius).toBe('0px');
      expect(layout.contrast, brand.brand + ' selected desktop category text keeps WCAG AA contrast').toBeGreaterThanOrEqual(4.5);
      expect(layout.iconBackground).not.toBe('rgba(0, 0, 0, 0)');
      expect(layout.iconRadius).toBe(brand.brand === 'coffee' ? '50%' : '8px');
      expect(layout.iconWidth).toBe(32);
      expect(layout.iconHeight).toBe(32);
      expect(columns).toBe(viewport.columns);

      await testInfo.attach(brand.brand + '-desktop-' + viewport.width + 'x' + viewport.height + '-single-frame-rail', {
        body: await page.screenshot({ animations: 'disabled' }),
        contentType: 'image/png',
      });
    }
  }
});


test('short landscape category tabs use a detached floating capsule', async ({ page }, testInfo) => {
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
          railBottom: railRect.bottom,
          railHeight: railRect.height,
          railWidth: railRect.width,
          bottomGap: window.innerHeight - railRect.bottom,
          railTotalHeight: (() => {
            const probe = document.createElement('div');
            probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;width:0;height:var(--rail-total-h)';
            document.body.appendChild(probe);
            const value = probe.getBoundingClientRect().height;
            probe.remove();
            return value;
          })(),
          gridLeft: gridRect.left,
          gridRight: gridRect.right,
          buttonWidths: [...rail.querySelectorAll('button')].map((button) => button.getBoundingClientRect().width),
          scrollWidth: rail.scrollWidth,
          clientWidth: rail.clientWidth,
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: document.documentElement.clientWidth,
          viewportHeight: window.innerHeight,
        };
      }, { railSelector: brand.rail, gridSelector: brand.brand === 'coffee' ? '#grid' : '#deliveryGrid' });

      expect(layout.parentIsMenu).toBe(true);
      expect(layout.direction).toBe('row');
      expect(layout.railLeft).toBeGreaterThanOrEqual(12);
      expect(layout.railRight).toBeLessThanOrEqual(layout.viewportWidth - 12);
      expect(layout.railWidth).toBeLessThanOrEqual(layout.viewportWidth - 24);
      expect(layout.bottomGap).toBeGreaterThanOrEqual(10);
      expect(layout.bottomGap).toBeLessThanOrEqual(12);
      expect(layout.railHeight).toBe(48);
      expect(layout.railTotalHeight).toBeCloseTo(layout.railHeight + layout.bottomGap, 0);
      expect(Math.min(...layout.buttonWidths)).toBeGreaterThanOrEqual(60);
      expect(layout.scrollWidth).toBeGreaterThanOrEqual(layout.clientWidth);
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
          activeTextColor: buttonStyle.color,
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
    expect(style.railBorder, brand.brand + ' desktop rail has no frame').toBe('0px');
    expect(style.railShadow, brand.brand + ' desktop rail avoids a heavy decorative shadow').toBe('none');
    expect(style.buttonBackground, brand.brand + ' active category has no tab fill').toBe('rgba(0, 0, 0, 0)');
    expect(style.buttonBorder, brand.brand + ' active category has no frame').toBe('0px');
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
    await expect.poll(() => rail.evaluate((el) => {
        const railRect = el.getBoundingClientRect();
        const lastRect = el.querySelector('button:last-child').getBoundingClientRect();
        return lastRect.right <= railRect.right + 1 && lastRect.left >= railRect.left - 1;
      })).toBe(true);
  }
});


test('switching delivery categories scrolls content below the sticky topbar without moving the floating rail', async ({ page }, testInfo) => {
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

  const after = await page.evaluate(() => {
    const rail = document.querySelector('#deliveryRail').getBoundingClientRect();
    const topbar = document.querySelector('header.topbar').getBoundingClientRect();
    const subfilters = document.querySelector('#deliverySubFilterViewport');
    const subfiltersVisible = !!subfilters && !subfilters.hidden &&
      getComputedStyle(subfilters).display !== 'none' &&
      subfilters.getBoundingClientRect().height > 0;
    const content = subfiltersVisible ? subfilters : document.querySelector('#deliveryGrid');
    return {
      scrollY: window.scrollY,
      railTop: rail.top,
      railBottom: rail.bottom,
      railBottomGap: window.innerHeight - rail.bottom,
      contentTop: content.getBoundingClientRect().top,
      viewportTop: topbar.bottom + 12,
    };
  });
  await testInfo.attach('delivery-category-switch-after', {
    body: await page.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  });

  expect(Math.abs(after.railTop - before.railTop)).toBeLessThanOrEqual(1);
  expect(after.railBottomGap).toBe(10);
  expect(Math.abs(after.contentTop - after.viewportTop),
    'selected delivery content starts below the sticky topbar + 12px').toBeLessThanOrEqual(3);
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
  const menuHead = page.locator('#deliveryView .menu-head');
  await expect(rail).toBeVisible({ timeout: 10000 });
  await expect(filters).toBeVisible({ timeout: 15000 });
  await expect(rail.locator('button')).toHaveCount(5);
  const filterPillRadius = await filters.evaluate((element) => getComputedStyle(element, '::before').borderTopLeftRadius);
  expect(filterPillRadius).toContain('999');
  await expect(filters).toHaveCSS('min-height', '44px');

  const [railRect, filterRect, headRect] = await Promise.all([
    rail.boundingBox(),
    filters.boundingBox(),
    menuHead.boundingBox(),
  ]);
  expect(railRect && filterRect && headRect).not.toBeNull();
  expect(filterRect.y).toBeGreaterThan(headRect.y + headRect.height - 1);
  expect(filterRect.y + filterRect.height).toBeLessThanOrEqual(railRect.y);
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



test('category rail uses one surface and viewport-appropriate selected treatment', async ({ page }) => {
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

      const horizontalRail = usesHorizontalRail(viewport);
      const rail = page.locator(brand === 'coffee' ? '#rail' : '#deliveryRail');
      await expect(rail).toBeVisible({ timeout: 10000 });
      await page.addStyleTag({ content: '*,:before,:after{transition:none!important;animation:none!important}' });
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
          activeTextColor: buttonStyle.color,
          fontFamily: buttonStyle.fontFamily,
          fontSize: parseFloat(buttonStyle.fontSize),
          railHeight: element.getBoundingClientRect().height,
          buttonHeight: button.getBoundingClientRect().height,
        };
      });

      expect(styles.iconRect.width, brand + ' icon chip must have a fixed square width').toBeGreaterThanOrEqual(20);
      expect(styles.iconRect.width, brand + ' icon chip must be square').toBeCloseTo(styles.iconRect.height, 1);
      if (viewport.width >= 821 && viewport.height > 480) {
        expect(styles.iconRect.width, brand + ' desktop icon chip must be 32px').toBe(32);
      }
      expect(styles.iconRadius, brand + ' active icon shape must be brand-specific').toBe(brand === 'coffee' ? '50%' : '8px');
      expect(styles.inactiveIconBackground, brand + ' inactive icon must not have a chip').toBe('rgba(0, 0, 0, 0)');
      expect(styles.inactiveIconBorder, brand + ' inactive icon must not have a border').toBe('0px');
      expect(styles.buttonBorder, brand + ' active tab must not have a frame').toBe('0px');
      expect(styles.buttonBorderBottom, brand + ' active tab must not use border-bottom').toBe('0px');
      expect(styles.inactiveBackground, brand + ' inactive tab must not have a fill').toBe('rgba(0, 0, 0, 0)');
      expect(styles.inactiveBorder, brand + ' inactive tab must not have a frame').toBe('0px');
      if (horizontalRail) {
        expect(styles.iconBackground, brand + ' selected icon does not duplicate the tab fill').toBe('rgba(0, 0, 0, 0)');
        expect(styles.buttonBackground, brand + ' selected tab uses a filled state').not.toBe('rgba(0, 0, 0, 0)');
        expect(styles.buttonRadius).toBe('20px');
        expect(styles.pseudo.content).toBe('none');
        expect(styles.pseudo.display).toBe('none');
        expect(styles.railHeight).toBe(viewport.height <= 480 ? 48 : 56);
        expect(styles.buttonHeight).toBe(44);
      } else {
        expect(styles.iconBackground, brand + ' desktop active icon keeps its brand chip').not.toBe('rgba(0, 0, 0, 0)');
        expect(styles.buttonBackground, brand + ' desktop active tab stays unfilled').toBe('rgba(0, 0, 0, 0)');
        expect(styles.buttonRadius).toBe('0px');
        expect(styles.pseudo.content).not.toBe('none');
        expect(styles.pseudo.display).not.toBe('none');
        expect(parseFloat(styles.pseudo.width)).toBe(28);
        expect(parseFloat(styles.pseudo.height)).toBe(3);
        expect(styles.pseudo.radius).toBe('2px');
        expect(styles.railHeight, 'desktop category sidebar contains its tab targets').toBeGreaterThan(styles.buttonHeight);
      }
      expect(styles.fontFamily).toMatch(/system-ui|sans-serif/);
      const rgb = styles.activeTextColor.match(/[0-9.]+/g).map(Number);
      const luminance = rgb.slice(0, 3).map(value => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      const textLuminance = 0.2126 * luminance[0] + 0.7152 * luminance[1] + 0.0722 * luminance[2];
      const contrastBackground = horizontalRail ? styles.buttonBackground : styles.railBackground;
      const bgRgb = contrastBackground.match(/[0-9.]+/g).map(Number);
      const bgLum = bgRgb.slice(0, 3).map(value => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      const bgLuminance = 0.2126 * bgLum[0] + 0.7152 * bgLum[1] + 0.0722 * bgLum[2];
      const contrast = (Math.max(textLuminance, bgLuminance) + 0.05) / (Math.min(textLuminance, bgLuminance) + 0.05);
      expect(contrast, brand + ' active label must meet WCAG AA').toBeGreaterThanOrEqual(4.5);
      expect(styles.fontSize).toBeGreaterThanOrEqual(10);
    }
  }
});


// Horizontal rail baseline diagnostics for the two-phase CI capture.

test('coffee active rail background diagnostic reports token and matching CSS rules', async ({ page }, testInfo) => {
  const reports = [];
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
    await page.goto('/?brand=coffee', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#rail button.on')).toBeVisible();
    await page.waitForFunction(() => {
      const sheet = [...document.styleSheets].find(item => item.href && item.href.includes('/150-rail.css'));
      if (!sheet) return false;
      try { return sheet.cssRules.length > 0; } catch { return false; }
    });
    const report = await page.locator('#rail button.on').evaluate(element => {
      const token = getComputedStyle(document.documentElement).getPropertyValue('--category-tab-active-bg').trim();
      const backgroundColor = getComputedStyle(element).backgroundColor;
      const matches = [];
      if (token !== backgroundColor) {
        const visit = (rules, href) => {
          for (const rule of Array.from(rules || [])) {
            if (rule.cssRules) { visit(rule.cssRules, href); continue; }
            if (!rule.selectorText || !rule.style) continue;
            let matched = false;
            try { matched = element.matches(rule.selectorText); } catch {}
            if (!matched) continue;
            const value = rule.style.getPropertyValue('background');
            if (!value) continue;
            matches.push({
              file: href || 'inline <style>',
              selector: rule.selectorText,
              value,
              important: rule.style.getPropertyPriority('background') === 'important',
            });
          }
        };
        for (const sheet of Array.from(document.styleSheets)) {
          try { visit(sheet.cssRules, sheet.href); } catch {}
        }
      }
      return { viewport: { width: innerWidth, height: innerHeight }, token, backgroundColor, matchingBackgroundRules: matches };
    });
    reports.push(report);
  }
  await testInfo.attach('coffee-active-rail-background-diagnostic.json', {
    body: Buffer.from(JSON.stringify(reports, null, 2)),
    contentType: 'application/json',
  });
});

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
  const colorSnapshot = snapshot => {
    const keys = ['rail', 'button', 'active', 'inactive', 'icon', 'activeIcon', 'inactiveIcon'];
    return Object.fromEntries(keys.map(key => {
      const item = snapshot.computed[key];
      return [key, item && {
        backgroundColor: item.backgroundColor,
        color: item.color,
        borderTopColor: item.borderTopColor,
        borderBottomColor: item.borderBottomColor,
        borderRadius: item.borderRadius,
      }];
    }));
  };

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
      const cardSelector = brand.brand === 'coffee' ? '#grid > article.card' : '#deliveryGrid > .card';
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
      await expect(page.locator(cardSelector).first()).toBeVisible({ timeout: 15000 });
      const firstFrame=await measure();
      expect(firstFrame.firstCardRect?.width, `${brand.brand} ${viewport.name}: first-frame card rect must be measured`).toBeGreaterThan(0);
      expect(firstFrame.firstCardRect?.height, `${brand.brand} ${viewport.name}: first-frame card rect must be measured`).toBeGreaterThan(0);
      releaseStyles();
      await expect.poll(() => page.evaluate(() => Array.from(document.querySelectorAll('link[rel="stylesheet"]')).some(link =>
        link.href.includes('/app/ui/theme/150-rail.css') && link.media==='all'
      )), { timeout:15000 }).toBe(true);
      await page.evaluate(() => document.fonts && document.fonts.ready);
      await expect(page.locator(cardSelector).first()).toBeVisible({ timeout: 15000 });
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

      if (usesHorizontalRail(viewport)) {
        expect(hydrated.computed.rail.rect.height,
          `${brand.brand} ${viewport.name}: capsule surface height`).toBe(viewport.height <= 480 ? 48 : 56);
        expect(hydrated.computed.button.rect.height,
          `${brand.brand} ${viewport.name}: category hit target height`).toBe(44);
      } else {
        expect(Math.abs(hydrated.computed.rail.rect.height-hydrated.computed.button.rect.height),
          `${brand.brand} ${viewport.name}: desktop rail and button heights match`).toBeLessThanOrEqual(0.5);
      }
      expect(hydrated.computed.active.borderBottomWidth,
        `${brand.brand} ${viewport.name}: active tab must not use bottom border`).toBe('0px');
      expect(hydrated.iconTopSpread,
        `${brand.brand} ${viewport.name}: all icon tops must align`).toBeLessThanOrEqual(1);
      expect(parseFloat(hydrated.computed.button.fontSize),
        `${brand.brand} ${viewport.name}: label font size minimum`).toBeGreaterThanOrEqual(10);
      expect(hydrated.firstCardRect?.width, `${brand.brand} ${viewport.name}: first card rect must be measured`).toBeGreaterThan(0);
      expect(hydrated.firstCardRect?.height, `${brand.brand} ${viewport.name}: first card rect must be measured`).toBeGreaterThan(0);
      expect(hydrated.computed.inactive.backgroundColor, `${brand.brand} ${viewport.name}: inactive button has no fill`).toBe('rgba(0, 0, 0, 0)');
      expect(hydrated.computed.inactiveIcon.backgroundColor, `${brand.brand} ${viewport.name}: inactive icon has no chip`).toBe('rgba(0, 0, 0, 0)');
      if (usesHorizontalRail(viewport)) {
        expect(hydrated.activeAfter.content, `${brand.brand} ${viewport.name}: mobile selected state has no underline`).toBe('none');
        expect(hydrated.computed.button.backgroundColor,
          `${brand.brand} ${viewport.name}: selected category uses a filled tab`).not.toBe('rgba(0, 0, 0, 0)');
      } else {
        expect(hydrated.activeAfter.content, `${brand.brand} ${viewport.name}: desktop active underline exists`).not.toBe('none');
        expect(hydrated.activeAfter.height, `${brand.brand} ${viewport.name}: desktop underline height`).toBe('3px');
        expect(hydrated.activeAfter.width, `${brand.brand} ${viewport.name}: desktop underline width`).toBe('28px');
        expect(hydrated.activeAfter.borderRadius, `${brand.brand} ${viewport.name}: desktop underline radius`).toBe('2px');
      }
      expect(firstFrame.computed.button.fontFamily, `${brand.brand} ${viewport.name}: first-frame font fallback is generic`).toMatch(/system-ui|sans-serif/);
      expect(hydrated.computed.button.fontFamily, `${brand.brand} ${viewport.name}: hydrated font fallback is generic`).toMatch(/system-ui|sans-serif/);
      expect(hydrated.fonts.golosText, 'Golos Text font check').toBe(true);
      expect(hydrated.fonts.loadedFaces.length, 'loaded FontFace list is present').toBeGreaterThan(0);
      expect(colorSnapshot(hydrated), `${brand.brand} ${viewport.name}: hydrated colors remain stable after 200ms`).toEqual(colorSnapshot(hydratedAfter200ms));
      if (viewport.width <= 820 && viewport.height > 480) {
        expect(Math.abs(firstFrame.regions.rail.top - hydrated.regions.rail.top),
          `${brand.brand} ${viewport.name}: first-frame rail top matches hydrated within 2px`).toBeLessThanOrEqual(2);
      }
    }
  }
  await context.close();
  await testInfo.attach('horizontal-rail-baseline-diagnostics.json',{
    body:Buffer.from(JSON.stringify(reports,null,2)),contentType:'application/json',
  });
});


test('catalog grid uses three columns from 821px through 1180px for both brands', async ({ page }) => {
  const viewports = [
    { width: 820, height: 1024, columns: 2 },
    { width: 821, height: 900, columns: 3 },
    { width: 1024, height: 768, columns: 3 },
    { width: 1180, height: 900, columns: 3 },
    { width: 1181, height: 900, columns: 3 },
  ];

  for (const brand of CASES) {
    const selector = brand.brand === 'coffee' ? '#grid' : '#deliveryGrid';
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
      await page.goto('/?brand=' + brand.brand, { waitUntil: 'domcontentloaded' });
      const grid = page.locator(selector);
      await expect(grid.locator('.card').first()).toBeVisible({ timeout: 15000 });
      const columns = await grid.evaluate(element =>
        getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length
      );
      expect(columns, brand.brand + ' catalog columns at ' + viewport.width + 'px').toBe(viewport.columns);
    }
  }
});


test('desktop wrap expands to a centered 2560px maximum on wide viewports', async ({ page }) => {
  for (const brand of CASES) {
    for (const width of [1480, 1481, 1920, 2800, 3840]) {
      await page.setViewportSize({ width, height: 1080 });
      await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
      await page.goto('/?brand=' + brand.brand, { waitUntil: 'domcontentloaded' });
      const layout = await page.locator('body > div.wrap').evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          width: rect.width,
          left: rect.left,
          right: rect.right,
          maxWidth: style.maxWidth,
          viewportClientWidth: document.documentElement.clientWidth,
          marginLeft: style.marginLeft,
          marginRight: style.marginRight,
        };
      });
      if (width <= 1480) {
        expect(layout.maxWidth).toBe('1480px');
      } else {
        expect(layout.maxWidth).toBe('2560px');
      }
      if (width >= 2800) {
        const expectedWidth = Math.min(2560, layout.viewportClientWidth);
        const expectedLeft = (layout.viewportClientWidth - expectedWidth) / 2;
        expect(Math.abs(layout.width - expectedWidth), brand.brand + ' wrap width at ' + width + 'px').toBeLessThanOrEqual(1);
        expect(Math.abs(layout.left - expectedLeft), brand.brand + ' wrap centering at ' + width + 'px').toBeLessThanOrEqual(1);
        expect(Math.abs(layout.right - (expectedLeft + expectedWidth)), brand.brand + ' wrap right edge at ' + width + 'px').toBeLessThanOrEqual(1);
      }
    }
  }
});

test('vertical scrolling does not create an empty reserved gutter or shift layout', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?brand=coffee', { waitUntil: 'domcontentloaded' });
  const geometry = await page.evaluate(async () => {
    const root = document.documentElement;
    const wrap = document.querySelector('body > div.wrap');
    document.body.style.minHeight = '0';
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const before = {
      clientWidth: root.clientWidth,
      wrapLeft: wrap.getBoundingClientRect().left,
      wrapWidth: wrap.getBoundingClientRect().width,
    };
    document.body.style.minHeight = '200vh';
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return {
      before,
      after: {
        clientWidth: root.clientWidth,
        wrapLeft: wrap.getBoundingClientRect().left,
        wrapWidth: wrap.getBoundingClientRect().width,
      },
      hasVerticalScroll: root.scrollHeight > root.clientHeight,
      overflowY: getComputedStyle(root).overflowY,
      scrollbarGutter: getComputedStyle(root).scrollbarGutter,
    };
  });
  expect(geometry.hasVerticalScroll).toBe(true);
  expect(geometry.overflowY).toBe('scroll');
  expect(geometry.scrollbarGutter).toBe('auto');
  expect(geometry.after.clientWidth).toBe(geometry.before.clientWidth);
  expect(Math.abs(geometry.after.wrapLeft - geometry.before.wrapLeft)).toBeLessThanOrEqual(1);
  expect(Math.abs(geometry.after.wrapWidth - geometry.before.wrapWidth)).toBeLessThanOrEqual(1);
});


test('ticker always moves, fills wide viewports seamlessly, and toggles pause without a visible control', async ({ page }) => {
  for (const brand of ['coffee', 'delivery']) {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
    await page.goto('/?brand=' + brand, { waitUntil: 'domcontentloaded' });
    const ticker = page.locator('.ticker');
    const viewport = page.locator('.tickerViewport');
    const track = page.locator('#tickerTrack');
    await expect(ticker).toBeVisible({ timeout: 10000 });
    await expect.poll(() => track.evaluate(el => {
      const groups = [...el.querySelectorAll('.tickerGroup')];
      return groups.length >= 2 && el.getBoundingClientRect().width >= el.parentElement.clientWidth * 2;
    }), { timeout: 5000 }).toBe(true);
    await expect.poll(() => track.evaluate(el => getComputedStyle(el).animationName)).toBe('zt-marquee');
    await expect.poll(() => track.evaluate(el => getComputedStyle(el).animationPlayState)).toBe('running');

    await viewport.click();
    await expect(ticker).toHaveClass(/is-paused/);
    await expect.poll(() => track.evaluate(el => getComputedStyle(el).animationPlayState)).toBe('paused');

    await viewport.click();
    await expect(ticker).not.toHaveClass(/is-paused/);
    await expect.poll(() => track.evaluate(el => getComputedStyle(el).animationPlayState)).toBe('running');

    await viewport.focus();
    await page.keyboard.press('Space');
    await expect(ticker).toHaveClass(/is-paused/);
    await expect(viewport).toHaveAttribute('aria-pressed', 'true');
    await expect(viewport).toHaveAttribute('aria-label', 'Возобновить движение объявлений');
    await expect(viewport.locator('button, [role="button"]')).toHaveCount(0);
  }
});


test('mobile rail keeps its detached floating position after reload at a scrolled position', async ({ page }) => {
  for (const brand of CASES) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
    await page.goto('/?brand=' + brand.brand, { waitUntil: 'domcontentloaded' });
    const rail = page.locator(brand.rail);
    await expect(rail).toBeVisible({ timeout: 10000 });
    await page.evaluate(() => window.scrollTo(0, 700));
    await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 5000 })
      .toBeGreaterThan(100);
    await expect.poll(() => rail.evaluate(el => ({
      position: getComputedStyle(el).position,
      bottomGap: window.innerHeight - el.getBoundingClientRect().bottom,
      pinned: el.classList.contains('rail-is-pinned'),
    })), { timeout: 5000 }).toEqual({ position: 'fixed', bottomGap: 10, pinned: false });
    await page.reload({ waitUntil: 'load' });
    await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 5000 })
      .toBeGreaterThan(100);
    await expect.poll(() => rail.evaluate(el => ({
      position: getComputedStyle(el).position,
      bottomGap: window.innerHeight - el.getBoundingClientRect().bottom,
      pinned: el.classList.contains('rail-is-pinned'),
    })), { timeout: 5000 }).toEqual({ position: 'fixed', bottomGap: 10, pinned: false });
  }
});

test('manual category change returns new content below the sticky topbar while floating rail stays fixed', async ({ page }) => {
  for (const brand of CASES) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
    await page.goto('/?brand=' + brand.brand, { waitUntil: 'domcontentloaded' });

    const rail = page.locator(brand.rail);
    await expect(rail).toBeVisible({ timeout: 10000 });
    await page.evaluate(() => window.scrollTo(0, 700));
    await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 5000 })
      .toBeGreaterThan(300);
    await expect(rail).toHaveCSS('position', 'fixed');
    await expect(rail).not.toHaveClass(/rail-is-pinned/);

    const nextCategory = rail.locator('button').nth(1);
    await expect(nextCategory).toBeVisible();
    const categoryAttribute = brand.brand === 'delivery' ? 'data-dcat' : 'data-cat';
    const selectedCategory = await nextCategory.getAttribute(categoryAttribute);
    await nextCategory.click();
    await expect(rail.locator('button.on')).toHaveAttribute(categoryAttribute, selectedCategory);

    const contentSelector = brand.brand === 'delivery'
      ? '#deliverySubFilterViewport:not([hidden]), #deliveryGrid'
      : '#grid';
    await expect.poll(() => page.evaluate(({ contentSelector }) => {
      const content = document.querySelector(contentSelector);
      const topbar = document.querySelector('header.topbar');
      if (!content || !topbar) return false;
      return Math.abs(content.getBoundingClientRect().top -
        topbar.getBoundingClientRect().bottom - 12) <= 3;
    }, { contentSelector }), { timeout: 7000 }).toBe(true);
    const geometry = await page.evaluate(({ contentSelector, railSelector }) => {
      const contentRect = document.querySelector(contentSelector).getBoundingClientRect();
      const topbarRect = document.querySelector('header.topbar').getBoundingClientRect();
      const railRect = document.querySelector(railSelector).getBoundingClientRect();
      return {
        contentTop: contentRect.top,
        viewportTop: topbarRect.bottom + 12,
        railTop: railRect.top,
        railBottom: railRect.bottom,
        railBottomGap: window.innerHeight - railRect.bottom,
        scrollY: window.scrollY,
      };
    }, { contentSelector, railSelector: brand.rail });
    expect(Math.abs(geometry.contentTop - geometry.viewportTop),
      brand.brand + ' new content starts below the sticky topbar + 12px').toBeLessThanOrEqual(3);
    expect(geometry.railBottomGap).toBe(10);
    expect(geometry.scrollY, brand.brand + ' category selection leaves the previous deep scroll position')
      .toBeLessThan(600);
  }
});

test('late font hydration does not move the floating rail after manual category change', async ({ page }) => {
  for (const brand of CASES) {
    let releaseFonts;
    let fontRequestSeen = false;
    const fontsHeld = new Promise(resolve => { releaseFonts = resolve; });
    const fontRoute = /golos-text-400\.woff2(?:\?.*)?$/;

    await page.route(fontRoute, async route => {
      fontRequestSeen = true;
      await fontsHeld;
      await route.continue();
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
    await page.goto('/?brand=' + brand.brand, { waitUntil: 'domcontentloaded' });

    await expect.poll(() => fontRequestSeen, { timeout: 10000 }).toBe(true);
    await expect.poll(() => page.evaluate(() => document.fonts.status)).toBe('loading');

    const rail = page.locator(brand.rail);
    await expect(rail).toBeVisible({ timeout: 10000 });
    await expect(rail).toHaveCSS('position', 'fixed');
    await page.evaluate(() => window.scrollTo(0, 700));
    const nextCategory = rail.locator('button').nth(1);
    const categoryAttribute = brand.brand === 'delivery' ? 'data-dcat' : 'data-cat';
    const selectedCategory = await nextCategory.getAttribute(categoryAttribute);
    await nextCategory.click();
    await expect(rail.locator('button.on')).toHaveAttribute(categoryAttribute, selectedCategory);

    releaseFonts();
    await page.evaluate(() => document.fonts.ready);
    await expect.poll(() => rail.evaluate(el => ({
      position: getComputedStyle(el).position,
      bottomGap: window.innerHeight - el.getBoundingClientRect().bottom,
      pinned: el.classList.contains('rail-is-pinned'),
    }))).toEqual({ position: 'fixed', bottomGap: 10, pinned: false });
    await page.unroute(fontRoute);
  }
});

test('switching brands exposes only the active floating rail in both directions', async ({ page }, testInfo) => {
  for (const [fromBrand, toBrand] of [['delivery', 'coffee'], ['coffee', 'delivery']]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
    await page.goto('/?brand=' + fromBrand, { waitUntil: 'domcontentloaded' });

    const oldRailSelector = fromBrand === 'delivery' ? '#deliveryRail' : '#rail';
    const nextRailSelector = toBrand === 'delivery' ? '#deliveryRail' : '#rail';
    const oldRail = page.locator(oldRailSelector);
    const nextRail = page.locator(nextRailSelector);
    await expect(oldRail).toBeVisible({ timeout: 10000 });
    await page.evaluate(() => window.scrollTo(0, 700));
    await expect(oldRail).toHaveCSS('position', 'fixed');

    await page.locator('#venueToggle').click();
    await page.locator('#brandSeg button[data-brand="' + toBrand + '"]').click();
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.brand)).toBe(toBrand);
    await expect(nextRail).toBeVisible({ timeout: 10000 });
    await expect(oldRail).toBeHidden();
    await expect(nextRail).toHaveCSS('position', 'fixed');
    await expect(nextRail).not.toHaveClass(/rail-is-pinned/);
    const activeCategory = nextRail.locator('button').nth(1);
    await expect(activeCategory).toBeVisible();
    await activeCategory.click();
    await expect(activeCategory).toHaveAttribute('aria-pressed', 'true');
    await expect(oldRail).toBeHidden();

    const previousRailState = await oldRail.evaluate(el => ({
      pinned: el.classList.contains('rail-is-pinned'),
      parentSpacerCount: el.parentElement.querySelectorAll(':scope > .rail-pin-spacer').length,
      hasAdjacentSpacer: !!(el.previousElementSibling && el.previousElementSibling.classList.contains('rail-pin-spacer')),
      inlinePosition: el.style.position,
    }));
    expect(previousRailState.pinned).toBe(false);
    expect(previousRailState.inlinePosition).not.toBe('fixed');
    expect(previousRailState.parentSpacerCount).toBe(0);
    expect(previousRailState.hasAdjacentSpacer).toBe(false);

    await testInfo.attach('brand-switch-' + fromBrand + '-to-' + toBrand + '-390x844', {
      body: await page.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    });
  }
});

test('category rails retain the original emoji icons for both brands', async ({ page }) => {
  for (const brand of ['coffee', 'delivery']) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
    await page.goto('/?brand=' + brand, { waitUntil: 'domcontentloaded' });
    const railSelector = brand === 'coffee' ? '#rail' : '#deliveryRail';
    const rail = page.locator(railSelector);
    await expect(rail).toBeVisible({ timeout: 10000 });
    const icons = rail.locator('button .re');
    await expect(icons).not.toHaveCount(0);
    await expect.poll(() => icons.evaluateAll(nodes => nodes.every(node => {
      const svg = node.querySelector('svg');
      return !svg && node.textContent.trim().length > 0;

    }))).toBe(true);
    await expect(rail.locator('button')).toHaveCount(brand === 'coffee' ? 6 : 5);
    await expect(rail.locator('button').first()).toHaveAttribute('aria-pressed', 'true');
  }
});

test('coffee rail labels use the refined coffee typography without changing Friday', async ({ page }) => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));

    await page.goto('/?brand=coffee', { waitUntil: 'domcontentloaded' });
    const coffeeLabels = await page.locator('#rail button:not(.on)').first().evaluate(button => {
      const style = getComputedStyle(button);
      const active = getComputedStyle(button.parentElement.querySelector('button.on'));
      return {
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        activeWeight: active.fontWeight,
      };
    });
    expect(coffeeLabels.fontFamily).toContain('Golos Text');
    expect(coffeeLabels.fontSize).toBe('11px');
    expect(coffeeLabels.fontWeight).toBe('600');
    expect(coffeeLabels.activeWeight).toBe('700');

    await page.goto('/?brand=delivery', { waitUntil: 'domcontentloaded' });
    const fridayLabels = await page.locator('#deliveryRail button').first().evaluate(button => {
      const style = getComputedStyle(button);
      return { fontSize: style.fontSize, fontFamily: style.fontFamily };
    });
    expect(fridayLabels.fontSize).toBe('10px');
    expect(fridayLabels.fontFamily).toContain('Unbounded');
  }
});

test('active rail tabs keep their geometry on press and coffee uses its blue active state', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
  await page.goto('/?brand=coffee', { waitUntil: 'domcontentloaded' });
  const coffeeActive = page.locator('#rail button.on');
  await expect(coffeeActive).toBeVisible();
  await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; }' });
  const coffeeState = await coffeeActive.evaluate(button => ({
    buttonBackground: getComputedStyle(button).backgroundColor,
    iconBackground: getComputedStyle(button.querySelector('.re')).backgroundColor,
    iconColor: getComputedStyle(button.querySelector('.re')).color,
    labelColor: getComputedStyle(button).color,
    fontWeight: getComputedStyle(button).fontWeight,
  }));
  expect(coffeeState.buttonBackground).toBe('rgb(18, 58, 107)');
  expect(coffeeState.iconBackground).toBe('rgba(0, 0, 0, 0)');
  expect(coffeeState.iconColor).toBe('rgb(255, 255, 255)');
  expect(coffeeState.labelColor).toBe('rgb(255, 255, 255)');
  expect(coffeeState.fontWeight).toBe('700');

  await page.goto('/?brand=delivery', { waitUntil: 'domcontentloaded' });
  const deliveryRail = page.locator('#deliveryRail');
  const target = deliveryRail.locator('button').nth(1);
  const before = await target.evaluate(button => {
    const rect = button.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
  const targetBox = await target.boundingBox();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2);
  await page.mouse.down();
  const pressed = await target.evaluate(button => ({
    transform: getComputedStyle(button).transform,
    iconTransform: getComputedStyle(button.querySelector('.re')).transform,
    rect: (() => { const r = button.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })(),
  }));
  expect(pressed.transform).toBe('none');
  expect(pressed.iconTransform).toBe('none');
  expect(pressed.rect).toEqual(before);
  await page.mouse.up();
});

test('rail active background diagnostic and four brand viewport captures', async ({ page }, testInfo) => {
  for (const brand of ['coffee', 'delivery']) {
    for (const viewport of [
      { name: 'portrait-390x844', width: 390, height: 844 },
      { name: 'landscape-844x390', width: 844, height: 390 },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
      await page.goto('/?brand=' + brand, { waitUntil: 'domcontentloaded' });
      const rail = page.locator(brand === 'coffee' ? '#rail' : '#deliveryRail');
      await expect(rail).toBeVisible({ timeout: 10000 });
      await expect(rail.locator('button.on')).toBeVisible();
      await page.waitForFunction(() => {
        const sheet = [...document.styleSheets].find(item => item.href && item.href.includes('/150-rail.css'));
        if (!sheet) return false;
        try { return sheet.cssRules.length > 0; } catch { return false; }
      });
      const diagnostic = await page.evaluate(() => {
        const railSelector = document.documentElement.dataset.brand === 'delivery' ? '#deliveryRail' : '#rail';
        const active = document.querySelector(railSelector + ' button.on');
        const rootStyles = getComputedStyle(document.documentElement);
        const rootToken = rootStyles.getPropertyValue('--category-tab-active-bg').trim();
        const activeColorToken = rootStyles.getPropertyValue('--category-tab-active-color').trim();
        const iconActiveBackgroundToken = rootStyles.getPropertyValue('--category-icon-active-bg').trim();
        const activeStyle = active ? getComputedStyle(active) : null;
        const activeIcon = active ? active.querySelector('.re') : null;
        const computedBackground = activeStyle ? activeStyle.backgroundColor : null;
        const computedActiveColor = activeStyle ? activeStyle.color : null;
        const computedIconBackground = activeIcon ? getComputedStyle(activeIcon).backgroundColor : null;
        const matchedRules = [];
        const stylesheetHrefs = [];
        let styleRuleCount = 0;
        const visit = (rules, source) => {
          for (const rule of rules) {
            // CSSStyleRule also exposes cssRules in browsers with CSS nesting.
            // Check STYLE_RULE first or its own declarations can be skipped.
            if (rule.type === 1) {
              styleRuleCount += 1;
              if (!rule.selectorText || !rule.style || !active) continue;
              const matchingSelectors = rule.selectorText.split(',').map(selector => selector.trim())
                .filter(selector => {
                  try { return active.matches(selector); } catch (_) { return false; }
                });
              if (!matchingSelectors.length) continue;
              const background = rule.style.getPropertyValue('background');
              const backgroundColor = rule.style.getPropertyValue('background-color');
              if (!background && !backgroundColor) continue;
              matchedRules.push({
                file: source,
                selector: rule.selectorText,
                matchedSelector: matchingSelectors[0],
                background: background || null,
                backgroundColor: backgroundColor || null,
                important: rule.style.getPropertyPriority(background ? 'background' : 'background-color') === 'important',
              });
              continue;
            }
            if (rule.cssRules) {
              try { visit(rule.cssRules, source); } catch (_) {}
            }
          }
        };
        for (const sheet of document.styleSheets) {
          const source = sheet.href || 'inline <style>';
          if (source.includes('/150-rail.css')) stylesheetHrefs.push(source);
          try { visit(sheet.cssRules, source); } catch (_) {}
        }
        return {
          token: rootToken,
          activeColorToken: activeColorToken || null,
          iconActiveBackgroundToken: iconActiveBackgroundToken || null,
          computedBackground,
          computedActiveColor,
          computedIconBackground,
          styleRuleCount,
          stylesheetHrefs,
          matchedRules,
        };
      });
      await testInfo.attach(brand + '-' + viewport.name + '-rail-background-diagnostic.json', {
        body: Buffer.from(JSON.stringify(diagnostic, null, 2)),
        contentType: 'application/json',
      });
      expect(
        diagnostic.matchedRules.some(rule => rule.selector.includes('button.on')),
        brand + ' ' + viewport.name + ' should report the active-tab background rule'
      ).toBe(true);
      await testInfo.attach(brand + '-' + viewport.name + '-rail.png', {
        body: await page.screenshot({ animations: 'disabled' }),
        contentType: 'image/png',
      });
    }
  }
});



test('short landscape venue switcher is compact and keeps a 44px target for both brands', async ({ page }, testInfo) => {
  for (const brand of ['coffee', 'delivery']) {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
    await page.goto('/?brand=' + brand, { waitUntil: 'domcontentloaded' });
    const toggle = page.locator('#venueToggle');
    await expect(toggle).toBeVisible();
    const metrics = await toggle.evaluate(el => {
      const rect = el.getBoundingClientRect();
      const label = el.querySelector('.vt-label');
      const icon = el.querySelector('.vt-icon');
      const arrow = el.querySelector('.vt-arrow');
      return {
        width: rect.width, height: rect.height,
        labelDisplay: label && getComputedStyle(label).display,
        iconVisible: !!icon && getComputedStyle(icon).display !== 'none',
        arrowVisible: !!arrow && getComputedStyle(arrow).display !== 'none',
        right: rect.right, viewportWidth: document.documentElement.clientWidth,
      };
    });
    expect(metrics.width, brand + ' compact venue control width').toBeLessThanOrEqual(52);
    expect(metrics.height, brand + ' venue hit target height').toBeGreaterThanOrEqual(44);
    expect(metrics.labelDisplay, brand + ' long label is hidden in short landscape').toBe('none');
    expect(metrics.iconVisible).toBe(true);
    expect(metrics.arrowVisible).toBe(true);
    expect(metrics.right).toBeLessThanOrEqual(metrics.viewportWidth);
    await testInfo.attach(brand + '-venue-switcher-844x390', {
      body: await page.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    });
  }
});


test('mobile venue switcher panel fits viewport and keeps compact option rows', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
  await page.goto('/?brand=coffee', { waitUntil: 'domcontentloaded' });
  await page.locator('#venueToggle').click();
  const panel = page.locator('#brandSeg');
  await expect(panel).toBeVisible();
  const geometry = await panel.evaluate(el => {
    const rect = el.getBoundingClientRect();
    const buttons = Array.from(el.querySelectorAll('button')).map(button => {
      const r = button.getBoundingClientRect();
      const style = getComputedStyle(button);
      return {
        width: r.width, height: r.height, left: r.left, right: r.right,
        alignSelf: style.alignSelf, text: button.textContent.trim()
      };
    });
    return {
      left: rect.left, right: rect.right, width: rect.width,
      viewportWidth: document.documentElement.clientWidth,
      position: getComputedStyle(el).position, top: rect.top, buttons,
      overflowWidth: document.documentElement.scrollWidth,
    };
  });
  expect(geometry.left).toBeGreaterThanOrEqual(8);
  expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth - 8);
  expect(geometry.width).toBeGreaterThanOrEqual(180);
  expect(geometry.buttons).toHaveLength(2);
  expect(geometry.buttons.every(button => button.width > 0)).toBe(true);
  expect(Math.abs(geometry.buttons[0].width - geometry.buttons[1].width)).toBeLessThanOrEqual(1);
  expect(geometry.buttons.every(button => button.width <= geometry.width - 14)).toBe(true);
  expect(geometry.buttons.every(button => button.height >= 40)).toBe(true);
  expect(geometry.buttons.every(button => button.left >= geometry.left + 6 && button.right <= geometry.right - 6)).toBe(true);
  expect(geometry.overflowWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);
});


for (const brand of CASES) {
  test(`${brand.brand}: mobile rail stays close to the first catalog control`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
    await page.goto(`/?brand=${brand.brand}`, { waitUntil: 'domcontentloaded' });

    const gridSelector = brand.brand === 'delivery' ? '#deliveryGrid' : '#grid';
    const railSelector = brand.rail;
    await expect(page.locator(railSelector)).toBeVisible();
    await expect(page.locator(`${gridSelector} > .card`).first()).toBeVisible({ timeout: 15000 });

    const geometry = await page.evaluate(({ railSelector, gridSelector, isDelivery }) => {
      const rail = document.querySelector(railSelector);
      const grid = document.querySelector(gridSelector);
      const viewport = isDelivery ? document.querySelector('#deliverySubFilterViewport') : null;
      const target = viewport && getComputedStyle(viewport).display !== 'none' &&
        viewport.getBoundingClientRect().height > 0 ? viewport : grid;
      const railRect = rail.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const style = getComputedStyle(target);
      return {
        gap: targetRect.top - railRect.bottom,
        railBottom: railRect.bottom,
        targetTop: targetRect.top,
        targetId: target.id,
        targetDisplay: style.display,
        targetMarginTop: style.marginTop,
        targetPaddingTop: style.paddingTop,
        targetHeight: targetRect.height,
        gridChildCount: grid.children.length,
      };
    }, { railSelector, gridSelector, isDelivery: brand.brand === 'delivery' });

    await testInfo.attach(`${brand.brand}-mobile-rail-content-gap.json`, {
      body: Buffer.from(JSON.stringify(geometry, null, 2)),
      contentType: 'application/json',
    });
    expect(geometry.gap, 'the first catalog control must follow the rail without a blank spacer').toBeLessThanOrEqual(28);
  });
}

for (const brand of CASES) {
  test(`${brand.brand}: venue options use compact width and brand active styling`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
    await page.goto(`/?brand=${brand.brand}`, { waitUntil: 'domcontentloaded' });
    await page.locator('#venueToggle').click();
    const panel = page.locator('#brandSeg');
    await expect(panel).toBeVisible();

    const state = await panel.evaluate(el => {
      const buttons = Array.from(el.querySelectorAll('button'));
      const active = buttons.find(button => button.classList.contains('on'));
      const panelRect = el.getBoundingClientRect();
      const activeRect = active.getBoundingClientRect();
      const style = getComputedStyle(active);
      return {
        panelWidth: panelRect.width,
        activeWidth: activeRect.width,
        activeBackground: style.backgroundColor,
        activeColor: style.color,
        activeBorder: style.border,
        activeShadow: style.boxShadow,
        activeFont: style.fontFamily,
        buttonWidths: buttons.map(button => button.getBoundingClientRect().width),
      };
    });

    expect(state.activeWidth, 'venue options should share the dropdown content width').toBeGreaterThanOrEqual(state.panelWidth - 16);
    expect(Math.abs(state.buttonWidths[0] - state.buttonWidths[1])).toBeLessThanOrEqual(1);
    if (brand.brand === 'delivery') {
      expect(state.activeBackground).toBe('rgb(139, 43, 32)');
      expect(state.activeColor).toBe('rgb(255, 255, 255)');
      expect(state.activeFont).toContain('Unbounded');
      expect(state.activeShadow).not.toBe('none');
    } else {
      expect(state.activeBackground).toBe('rgb(187, 215, 242)');
      expect(state.activeColor).toBe('rgb(18, 58, 107)');
    }
  });
}

test('coffee category switch scrolls the new catalog column into view smoothly below the sticky topbar', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
  await page.goto('/?brand=coffee', { waitUntil: 'domcontentloaded' });

  const rail = page.locator('#rail');
  await expect(rail).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 700));
  await expect(rail).toHaveCSS('position', 'fixed');
  await expect(rail).not.toHaveClass(/rail-is-pinned/);

  await page.evaluate(() => {
    const original = window.scrollMenuContentToStart;
    window.__coffeeScrollEvidence = null;
    window.scrollMenuContentToStart = function (contentSelector, railSelector, preservePinned) {
      window.__coffeeScrollEvidence = {
        cardCount: document.querySelectorAll('#grid .card').length,
        preservePinned,
        argumentCount: arguments.length,
      };
      return original.call(this, contentSelector, railSelector, preservePinned);
    };
  });

  const category = page.locator('#rail button[data-cat]').nth(1);
  const grid = page.locator('#grid');
  const beforeCardCount = await grid.locator(':scope > .card').count();
  expect(beforeCardCount).toBeGreaterThan(0);

  // The coffee renderer must keep the previous column in flow until the
  // replacement cards are ready; clearing #grid synchronously collapses the
  // document and lets the browser clamp scrollY before smooth scrolling starts.
  const immediateCardCount = await page.evaluate(() => {
    document.querySelector('#rail button[data-cat]:nth-child(2)').click();
    return document.querySelectorAll('#grid > .card').length;
  });
  expect(immediateCardCount, 'category switch must not synchronously empty the catalog column').toBeGreaterThan(0);
  const scrollFrames = await page.evaluate(() => {
    const startedAt = performance.now();
    const samples = [];
    return new Promise(resolve => {
      const sample = now => {
        const gridRect = document.querySelector('#grid').getBoundingClientRect();
        const railRect = document.querySelector('#rail').getBoundingClientRect();
        samples.push({
          time: now - startedAt,
          gridTop: gridRect.top,
          gridHeight: gridRect.height,
          railBottom: railRect.bottom,
          scrollY: window.scrollY,
        });
        if (now - startedAt >= 900) resolve(samples);
        else requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
  });
  await testInfo.attach('coffee-category-scroll-frames-390x844.json', {
    body: Buffer.from(JSON.stringify(scrollFrames, null, 2)),
    contentType: 'application/json',
  });
  const scrollPositions = scrollFrames.map(frame => frame.scrollY);
  expect(Math.max(...scrollPositions) - Math.min(...scrollPositions),
    'category navigation should perform measurable smooth scrolling when the new catalog is below the current viewport')
    .toBeGreaterThan(2);

  await expect(category).toHaveClass(/on/);
  await expect.poll(() => page.evaluate(() => window.__coffeeScrollEvidence?.cardCount ?? -1))
    .toBeGreaterThan(0);
  expect(await page.evaluate(() => window.__coffeeScrollEvidence.argumentCount)).toBe(3);
  expect(await page.evaluate(() => window.__coffeeScrollEvidence.preservePinned)).toBe(false);
  await expect.poll(() => page.evaluate(() => {
    const topbar = document.querySelector('header.topbar');
    const grid = document.querySelector('#grid');
    if (!topbar || !grid) return Infinity;
    return Math.abs(grid.getBoundingClientRect().top - topbar.getBoundingClientRect().bottom - 12);
  }), { timeout: 8000 }).toBeLessThanOrEqual(3);
  await testInfo.attach('coffee-category-switch-scrolled-390x844', {
    body: await page.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  });
});

test('mobile category labels stay on one line and fully inside their tabs for both brands', async ({ page }) => {
  for (const brand of CASES) {
    for (const viewport of [
      { width: 320, height: 740 },
      { width: 390, height: 844 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(viewport);
      await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
      await page.goto('/?brand=' + brand.brand, { waitUntil: 'domcontentloaded' });

      const rail = page.locator(brand.rail);
      await expect(rail).toBeVisible({ timeout: 10000 });
      await expect.poll(() => rail.locator('button').count()).toBeGreaterThan(1);

      const labels = await rail.evaluate((element) => {
        return Array.from(element.querySelectorAll('button')).map((button) => {
          const label = button.querySelector('.category-label');
          const range = document.createRange();
          if (label) range.selectNodeContents(label);
          const rects = label ? Array.from(range.getClientRects()) : [];
          const buttonRect = button.getBoundingClientRect();
          const labelRect = rects[0] || null;
          return {
            label: label?.textContent.trim() || '',
            accessibleName: button.getAttribute('aria-label') || '',
            lineCount: rects.length,
            whiteSpace: getComputedStyle(button).whiteSpace,
            fontSize: label ? Number.parseFloat(getComputedStyle(label).fontSize) : 0,
            transform: label ? getComputedStyle(label).transform : 'none',
            buttonWidth: buttonRect.width,
            insideTab: Boolean(labelRect) &&
              labelRect.left >= buttonRect.left - 1 &&
              labelRect.right <= buttonRect.right + 1,
          };
        });
      });

      expect(labels.every((label) =>
        label.label &&
        label.lineCount === 1 &&
        label.whiteSpace === 'nowrap' &&
        label.fontSize >= 8.5 &&
        label.transform === 'none' &&
        label.insideTab
      ), brand.brand + ' category labels must remain readable, single-line and fully visible at ' +
        viewport.width + 'x' + viewport.height + ': ' + JSON.stringify(labels)).toBe(true);
      expect(Math.min(...labels.map((label) => label.buttonWidth)),
        brand.brand + ' category tabs retain a 60px minimum target width').toBeGreaterThanOrEqual(60);
      if (brand.brand === 'delivery') {
        const sauces = labels.find((label) => label.accessibleName === 'Допы и соусы');
        expect(sauces?.label, 'delivery sauces category uses a compact visible label').toBe('Добавки');
      }
    }
  }
});


// Geometry contract for the guest mobile menu: compact header, shorter rail, and preserved touch targets.
test('mobile menu header and category rail use compact vertical geometry', async ({ page }, testInfo) => {
  for (const brand of CASES) {
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
      await page.goto('/?brand=' + brand.brand, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => [...document.styleSheets].some(sheet => {
        if (!sheet.href || !sheet.href.includes('/150-rail.css')) return false;
        try { return sheet.cssRules.length > 0; } catch { return false; }
      }));

      const geometry = await page.evaluate(({ headSelector, railSelector }) => {
        const head = document.querySelector(headSelector);
        const rail = document.querySelector(railSelector);
        const heading = head.querySelector('h1');
        const search = head.querySelector('.mh-right > .search');
        const active = rail.querySelector('button.on');
        const label = active?.querySelector('.category-label');
        const activeStyle = active && getComputedStyle(active);
        const rect = (element) => {
          const box = element.getBoundingClientRect();
          return { top: box.top, bottom: box.bottom, height: box.height };
        };
        const labelRect = rect(label);
        const railRect = rect(rail);
        return {
          head: rect(head),
          heading: rect(heading),
          search: rect(search),
          titleSearchGap: rect(search).top - rect(heading).bottom,
          rail: railRect,
          activeBackground: activeStyle?.backgroundColor ?? 'rgba(0, 0, 0, 0)',
          buttonRadius: activeStyle?.borderTopLeftRadius ?? '0px',
          buttonHeight: active?.getBoundingClientRect().height ?? 0,
        };
      }, { headSelector: brand.head, railSelector: brand.rail });

      expect(geometry.head.height, 'mobile menu block should be shorter than the former 100px').toBeLessThanOrEqual(90);
      expect(geometry.titleSearchGap, 'search should sit close below the menu title').toBeLessThanOrEqual(14);
      expect(geometry.rail.height, 'category rail should use compact 56px height').toBe(56);
      expect(geometry.buttonHeight, 'compact rail must preserve a comfortable touch target').toBeGreaterThanOrEqual(44);
      expect(geometry.activeBackground, 'selected category is indicated by a filled tab').not.toBe('rgba(0, 0, 0, 0)');
      expect(geometry.buttonRadius, 'selected category uses a compact pill treatment').toBe('20px');
      await testInfo.attach(`compact-menu-${brand.brand}-${viewport.width}px`, {
        body: await page.screenshot({ animations: 'disabled' }),
        contentType: 'image/png',
      });
    }
  }
});


// Mirrors the guest 90px menu-card and 74px two-row toolbar reservation in index.html.
test('mobile guest menu panel keeps its lower inset while compacting the title-to-search gap', async ({ page }, testInfo) => {
  for (const brand of CASES) {
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
      await page.goto('/?brand=' + brand.brand, { waitUntil: 'domcontentloaded' });

      const head = page.locator(brand.head);
      const title = head.locator('h1');
      const search = head.locator('.mh-right .search');
      await expect(head).toBeVisible();
      await expect(title).toHaveText('Меню');
      await expect(search).toBeVisible();

      const geometry = await head.evaluate((element) => {
        const rect = (node) => {
          const box = node.getBoundingClientRect();
          return { top: box.top, bottom: box.bottom, height: box.height };
        };
        const title = element.querySelector('h1');
        const search = element.querySelector('.mh-right .search');
        const toolbar = element.querySelector('.mh-top');
        const titleRow = toolbar?.firstElementChild;
        const style = getComputedStyle(element);
        return {
          panelHeight: rect(element).height,
          panelPaddingBottom: Number.parseFloat(style.paddingBottom),
          bottomClearance: rect(element).bottom - rect(search).bottom,
          titleToSearchGap: rect(search).top - rect(title).bottom,
          toolbarHeight: rect(toolbar).height,
          titleRowHeight: rect(titleRow).height,
          searchHeight: rect(search).height,
        };
      });

      expect(geometry.panelHeight, 'outer menu panel height remains unchanged').toBeCloseTo(90, 0);
      expect(geometry.panelPaddingBottom, 'existing panel bottom padding is preserved').toBeGreaterThanOrEqual(6);
      expect(geometry.bottomClearance, 'search keeps a visible inset from the panel border').toBeGreaterThanOrEqual(6);
      expect(geometry.titleToSearchGap, 'search sits close below the Menu title').toBeLessThanOrEqual(14);
      expect(geometry.toolbarHeight).toBe(74);
      expect(geometry.titleRowHeight).toBe(28);
      expect(geometry.searchHeight).toBeGreaterThanOrEqual(40);

      await testInfo.attach('menu-panel-spacing-' + brand.brand + '-' + viewport.width + 'px', {
        body: await page.screenshot({ animations: 'disabled' }),
        contentType: 'image/png',
      });
    }
  }
});

