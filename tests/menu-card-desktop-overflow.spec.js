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

  test('pizza crust labels are not ellipsized on desktop', async ({ page }) => {
    const crusts = page.locator('#deliveryGrid .opts .opt-crust');
    await expect(crusts.first()).toBeVisible();
    await expect(crusts.filter({ hasText: 'тонкое' }).first()).toBeVisible();

    const styles = await crusts.evaluateAll((nodes) => nodes.map((node) => {
      const style = getComputedStyle(node);
      return {
        text: node.textContent.trim(),
        overflow: style.overflow,
        textOverflow: style.textOverflow,
        flexShrink: style.flexShrink
      };
    }));

    expect(styles.length).toBeGreaterThan(0);
    for (const style of styles) {
      expect(style.overflow, style.text).toBe('visible');
      expect(style.textOverflow, style.text).toBe('clip');
      expect(style.flexShrink, style.text).toBe('0');
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

    const rows = await page.evaluate(() => {
      const byTop = new Map();
      for (const card of document.querySelectorAll('#deliveryGrid .card:not(.skeleton-card)')) {
        const rect = card.getBoundingClientRect();
        const key = Math.round(rect.top);
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
