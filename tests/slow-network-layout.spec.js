import { test, expect } from '@playwright/test';

test.describe('Slow network: first viewport stays styled before deferred CSS', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('delivery ticker and menu header do not flash into unstyled layout', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('zt_onb', '1');
      localStorage.setItem('zt_inst_hide', '1');
      sessionStorage.setItem('splashDone', '1');
      window.__layoutShifts = [];
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) window.__layoutShifts.push(entry.value);
          }
        }).observe({ type: 'layout-shift', buffered: true });
      } catch (_) {}
    });

    await page.route('**/app/ui/theme/*.css*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 900));
      await route.continue();
    });

    await page.goto('/?brand=delivery', { waitUntil: 'commit' });
    const ticker = page.locator('#ticker');
    const track = page.locator('#tickerTrack');
    await expect(track.locator('span').first()).toBeAttached({ timeout: 10000 });

    const measure = () => page.evaluate(() => {
      const tickerEl = document.getElementById('ticker');
      const heading = document.querySelector('#deliveryView .menu-head h1');
      const sections = document.querySelector('#deliveryView .menu-head h2.vh');
      const box = (el) => {
        const r = el.getBoundingClientRect();
        return { width: Math.round(r.width), height: Math.round(r.height), top: Math.round(r.top) };
      };
      return {
        ticker: box(tickerEl),
        tickerOverflow: getComputedStyle(tickerEl).overflow,
        heading: box(heading),
        sections: box(sections),
        viewportWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth
      };
    });

    const before = await measure();
    expect(before.ticker.height).toBeLessThanOrEqual(30);
    expect(before.tickerOverflow).toBe('hidden');
    expect(before.heading.width).toBeLessThanOrEqual(before.viewportWidth);
    expect(before.sections.width).toBeLessThanOrEqual(before.viewportWidth);
    expect(before.scrollWidth).toBeLessThanOrEqual(before.viewportWidth + 1);

    await page.waitForLoadState('load');
    await page.waitForTimeout(100);
    const after = await measure();
    expect(after.ticker.height).toBeLessThanOrEqual(30);
    expect(after.heading.width).toBe(before.heading.width);
    expect(after.sections.width).toBe(before.sections.width);

    const cls = await page.evaluate(() => window.__layoutShifts.reduce((sum, value) => sum + value, 0));
    expect(cls).toBeLessThan(0.01);
  });
});
