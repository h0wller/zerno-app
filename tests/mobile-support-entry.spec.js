import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test.use({ serviceWorkers: 'block' });

const indexHtml = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const BRANDS = [
  { id: 'coffee', view: '#menuView' },
  { id: 'delivery', view: '#deliveryView' },
];
const VIEWPORTS = [
  { name: '320px', width: 320, height: 740 },
  { name: '390px', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
];

for (const brand of BRANDS) {
  for (const viewport of VIEWPORTS) {
    test(`${brand.id}: support action belongs to the menu toolbar at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.addInitScript(() => {
        localStorage.clear();
        sessionStorage.clear();
        localStorage.setItem('zt_onb', '1');
      });
      await page.goto(`/?brand=${brand.id}`, { waitUntil: 'domcontentloaded' });

      const support = page.locator('#chatFab');
      const search = page.locator(`${brand.view} .mh-right .search`);
      const noScriptBlock = indexHtml.match(/<noscript>([\\s\\S]*?)<\\/noscript>/i)?.[1] || '';
      expect(noScriptBlock).toMatch(/<link rel="stylesheet" href="\\/app\\/ui\\/theme\\/160-15-mobile-support-toolbar\\.css\\?v=\\d+"\\s*\\/>/);
      expect(noScriptBlock).not.toMatch(/160-15-mobile-support-toolbar\\.css[^>]*media=/);
      await expect(support).toBeVisible({ timeout: 15000 });
      await expect(search).toBeVisible({ timeout: 15000 });

      if (viewport.width <= 820) {
        await expect(support).toHaveCSS('position', 'relative');
        await expect.poll(() => support.evaluate((el) => el.parentElement?.classList.contains('mh-right'))).toBe(true);

        const geometry = await page.evaluate(({ view }) => {
          const toolbar = document.querySelector(`${view} .mh-right`);
          const searchRect = toolbar.querySelector('.search').getBoundingClientRect();
          const supportRect = toolbar.querySelector('#chatFab').getBoundingClientRect();
          const toolbarRect = toolbar.getBoundingClientRect();
          const intersects = searchRect.left < supportRect.right
            && searchRect.right > supportRect.left
            && searchRect.top < supportRect.bottom
            && searchRect.bottom > supportRect.top;
          return {
            intersects,
            supportInsideToolbar: supportRect.left >= toolbarRect.left
              && supportRect.right <= toolbarRect.right,
            verticalCenterDelta: Math.abs(
              (searchRect.top + searchRect.height / 2)
              - (supportRect.top + supportRect.height / 2)
            ),
          };
        }, { view: brand.view });

        expect(geometry.intersects, 'support action must not overlap the search input').toBe(false);
        expect(geometry.supportInsideToolbar).toBe(true);
        expect(geometry.verticalCenterDelta).toBeLessThanOrEqual(8);

        await support.click();
        await expect(page.locator('#chatPanel')).toHaveClass(/open/);
        await support.click();
        await expect(page.locator('#chatPanel')).not.toHaveClass(/open/);
      } else {
        await expect(support).toHaveCSS('position', 'fixed');
        await expect.poll(() => support.evaluate((el) => el.parentElement?.id)).toBe('supportLauncherHost');
      }

      const cartPanel = page.locator('#cartPanel');
      await cartPanel.evaluate((element) => element.classList.add('open'));
      await expect(support).toBeHidden();
      await cartPanel.evaluate((element) => element.classList.remove('open'));
      await expect(support).toBeVisible();

      const crossBreakpointWidth = viewport.width <= 820 ? 1440 : 390;
      await page.setViewportSize({ width: crossBreakpointWidth, height: 900 });
      if (crossBreakpointWidth <= 820) {
        await expect(support).toHaveCSS('position', 'relative');
        await expect.poll(() => support.evaluate((el) => el.parentElement?.classList.contains('mh-right'))).toBe(true);
      } else {
        await expect(support).toHaveCSS('position', 'fixed');
        await expect.poll(() => support.evaluate((el) => el.parentElement?.id)).toBe('supportLauncherHost');
      }
    });
  }
}
