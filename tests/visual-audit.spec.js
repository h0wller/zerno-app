import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.join('artifacts', 'visual-audit');
const VIEWPORTS = [
  { id: 'xs', width: 320, height: 740 },
  { id: 'm', width: 390, height: 844 },
  { id: 'landscape', width: 844, height: 390 },
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

  await page.goto(`/?brand=${brand}`, { waitUntil: 'domcontentloaded' });
}

test('cold guest navigation uses the configured Playwright baseURL', async ({ page }, testInfo) => {
  const configuredBaseURL = testInfo.project.use.baseURL;
  expect(configuredBaseURL, 'Playwright baseURL must be configured').toBeTruthy();

  await prepareColdGuest(page, 'coffee', { width: 390, height: 844 });

  expect(new URL(page.url()).origin).toBe(new URL(configuredBaseURL).origin);
});

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
  await expect(help).toContainText('Ваши подарки');
  await expect(help).toContainText('На карте профиля уже есть 1 бесплатный кофе');

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
  await expect(help.getByRole('link', { name: 'Telegram-бота' })).toHaveCount(0);
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



const REVIEW_VIEWPORTS = [
  { id: '320x740', width: 320, height: 740 },
  { id: '360x780', width: 360, height: 780 },
  { id: '320x568', width: 320, height: 568 },
  { id: '390x844', width: 390, height: 844 },
  { id: '430x932', width: 430, height: 932 },
  { id: '844x390', width: 844, height: 390 },
  { id: '1024x390', width: 1024, height: 390 },
  { id: '820x1024', width: 820, height: 1024 },
  { id: '1440x900', width: 1440, height: 900 },
];

