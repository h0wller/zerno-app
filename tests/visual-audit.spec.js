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

async function waitForHydratedSidebar(page, brand, viewport) {
  const profile = page.locator('#pvProfile');
  await expect(profile).toBeAttached({ timeout: 10000 });

  // At tablet/mobile widths the account panel is an intentionally closed drawer.
  // Only desktop renders it as the third storefront column in the captured viewport.
  if (viewport.width > 1180) {
    await expect(profile).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#profileNoUser')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#profileBox')).toBeHidden();
  }
}

async function capture(page, meta) {
  if (meta.fullPage) {
    const gridSelector = meta.brand === 'delivery' ? '#deliveryGrid' : '#grid';
    await page.addStyleTag({
      content: gridSelector + ' > .card { content-visibility: visible !important; }',
    });
    await expect.poll(() => page.locator(gridSelector + ' > .card:not(.skeleton-card)').evaluateAll((cards) =>
      cards.every((card) => {
        const title = card.querySelector('h3');
        const rect = title && title.getBoundingClientRect();
        return !!rect && rect.width > 0 && rect.height > 0;
      })
    )).toBe(true);
  }

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

  const fullPageContentVisibilityOverride = meta.fullPage === true;
  const runtime = await page.evaluate((fullPageOverride) => ({
    title: document.title,
    brand: document.documentElement.dataset.brand || null,
    fullPageContentVisibilityOverride: fullPageOverride,
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
    sidebar: {
      activePanel: document.getElementById('pvProfile') && !document.getElementById('pvProfile').hidden
        ? 'profile' : null,
      profilePanelHidden: document.getElementById('pvProfile')?.hidden ?? null,
      profileGuestPromptHidden: document.getElementById('profileNoUser')?.hidden ?? null,
      profileBoxHidden: document.getElementById('profileBox')?.hidden ?? null,
      coffeeLoyaltyHidden: document.getElementById('profileCoffeeSection')?.hidden ?? null,
    },
  }), fullPageContentVisibilityOverride);

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
      await waitForHydratedSidebar(page, brand, viewport);

      const hydratedViewport = await capture(page, {
        brand, viewport, state: 'hydrated-menu-viewport',
      });
      const hydrated = await capture(page, {
        brand, viewport, state: 'hydrated-menu', fullPage: true,
      });

      expect(hydratedViewport.runtime.staffRole).toBeNull();
      expect(hydratedViewport.runtime.document.width).toBeLessThanOrEqual(viewport.width);
      expect(hydrated.runtime.staffRole).toBeNull();
      expect(hydrated.runtime.document.width).toBeLessThanOrEqual(viewport.width);
      expect(hydrated.runtime.fullPageContentVisibilityOverride).toBe(true);

      const metadataPath = path.join(OUT, `${brand}-guest-${viewport.id}.json`);
      fs.writeFileSync(metadataPath, JSON.stringify({ initial, hydratedViewport, hydrated }, null, 2));
    });
  }
}

