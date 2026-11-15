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


test('both mobile category rails sit below search and scroll horizontally', async ({ page }) => {
  for (const brand of CASES) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
    await page.goto('/?brand=' + brand.brand, { waitUntil: 'domcontentloaded' });
    const metrics = await page.evaluate(({ viewSelector, headSelector, railSelector, filterSelector }) => {
      const view = document.querySelector(viewSelector);
      const head = document.querySelector(headSelector);
      const rail = document.querySelector(railSelector);
      const filter = filterSelector ? document.querySelector(filterSelector) : null;
      const headRect = head.getBoundingClientRect();
      const railRect = rail.getBoundingClientRect();
      const filterRect = filter && !filter.hidden ? filter.getBoundingClientRect() : null;
      const buttons = Array.from(rail.querySelectorAll('button')).map(button => button.getBoundingClientRect());
      return {
        parentIsView: rail.parentElement === view,
        direction: getComputedStyle(rail).flexDirection,
        topGap: railRect.top - headRect.bottom,
        railBottom: railRect.bottom,
        filterTop: filterRect ? filterRect.top : null,
        horizontalGap: buttons.length > 1 ? buttons[1].left - buttons[0].right : -1,
        firstTargetHeight: buttons[0] ? buttons[0].height : 0
      };
    }, {
      viewSelector: brand.brand === 'coffee' ? '#menuView' : '#deliveryView',
      headSelector: brand.head,
      railSelector: brand.rail,
      filterSelector: brand.brand === 'delivery' ? '#deliverySubFilterViewport' : null
    });
    expect(metrics.parentIsView, brand.brand + ' rail belongs inside its menu view').toBe(true);
    expect(metrics.direction, brand.brand + ' rail is horizontal').toBe('row');
    expect(metrics.topGap, brand.brand + ' rail follows the search block').toBeGreaterThanOrEqual(8);
    if (metrics.filterTop !== null) {
      expect(metrics.railBottom, 'delivery main categories precede secondary filters').toBeLessThanOrEqual(metrics.filterTop + 1);
    }
    expect(metrics.horizontalGap, brand.brand + ' category buttons form a horizontal row').toBeGreaterThanOrEqual(6);
    expect(metrics.firstTargetHeight, brand.brand + ' category target remains at least 44px').toBeGreaterThanOrEqual(44);
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
    expect(m.rb - m.rt, 'desktop category rail must fit its own items, not stretch beside the full catalog').toBeLessThan(400);
    expect(m.pos).toBe('relative');
    expect(m.align).toBe('start');
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


test('mobile category navigation is horizontal, full-width and follows search for both brands', async ({ page }, testInfo) => {
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

      const view = brand.brand === 'coffee' ? '#menuView' : '#deliveryView';
      const rail = page.locator(brand.rail);
      const head = page.locator(brand.head);
      const grid = page.locator(brand.brand === 'coffee' ? '#grid' : '#deliveryGrid');

      await expect(head).toBeVisible({ timeout: 10000 });
      await expect(rail).toBeVisible({ timeout: 10000 });
      await expect(grid.locator('.card').first()).toBeVisible({ timeout: 15000 });

      const geometry = await page.evaluate(({ viewSelector, railSelector, headSelector, gridSelector, brandName }) => {
        const viewEl = document.querySelector(viewSelector);
        const railEl = document.querySelector(railSelector);
        const headEl = document.querySelector(headSelector);
        const gridEl = document.querySelector(gridSelector);
        const filterEl = brandName === 'delivery'
          ? document.querySelector('#deliverySubFilterViewport')
          : null;
        const rr = railEl.getBoundingClientRect();
        const hr = headEl.getBoundingClientRect();
        const gr = gridEl.getBoundingClientRect();
        const fr = filterEl && !filterEl.hidden ? filterEl.getBoundingClientRect() : null;
        const buttons = Array.from(railEl.querySelectorAll('button')).map(button => {
          const rect = button.getBoundingClientRect();
          return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, height: rect.height };
        });
        return {
          parent: railEl.parentElement,
          parentIsView: railEl.parentElement === viewEl,
          display: getComputedStyle(railEl).display,
          direction: getComputedStyle(railEl).flexDirection,
          width: rr.width,
          height: rr.height,
          clientWidth: railEl.clientWidth,
          scrollWidth: railEl.scrollWidth,
          headLeft: hr.left,
          headRight: hr.right,
          headBottom: hr.bottom,
          railLeft: rr.left,
          railRight: rr.right,
          railTop: rr.top,
          railBottom: rr.bottom,
          filterTop: fr ? fr.top : null,
          gridLeft: gr.left,
          gridRight: gr.right,
          buttonCount: buttons.length,
          buttons,
          viewportWidth: document.documentElement.clientWidth,
          documentWidth: document.documentElement.scrollWidth,
        };
      }, {
        viewSelector: view,
        railSelector: brand.rail,
        headSelector: brand.head,
        gridSelector: brand.brand === 'coffee' ? '#grid' : '#deliveryGrid',
        brandName: brand.brand,
      });

      expect(geometry.parentIsView, brand.brand + ' rail belongs to its active menu view on mobile').toBe(true);
      expect(geometry.display).toBe('flex');
      expect(geometry.direction, brand.brand + ' categories render in one horizontal row').toBe('row');
      expect(geometry.height, brand.brand + ' category row stays compact on short screens').toBeLessThanOrEqual(76);
      expect(geometry.railTop, brand.brand + ' categories follow the search/header block').toBeGreaterThan(geometry.headBottom);
      expect(geometry.railLeft, brand.brand + ' category row begins at the menu content edge').toBeCloseTo(geometry.headLeft, 0);
      expect(geometry.railRight, brand.brand + ' category row spans the full menu width').toBeCloseTo(geometry.headRight, 0);
      expect(geometry.gridLeft, brand.brand + ' catalog uses the full content width').toBeCloseTo(geometry.headLeft, 0);
      expect(geometry.gridRight, brand.brand + ' catalog reaches the content right edge').toBeCloseTo(geometry.headRight, 0);
      expect(geometry.buttonCount).toBeGreaterThan(1);
      expect(geometry.buttons[1].left, brand.brand + ' second category is next to the first').toBeGreaterThan(geometry.buttons[0].right);
      expect(geometry.buttons[0].height, brand.brand + ' category tap targets remain at least 44px').toBeGreaterThanOrEqual(44);
      if (geometry.filterTop !== null) {
        expect(geometry.railBottom, 'delivery categories precede the secondary filters').toBeLessThanOrEqual(geometry.filterTop + 1);
      }
      expect(geometry.documentWidth, brand.brand + ' horizontal category rail does not create page overflow').toBeLessThanOrEqual(geometry.viewportWidth + 1);

      await testInfo.attach(brand.brand + '-horizontal-categories-' + viewport.width + 'px', {
        body: await page.screenshot({ animations: 'disabled' }),
        contentType: 'image/png',
      });
    }
  }
});


