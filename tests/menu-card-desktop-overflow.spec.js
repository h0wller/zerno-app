import { test, expect } from '@playwright/test';

test.describe('Desktop delivery card layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('zt_onb', '1');
      sessionStorage.setItem('splashDone', '1');
    });
    await page.goto('/?brand=delivery', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#deliveryGrid .card').first()).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
  });

  test('pizza composition descriptions are fully visible on desktop', async ({ page }) => {
    const descriptions = page.locator('#deliveryGrid .cbody .desc');
    await expect(descriptions.first()).toBeVisible();
    const measurements = await descriptions.evaluateAll((nodes) => nodes.map((node) => {
      const style = getComputedStyle(node);
      return {
        text: node.textContent.trim(),
        display: style.display,
        overflow: style.overflow,
        lineClamp: style.webkitLineClamp,
        clientHeight: node.clientHeight,
        scrollHeight: node.scrollHeight
      };
    }));

    expect(measurements.length).toBeGreaterThan(0);
    for (const item of measurements) {
      expect(item.display, item.text).toBe('block');
      expect(item.overflow, item.text).toBe('visible');
      expect(item.lineClamp, item.text).toBe('none');
      expect(
        item.scrollHeight,
        `Composition is clipped: ${item.scrollHeight}px content inside ${item.clientHeight}px`
      ).toBeLessThanOrEqual(item.clientHeight + 1);
    }
  });

  test('pizza crust labels are not ellipsized on desktop', async ({ page }) => {
    const crusts = page.locator('#deliveryGrid .opts .opt-crust');
    await expect(crusts.first()).toBeVisible();
    await expect(crusts.filter({ hasText: 'тонкое' }).first()).toBeVisible();

    const widths = await crusts.evaluateAll((nodes) => nodes.map((node) => ({
      text: node.textContent.trim(),
      renderedWidth: node.getBoundingClientRect().width,
      scrollWidth: node.scrollWidth
    })));

    expect(widths.length).toBeGreaterThan(0);
    for (const item of widths) {
      expect(item.text, 'full crust name should remain in the DOM').toMatch(/^(пышное|тонкое)$/);
      expect(
        item.scrollWidth,
        `Crust label "${item.text}" is clipped: ${item.scrollWidth}px inside ${item.renderedWidth}px`
      ).toBeLessThanOrEqual(item.renderedWidth + 1);
    }
  });

  test('roll cards keep equal height within each desktop grid row', async ({ page }) => {
    await page.evaluate(() => {
      window.dcat = 'rolls';
      window.renderDeliveryMenu();
    });

    const cards = page.locator('#deliveryGrid .card:not(.skeleton-card)');
    await expect(cards.first()).toBeVisible();
    await expect.poll(() => cards.count()).toBeGreaterThan(1);

    await page.addStyleTag({
      content: '#deliveryGrid > .card { content-visibility: visible !important; contain-intrinsic-block-size: auto !important; }'
    });
    for (const card of await cards.all()) await card.scrollIntoViewIfNeeded();

    const rows = await page.evaluate(() => {
      const byTop = new Map();
      for (const card of document.querySelectorAll('#deliveryGrid .card:not(.skeleton-card)')) {
        const rect = card.getBoundingClientRect();
        const key = Math.round(rect.top + window.scrollY);
        if (!byTop.has(key)) byTop.set(key, []);
        byTop.get(key).push(rect.height);
      }
      return [...byTop.values()];
    });

    expect(rows.length).toBeGreaterThan(0);
    for (const heights of rows) {
      expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1);
    }
  });
});