// Coffee is a loyalty/menu storefront; it does not expose ordering or checkout.
// Capture its real hydrated menu only. The order/cart flow belongs to delivery.
for (const viewport of REVIEW_VIEWPORTS) {
  test(`visual audit: coffee guest menu only at ${viewport.id}`, async ({ page }) => {
    await prepareColdGuest(page, 'coffee', viewport);
    await waitForHydratedStorefront(page, 'coffee');
    await waitForHydratedSidebar(page, 'coffee', viewport);

    await expect(page.locator('#cartFab')).toBeHidden();
    await expect(page.locator('#cartPanel')).toBeHidden();
    await expect(page.locator('#grid [data-add]')).toHaveCount(0);

    const screenshot = await capture(page, {
      brand: 'coffee',
      viewport,
      state: 'hydrated-menu',
    });
    const runtime = await page.evaluate(() => ({
      brand: document.documentElement.dataset.brand || null,
      staffRole: document.documentElement.getAttribute('data-staff-role'),
      cartFabVisible: (() => {
        const element = document.getElementById('cartFab');
        if (!element) return false;
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' &&
          rect.width > 0 && rect.height > 0;
      })(),
      cartOpen: document.getElementById('cartPanel')?.classList.contains('open') ?? false,
      deliveryAddControls: document.querySelectorAll('#grid [data-add]').length,
      documentWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));

    expect(runtime.brand).toBe('coffee');
    expect(runtime.staffRole).toBeNull();
    expect(runtime.cartFabVisible).toBe(false);
    expect(runtime.cartOpen).toBe(false);
    expect(runtime.deliveryAddControls).toBe(0);
    expect(runtime.documentWidth).toBeLessThanOrEqual(viewport.width);

    fs.writeFileSync(
      path.join(OUT, `coffee-menu-${viewport.id}.json`),
      JSON.stringify({ screenshot, runtime }, null, 2)
    );
  });
}

// Delivery search is an interaction state owned by delivery-search.js.
// Capture both a matching result and an empty result at mobile portrait/landscape and desktop.
for (const viewport of [
  { id: '320x568', width: 320, height: 568 },
  { id: '390x844', width: 390, height: 844 },
  { id: '844x390', width: 844, height: 390 },
  { id: '1440x900', width: 1440, height: 900 },
]) {
  test(`visual audit: delivery search states at ${viewport.id}`, async ({ page }) => {
    await prepareColdGuest(page, 'delivery', viewport);
    await waitForHydratedStorefront(page, 'delivery');
    if (viewport.width >= 821 && viewport.height > 480) {
      await page.waitForFunction(() => {
        const panel = document.querySelector('#panel');
        const rect = panel?.getBoundingClientRect();
        const style = panel ? getComputedStyle(panel) : null;
        return !!panel
          && !panel.hidden
          && style.display !== 'none'
          && style.visibility !== 'hidden'
          && style.opacity !== '0'
          && rect.width >= 300
          && rect.left <= window.innerWidth - 360;
      }, null, { timeout: 5000 });
    }

    const search = page.locator('#deliveryView #dSearch');
    await expect(search).toBeVisible();
    await expect(search).toHaveCount(1);

    await search.fill('маргарита');
    const matchingCard = page.locator('#deliveryGrid [data-product-id="pz-marg"]');
    await expect(matchingCard).toBeVisible();
    await expect(page.locator('#deliveryGrid .card:not(.skeleton-card):visible')).toHaveCount(1);

    const matching = await capture(page, {
      brand: 'delivery',
      viewport,
      state: 'search-match',
    });

    await search.fill('позиция-которой-нет');
    await expect(page.locator('#deliveryGrid .card:not(.skeleton-card):visible')).toHaveCount(0);
    const empty = await capture(page, {
      brand: 'delivery',
      viewport,
      state: 'search-empty',
    });

    const runtime = await page.evaluate(() => ({
      brand: document.documentElement.dataset.brand || null,
      staffRole: document.documentElement.getAttribute('data-staff-role'),
      query: document.querySelector('#deliveryView #dSearch')?.value ?? null,
      visibleCards: document.querySelectorAll('#deliveryGrid .card:not(.skeleton-card)').length
        ? [...document.querySelectorAll('#deliveryGrid .card:not(.skeleton-card)')]
          .filter((card) => getComputedStyle(card).display !== 'none').length
        : 0,
      documentWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      searchGeometry: (() => {
        const input = document.querySelector('#deliveryView #dSearch');
        const hitArea = input?.closest('.search') || input;
        const inputRect = input?.getBoundingClientRect();
        const hitRect = hitArea?.getBoundingClientRect();
        const style = input ? getComputedStyle(input) : null;
        const hitStyle = hitArea ? getComputedStyle(hitArea) : null;
        const probe = document.createElement('div');
        probe.style.paddingTop = 'env(safe-area-inset-top, 0px)';
        document.body.appendChild(probe);
        const safeAreaTop = parseFloat(getComputedStyle(probe).paddingTop) || 0;
        probe.remove();
        return {
          input: inputRect ? { x: inputRect.x, y: inputRect.y, width: inputRect.width, height: inputRect.height } : null,
          hitArea: hitRect ? { x: hitRect.x, y: hitRect.y, width: hitRect.width, height: hitRect.height } : null,
          focus: {
            active: document.activeElement === input,
            outlineStyle: style?.outlineStyle ?? null,
            outlineWidth: style?.outlineWidth ?? null,
            hitAreaBoxShadow: hitStyle?.boxShadow ?? null
          },
          safeAreaTop,
          virtualKeyboard: 'not emulated by Playwright Chromium; requires physical iOS check'
        };
      })(),
    }));

    expect(runtime.brand).toBe('delivery');
    expect(runtime.staffRole).toBeNull();
    expect(runtime.query).toBe('позиция-которой-нет');
    expect(runtime.visibleCards).toBe(0);
    expect(runtime.documentWidth).toBeLessThanOrEqual(viewport.width);

    fs.writeFileSync(
      path.join(OUT, `delivery-search-${viewport.id}.json`),
      JSON.stringify({ matching, empty, runtime }, null, 2)
    );
  });
}


test('visual audit: delivery search states for admin at 390x844', async ({ page }) => {
  const viewport = { id: '390x844', width: 390, height: 844 };
  const menuResponse = await page.request.get('/api/dmenu');
  expect(menuResponse.ok()).toBe(true);
  const publicMenu = await menuResponse.json();
  const staffItems = (publicMenu.items || []).map((item) => ({ ...item, section: 'delivery' }));

  await page.route('**/api/me', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      customer: {
        id: 'visual-delivery-admin',
        name: 'Visual Admin',
        phone: '+70000000000',
        role: 'admin',
        verified: 1,
        cups: 0,
        stamps: 0,
        free: 0,
        history: [],
        qr: 'visual-delivery-admin'
      }
    })
  }));
  await page.route('**/api/menu/all', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ items: staffItems, updatedAt: '2026-11-24T00:00:00.000Z' })
  }));
  await page.route('**/api/promos', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      promos: [{
        id: 4321,
        code: 'VISUAL10',
        kind: 'percent',
        value: 10,
        expires: null,
        maxuses: 100,
        uses: 2,
        active: true,
        owner: null
      }]
    })
  }));
  await page.route('**/api/delivery/info', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      weekPromo: {
        text: 'Каждые 2000 ₽ в чеке — подарок',
        threshold: 2000,
        gift: 'Пиво 0.5',
        until: null
      },
      pizzaMonth: { name: 'Грибная' }
    })
  }));
  await page.route('**/api/admin/bonuses', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ kinds: {}, days: 30 })
  }));
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    localStorage.setItem('zt_inst_hide', '1');
    localStorage.setItem('zt_user', 'visual-delivery-admin-token');
    localStorage.setItem('zt_role', 'admin');
    sessionStorage.setItem('splashDone', '1');
  });

  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto('/?brand=delivery', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() =>
    document.documentElement.getAttribute('data-staff-role') === 'admin' &&
    document.documentElement.getAttribute('data-staff-ready') === '1'
  );
  await page.evaluate(() => window.setMode('admin'));
  await expect(page.locator('#adminBar')).toBeVisible();
  await expect(page.locator('#toasts .toast')).toHaveCount(0, { timeout: 5000 });

  const search = page.locator('#deliveryView #dSearch');
  const matchingCard = page.locator('#deliveryGrid [data-product-id="pz-marg"]');
  await expect(search).toBeVisible();
  await expect(matchingCard).toBeVisible();
  await search.fill('маргарита');
  await expect(matchingCard).toBeVisible();
  await expect(page.locator('#deliveryGrid [data-product-id]:visible')).toHaveCount(1);
  await page.screenshot({
    path: path.join(OUT, 'DELIVERY-ADMIN-SEARCH-MATCH-390x844.png'),
    animations: 'disabled'
  });

  await search.fill('позиция-которой-нет');
  await expect(page.locator('#deliveryGrid [data-product-id]:visible')).toHaveCount(0);
  const runtime = await page.evaluate(() => ({
    brand: document.documentElement.dataset.brand || null,
    staffRole: document.documentElement.getAttribute('data-staff-role'),
    query: document.querySelector('#deliveryView #dSearch')?.value ?? null,
    visibleCards: document.querySelectorAll('#deliveryGrid [data-product-id]:not([style*="display: none"])').length,
    documentWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    searchRect: (() => {
      const rect = document.querySelector('#deliveryView #dSearch').getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    })()
  }));
  expect(runtime.brand).toBe('delivery');
  expect(runtime.staffRole).toBe('admin');
  expect(runtime.query).toBe('позиция-которой-нет');
  expect(runtime.visibleCards).toBe(0);
  expect(runtime.documentWidth).toBeLessThanOrEqual(viewport.width);
  await page.screenshot({
    path: path.join(OUT, 'DELIVERY-ADMIN-SEARCH-EMPTY-390x844.png'),
    animations: 'disabled'
  });
  fs.writeFileSync(
    path.join(OUT, 'delivery-search-admin-390x844.json'),
    JSON.stringify({ viewport, role: 'admin', runtime }, null, 2)
  );

  await expect(page.locator('#promoToggle')).toBeVisible();
  await page.locator('#promoToggle').click();
  const promoModal = page.locator('#promoModal');
  await expect(promoModal).toHaveClass(/show/);
  await expect(promoModal.locator('#pmList .logrow')).toHaveCount(1);
  await expect(promoModal.locator('#pmList')).toHaveCount(1);
  await expect(promoModal.locator('#wpText')).toHaveValue('Каждые 2000 ₽ в чеке — подарок');
  await expect(promoModal.locator('#pmName')).toHaveValue('Грибная');
  await expect(promoModal.locator('#bzDays')).toHaveValue('30');

  await page.screenshot({
    path: path.join(OUT, 'DELIVERY-ADMIN-PROMO-MODAL-390x844.png'),
    animations: 'disabled'
  });
  const promoCard = promoModal.locator('.modal-card');
  await promoCard.evaluate(element => { element.scrollTop = element.scrollHeight; });
  await expect(promoModal.locator('#pmOn')).toBeVisible();
  await expect(promoModal.locator('#bzDays')).toBeVisible();
  await page.screenshot({
    path: path.join(OUT, 'DELIVERY-ADMIN-PROMO-MODAL-BOTTOM-390x844.png'),
    animations: 'disabled'
  });
  const promoRuntime = await page.evaluate(() => {
    const modal = document.getElementById('promoModal');
    const card = modal.querySelector('.modal-card');
    const rect = card.getBoundingClientRect();
    return {
      brand: document.documentElement.dataset.brand || null,
      staffRole: document.documentElement.getAttribute('data-staff-role'),
      modalVisible: getComputedStyle(modal).visibility !== 'hidden',
      card: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      viewport: { width: innerWidth, height: innerHeight },
      documentWidth: document.documentElement.scrollWidth,
      listHosts: document.querySelectorAll('#promoModal #pmList').length,
      promoRows: document.querySelectorAll('#promoModal #pmList .logrow').length,
      modalScrollHeight: card.scrollHeight,
      modalClientHeight: card.clientHeight
    };
  });
  expect(promoRuntime.brand).toBe('delivery');
  expect(promoRuntime.staffRole).toBe('admin');
  expect(promoRuntime.modalVisible).toBe(true);
  expect(promoRuntime.listHosts).toBe(1);
  expect(promoRuntime.promoRows).toBe(1);
  expect(promoRuntime.documentWidth).toBeLessThanOrEqual(viewport.width);
  expect(promoRuntime.card.x).toBeGreaterThanOrEqual(0);
  expect(promoRuntime.card.y).toBeGreaterThanOrEqual(0);
  expect(promoRuntime.card.x + promoRuntime.card.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(promoRuntime.card.y + promoRuntime.card.height).toBeLessThanOrEqual(viewport.height + 1);
  fs.writeFileSync(
    path.join(OUT, 'delivery-admin-promo-modal-390x844.json'),
    JSON.stringify({ viewport, role: 'admin', brand: 'delivery', runtime: promoRuntime }, null, 2)
  );
  await page.locator('#promoClose').click();
  await expect(promoModal).not.toHaveClass(/show/);
  await expect(page.locator('#overlay')).toHaveCSS('visibility', 'hidden');
});

