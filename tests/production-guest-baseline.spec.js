import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.TEST_URL || 'https://friday.andcoffee.online';
const PRODUCTION_COMMIT = 'c005b1c6832a5b722c97c43dd7cd525f638c209b';
const OUT = path.resolve('artifacts', 'production-guest-baseline');
const VIEWPORTS = [
  { id: 'xs', width: 320, height: 740 },
  { id: 'm', width: 390, height: 844 },
  { id: 't', width: 768, height: 1024 },
  { id: 'd', width: 1440, height: 900 },
];

test.setTimeout(360_000);
test.use({
  serviceWorkers: 'block',
  colorScheme: 'light',
  reducedMotion: 'no-preference',
});

test('archive both production guest menus at four viewport sizes without changing site data', async ({ browser }, testInfo) => {
  fs.mkdirSync(OUT, { recursive: true });
  const captures = [];

  for (const brand of ['coffee', 'delivery']) {
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 1,
        colorScheme: 'light',
        reducedMotion: 'no-preference',
        serviceWorkers: 'block',
      });
      const page = await context.newPage();
      const url = new URL('/', BASE);
      url.searchParams.set('brand', brand);

      try {
        await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 60_000 });
        await expect(page.locator('html')).toHaveAttribute('data-brand', brand, { timeout: 30_000 });

        const grid = brand === 'delivery' ? '#deliveryGrid' : '#grid';
        const cards = page.locator(`${grid} .card:not(.skeleton-card)`);
        await expect(page.locator(grid)).toBeVisible({ timeout: 45_000 });
        await expect(cards.first()).toBeVisible({ timeout: 45_000 });
        await expect(page.locator(`${grid} .skeleton-card`)).toHaveCount(0, { timeout: 45_000 });

        await page.evaluate(async () => {
          if (document.fonts?.ready) await document.fonts.ready;
          const visibleImages = [...document.images].filter((image) => {
            const rect = image.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && rect.top < innerHeight && rect.left < innerWidth;
          });
          await Promise.all(visibleImages.map((image) => image.decode().catch(() => {})));
        });

        const runtime = await page.evaluate((selectors) => {
          const root = document.documentElement;
          const isVisible = (element) => {
            if (!element) return false;
            const style = getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return style.display !== 'none'
              && style.visibility !== 'hidden'
              && rect.width > 0
              && rect.height > 0;
          };
          const staffVisible = selectors.filter((selector) => isVisible(document.querySelector(selector)));
          const firstCard = document.querySelector(
            root.dataset.brand === 'delivery'
              ? '#deliveryGrid .card:not(.skeleton-card)'
              : '#grid .card:not(.skeleton-card)'
          );
          return {
            capturedAt: new Date().toISOString(),
            url: location.href,
            dataBrand: root.dataset.brand || null,
            htmlClass: root.className,
            viewport: { width: innerWidth, height: innerHeight, deviceScaleFactor: window.devicePixelRatio },
            document: {
              clientWidth: root.clientWidth,
              scrollWidth: root.scrollWidth,
              horizontalOverflow: root.scrollWidth > root.clientWidth,
            },
            firstCardTitle: firstCard?.querySelector('h3')?.innerText?.trim() || null,
            staffControlsVisible: staffVisible,
          };
        }, ['#adminBar', '#cashierPanel', '#dispatchPanel', '#adminDashboard']);

        expect(runtime.dataBrand).toBe(brand);
        expect(runtime.viewport).toEqual({
          width: viewport.width,
          height: viewport.height,
          deviceScaleFactor: 1,
        });
        expect(runtime.document.horizontalOverflow).toBe(false);
        expect(runtime.staffControlsVisible).toEqual([]);
        expect(runtime.firstCardTitle).toBeTruthy();

        const filename = `production-${brand}-guest-menu-${viewport.width}x${viewport.height}-c005b1c.png`;
        const screenshotPath = path.join(OUT, filename);
        await page.screenshot({
          path: screenshotPath,
          fullPage: false,
          animations: 'disabled',
          caret: 'hide',
        });
        await testInfo.attach(filename, { path: screenshotPath, contentType: 'image/png' });

        captures.push({
          filename,
          brand,
          role: 'guest',
          state: 'hydrated-first-viewport',
          productionCommit: PRODUCTION_COMMIT,
          viewport: { width: viewport.width, height: viewport.height, deviceScaleFactor: 1 },
          runtime,
          captureSource: 'read-only-production-playwright',
        });
      } finally {
        await context.close();
      }
    }
  }

  const manifest = {
    manifestVersion: '1.0',
    capturedAt: new Date().toISOString(),
    productionBaseUrl: BASE,
    productionCommit: PRODUCTION_COMMIT,
    session: 'isolated-empty-browser-contexts',
    actionsTaken: 'GET navigation and screenshot capture only; no sign-in, clicks, cart actions, orders, payments or data writes',
    captures,
  };
  const manifestPath = path.join(OUT, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  await testInfo.attach('production-guest-baseline-manifest.json', {
    path: manifestPath,
    contentType: 'application/json',
  });
  expect(captures).toHaveLength(8);
});
