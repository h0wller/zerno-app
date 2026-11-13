import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

const BRANDS = ['coffee', 'delivery'];
const VIEWPORTS = [
  { width: 320, height: 740 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
];

for (const brand of BRANDS) {
  for (const viewport of VIEWPORTS) {
    test(`${brand}: profile control keeps a 32px face inside a 44px hit cell at ${viewport.width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      await page.addInitScript(() => {
        localStorage.clear();
        sessionStorage.clear();
        localStorage.setItem('zt_onb', '1');
        sessionStorage.setItem('splashDone', '1');
      });
      await page.goto(`/?brand=${brand}`, { waitUntil: 'domcontentloaded' });

      const profile = page.locator('#profileTopBtn');
      await expect(profile).toBeVisible();

      const metrics = await profile.evaluate((button) => {
        const rect = button.getBoundingClientRect();
        const face = getComputedStyle(button, '::before');
        const inset = ['top', 'right', 'bottom', 'left'].reduce((result, side) => {
          result[side] = Number.parseFloat(face[side]) || 0;
          return result;
        }, {});
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const points = [
          [cx - 21, cy - 21],
          [cx + 21, cy - 21],
          [cx - 21, cy + 21],
          [cx + 21, cy + 21],
        ];
        return {
          width: rect.width,
          height: rect.height,
          pseudoContent: face.content,
          faceWidth: rect.width - inset.left - inset.right,
          faceHeight: rect.height - inset.top - inset.bottom,
          inset,
          hitPoints: points.map(([x, y]) => {
            const hit = document.elementFromPoint(x, y);
            return hit === button || button.contains(hit);
          }),
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        };
      });

      expect(metrics.width, JSON.stringify(metrics)).toBe(44);
      expect(metrics.height, JSON.stringify(metrics)).toBe(44);
      expect(metrics.pseudoContent).not.toBe('none');
      expect(metrics.faceWidth, JSON.stringify(metrics)).toBe(32);
      expect(metrics.faceHeight, JSON.stringify(metrics)).toBe(32);
      expect(metrics.hitPoints.every(Boolean), JSON.stringify(metrics)).toBe(true);
      expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);

      if (viewport.width === 390) {
        await testInfo.attach(`tap-target-profile-${brand}-390px`, {
          body: await page.screenshot({ fullPage: false }),
          contentType: 'image/png',
        });
      }
    });
  }
}
