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
    test(`${brand.brand}: menu header geometry and viewport-centered rail at ${viewport.name}`, async ({ page }) => {
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
      const initialRail = await page.evaluate(({ headSelector, railSelector }) => {
        const head = document.querySelector(headSelector).getBoundingClientRect();
        const rail = document.querySelector(railSelector).getBoundingClientRect();
        const topbar = document.querySelector('header.topbar').getBoundingClientRect();
        const clearanceTop = Math.max(0, head.bottom, topbar.bottom) + 12;
        const targetCenter = (clearanceTop + window.innerHeight - 12) / 2;
        return {
          centerDelta: Math.abs((rail.top + rail.height / 2) - targetCenter),
          headGap: rail.top - head.bottom,
          topbarGap: rail.top - topbar.bottom,
        };
      }, { headSelector: brand.head, railSelector: brand.rail });
      expect(initialRail.centerDelta).toBeLessThanOrEqual(2);
      expect(initialRail.headGap, 'rail must start below the menu title and search').toBeGreaterThanOrEqual(8);
      expect(initialRail.topbarGap, 'rail must not overlap the topbar').toBeGreaterThanOrEqual(8);
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
          headBottom: headRect.bottom,
          contentLeft: wrapRect.left + parseFloat(wrapStyle.borderLeftWidth) + parseFloat(wrapStyle.paddingLeft),
          contentRight: wrapRect.right - parseFloat(wrapStyle.borderRightWidth) - parseFloat(wrapStyle.paddingRight),
          documentWidth: document.documentElement.clientWidth,
          documentScrollWidth: document.documentElement.scrollWidth,
        };
      }, { headSelector: brand.head, railSelector: brand.rail });

      if (viewport.width <= 820) {
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

      await page.evaluate(() => window.scrollTo(0, 500));
      await expect.poll(() => page.evaluate(({ headSelector, railSelector }) => {
        const head = document.querySelector(headSelector).getBoundingClientRect();
        const rail = document.querySelector(railSelector).getBoundingClientRect();
        const topbar = document.querySelector('header.topbar').getBoundingClientRect();
        const clearanceTop = Math.max(0, head.bottom, topbar.bottom) + 12;
        const targetCenter = (clearanceTop + window.innerHeight - 12) / 2;
        return Math.abs((rail.top + rail.height / 2) - targetCenter);
      }, { headSelector: brand.head, railSelector: brand.rail }), { timeout: 5000 }).toBeLessThanOrEqual(2);
      const afterScroll = await page.evaluate(({ headSelector, railSelector }) => {
        const head = document.querySelector(headSelector).getBoundingClientRect();
        const rail = document.querySelector(railSelector).getBoundingClientRect();
        const topbar = document.querySelector('header.topbar').getBoundingClientRect();
        return {
          railTop: rail.top,
          menuHeadBottom: head.bottom,
          topbarBottom: topbar.bottom,
        };
      }, { headSelector: brand.head, railSelector: brand.rail });
      expect(afterScroll.railTop).toBeGreaterThanOrEqual(Math.max(
        0,
        afterScroll.menuHeadBottom,
        afterScroll.topbarBottom
      ) + 8);
    });
  }
}


test('menu headings stay compact while retaining their brand context', async ({ page }) => {
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
      const geometry = await heading.evaluate((element, view) => {
        const rect = element.getBoundingClientRect();
        const rail = document.querySelector(view === '#menuView' ? '#rail' : '#deliveryRail');
        const railRect = rail?.getBoundingClientRect();
        const tagline = element.querySelector('em');
        const taglineRect = tagline?.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          width: rect.width,
          railRight: railRect?.right ?? 0,
          viewportWidth: document.documentElement.clientWidth,
          title: element.childNodes[0]?.textContent?.trim(),
          taglineVisible: !!tagline && getComputedStyle(tagline).display !== 'none' && taglineRect.width > 0,
        };
      }, view);
      expect(geometry.left).toBeGreaterThanOrEqual(0);
      expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth + 1);
      expect(geometry.title).toBe('Меню');
      expect(geometry.taglineVisible).toBe(true);
      if (viewport.width <= 820) {
        expect(geometry.left).toBeGreaterThanOrEqual(geometry.railRight - 1);
      }
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
