import { test, expect } from '@playwright/test';

test.describe('Slow network: first viewport stays styled before deferred CSS', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('delivery menu keeps its content column and product card geometry', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('zt_onb', '1');
      localStorage.setItem('zt_inst_hide', '1');
      sessionStorage.setItem('splashDone', '1');
      window.__layoutShifts = [];
      window.__layoutShiftDetails = [];
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) {
              window.__layoutShifts.push(entry.value);
              window.__layoutShiftDetails.push({
                value: entry.value,
                startTime: entry.startTime,
                sources: (entry.sources || []).map((source) => {
                  const node = source.node;
                  return {
                    node: node ? `${node.tagName.toLowerCase()}${node.id ? `#${node.id}` : ''}${typeof node.className === 'string' && node.className ? `.${node.className.trim().replace(/\s+/g, '.')}` : ''}` : null,
                    previousRect: source.previousRect,
                    currentRect: source.currentRect
                  };
                })
              });
            }
          }
        }).observe({ type: 'layout-shift', buffered: true });
      } catch (_) {}
    });

    await page.route('**/app/ui/theme/*.css*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 900));
      await route.continue();
    });

    await page.goto('/?brand=delivery', { waitUntil: 'commit' });
    await expect(page.locator('#deliveryGrid > .card').first()).toBeAttached({ timeout: 10000 });

    const measure = () => page.evaluate(() => {
      const box = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width), height: Math.round(r.height) };
      };
      const ticker = document.querySelector('.ticker');
      const heading = document.querySelector('#deliveryView .menu-head h1');
      const card = document.querySelector('#deliveryGrid > .card');
      const media = card && card.querySelector('.media');
      const brandTitle = document.querySelector('#brandTitle');
      const brandSub = document.querySelector('#brandSub');
      return {
        ticker: box(ticker),
        tickerOverflow: ticker && getComputedStyle(ticker).overflow,
        heading: box(heading),
        card: box(card),
        media: box(media),
        brandMark: box(document.querySelector('#brandMark')),
        brandTitleDisplay: brandTitle && getComputedStyle(brandTitle).display,
        brandSubDisplay: brandSub && getComputedStyle(brandSub).display,
        search: box(document.querySelector('#deliveryView .mh-right .search')),
        searchInput: box(document.querySelector('#dSearch')),
        updated: box(document.querySelector('#deliveryView .menu-head .upd')),
        subchip: box(document.querySelector('#deliverySubFilter .subchip')),
        option: box(document.querySelector('#deliveryGrid .opts .opt-btn')),
        section: box(document.querySelector('.wrap > section')),
        rail: box(document.querySelector('.wrap > .rail:not([style*="display: none"])')),
        viewportWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth
      };
    });

    const before = await measure();
    console.log('[slow-network-layout] before deferred CSS', JSON.stringify(before));
    expect(before.ticker).not.toBeNull();
    expect(before.ticker.height).toBeLessThanOrEqual(30);
    expect(before.tickerOverflow).toBe('hidden');
    expect(before.section.width).toBeGreaterThan(250);
    expect(before.section.width).toBeLessThanOrEqual(before.viewportWidth - 80);
    expect(before.heading.width).toBeGreaterThan(200);
    expect(before.heading.x).toBeGreaterThanOrEqual(before.section.x);
    expect(before.heading.right).toBeLessThanOrEqual(before.section.right + 1);
    expect(before.card.width).toBeGreaterThan(200);
    expect(before.media.height).toBe(180);
    expect(before.brandMark).not.toBeNull();
    expect(before.brandTitleDisplay).toBe('none');
    expect(before.brandSubDisplay).toBe('none');
    expect(before.search).not.toBeNull();
    expect(before.searchInput).not.toBeNull();
    expect(before.card.width).toBeLessThanOrEqual(before.viewportWidth - 80);
    expect(before.scrollWidth).toBeLessThanOrEqual(before.viewportWidth + 1);

    await page.waitForLoadState('load');
    await page.waitForTimeout(100);
    const after = await measure();
    console.log('[slow-network-layout] after deferred CSS', JSON.stringify(after));
    expect(after.card.width).toBe(before.card.width);
    expect(after.media.height).toBe(before.media.height);
    expect(after.brandMark).toEqual(before.brandMark);
    expect(after.brandTitleDisplay).toBe(before.brandTitleDisplay);
    expect(after.brandSubDisplay).toBe(before.brandSubDisplay);
    expect(after.search).toEqual(before.search);
    expect(after.searchInput).toEqual(before.searchInput);
    expect(after.updated.width).toBe(before.updated.width);
    expect(after.subchip.width).toBe(before.subchip.width);
    expect(after.option.height).toBe(before.option.height);
    expect(after.heading.width).toBeGreaterThan(200);
    expect(after.heading.x).toBeGreaterThanOrEqual(after.section.x);
    expect(after.heading.right).toBeLessThanOrEqual(after.section.right + 1);
    expect(after.section.width).toBe(before.section.width);

    const shiftReport = await page.evaluate(() => ({
      cls: window.__layoutShifts.reduce((sum, value) => sum + value, 0),
      shifts: window.__layoutShiftDetails
    }));
    console.log('[slow-network-layout] layout shift attribution', JSON.stringify(shiftReport));
    const cls = shiftReport.cls;
    expect(cls).toBeLessThan(0.01);
  });

  test('delivery header stays stable at responsive breakpoints', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('zt_onb', '1');
      localStorage.setItem('zt_inst_hide', '1');
      sessionStorage.setItem('splashDone', '1');
    });
    await page.route('**/app/ui/theme/*.css*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 900));
      await route.continue();
    });

    for (const width of [320, 480, 690, 820, 821, 1023]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/?brand=delivery', { waitUntil: 'commit' });
      await expect(page.locator('#deliveryGrid > .card').first()).toBeAttached({ timeout: 10000 });

      const measureBrand = () => page.evaluate(() => {
        const mark = document.querySelector('#brandMark');
        const rect = mark && mark.getBoundingClientRect();
        return {
          x: rect ? Math.round(rect.x) : null,
          y: rect ? Math.round(rect.y) : null,
          width: rect ? Math.round(rect.width) : null,
          height: rect ? Math.round(rect.height) : null,
          titleDisplay: getComputedStyle(document.querySelector('#brandTitle')).display,
          subDisplay: getComputedStyle(document.querySelector('#brandSub')).display,
          viewportWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth
        };
      });

      const before = await measureBrand();
      expect(before.width, `brand mark exists at ${width}px`).not.toBeNull();
      if (width <= 1023) {
        expect(before.titleDisplay, `coffee title hidden at ${width}px before CSS`).toBe('none');
        expect(before.subDisplay, `coffee subtitle hidden at ${width}px before CSS`).toBe('none');
      }
      expect(before.scrollWidth, `no initial horizontal overflow at ${width}px`)
        .toBeLessThanOrEqual(width + 1);

      await page.waitForLoadState('load');
      await page.waitForTimeout(50);
      const after = await measureBrand();
      expect(after.x, `brand x remains stable at ${width}px`).toBe(before.x);
      expect(after.y, `brand y remains stable at ${width}px`).toBe(before.y);
      expect(after.width, `brand width remains stable at ${width}px`).toBe(before.width);
      expect(after.height, `brand height remains stable at ${width}px`).toBe(before.height);
      expect(after.scrollWidth, `no final horizontal overflow at ${width}px`)
        .toBeLessThanOrEqual(width + 1);
    }
  });
});
