import { test, expect } from '@playwright/test';

const CASES = [
  { brand: 'coffee', view: '#menuView', head: '#menuView .menu-head', rail: '#rail', grid: '#grid', tickerBg: 'rgb(18, 58, 107)' },
  { brand: 'delivery', view: '#deliveryView', head: '#deliveryView .menu-head', rail: '#deliveryRail', grid: '#deliveryGrid', tickerBg: 'rgb(58, 42, 28)' },
];

const VIEWPORTS = [
  { name: 'narrow mobile', width: 320, height: 740 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile breakpoint', width: 820, height: 900 },
  { name: 'desktop breakpoint', width: 821, height: 900 },
  { name: 'desktop', width: 1440, height: 900 },
];

for (const brand of CASES) {
  for (const viewport of VIEWPORTS) {
    test(`${brand.brand}: category navigation follows the responsive shell at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
      await page.goto(`/?brand=${brand.brand}`, { waitUntil: 'domcontentloaded' });

      const menuHead = page.locator(brand.head);
      const rail = page.locator(brand.rail);
      const ticker = page.locator('.ticker');
      const topbar = page.locator('header.topbar');

      await expect(menuHead).toBeVisible({ timeout: 10000 });
      await expect(rail).toBeVisible({ timeout: 10000 });
      await expect(ticker).toHaveCSS('display', 'flex');
      if (viewport.width <= 820) {
        await expect(topbar).toHaveCSS('border-bottom-width', '0px');
      }

      const layout = await page.evaluate(({ viewSelector, headSelector, railSelector, gridSelector, isDelivery }) => {
        const view = document.querySelector(viewSelector);
        const head = document.querySelector(headSelector);
        const railEl = document.querySelector(railSelector);
        const grid = document.querySelector(gridSelector);
        const subfilter = isDelivery ? document.getElementById('deliverySubFilter') : null;
        const r = railEl.getBoundingClientRect();
        const h = head.getBoundingClientRect();
        const g = grid.getBoundingClientRect();
        const style = getComputedStyle(railEl);
        return {
          parentId: railEl.parentElement && railEl.parentElement.id,
          parentClass: railEl.parentElement && railEl.parentElement.className,
          display: style.display,
          flexDirection: style.flexDirection,
          overflowX: style.overflowX,
          position: style.position,
          ready: railEl.classList.contains('rail-position-ready'),
          railTop: r.top,
          railBottom: r.bottom,
          headBottom: h.bottom,
          gridTop: g.top,
          subfilterBeforeRail: !!(subfilter && (subfilter.compareDocumentPosition(railEl) & Node.DOCUMENT_POSITION_FOLLOWING)),
          railBeforeSubfilter: !!(subfilter && (railEl.compareDocumentPosition(subfilter) & Node.DOCUMENT_POSITION_FOLLOWING)),
          railBeforeGrid: !!(railEl.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING),
          railScrollWidth: railEl.scrollWidth,
          railClientWidth: railEl.clientWidth,
          documentWidth: document.documentElement.clientWidth,
          documentScrollWidth: document.documentElement.scrollWidth,
          viewContainsRail: view.contains(railEl),
        };
      }, {
        viewSelector: brand.view,
        headSelector: brand.head,
        railSelector: brand.rail,
        gridSelector: brand.grid,
        isDelivery: brand.brand === 'delivery',
      });

      if (viewport.width <= 820) {
        expect(layout.parentId).toBe(brand.brand === 'coffee' ? 'menuView' : 'deliveryView');
        expect(layout.viewContainsRail).toBe(true);
        expect(layout.display).toBe('flex');
        expect(layout.flexDirection).toBe('row');
        expect(['auto', 'scroll']).toContain(layout.overflowX);
        expect(layout.position).toBe('static');
        expect(layout.ready).toBe(false);
        expect(layout.railTop).toBeGreaterThanOrEqual(layout.headBottom - 1);
        expect(layout.railBottom).toBeLessThanOrEqual(layout.gridTop + 1);
        expect(layout.railBeforeGrid).toBe(true);
        if (brand.brand === 'delivery') {
          expect(layout.subfilterBeforeRail).toBe(false);
          expect(layout.railBeforeSubfilter).toBe(true);
        }
      } else {
        expect(layout.parentClass).toContain('wrap');
        expect(layout.viewContainsRail).toBe(false);
        expect(layout.ready).toBe(true);
        expect(layout.flexDirection).toBe('column');
      }

      expect(layout.documentScrollWidth, 'category layout must not create horizontal page overflow')
        .toBeLessThanOrEqual(layout.documentWidth + 1);

      await expect.poll(() => ticker.evaluate((el) => getComputedStyle(el).backgroundColor), { timeout: 5000 })
        .toBe(brand.tickerBg);

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
          trackWidth: trackEl.getBoundingClientRect().width,
        };
      });
      expect(tickerLayout.viewportWidth).toBeCloseTo(tickerLayout.tickerWidth, 0);
      expect(tickerLayout.trackWidth).toBeGreaterThanOrEqual(tickerLayout.viewportWidth);
      expect(Math.abs(tickerLayout.tickerTop - tickerLayout.topbarBottom)).toBeLessThanOrEqual(1);

      await page.evaluate(() => window.scrollTo(0, 500));
      if (viewport.width > 820) {
        await expect.poll(() => page.evaluate(({ headSelector, railSelector }) => {
          const head = document.querySelector(headSelector).getBoundingClientRect();
          const railRect = document.querySelector(railSelector).getBoundingClientRect();
          const topbarRect = document.querySelector('header.topbar').getBoundingClientRect();
          const clearanceTop = Math.max(0, head.bottom, topbarRect.bottom) + 12;
          const targetCenter = (clearanceTop + window.innerHeight - 12) / 2;
          return Math.abs((railRect.top + railRect.height / 2) - targetCenter);
        }, { headSelector: brand.head, railSelector: brand.rail }), { timeout: 5000 }).toBeLessThanOrEqual(2);
      }
    });
  }
}
