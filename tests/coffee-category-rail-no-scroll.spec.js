import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { name: '320', width: 320, height: 740 },
  { name: '360', width: 360, height: 800 },
  { name: '390', width: 390, height: 844 },
  { name: '430', width: 430, height: 932 },
  { name: 'short-landscape', width: 844, height: 390 },
];

test.describe('coffee category rail has no internal horizontal scrolling', () => {
  for (const viewport of VIEWPORTS) {
    test(`all six coffee categories fit and remain tappable at ${viewport.name}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.addInitScript(() => {
        sessionStorage.setItem('splashDone', '1');
        localStorage.setItem('zt_onb', '1');
        localStorage.setItem('zt_inst_hide', '1');
        localStorage.setItem('zt_ios_hide', '1');
      });
      await page.goto('/?brand=coffee', { waitUntil: 'domcontentloaded' });

      const rail = page.locator('#rail');
      await expect(rail).toBeVisible({ timeout: 10000 });
      await expect(rail.locator('button')).toHaveCount(6);

      const state = await rail.evaluate(element => {
        const railRect = element.getBoundingClientRect();
        const buttons = Array.from(element.querySelectorAll('button')).map(button => {
          const rect = button.getBoundingClientRect();
          return {
            label: button.textContent.trim(),
            ariaLabel: button.getAttribute('aria-label'),
            title: button.getAttribute('title'),
            left: rect.left,
            right: rect.right,
            width: rect.width,
            height: rect.height,
          };
        });
        return {
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          overflowX: getComputedStyle(element).overflowX,
          railLeft: railRect.left,
          railRight: railRect.right,
          viewportWidth: window.innerWidth,
          buttons,
        };
      });

      await testInfo.attach(`coffee-rail-no-scroll-${viewport.name}.json`, {
        body: Buffer.from(JSON.stringify(state, null, 2)),
        contentType: 'application/json',
      });
      await testInfo.attach(`coffee-rail-no-scroll-${viewport.name}.png`, {
        body: await page.screenshot({ animations: 'disabled' }),
        contentType: 'image/png',
      });

      expect(state.scrollWidth, 'coffee category rail must not have internal horizontal overflow')
        .toBeLessThanOrEqual(state.clientWidth);
      expect(state.overflowX, 'coffee rail should not expose a horizontal scrolling surface')
        .not.toBe('auto');
      expect(state.buttons.every(button => button.width >= 44 && button.height >= 44),
        'all category targets remain at least 44×44 CSS px').toBe(true);
      expect(state.buttons.every(button => button.left >= state.railLeft - 1 &&
        button.right <= state.railRight + 1), 'all six categories are visible without scrolling').toBe(true);
      expect(state.buttons.every(button => button.ariaLabel || button.title || button.label.length > 0),
        'icon-only compact controls retain accessible category names').toBe(true);
    });
  }
});
