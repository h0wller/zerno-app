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
                    node: node ? `${node.tagName.toLowerCase()}${node.id ? `#${node.id}` : ''}${typeof node.className === 'string' && node.className ? `.${node.className.trim().replace(/\\s+/g, '.')}` : ''}` : null,
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
      return {
        ticker: box(ticker),
        tickerOverflow: ticker && getComputedStyle(ticker).overflow,
        heading: box(heading),
        card: box(card),
        media: box(media),
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
    expect(before.card.width).toBeLessThanOrEqual(before.viewportWidth - 80);
    expect(before.scrollWidth).toBeLessThanOrEqual(before.viewportWidth + 1);

    await page.waitForLoadState('load');
    await page.waitForTimeout(100);
    const after = await measure();
    console.log('[slow-network-layout] after deferred CSS', JSON.stringify(after));
    expect(after.card.width).toBe(before.card.width);
    expect(after.media.height).toBe(before.media.height);
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
});