test('mobile category navigation carries each storefront brand identity and stays distinct from secondary filters', async ({ page }, testInfo) => {
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
      await expect(page.locator(brand.rail + ' button.on')).toBeVisible({ timeout: 10000 });
      if (brand.brand === 'coffee') {
        await expect.poll(
          () => page.locator(brand.rail + ' button.on').evaluate((button) => getComputedStyle(button).backgroundColor),
          { message: 'coffee active tab settles on its white brand surface' },
        ).toBe('rgb(255, 255, 255)');
      }
      if (brand.brand === 'delivery') {
        await expect(page.locator('#deliverySubFilter .subchip').first()).toBeVisible({ timeout: 15000 });
      }

      const metrics = await page.evaluate(({ railSelector, brandName }) => {
        const rail = document.querySelector(railSelector);
        const button = rail.querySelector('button.on');
        const buttonStyle = getComputedStyle(button);
        const railStyle = getComputedStyle(rail);
        const buttonRect = button.getBoundingClientRect();
        const icon = button.querySelector('.re');
        const iconStyle = getComputedStyle(icon);
        const subchip = brandName === 'delivery'
          ? document.querySelector('#deliverySubFilter .subchip')
          : null;
        const subchipRect = subchip && subchip.getBoundingClientRect();
        const subchipPseudo = subchip && getComputedStyle(subchip, '::before');

        return {
          railHeight: rail.getBoundingClientRect().height,
          railBackground: railStyle.backgroundColor,
          railBorderWidth: railStyle.borderTopWidth,
          railRadius: railStyle.borderTopLeftRadius,
          railShadow: railStyle.boxShadow,
          buttonHeight: buttonRect.height,
          buttonDirection: buttonStyle.flexDirection,
          buttonBackground: buttonStyle.backgroundColor,
          buttonColor: buttonStyle.color,
          buttonBorderWidth: buttonStyle.borderTopWidth,
          buttonRadius: buttonStyle.borderTopLeftRadius,
          buttonShadow: buttonStyle.boxShadow,
          labelFont: buttonStyle.fontFamily,
          iconSize: iconStyle.width,
          iconBackground: iconStyle.backgroundColor,
          iconColor: iconStyle.color,
          iconBorderWidth: iconStyle.borderTopWidth,
          iconRadius: iconStyle.borderTopLeftRadius,
          subchipHeight: subchipRect ? subchipRect.height : null,
          subchipRadius: subchipPseudo ? subchipPseudo.borderRadius : null,
          subchipBorderWidth: subchipPseudo ? subchipPseudo.borderTopWidth : null,
        };
      }, { railSelector: brand.rail, brandName: brand.brand });

      expect(metrics.railHeight, brand.brand + ' category navigation stays visually light').toBeLessThanOrEqual(60);
      expect(metrics.buttonHeight, brand.brand + ' category targets remain compact and tappable').toBe(44);
      expect(metrics.buttonDirection, brand.brand + ' category icon and label share one compact row').toBe('row');
      expect(metrics.iconSize, brand.brand + ' icon is not enclosed in a second badge').toBe('20px');
      expect(metrics.buttonRadius, brand.brand + ' tabs are visibly shaped, not plain text').not.toBe('0px');
      expect(metrics.buttonBackground, brand.brand + ' active tab has a brand surface').not.toBe('rgba(0, 0, 0, 0)');

      if (brand.brand === 'coffee') {
        expect(metrics.railBackground, 'coffee rail does not add a second framed surface').toBe('rgba(0, 0, 0, 0)');
        expect(metrics.railBorderWidth, 'coffee rail has no enclosing frame').toBe('0px');
        expect(metrics.railRadius, 'coffee rail does not create a nested panel').toBe('0px');
        const coffeeActiveSurface = metrics.buttonBackground.match(/[0-9.]+/g).map(Number);
        expect(coffeeActiveSurface.slice(0, 3), 'coffee active tab uses the ocean accent').toEqual([18, 58, 107]);
        expect(coffeeActiveSurface.length > 3 ? coffeeActiveSurface[3] : 1, 'coffee active tab settles to an opaque white surface').toBe(1);
        expect(metrics.buttonColor, 'coffee active label remains readable').toBe('rgb(255, 255, 255)');
        expect(metrics.buttonBorderWidth, 'coffee active tab uses a fine blue outline').toBe('1px');
        expect(metrics.buttonShadow, 'coffee active tab avoids a decorative shadow').toBe('none');
        expect(metrics.iconBackground, 'coffee icon has no nested badge').toBe('rgba(0, 0, 0, 0)');
        expect(metrics.iconRadius, 'coffee icon has no badge shape').toBe('0px');
        expect(metrics.labelFont, 'coffee labels use the coffee typeface').toContain('Golos Text');
      }

      if (brand.brand === 'delivery') {
        expect(metrics.railBackground, 'Friday rail avoids a second framed surface').toBe('rgba(0, 0, 0, 0)');
        expect(metrics.railBorderWidth, 'Friday rail has no enclosing frame').toBe('0px');
        expect(metrics.railShadow, 'Friday rail avoids a heavy offset shadow').toBe('none');
        expect(metrics.buttonBackground, 'Friday active tab uses the configured high-contrast dark terracotta token').toBe('rgb(139, 43, 32)');
        expect(metrics.buttonColor, 'Friday active label remains white on terracotta').toBe('rgb(255, 255, 255)');
        expect(metrics.buttonBorderWidth, 'Friday active tab uses a restrained outline').toBe('1px');
        expect(metrics.iconBackground, 'Friday icon has no nested badge').toBe('rgba(0, 0, 0, 0)');
        expect(metrics.iconRadius, 'Friday icon has no badge shape').toBe('0px');
        expect(metrics.labelFont, 'Friday labels remain legible in the shared navigation system').toContain('Golos Text');
        expect(metrics.subchipHeight, 'secondary filters remain compact chips').toBe(44);
        expect(metrics.subchipRadius, 'secondary filters retain the pill shape').toContain('999');
        expect(Number.parseFloat(metrics.subchipBorderWidth), 'secondary filters retain their own outline').toBeGreaterThan(0);
        expect(metrics.buttonHeight, 'primary category targets use the same accessible minimum as filters').toBe(metrics.subchipHeight);
      }

      await testInfo.attach(brand.brand + '-category-brand-identity-' + viewport.width + 'px', {
        body: await page.screenshot({ animations: 'disabled' }),
        contentType: 'image/png',
      });
    }
  }
});