test('visual audit: coffee profile loyalty without duplicate progress UI at 390px', async ({ page }) => {
  const viewport = { id: 'm', width: 390, height: 844 };
  await prepareColdGuest(page, 'coffee', viewport);

  await expect.poll(() => page.evaluate(() =>
    document.documentElement.getAttribute('data-staff-ready') === '1' &&
    typeof window.setUser === 'function' &&
    typeof window.openPanel === 'function'
  )).toBe(true);

  await page.evaluate(() => {
    const customer = {
      id: 'visual-coffee-loyalty-guest',
      name: 'Тестовый гость',
      phone: '+7 900 000-00-00',
      role: 'guest',
      cups: 18,
      stamps: 6,
      free: 1,
      qr: 'visual-coffee-loyalty-guest',
      history: [],
      verified: 1
    };

    window.setUser('visual-coffee-loyalty-token', customer);
    window.__profileMeReady();
    window.renderBonus();
    window.renderProfile();
    window.renderVerifyNote();
    window.openPanel('profile');
  });

  await expect(page.locator('#panel')).toHaveClass(/open/);
  await expect(page.locator('#pvProfile')).toBeVisible();
  await expect(page.locator('#profileBox')).toBeVisible();
  await expect(page.locator('#profileCoffeeSection')).toBeVisible();
  await expect(page.locator('#bonusBox')).toBeVisible();
  await expect(page.locator('#bonusCount')).toHaveText('6/10');
  await expect(page.locator('#stampGrid .stamp')).toHaveCount(10);
  await expect(page.locator('#freeSlot .freeCard')).toContainText('Бесплатный кофе ×1');
  await expect(page.locator('#profileCoffeeSection .profile-qr-access')).toBeVisible();
  await expect(page.locator('#qrOpenProfile')).toHaveText('Показать QR');
  await expect(page.locator('#profileCoffeeSection .stats')).toBeHidden();

  const help = page.locator('#verifyNote .profile-loyalty-help');
  await expect(help).toHaveCount(1);
  await expect(help.locator('summary span').first()).toHaveText('Как работают бонусы?');
  await expect(help).not.toHaveAttribute('open', '');
  await expect(page.locator('#verifyNote > small')).toHaveCount(0);
  await expect(help).toContainText('Приветственный бонус');

  // The stamp grid and the reward card are the only loyalty status displays.
  await expect(page.locator(
    '#profileStampProgress, #profileStampsRemaining, #bonusProg, .profile-stamps-summary'
  )).toHaveCount(0);

  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
    document.querySelector('#panel').scrollTop = 0;
  });

  const imagePath = path.join(OUT, 'COFFEE-PROFILE-LOYALTY-390.png');
  await page.screenshot({
    path: imagePath,
    fullPage: false,
    animations: 'disabled',
    caret: 'hide'
  });

  await help.locator('summary').click();
  await expect(help).toHaveAttribute('open', '');
  await expect(help.locator('.profile-loyalty-help-content')).toBeVisible();
  await expect(help).toContainText('10 штампов — бесплатный кофе');
  await expect(help.getByRole('link', { name: 'Telegram-бота' }))
    .toHaveAttribute('href', 'https://t.me/and_coffee_bot');
  await page.screenshot({
    path: path.join(OUT, 'COFFEE-PROFILE-LOYALTY-390-EXPANDED.png'),
    fullPage: false,
    animations: 'disabled',
    caret: 'hide'
  });

  await help.locator('summary').click();
  await expect(help).not.toHaveAttribute('open', '');
  const promo = page.locator('#profileCoffeeSection .profile-promo-details');
  await promo.scrollIntoViewIfNeeded();
  await expect(promo).toBeVisible();
  await page.screenshot({
    path: path.join(OUT, 'COFFEE-PROFILE-PROMO-390.png'),
    fullPage: false,
    animations: 'disabled',
    caret: 'hide'
  });
  await promo.locator('summary').click();
  await expect(promo).toHaveAttribute('open', '');
  await expect(page.locator('#promoInput')).toBeVisible();
  await page.screenshot({
    path: path.join(OUT, 'COFFEE-PROFILE-PROMO-390-EXPANDED.png'),
    fullPage: false,
    animations: 'disabled',
    caret: 'hide'
  });

  const runtime = await page.evaluate(() => ({
    brand: document.documentElement.dataset.brand || null,
    staffRole: document.documentElement.getAttribute('data-staff-role'),
    viewport: { width: innerWidth, height: innerHeight },
    stamps: document.querySelectorAll('#stampGrid .stamp').length,
    stampCount: document.querySelector('#bonusCount')?.textContent?.trim() || null,
    freeReward: document.querySelector('#freeSlot')?.innerText?.trim() || null,
    progressElements: document.querySelectorAll(
      '#profileStampProgress, #profileStampsRemaining, #bonusProg, .profile-stamps-summary'
    ).length,
    qrActions: document.querySelectorAll('#qrOpenProfile').length,
    profileVisible: !document.querySelector('#pvProfile')?.hidden,
    loyaltyVisible: !document.querySelector('#profileCoffeeSection')?.hidden
  }));

  expect(runtime.brand).toBe('coffee');
  expect(runtime.staffRole).toBeNull();
  expect(runtime.viewport).toEqual({ width: 390, height: 844 });
  expect(runtime.progressElements).toBe(0);
  expect(runtime.qrActions).toBe(1);
  expect(runtime.profileVisible).toBe(true);
  expect(runtime.loyaltyVisible).toBe(true);

  fs.writeFileSync(
    path.join(OUT, 'coffee-profile-loyalty-390.json'),
    JSON.stringify({
      screenshot: path.basename(imagePath),
      commit: process.env.GITHUB_SHA || null,
      viewport,
      runtime
    }, null, 2)
  );
});



test('visual audit: delivery pizza and rolls card grids at desktop width', async ({ page }) => {
  const viewport = { id: 'desktop', width: 1440, height: 1000 };
  await prepareColdGuest(page, 'delivery', viewport);
  await waitForHydratedStorefront(page, 'delivery');

  const grid = page.locator('#deliveryGrid');
  const cards = grid.locator(':scope > .card:not(.skeleton-card)');
  await expect(cards.first()).toBeVisible();

  const captureCategory = async (category, filename) => {
    await page.evaluate((selectedCategory) => {
      window.dcat = selectedCategory;
      window.renderDeliveryMenu();
    }, category);

    await expect(cards.first()).toBeVisible();
    await expect.poll(() => cards.count()).toBeGreaterThan(1);
    // Full-page element captures must not leave content-visibility placeholders in lower rows.
    await page.addStyleTag({
      content: '#deliveryGrid > .card { content-visibility: visible !important; contain-intrinsic-block-size: auto !important; }'
    });
    for (const card of await cards.all()) await card.scrollIntoViewIfNeeded();
    await page.evaluate(async () => {
      if (document.fonts?.ready) await document.fonts.ready;
      const images = [...document.querySelectorAll('#deliveryGrid .card img')];
      await Promise.all(images.map((image) => image.decode().catch(() => {})));
      window.scrollTo(0, 0);
    });

    await grid.screenshot({
      path: path.join(OUT, filename),
      animations: 'disabled'
    });

    const rows = await cards.evaluateAll((nodes) => {
      const grouped = new Map();
      for (const card of nodes) {
        const rect = card.getBoundingClientRect();
        const key = Math.round(rect.top);
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push({
          height: rect.height,
          right: rect.right,
          left: rect.left,
          width: rect.width
        });
      }
      return [...grouped.values()].map((row) => ({
        count: row.length,
        heightSpread: Math.max(...row.map((item) => item.height)) - Math.min(...row.map((item) => item.height)),
        rightEdge: Math.max(...row.map((item) => item.right)),
        leftEdge: Math.min(...row.map((item) => item.left))
      }));
    });

    expect(rows.length, category + ' should render card rows').toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.heightSpread, category + ' cards in a row must align').toBeLessThanOrEqual(1);
    }
    return { category, filename, cardCount: await cards.count(), rows };
  };

  const pizza = await captureCategory('pizza', 'DELIVERY-PIZZA-CARDS-DESKTOP-1440.png');
  const rolls = await captureCategory('rolls', 'DELIVERY-ROLLS-CARDS-DESKTOP-1440.png');

  fs.writeFileSync(
    path.join(OUT, 'delivery-card-grid-desktop.json'),
    JSON.stringify({
      commit: process.env.GITHUB_SHA || null,
      viewport,
      pizza,
      rolls
    }, null, 2)
  );
});