// Delivery is the ordering storefront. Only this brand is captured with a populated cart.
for (const viewport of REVIEW_VIEWPORTS) {
  test(`visual audit: delivery guest cart open at ${viewport.id}`, async ({ page }) => {
    await prepareColdGuest(page, 'delivery', viewport);
    await waitForHydratedStorefront(page, 'delivery');
    await waitForHydratedSidebar(page, 'delivery', viewport);

    const card = page.locator('#deliveryGrid .card:not(.skeleton-card):not(.stopped)').first();
    await expect(card).toBeVisible({ timeout: 15000 });
    const firstOption = card.locator('.opts label.opt-btn').first();
    if (await firstOption.count()) await firstOption.click();
    await card.locator('[data-add]').click();

    await expect(page.locator('#cartFab')).toBeVisible({ timeout: 10000 });
    await page.locator('#cartFab').click();
    const cartPanel = page.locator('#cartPanel');
    await expect(cartPanel).toHaveClass(/open/);
    await expect(cartPanel).toBeVisible();
    await expect(page.locator('#cartItems .cartItem')).toHaveCount(1);
    await expect(page.locator('#toasts .toast')).toHaveCount(0, { timeout: 5000 });

    await page.evaluate(async () => {
      if (document.fonts?.ready) await document.fonts.ready;
      window.scrollTo(0, 0);
      const scrollBody = document.getElementById('cartScrollBody');
      if (scrollBody) scrollBody.scrollTop = 0;
    });

    const screenshot = await capture(page, {
      brand: 'delivery',
      viewport,
      state: 'cart-open',
    });
    const runtime = await page.evaluate(() => ({
      brand: document.documentElement.dataset.brand || null,
      staffRole: document.documentElement.getAttribute('data-staff-role'),
      cartOpen: document.getElementById('cartPanel')?.classList.contains('open') ?? false,
      itemCount: document.querySelectorAll('#cartItems .cartItem').length,
      documentWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));

    expect(runtime.brand).toBe('delivery');
    expect(runtime.staffRole).toBeNull();
    expect(runtime.cartOpen).toBe(true);
    expect(runtime.itemCount).toBe(1);
    expect(runtime.documentWidth).toBeLessThanOrEqual(viewport.width);

    fs.writeFileSync(
      path.join(OUT, `delivery-cart-open-${viewport.id}.json`),
      JSON.stringify({ screenshot, runtime }, null, 2)
    );
  });
}


// PR #345: exact registration → pending profile → cashier-code capture matrix.
// Additional evidence only; ui:baseline snapshots are not changed.
const REGISTRATION_ACTIVATION_VIEWPORTS = [
  { id: '320x640', width: 320, height: 640 },
  { id: '360x640', width: 360, height: 640 },
  { id: '390x844', width: 390, height: 844 },
  { id: '844x390', width: 844, height: 390 },
  { id: '820x1024', width: 820, height: 1024 },
  { id: '1440x900', width: 1440, height: 900 },
];

for (const brand of ['coffee', 'delivery']) {
  for (const viewport of REGISTRATION_ACTIVATION_VIEWPORTS) {
    test(`visual audit: ${brand} registration and pending activation ${viewport.id}`, async ({ page }) => {
      test.setTimeout(120000);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.addInitScript((selectedBrand) => {
        localStorage.clear();
        sessionStorage.clear();
        localStorage.setItem('zt_onb', '1');
        localStorage.setItem('zt_brand', selectedBrand);
        sessionStorage.setItem('splashDone', '1');
      }, brand);

      const pendingCustomer = {
        id: 'visual-pending-' + brand,
        name: 'Visual Pending Guest',
        phone: '+7 900 000-00-77',
        role: 'guest',
        verified: 0,
        cups: 0,
        stamps: 0,
        free: 0,
        welcome: 0,
        tg: null,
        notify_tg: 0,
        notify_web: 0,
        history: [],
        qr: 'Z-VISUAL-PENDING-' + brand.toUpperCase()
      };

      await page.route('**/api/me', (route) => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ customer: pendingCustomer })
      }));
      await page.route('**/api/orders/mine', (route) => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ orders: [] })
      }));

      await page.goto(`/?brand=${brand}`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() =>
        document.documentElement.getAttribute('data-staff-ready') === '1' &&
        typeof window.openAuth === 'function' &&
        typeof window.closeAuth === 'function' &&
        typeof window.setUser === 'function' &&
        typeof window.renderProfile === 'function' &&
        typeof window.renderVerifyNote === 'function' &&
        typeof window.openPanel === 'function'
      );
      await page.evaluate(async () => {
        if (document.fonts?.ready) await document.fonts.ready;
        window.openAuth(false);
      });

      const authModal = page.locator('#authModal');
      await expect(authModal).toBeVisible();
      await expect(authModal).toHaveClass(/show/);
      await expect(page.locator('#regForm')).toBeVisible();
      await expect(page.locator('#regName')).toBeVisible();
      const registrationFrame = await capture(page, {
        brand, viewport, state: 'registration',
      });

      await page.evaluate((customer) => {
        window.closeAuth();
        window.setUser('visual-pending-session-' + customer.id, customer);
        if (typeof window.__profileMeReady === 'function') window.__profileMeReady();
        window.renderProfile();
        window.renderVerifyNote();
        window.openPanel('profile');
      }, pendingCustomer);

      const profilePanel = page.locator('#panel');
      await expect(profilePanel).toBeVisible();
      await expect(page.locator('#pvProfile')).toBeVisible();
      await expect(page.locator('#profileBox')).toBeVisible();
      await expect(page.locator('#verifyNote')).toContainText('Профиль не активирован');

      const telegram = page.locator('#verifyNote #actTgBtn');
      await expect(telegram).toBeVisible();
      await expect(telegram).toHaveText('Подтвердить через Telegram');
      const telegramGeometry = await telegram.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      });
      expect(telegramGeometry.width).toBeGreaterThanOrEqual(44);
      expect(telegramGeometry.height).toBeGreaterThanOrEqual(44);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

      await page.evaluate(async () => {
        if (document.fonts?.ready) await document.fonts.ready;
      });
      const pendingFrame = await capture(page, {
        brand, viewport, state: 'pending-activation-telegram',
      });

      const cashierDetails = page.locator('#verifyNote .profile-activation-details');
      await expect(cashierDetails.locator('summary')).toContainText('Активировать через кассира');
      await cashierDetails.scrollIntoViewIfNeeded();
      await cashierDetails.locator('summary').click();
      await expect(cashierDetails).toHaveAttribute('open', '');
      const cashierCode = page.locator('#verifyNote #actCode');
      const cashierSubmit = page.locator('#verifyNote #actBtn');
      await expect(cashierCode).toBeVisible();
      await expect(cashierSubmit).toBeVisible();
      const cashierGeometry = await Promise.all([
        cashierCode.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return { width: rect.width, height: rect.height };
        }),
        cashierSubmit.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return { width: rect.width, height: rect.height };
        })
      ]);
      for (const target of cashierGeometry) {
        expect(target.width).toBeGreaterThanOrEqual(44);
        expect(target.height).toBeGreaterThanOrEqual(44);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

      const cashierExpandedFrame = await capture(page, {
        brand, viewport, state: 'pending-activation-cashier-expanded',
      });
      fs.writeFileSync(
        path.join(OUT, `registration-activation-${brand}-${viewport.id}.json`),
        JSON.stringify({
          commit: process.env.GITHUB_SHA || null,
          brand,
          role: 'guest-pending-activation',
          viewport,
          frames: {
            registration: registrationFrame,
            pendingActivationTelegram: pendingFrame,
            cashierCodeExpanded: cashierExpandedFrame
          },
          runtime: {
            telegramTarget: telegramGeometry,
            cashierTargets: cashierGeometry,
            documentWidth: await page.evaluate(() => document.documentElement.scrollWidth)
          }
        }, null, 2)
      );
    });
  }
}
