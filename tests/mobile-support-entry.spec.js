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

async function expectCompact44pxHitTarget(locator) {
  const metrics = await locator.evaluate((button) => {
    const rect = button.getBoundingClientRect();
    const points = [
      [rect.left + 2, rect.top + 2],
      [rect.right - 2, rect.top + 2],
      [rect.left + 2, rect.bottom - 2],
      [rect.right - 2, rect.bottom - 2],
      [rect.left + rect.width / 2, rect.top + 2],
      [rect.left + rect.width / 2, rect.bottom - 2],
      [rect.left + 2, rect.top + rect.height / 2],
      [rect.right - 2, rect.top + rect.height / 2]
    ];
    const face = window.getComputedStyle(button, '::before');
    return {
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      faceWidth: Number.parseFloat(face.width),
      faceHeight: Number.parseFloat(face.height),
      edgeHits: points.map(([x, y]) => document.elementFromPoint(x, y)?.closest('button') === button)
    };
  });

  expect(metrics.width).toBeGreaterThanOrEqual(44);
  expect(metrics.height).toBeGreaterThanOrEqual(44);
  expect(metrics.faceWidth).toBe(32);
  expect(metrics.faceHeight).toBe(32);
  expect(metrics.edgeHits.every(Boolean)).toBe(true);
}

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

      if (viewport.width <= 820) {
        const targets = await page.evaluate(({ view }) => {
          const box = (element) => {
            const rect = element.getBoundingClientRect();
            return { width: rect.width, height: rect.height };
          };
          return {
            launcherHost: box(document.querySelector(`${view} #supportLauncherHost`)),
            launcher: box(document.querySelector(`${view} #chatFab`)),
            search: box(document.querySelector(`${view} .mh-right .search`))
          };
        }, { view: brand.view });
        expect(targets.launcherHost).toEqual({ width: 44, height: 44 });
        expect(targets.launcher).toEqual({ width: 44, height: 44 });
        expect(targets.search.height).toBe(40);
        await expect(support).toHaveCSS('position', 'relative');
        await expect.poll(() => supportHost.evaluate((el) => el.parentElement?.classList.contains('mh-right'))).toBe(true);

        const geometry = await page.evaluate(({ view }) => {
          const toolbar = document.querySelector(`${view} .mh-right`);
          const searchRect = toolbar.querySelector('.search').getBoundingClientRect();
          const supportRect = toolbar.querySelector('#chatFab').getBoundingClientRect();
          const supportHostRect = toolbar.querySelector('#supportLauncherHost').getBoundingClientRect();
          const toolbarRect = toolbar.getBoundingClientRect();
          const intersects = searchRect.left < supportRect.right
            && searchRect.right > supportRect.left
            && searchRect.top < supportRect.bottom
            && searchRect.bottom > supportRect.top;
          return {
            intersects,
            supportInsideToolbar: supportHostRect.left >= toolbarRect.left
              && supportHostRect.right <= toolbarRect.right,
            supportInsideLandmark: toolbar.querySelector('#chatFab').parentElement
              === toolbar.querySelector('#supportLauncherHost'),
            verticalCenterDelta: Math.abs(
              (searchRect.top + searchRect.height / 2)
              - (supportRect.top + supportRect.height / 2)
            ),
          };
        }, { view: brand.view });

        expect(geometry.intersects, 'support action must not overlap the search input').toBe(false);
        expect(geometry.supportInsideToolbar).toBe(true);
        expect(geometry.supportInsideLandmark).toBe(true);
        expect(geometry.verticalCenterDelta).toBeLessThanOrEqual(8);

        await support.click();
        await expect(page.locator('#chatPanel')).toHaveClass(/open/);
        const closeChat = page.locator('#chatClose');
        const sendChat = page.locator('#chatSend');
        await expect(closeChat).toBeVisible();
        await expect(sendChat).toBeVisible();
        await expectCompact44pxHitTarget(closeChat);
        await expectCompact44pxHitTarget(sendChat);
        await closeChat.click();
        await expect(page.locator('#chatPanel')).not.toHaveClass(/open/);
      } else {
        await expect(support).toHaveCSS('position', 'fixed');
        await expect.poll(() => supportHost.evaluate((el) => el.parentElement === document.body)).toBe(true);
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
        await expect.poll(() => supportHost.evaluate((el) => el.parentElement?.classList.contains('mh-right'))).toBe(true);
      } else {
        await expect(support).toHaveCSS('position', 'fixed');
        await expect.poll(() => supportHost.evaluate((el) => el.parentElement === document.body)).toBe(true);
      }

      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      if (viewport.width <= 820) {
        await expect(support).toHaveCSS('position', 'relative');
        await expect.poll(() => supportHost.evaluate((el) => el.parentElement?.classList.contains('mh-right'))).toBe(true);
      } else {
        await expect(support).toHaveCSS('position', 'fixed');
        await expect.poll(() => supportHost.evaluate((el) => el.parentElement === document.body)).toBe(true);
      }
    });
  }
}