test('mobile category navigation exposes usable scrolling and spacing across portrait and landscape viewports', async ({ page }, testInfo) => {
  const viewports = [
    { name: '320 portrait', width: 320, height: 740 },
    { name: '360 portrait', width: 360, height: 800 },
    { name: '375 portrait', width: 375, height: 812 },
    { name: '390 portrait', width: 390, height: 844 },
    { name: '414 portrait', width: 414, height: 896 },
    { name: '520 portrait', width: 520, height: 900 },
    { name: '690 portrait', width: 690, height: 960 },
    { name: '820 portrait', width: 820, height: 1024 },
    { name: '568 short landscape', width: 568, height: 320 },
    { name: '667 landscape', width: 667, height: 375 },
    { name: '820 landscape', width: 820, height: 390 },
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
      await expect(rail).toBeVisible({ timeout: 10000 });
      await expect(grid.locator('.card').first()).toBeVisible({ timeout: 15000 });

      const before = await page.evaluate(({ railSelector, brandName }) => {
        const rail = document.querySelector(railSelector);
        const firstCard = document.querySelector(brandName === 'coffee' ? '#grid .card' : '#deliveryGrid .card');
        const filter = brandName === 'delivery' ? document.querySelector('#deliverySubFilterViewport') : null;
        const railRect = rail.getBoundingClientRect();
        const cardRect = firstCard.getBoundingClientRect();
        const filterRect = filter && !filter.hidden ? filter.getBoundingClientRect() : null;
        const style = getComputedStyle(rail);
        const buttons = [...rail.querySelectorAll('button')];
        const first = buttons[0]?.getBoundingClientRect();
        return {
          width: rail.clientWidth,
          scrollWidth: rail.scrollWidth,
          overflowX: style.overflowX,
          scrollbarWidth: style.scrollbarWidth,
          gap: Number.parseFloat(style.columnGap || style.gap) || 0,
          railBottom: railRect.bottom,
          cardTop: cardRect.top,
          filterTop: filterRect?.top ?? null,
          filterBottom: filterRect?.bottom ?? null,
          firstButtonHeight: first?.height ?? 0,
          buttonDirection: buttons[0] ? getComputedStyle(buttons[0]).flexDirection : '',
          viewportWidth: document.documentElement.clientWidth,
          documentWidth: document.documentElement.scrollWidth,
          pageCanScroll: document.documentElement.scrollHeight > document.documentElement.clientHeight,
          hasOverflowCue: rail.classList.contains('has-overflow'),
          atEndCue: rail.classList.contains('at-end'),
          cueContent: getComputedStyle(rail, '::after').content,
          cueColor: getComputedStyle(rail, '::after').color,
        };
      }, { railSelector: brand.rail, brandName: brand.brand });

      expect(before.overflowX, brand.brand + ' rail uses a real horizontal scroll container at ' + viewport.name).toBe('auto');
      expect(before.scrollbarWidth, brand.brand + ' rail avoids a distracting scrollbar at ' + viewport.name).toBe('none');
      expect(before.gap, brand.brand + ' rail keeps deliberate spacing between categories at ' + viewport.name).toBeGreaterThanOrEqual(8);
      expect(before.firstButtonHeight, brand.brand + ' category targets remain comfortably tappable at ' + viewport.name).toBe(44);
      expect(before.buttonDirection, brand.brand + ' category icon and label remain on one line at ' + viewport.name).toBe('row');
      expect(before.documentWidth, brand.brand + ' rail never widens the page at ' + viewport.name).toBeLessThanOrEqual(before.viewportWidth + 1);
      expect(before.pageCanScroll, brand.brand + ' catalog remains vertically scrollable at ' + viewport.name).toBe(true);

      if (brand.brand === 'coffee') {
        expect(before.cardTop - before.railBottom, 'coffee rail leaves a visible gap before the first card at ' + viewport.name).toBeGreaterThanOrEqual(12);
      } else {
        expect(before.filterTop - before.railBottom, 'delivery main categories and secondary filters remain distinct at ' + viewport.name).toBeGreaterThanOrEqual(6);
        expect(before.cardTop - before.filterBottom, 'delivery filters leave breathing room before the catalog at ' + viewport.name).toBeGreaterThanOrEqual(12);
      }

      if (before.scrollWidth > before.width + 1) {
        expect(before.hasOverflowCue, brand.brand + ' shows a directional cue when more categories are available at ' + viewport.name).toBe(true);
        expect(before.atEndCue, brand.brand + ' starts with the directional cue visible at ' + viewport.name).toBe(false);
        expect(before.cueContent, brand.brand + ' does not overlay decorative arrow glyphs at ' + viewport.name).toBe('none');
        expect(before.cueColor, brand.brand + ' uses a legible brand-colored scroll cue at ' + viewport.name).toBe(
          brand.brand === 'delivery' ? 'rgb(58, 42, 28)' : 'rgb(18, 58, 107)',
        );
        await rail.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
        await expect.poll(() => rail.evaluate((element) => element.classList.contains('at-end'))).toBe(true);
        await expect.poll(() => rail.evaluate((element) => getComputedStyle(element, '::after').opacity)).toBe('0');
        await testInfo.attach(brand.brand + '-' + viewport.name.replaceAll(' ', '-') + '-navigation-end', {
          body: await page.screenshot({ animations: 'disabled' }),
          contentType: 'image/png',
        });
        await rail.evaluate((element) => { element.scrollLeft = 0; });
        await expect.poll(() => rail.evaluate((element) => element.classList.contains('at-end'))).toBe(false);
        await rail.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
        await expect.poll(() => rail.evaluate((element) => {
          const last = element.querySelector('button:last-child').getBoundingClientRect();
          const bounds = element.getBoundingClientRect();
          return bounds.right - last.right;
        })).toBeGreaterThanOrEqual(-1);
        await rail.evaluate((element) => { element.scrollLeft = 0; });
      } else {
        expect(before.hasOverflowCue, brand.brand + ' does not show a false scroll cue when all categories fit at ' + viewport.name).toBe(false);
        expect(before.cueContent, brand.brand + ' omits the cue when the rail does not overflow at ' + viewport.name).toBe('none');
      }

      await testInfo.attach(brand.brand + '-' + viewport.name.replaceAll(' ', '-') + '-navigation', {
        body: await page.screenshot({ animations: 'disabled' }),
        contentType: 'image/png',
      });
    }
  }
});


