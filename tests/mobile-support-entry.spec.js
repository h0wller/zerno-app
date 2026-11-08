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
    test(`${brand.id}: support remains a floating launcher outside the search row at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.addInitScript(() => {
        localStorage.clear();
        sessionStorage.clear();
        localStorage.setItem('zt_onb', '1');
      });
      await page.goto(`/?brand=${brand.id}`, { waitUntil: 'domcontentloaded' });

      const support = page.locator('#chatFab');
      const supportHost = page.locator('#supportLauncherHost');
      const search = page.locator(`${brand.view} .mh-right .search`);
      const noScriptStart = indexHtml.indexOf('<noscript>');
      const noScriptEnd = indexHtml.indexOf('</noscript>', noScriptStart);
      const noScriptBlock = noScriptStart >= 0 && noScriptEnd > noScriptStart
        ? indexHtml.slice(noScriptStart, noScriptEnd)
        : '';
      expect(noScriptBlock).toContain('<link rel="stylesheet" href="/app/ui/theme/160-15-mobile-support-toolbar.css?v=');
      expect(noScriptBlock).not.toContain('160-15-mobile-support-toolbar.css" media=');
      await expect(support).toBeVisible({ timeout: 15000 });
      await expect(supportHost).toHaveCount(1);
      await expect(supportHost).toHaveAttribute('aria-label', 'Поддержка');
      await expect.poll(() => support.evaluate((el) => el.parentElement?.id)).toBe('supportLauncherHost');
      await expect(search).toBeVisible({ timeout: 15000 });
      await expect(support).toHaveCSS('position', 'fixed');
      await expect(support).toHaveCSS('width', '56px');
      await expect(support).toHaveCSS('height', '56px');
      await expect.poll(() => supportHost.evaluate((el) => el.parentElement === document.body)).toBe(true);

      if (viewport.width <= 820) {
        const geometry = await page.evaluate(({ view }) => {
          const toolbar = document.querySelector(`${view} .mh-right`);
          const searchRect = toolbar.querySelector('.search').getBoundingClientRect();
          const toolbarRect = toolbar.getBoundingClientRect();
          const supportHost = document.getElementById('supportLauncherHost');
          const supportRect = document.getElementById('chatFab').getBoundingClientRect();
          const intersects = searchRect.left < supportRect.right
            && searchRect.right > supportRect.left
            && searchRect.top < supportRect.bottom
            && searchRect.bottom > supportRect.top;
          return {
            searchWidth: searchRect.width,
            toolbarWidth: toolbarRect.width,
            searchHeight: searchRect.height,
            supportInsideToolbar: toolbar.contains(supportHost),
            supportRight: supportRect.right,
            supportBottom: supportRect.bottom,
            viewportWidth: document.documentElement.clientWidth,
            viewportHeight: window.innerHeight,
            intersects
          };
        }, { view: brand.view });

        expect(geometry.searchWidth).toBeGreaterThanOrEqual(geometry.toolbarWidth - 2);
        expect(geometry.searchHeight).toBeGreaterThanOrEqual(44);
        expect(geometry.supportInsideToolbar).toBe(false);
        expect(geometry.intersects).toBe(false);
        expect(geometry.supportRight).toBeLessThanOrEqual(geometry.viewportWidth + 1);
        expect(geometry.supportBottom).toBeLessThanOrEqual(geometry.viewportHeight + 1);
      }

      await support.click();
      await expect(page.locator('#chatPanel')).toHaveClass(/open/);
      const closeChat = page.locator('#chatClose');
      await expect(closeChat).toBeVisible();
      await closeChat.click();
      await expect(page.locator('#chatPanel')).not.toHaveClass(/open/);

      const cartPanel = page.locator('#cartPanel');
      await cartPanel.evaluate((element) => element.classList.add('open'));
      await expect(support).toBeHidden();
      await cartPanel.evaluate((element) => element.classList.remove('open'));
      await expect(support).toBeVisible();

      const crossBreakpointWidth = viewport.width <= 820 ? 1440 : 390;
      await page.setViewportSize({ width: crossBreakpointWidth, height: 900 });
      await expect(support).toHaveCSS('position', 'fixed');
      await expect(support).toHaveCSS('width', '56px');
      await expect.poll(() => supportHost.evaluate((el) => el.parentElement === document.body)).toBe(true);

      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await expect(support).toHaveCSS('position', 'fixed');
      await expect(support).toHaveCSS('width', '56px');
      await expect.poll(() => supportHost.evaluate((el) => el.parentElement === document.body)).toBe(true);
    });
  }
}
