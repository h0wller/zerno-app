import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.TEST_URL;
const OUT = path.join('artifacts', 'visual-audit');
const VIEWPORTS = [
  { id: 'xs', width: 320, height: 740 },
  { id: 'm', width: 390, height: 844 },
  { id: 't', width: 768, height: 1024 },
  { id: 'd', width: 1440, height: 900 },
];

if (!BASE) throw new Error('TEST_URL is required for read-only visual audit capture');

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
  const target = brand === 'delivery' ? '#deliveryGrid' : '#grid';
  await expect(page.locator(target)).toBeVisible({ timeout: 30000 });
  await expect(page.locator(`${target} .skeleton-card`)).toHaveCount(0, { timeout: 30000 }).catch(() => {});
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
    const images = [...document.images].filter((img) => img.getBoundingClientRect().width > 0);
    await Promise.all(images.map((img) => img.decode().catch(() => {})));
  });
}

async function capture(page, meta) {
  const safe = [
    meta.brand.toUpperCase(),
    'GUEST',
    meta.state.toUpperCase(),
    meta.viewport.id.toUpperCase(),
  ].join('-');
  const file = `${safe}.png`;
  await page.screenshot({
    path: path.join(OUT, file),
    fullPage: meta.fullPage ?? false,
    animations: 'disabled',
  });
  const runtime = await page.evaluate(() => ({
    title: document.title,
    brand: document.documentElement.dataset.brand || null,
    viewport: { width: innerWidth, height: innerHeight },
    document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
    visibleImages: [...document.images].filter((image) => {
      const rect = image.getBoundingClientRect();
      const style = getComputedStyle(image);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    }).length,
  }));
  return {
    id: safe,
    file,
    url: page.url(),
    timestamp: new Date().toISOString(),
    role: 'guest-cold-context',
    brand: meta.brand,
    state: meta.state,
    viewport: meta.viewport,
    fullPage: meta.fullPage ?? false,
    evidence: 'production-read-only-playwright',
    runtime,
  };
}

for (const brand of ['coffee', 'delivery']) {
  for (const viewport of VIEWPORTS) {
    test(`visual audit: ${brand} guest first paint and hydrated menu ${viewport.id}`, async ({ page }) => {
      await prepareColdGuest(page, brand, viewport);
      const first = await capture(page, { brand, viewport, state: 'first-paint' });
      await waitForHydratedStorefront(page, brand);
      const hydrated = await capture(page, { brand, viewport, state: 'hydrated-menu', fullPage: true });
      const metadataPath = path.join(OUT, `${brand}-guest-${viewport.id}.json`);
      fs.writeFileSync(metadataPath, JSON.stringify({ first, hydrated }, null, 2));
    });
  }
}

test('visual audit: delivery read-only catalog does not leak horizontal overflow', async ({ page }) => {
  const viewport = { id: 'm', width: 390, height: 844 };
  await prepareColdGuest(page, 'delivery', viewport);
  await waitForHydratedStorefront(page, 'delivery');
  const widths = await page.evaluate(() => ({
    viewport: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(widths.scrollWidth).toBeLessThanOrEqual(widths.viewport);
});