for (const brand of CASES) {
  for (const viewport of [
    { name: 'short landscape 844', width: 844, height: 390 },
    { name: 'short landscape 1024', width: 1024, height: 390 },
  ]) {
    test(`${brand.brand}: category rail stays horizontal on ${viewport.name}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.addInitScript(() => {
        localStorage.clear();
        sessionStorage.clear();
        sessionStorage.setItem('splashDone', '1');
      });
      await page.goto(`/?brand=${brand.brand}`, { waitUntil: 'domcontentloaded' });
      const rail = page.locator(brand.rail);
      await expect(rail).toBeVisible({ timeout: 10000 });
      await expect(page.locator(brand.brand === 'coffee' ? '#grid .card' : '#deliveryGrid .card').first()).toBeVisible({ timeout: 15000 });

      const geometry = await page.evaluate(({ railSelector, viewSelector, brandName }) => {
        const railEl = document.querySelector(railSelector);
        const view = document.querySelector(viewSelector);
        const head = view.querySelector('.menu-head');
        const wrap = document.querySelector('.wrap');
        const section = wrap.querySelector(':scope > section');
        const firstCard = document.querySelector(brandName === 'coffee' ? '#grid .card' : '#deliveryGrid .card');
        const filter = brandName === 'delivery' ? document.querySelector('#deliverySubFilterViewport') : null;
        const railRect = railEl.getBoundingClientRect();
        const headRect = head.getBoundingClientRect();
        const cardRect = firstCard.getBoundingClientRect();
        const filterRect = filter && !filter.hidden ? filter.getBoundingClientRect() : null;
        const buttons = [...railEl.querySelectorAll('button')];
        const firstTarget = buttons[0]?.getBoundingClientRect();
        const wrapStyle = getComputedStyle(wrap);
        return {
          parentIsView: railEl.parentElement === view,
          nextAfterHead: head.nextElementSibling === railEl,
          direction: getComputedStyle(railEl).flexDirection,
          railTop: railRect.top,
          headBottom: headRect.bottom,
          railBottom: railRect.bottom,
          cardTop: cardRect.top,
          filterTop: filterRect?.top ?? null,
          filterBottom: filterRect?.bottom ?? null,
          firstTargetHeight: firstTarget?.height ?? 0,
          railVisibility: getComputedStyle(railEl).visibility,
          railOpacity: Number(getComputedStyle(railEl).opacity),
          cardVisibility: getComputedStyle(firstCard).visibility,
          cardOpacity: Number(getComputedStyle(firstCard).opacity),
          viewportHeight: window.innerHeight,
          wrapColumns: wrapStyle.gridTemplateColumns,
          sectionColumn: getComputedStyle(section).gridColumnStart,
          documentWidth: document.documentElement.clientWidth,
          documentScrollWidth: document.documentElement.scrollWidth,
        };
      }, {
        railSelector: brand.rail,
        viewSelector: brand.brand === 'coffee' ? '#menuView' : '#deliveryView',
        brandName: brand.brand
      });

      await testInfo.attach(`${brand.brand}-${viewport.width}x${viewport.height}-short-landscape-before-fix`, {
        body: await page.screenshot({ animations: 'disabled' }),
        contentType: 'image/png',
      });

      expect(geometry.railVisibility, 'short-landscape rail is actually painted').toBe('visible');
      expect(geometry.railOpacity, 'short-landscape rail is not transparent').toBeGreaterThan(0);
      expect(geometry.railTop, 'short-landscape rail starts in the visible viewport').toBeGreaterThanOrEqual(0);
      expect(geometry.railBottom, 'short-landscape rail fits in the visible viewport').toBeLessThanOrEqual(geometry.viewportHeight);
      expect(geometry.cardVisibility, 'short-landscape first card is actually painted').toBe('visible');
      expect(geometry.cardOpacity, 'short-landscape first card is not transparent').toBeGreaterThan(0);
      expect(geometry.cardTop, 'short-landscape first card starts in the visible viewport').toBeLessThan(geometry.viewportHeight);
      expect(geometry.parentIsView, 'short-landscape rail belongs below the search in its menu view').toBe(true);
      expect(geometry.nextAfterHead, 'short-landscape rail follows the menu search').toBe(true);
      expect(geometry.direction, 'short-landscape categories use the horizontal tab rail').toBe('row');
      expect(geometry.firstTargetHeight, 'short-landscape category targets remain tappable').toBeGreaterThanOrEqual(44);
      expect(geometry.sectionColumn, 'short-landscape catalog uses the full wrap width').toBe('1');
      expect(geometry.documentScrollWidth, 'short-landscape page has no horizontal document overflow').toBeLessThanOrEqual(geometry.documentWidth + 1);
      expect(geometry.railTop - geometry.headBottom, 'short-landscape search-to-rail gap is visible').toBeGreaterThanOrEqual(8);
      if (brand.brand === 'coffee') {
        expect(geometry.cardTop - geometry.railBottom, 'coffee short-landscape rail has breathing room before cards').toBeGreaterThanOrEqual(12);
      } else {
        expect(geometry.filterTop - geometry.railBottom, 'delivery short-landscape secondary filters follow primary categories').toBeGreaterThanOrEqual(6);
        expect(geometry.cardTop - geometry.filterBottom, 'delivery short-landscape filters have breathing room before cards').toBeGreaterThanOrEqual(12);
      }
    });
  }
}

for (const brand of CASES) {
  test(`${brand.brand}: category rail relocates when rotating between portrait, compact landscape and desktop`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
      sessionStorage.setItem('splashDone', '1');
    });
    await page.goto(`/?brand=${brand.brand}`, { waitUntil: 'domcontentloaded' });
    const rail = page.locator(brand.rail);
    const viewSelector = brand.brand === 'coffee' ? '#menuView' : '#deliveryView';
    const gridSelector = brand.brand === 'coffee' ? '#grid' : '#deliveryGrid';
    await expect(rail).toBeVisible({ timeout: 10000 });
    await expect.poll(() => rail.evaluate(el => el.parentElement.id)).toBe(viewSelector.slice(1));
    await testInfo.attach(`${brand.brand}-390x844-portrait-before-rotation`, {
      body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png'
    });

    await page.setViewportSize({ width: 844, height: 390 });
    await expect.poll(() => rail.evaluate(el => el.parentElement.id), {
      message: 'short landscape keeps the rail in the menu view'
    }).toBe(viewSelector.slice(1));
    await expect.poll(() => rail.evaluate(el => getComputedStyle(el).flexDirection)).toBe('row');
    await testInfo.attach(`${brand.brand}-844x390-short-landscape-after-rotation`, {
      body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png'
    });

    await page.setViewportSize({ width: 821, height: 900 });
    await expect.poll(() => rail.evaluate(el => el.parentElement.classList.contains('wrap')), {
      message: 'standard desktop restores the sidebar DOM placement'
    }).toBe(true);
    await expect.poll(() => rail.evaluate(el => getComputedStyle(el).flexDirection)).toBe('column');
    await expect.poll(() => page.locator(gridSelector + ' .card').first().isVisible()).toBe(true);
    await testInfo.attach(`${brand.brand}-821x900-desktop-after-rotation`, {
      body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png'
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(() => rail.evaluate(el => el.parentElement.id)).toBe(viewSelector.slice(1));
    await expect.poll(() => rail.evaluate(el => getComputedStyle(el).flexDirection)).toBe('row');
    await testInfo.attach(`${brand.brand}-390x844-portrait-after-rotation`, {
      body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png'
    });
  });
}

for (const brand of CASES) {
  test(`${brand.brand}: selecting an offscreen category keeps the active tab visible and announced`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
      sessionStorage.setItem('splashDone', '1');
    });
    await page.goto(`/?brand=${brand.brand}`, { waitUntil: 'domcontentloaded' });
    const rail = page.locator(brand.rail);
    await expect(rail).toBeVisible({ timeout: 10000 });
    await rail.locator('button').last().click();
    await expect.poll(() => rail.locator('button[aria-pressed="true"]').count()).toBe(1);
    await expect.poll(() => page.evaluate((selector) => {
      const container = document.querySelector(selector);
      const active = container.querySelector('button[aria-pressed="true"]');
      if (!active) return false;
      const bounds = container.getBoundingClientRect();
      const target = active.getBoundingClientRect();
      return target.left >= bounds.left - 1 && target.right <= bounds.right + 1;
    }, brand.rail)).toBe(true);
  });
}


for (const brand of CASES) {
  test(`${brand.brand}: category rail exposes an accessible, discoverable horizontal scroll region`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
    await page.goto(`/?brand=${brand.brand}`, { waitUntil: 'domcontentloaded' });

    const rail = page.locator(brand.rail);
    await expect(rail).toBeVisible({ timeout: 10000 });
    await expect(rail).toHaveAttribute('role', 'group');
    await expect(rail).toHaveAttribute('aria-label', 'Категории меню');
    await expect(rail).toHaveAttribute('tabindex', '0');
    await expect(rail.locator('button').first()).toHaveAttribute('type', 'button');

    const initial = await rail.evaluate((el) => ({
      overflowX: getComputedStyle(el).overflowX,
      overflowY: getComputedStyle(el).overflowY,
      overscrollY: getComputedStyle(el).overscrollBehaviorY,
      firstTarget: el.querySelector('button')?.getBoundingClientRect().height || 0,
      hasOverflow: el.classList.contains('has-overflow'),
      hasStartCue: el.classList.contains('has-start-overflow'),
      endCueContent: getComputedStyle(el, '::after').content,
    }));
    expect(initial.overflowX).toBe('auto');
    expect(initial.overflowY).toBe('hidden');
    expect(initial.overscrollY).not.toBe('contain');
    expect(initial.firstTarget).toBeGreaterThanOrEqual(44);

    if (initial.hasOverflow) {
      await rail.focus();
      await page.keyboard.press('ArrowRight');
      await expect.poll(() => rail.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
      await rail.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
      await expect.poll(() => rail.evaluate(el => el.classList.contains('has-start-overflow'))).toBe(true);
      await expect.poll(() => rail.evaluate(el => getComputedStyle(el, '::before').content)).toBe('none');
      await expect.poll(() => rail.evaluate(el => el.classList.contains('at-end'))).toBe(true);
      await expect.poll(() => rail.evaluate(el => getComputedStyle(el, '::before').content)).toBe('none');
      await expect.poll(() => rail.evaluate(el => getComputedStyle(el, '::after').opacity)).toBe('0');
      await rail.evaluate((el) => { el.scrollLeft = 0; });
      await expect.poll(() => rail.evaluate(el => el.classList.contains('has-start-overflow'))).toBe(false);
      await expect.poll(() => rail.evaluate(el => el.classList.contains('at-end'))).toBe(false);
    }
  });
}
