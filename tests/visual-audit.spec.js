import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.TEST_URL || process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const OUT = path.join('artifacts', 'visual-audit');
const VIEWPORTS = [
  { id: 'xs', width: 320, height: 740 },
  { id: 'm', width: 390, height: 844 },
  { id: 't', width: 768, height: 1024 },
  { id: 'd', width: 1440, height: 900 },
];

test.use({
  serviceWorkers: 'block',
  colorScheme: 'light',
  reducedMotion: 'no-preference',
});

test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));

async function prepareColdGuest(page, brand, viewport) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.addInitScript((selectedBrand) => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('zt_onb', '1');
      localStorage.setItem('zt_brand', selectedBrand);
    } catch {}
  }, brand);

  await page.goto(`${BASE}/?brand=${brand}`, { waitUntil: 'domcontentloaded' });
}

async function waitForHydratedStorefront(page, brand) {
  const grid = brand === 'delivery' ? '#deliveryGrid' : '#grid';
  const cards = brand === 'delivery'
    ? page.locator('#deliveryGrid .card:not(.skeleton-card)')
    : page.locator('#grid .card:not(.skeleton-card)');

  await expect(page.locator(grid)).toBeVisible({ timeout: 30000 });
  await expect(cards.first()).toBeVisible({ timeout: 30000 });
  await expect(page.locator(`${grid} .skeleton-card`)).toHaveCount(0, { timeout: 30000 });

  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
    const images = [...document.images].filter((img) => img.getBoundingClientRect().width > 0);
    await Promise.all(images.map((img) => img.decode().catch(() => {})));
  });
}

async function capture(page, meta) {
  const id = [
    meta.brand.toUpperCase(),
    'GUEST',
    meta.state.toUpperCase(),
    meta.viewport.id.toUpperCase(),
  ].join('-');
  const file = `${id}.png`;

  await page.screenshot({
    path: path.join(OUT, file),
    fullPage: meta.fullPage ?? false,
    animations: 'disabled',
  });

  const runtime = await page.evaluate(() => ({
    title: document.title,
    brand: document.documentElement.dataset.brand || null,
    staffRole: document.documentElement.getAttribute('data-staff-role'),
    viewport: { width: innerWidth, height: innerHeight },
    document: {
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
    },
    visibleImages: [...document.images].filter((image) => {
      const rect = image.getBoundingClientRect();
      const style = getComputedStyle(image);
      return rect.width > 0 && rect.height > 0
        && style.display !== 'none' && style.visibility !== 'hidden';
    }).length,
  }));

  return {
    id,
    file,
    url: page.url(),
    timestamp: new Date().toISOString(),
    role: 'guest-cold-context',
    brand: meta.brand,
    state: meta.state,
    viewport: meta.viewport,
    deviceScaleFactor: 1,
    fullPage: meta.fullPage ?? false,
    captureSource: process.env.TEST_URL ? 'production-read-only-playwright' : 'isolated-playwright-test-server',
    runtime,
  };
}

for (const brand of ['coffee', 'delivery']) {
  for (const viewport of VIEWPORTS) {
    test(`visual audit: ${brand} guest menu ${viewport.id}`, async ({ page }) => {
      await prepareColdGuest(page, brand, viewport);

      const initial = await capture(page, {
        brand, viewport, state: 'initial-guest-state',
      });

      await waitForHydratedStorefront(page, brand);
      const hydrated = await capture(page, {
        brand, viewport, state: 'hydrated-menu', fullPage: true,
      });

      expect(hydrated.runtime.staffRole).toBeNull();
      expect(hydrated.runtime.document.width).toBeLessThanOrEqual(viewport.width);

      const metadataPath = path.join(OUT, `${brand}-guest-${viewport.id}.json`);
      fs.writeFileSync(metadataPath, JSON.stringify({ initial, hydrated }, null, 2));
    });
  }
}


for (const viewport of VIEWPORTS.filter(({ id }) => id === 'xs' || id === 'm')) {
  test(`visual audit: delivery support FAB clears menu actions at ${viewport.id}`, async ({ page }) => {
    await prepareColdGuest(page, 'delivery', viewport);
    await waitForHydratedStorefront(page, 'delivery');

    const collisions = await page.evaluate(() => {
      const fab = document.querySelector('#chatFab');
      if (!fab) return { visible: false, collisions: ['#chatFab missing'] };

      const fabRect = fab.getBoundingClientRect();
      const fabStyle = getComputedStyle(fab);
      const visible = fabRect.width > 0 && fabRect.height > 0
        && fabStyle.display !== 'none'
        && fabStyle.visibility !== 'hidden';

      const targets = [
        ...document.querySelectorAll('#deliveryGrid .opts label.opt-btn'),
        ...document.querySelectorAll('#deliveryGrid [data-add]'),
        ...document.querySelectorAll('#deliveryRail button'),
      ].filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0
          && style.display !== 'none'
          && style.visibility !== 'hidden';
      });

      const overlaps = (a, b) => (
        a.left < b.right && a.right > b.left
        && a.top < b.bottom && a.bottom > b.top
      );

      return {
        visible,
        fab: {
          left: fabRect.left,
          right: fabRect.right,
          top: fabRect.top,
          bottom: fabRect.bottom,
        },
        collisions: targets
          .filter((element) => overlaps(fabRect, element.getBoundingClientRect()))
          .map((element) => ({
            selector: element.matches('[data-add]')
              ? '#deliveryGrid [data-add]'
              : element.matches('.opt-btn')
                ? '#deliveryGrid .opts .opt-btn'
                : '#deliveryRail button',
            text: (element.textContent || '').trim().slice(0, 40),
          })),
      };
    });

    expect(collisions.visible).toBe(true);
    expect(collisions.collisions).toEqual([]);
    await page.screenshot({
      path: path.join(OUT, `DELIVERY-SUPPORT-FAB-CLEAR-${viewport.id.toUpperCase()}.png`),
      animations: 'disabled',
    });
  });
}
