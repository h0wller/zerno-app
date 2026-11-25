import { test, expect } from '@playwright/test';

test.describe('Brand header first-frame stability', () => {
  test.use({ serviceWorkers: 'block' });
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    for (const brand of ['coffee', 'delivery']) {
      test(`${brand} header keeps its first-frame mark geometry at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
        await page.setViewportSize(viewport);
        await page.addInitScript((selectedBrand) => {
          localStorage.clear();
          sessionStorage.setItem('splashDone', '1');
          localStorage.setItem('zt_onb', '1');
          localStorage.setItem('zt_brand', selectedBrand);
        }, brand);
        await page.route('**/api/**', route => route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ ok: true, items: [], orders: [], customers: [], threads: [], messages: [] })
        }));
        await page.goto('/?brand=' + brand, { waitUntil: 'commit' });
        const firstFrame = await page.evaluate(() => {
          const bean = document.querySelector('#brandTitle .bean');
          const mark = document.querySelector('#brandMark');
          const image = mark && mark.querySelector('img');
          const rect = element => {
            const r = element.getBoundingClientRect();
            return { x:r.x, y:r.y, width:r.width, height:r.height };
          };
          return { bean: bean ? rect(bean) : null, beanSvg: bean ? rect(bean.querySelector('svg')) : null,
            mark: rect(mark), src: image && new URL(image.getAttribute('src'), location.href).pathname };
        });
        expect(firstFrame.src).toBe(brand === 'coffee' ? '/andCoffee.svg' : '/friday-logo.svg');
        await page.waitForFunction(() => window.applyBrandChrome && document.querySelector('#brandMark img'));
        const hydrated = await page.evaluate(() => {
          const bean = document.querySelector('#brandTitle .bean');
          const mark = document.querySelector('#brandMark');
          const rect = element => { const r = element.getBoundingClientRect(); return { x:r.x, y:r.y, width:r.width, height:r.height }; };
          return { bean: bean ? rect(bean) : null, beanSvg: bean ? rect(bean.querySelector('svg')) : null, mark: rect(mark) };
        });
        if (brand === 'coffee') {
          expect(firstFrame.bean).not.toBeNull();
          expect(firstFrame.beanSvg).not.toBeNull();
          for (const edge of ['x','y','width','height']) {
            expect(Math.abs(hydrated.bean[edge] - firstFrame.bean[edge])).toBeLessThanOrEqual(1);
            expect(Math.abs(hydrated.beanSvg[edge] - firstFrame.beanSvg[edge])).toBeLessThanOrEqual(1);
          }
        }
        for (const edge of ['x','y','width','height']) expect(Math.abs(hydrated.mark[edge] - firstFrame.mark[edge])).toBeLessThanOrEqual(1);
        await testInfo.attach(`brand-header-${brand}-${viewport.width}x${viewport.height}.png`, { body: await page.screenshot(), contentType: 'image/png' });
      });
    }
  }
});
