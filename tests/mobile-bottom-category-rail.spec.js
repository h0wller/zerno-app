import { test, expect } from '@playwright/test';

const CASES = [
  { brand: 'coffee', rail: '#rail' },
  { brand: 'delivery', rail: '#deliveryRail' },
];

const VIEWPORTS = [
  { name: 'portrait', width: 390, height: 844, expectedHeight: 56 },
  { name: 'compact-landscape', width: 844, height: 390, expectedHeight: 48 },
];

for (const brand of CASES) {
  for (const viewport of VIEWPORTS) {
    test(`${brand.brand}: category rail is docked to the bottom at ${viewport.name}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.addInitScript(() => {
        sessionStorage.setItem('splashDone', '1');
        localStorage.setItem('zt_onb', '1');
        localStorage.setItem('zt_inst_hide', '1');
        localStorage.setItem('zt_ios_hide', '1');
      });
      await page.goto(`/?brand=${brand.brand}`, { waitUntil: 'domcontentloaded' });

      const rail = page.locator(brand.rail);
      await expect(rail).toBeVisible({ timeout: 10000 });
      await expect(rail).toHaveClass(/rail-position-ready/);

      const geometry = await page.evaluate((selector) => {
        const element = document.querySelector(selector);
        const rect = element.getBoundingClientRect();
        const ancestors = [];
        for (let node = element; node && node instanceof HTMLElement; node = node.parentElement) {
          const style = getComputedStyle(node);
          const box = node.getBoundingClientRect();
          ancestors.push({
            tag: node.tagName,
            id: node.id || null,
            className: typeof node.className === 'string' ? node.className : '',
            position: style.position,
            transform: style.transform,
            filter: style.filter,
            perspective: style.perspective,
            contain: style.contain,
            willChange: style.willChange,
            overflowX: style.overflowX,
            overflowY: style.overflowY,
            rect: { top: box.top, right: box.right, bottom: box.bottom, left: box.left },
          });
        }
        const buttons = Array.from(element.querySelectorAll('button'));
        return {
          position: getComputedStyle(element).position,
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left,
          right: rect.right,
          width: rect.width,
          height: rect.height,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          scrollY: window.scrollY,
          safeAreaBottom: getComputedStyle(document.documentElement).getPropertyValue('--sab').trim(),
          buttonHeights: buttons.map(button => button.getBoundingClientRect().height),
          pinClass: element.classList.contains('rail-is-pinned'),
          spacerCount: element.parentElement.querySelectorAll(':scope > .rail-pin-spacer').length,
          ancestors,
        };
      }, brand.rail);

      await testInfo.attach(`${brand.brand}-${viewport.name}-rail-geometry`, {
        body: Buffer.from(JSON.stringify(geometry, null, 2)),
        contentType: 'application/json',
      });

      expect(geometry.position, 'mobile rail is fixed independently of catalog scroll position').toBe('fixed');
      expect(Math.abs(geometry.bottom - geometry.viewportHeight),
        'rail surface is aligned with the viewport bottom edge').toBeLessThanOrEqual(1);
      expect(geometry.height, 'rail uses the compact or regular mobile height')
        .toBe(viewport.expectedHeight);
      expect(geometry.buttonHeights.length).toBeGreaterThan(0);
      expect(geometry.buttonHeights.every(height => height >= 44),
        'category buttons retain at least 44px hit targets').toBe(true);
      expect(geometry.pinClass, 'legacy top-pinning state is not used').toBe(false);
      expect(geometry.spacerCount, 'bottom rail does not leave a top-pin flow spacer').toBe(0);

      const beforeScroll = await rail.boundingBox();
      await page.evaluate(() => window.scrollTo(0, 600));
      await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 5000 })
        .toBeGreaterThan(100);
      const afterScroll = await rail.boundingBox();
      expect(Math.abs(afterScroll.y - beforeScroll.y),
        'rail stays at the same viewport coordinate during catalog scrolling').toBeLessThanOrEqual(1);
      expect(Math.abs(afterScroll.height - beforeScroll.height)).toBeLessThanOrEqual(1);
    });
  }
}
