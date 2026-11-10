import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

const MENU_ITEM = {
  id: 'pz-marg',
  section: 'delivery',
  cat: 'pizza',
  e: '🍕',
  name: 'Маргарита',
  desc: 'Красный соус, моцарелла',
  comp: ['красный соус', 'моцарелла'],
  vol: '25/35 см',
  price: '0',
  on: 1,
  opts: [
    { l: '25 см, пышное', w: '415 г', p: 535, sz: 25 },
    { l: '35 см, пышное', w: '750 г', p: 735, sz: 35 }
  ]
};

const RECOMMENDED_ITEMS = [
  { id: 'test-drink', cat: 'drinks', name: 'Лимонад к заказу', price: 180, on: 1, e: '🥤' },
  { id: 'test-sauce', cat: 'sauces', name: 'Соус сырный', price: 70, on: 1, e: '🥫' }
];

test('cart keeps the current selected price and explains every amount without guessing the address', async ({ page }, testInfo) => {
  await page.clock.install({ time: new Date('2026-11-02T15:00:00.000Z') });
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    localStorage.setItem('zt_inst_hide', '1');
    localStorage.setItem('zt_cart', JSON.stringify([{
      key: 'pz-marg_1',
      id: 'pz-marg',
      oi: 1,
      name: 'Old product name',
      opt: 'Old option label',
      price: 690,
      sz: 35,
      qty: 1
    }]));
    localStorage.setItem('zt_cartpromo', 'SAVE100');
    localStorage.removeItem('zt_saved_address');
    localStorage.removeItem('zt_saved_addresses');
    sessionStorage.setItem('splashDone', '1');
  });

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    let body = { ok: true, items: [], orders: [], pending: [], customers: [], threads: [], messages: [], promos: [] };

    if (url.pathname === '/api/dmenu') {
      body = { items: [MENU_ITEM, ...RECOMMENDED_ITEMS], updatedAt: '2026-11-03T10:00:00.000Z' };
    } else if (url.pathname === '/api/delivery/info') {
      const isPreorderFixture = new Date().getTime() >= Date.parse('2026-11-02T20:30:00.000Z');
      body = {
        zones: [
          { fee: 200, min: 0, places: ['Янтарный'] },
          { fee: 250, min: 1000, places: ['Синявино'] }
        ],
        today: { isOpen: true, canAcceptAsap: !isPreorderFixture, open: 11, close: isPreorderFixture ? 20 : 22 },
        schedule: { open: 11, close: isPreorderFixture ? 20 : 22 },
        days: [
          { offset: 0, date: '2026-11-02', isOpen: true, open: 11, close: isPreorderFixture ? 20 : 22 },
          { offset: 1, date: '2026-11-03', isOpen: true, open: 11, close: 22 }
        ],
        busySlots: [],
        weekPromo: null,
        pizzaMonth: null
      };
    } else if (url.pathname === '/api/promo/info') {
      body = { ok: true, kind: 'fixed', value: 100, code: url.searchParams.get('code') };
    } else if (url.pathname === '/api/me/free-delivery') {
      body = { code: '' };
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body)
    });
  });

  await page.goto('/?brand=delivery');
  await expect(page.locator('#deliveryGrid [data-product-id="pz-marg"]')).toBeAttached();
  await expect.poll(() => page.evaluate(() => window.DMENU.some((item) => item.id === 'pz-marg'))).toBe(true);
  await page.evaluate(() => window.refreshDeliveryInfo());
  await page.evaluate(() => {
    document.getElementById('cartPanel').classList.add('open');
    window.renderCart();
  });
  await expect(page.locator('#checkoutGuestBar')).toBeAttached();
  await expect(page.locator('#checkoutGuestBar')).toBeHidden();
  await page.evaluate(() => window.setUser('checkout-clarity-token', {
    id: 'checkout-clarity-guest',
    name: 'Тестовый гость',
    phone: '+7 999 123-45-67',
    role: 'guest',
    verified: 1,
    stamps: 0,
    free: 0
  }));
  await expect(page.locator('#checkoutGuestBar')).toBeVisible();
  await expect(page.locator('#checkoutGuestName')).toHaveText('Тестовый гость');
  await expect(page.locator('#checkoutGuestPhone')).toHaveText('+7 999 123-45-67');

  await page.evaluate(() => document.getElementById('toasts')?.remove());
  const desktopViewport = page.viewportSize();
  await testInfo.attach('cart-overview-' + desktopViewport.width + 'px', {
    body: await page.screenshot({ fullPage: false }),
    contentType: 'image/png',
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#cartClose')).toBeVisible();
  await expect(page.locator('#cartClose .cart-continue-short')).toBeVisible();
  await expect(page.locator('#cartClose .cart-continue-full')).toBeHidden();
  const headerActionsOverflow = await page.locator('.cart-header-actions').evaluate((el) =>
    el.getBoundingClientRect().right > el.parentElement.getBoundingClientRect().right + 1
  );
  expect(headerActionsOverflow).toBe(false);
  await testInfo.attach('cart-overview-390px', {
    body: await page.screenshot({ fullPage: false }),
    contentType: 'image/png',
  });
  await page.setViewportSize({ width: 320, height: 740 });
  await testInfo.attach('cart-overview-320px', {
    body: await page.screenshot({ fullPage: false }),
    contentType: 'image/png',
  });
  await page.setViewportSize(desktopViewport);

  const recommendations = page.locator('#cartAddons');
  await expect(recommendations.locator('.ca-title')).toHaveText('Рекомендуем к заказу');
  await expect(recommendations.locator('.ca-tabs-scroll')).toHaveAttribute('role', 'group');
  const allRecommendations = recommendations.locator('[data-atab="all"]');
  const sauceRecommendations = recommendations.locator('[data-atab="sauces"]');
  await expect(allRecommendations).toHaveAttribute('aria-pressed', 'true');
  await expect(sauceRecommendations).toHaveAttribute('aria-pressed', 'false');
  await sauceRecommendations.click();
  await expect(sauceRecommendations).toHaveAttribute('aria-pressed', 'true');
  await expect(recommendations.locator('.addon-pill-card')).toHaveCount(1);
  await expect(recommendations.locator('.ac-name')).toHaveText(['Соус сырный']);
  await allRecommendations.click();
  await expect(allRecommendations).toHaveAttribute('aria-pressed', 'true');
  await expect(recommendations.locator('.addon-pill-card')).toHaveCount(2);
  await expect(recommendations.locator('.ac-name')).toHaveText(['Лимонад к заказу', 'Соус сырный']);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#cartClose')).toHaveText('В меню');
  const recommendationsHeaderOverflow = await page.locator('.cart-header-actions').evaluate((el) =>
    el.getBoundingClientRect().right > el.parentElement.getBoundingClientRect().right + 1
  );
  expect(recommendationsHeaderOverflow).toBe(false);
  await recommendations.scrollIntoViewIfNeeded();
  const recommendationTabsFit = await recommendations.locator('.ca-tabs-scroll').evaluate((el) =>
    el.scrollWidth <= el.clientWidth
  );
  expect(recommendationTabsFit).toBe(true);
  await expect(recommendations.locator('[data-atab="drinks"]')).toBeVisible();
  await testInfo.attach('cart-recommendations-390px', {
    body: await page.screenshot({ fullPage: false }),
    contentType: 'image/png',
  });
  await page.evaluate(() => { document.getElementById('cartScrollBody').scrollTop = 0; });
  await page.setViewportSize(desktopViewport);

  const row = page.locator('#cartItems .cartItem[data-cart-idx="0"]');
  await expect(row.locator('.ci-unit-price')).toHaveText('735 ₽ / шт.');
  await expect(row.locator('.ci-line-total')).toHaveText('735 ₽');
  await expect(row.locator('.ci-name')).toHaveText('Маргарита');
  await expect(row.locator('.ci-opt')).toHaveText('35 см, пышное');
  await expect(row.locator('.ci-price-update-label')).toHaveText('Цена обновлена по меню');
  await expect(row.locator('.ci-price-update-values')).toHaveText('690 ₽ → 735 ₽');
  await expect(row.locator('[data-act="-"]')).toHaveAccessibleName('Уменьшить количество Маргарита');
  await expect(row.locator('[data-act="+"]')).toHaveAccessibleName('Увеличить количество Маргарита');

  await expect(page.locator('#checkoutPlace')).toHaveValue('');
  await expect(page.locator('#checkoutStreet')).toHaveValue('');
  await expect(page.locator('#checkoutHouse')).toHaveValue('');
  await expect(page.locator('#cartFee')).toContainText('Выберите населённый пункт');
  await expect(page.locator('#cartTotalLabel')).toHaveText('Сумма без доставки');

  const cartPanel = page.locator('#cartPanel');
  await page.locator('#cartClose').click();
  await expect(cartPanel).not.toHaveClass(/open/);

  await page.locator('#deliveryGrid [data-product-id="pz-marg"] .opts input[type="radio"]').nth(1).click();
  await page.locator('#deliveryGrid [data-product-id="pz-marg"] [data-add]').click();
  await page.locator('#cartFab').click();
  await expect(cartPanel).toHaveClass(/open/);
  await expect(row.locator('.qty span')).toHaveText('2');
  await expect(row.locator('.ci-unit-price')).toHaveText('735 ₽ / шт.');
  await expect(row.locator('.ci-line-total')).toHaveText('1 470 ₽');
  await expect(page.locator('#cartSubtotal')).toContainText('1 470 ₽');
  await expect(page.locator('#cartPromoDiscount')).toContainText('−100 ₽');
  await expect(page.locator('#cartPromoLine')).toContainText('SAVE100');

  await page.locator('#checkoutPlace').selectOption('Янтарный');
  await expect(page.locator('#cartFee')).toContainText('Янтарный');
  await expect(page.locator('#cartFee')).toContainText('200 ₽');
  await expect(page.locator('#cartTotalLabel')).toHaveText('Итого к оплате');
  await expect.poll(() => page.evaluate(() => window.totalsNow().total)).toBe(1570);

  await page.locator('.checkoutForm').scrollIntoViewIfNeeded();
  await page.evaluate(() => document.getElementById('toasts')?.remove());
  await testInfo.attach('cart-checkout-' + desktopViewport.width + 'px', {
    body: await page.screenshot({ fullPage: false }),
    contentType: 'image/png',
  });
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 740 }]) {
    await page.setViewportSize(viewport);
    await page.locator('.checkoutForm').scrollIntoViewIfNeeded();
    if (viewport.width === 390) {
      const footerHeight = await page.locator('#cartFooterBar').evaluate((el) => el.getBoundingClientRect().height);
      expect(footerHeight).toBeLessThan(200);
    }
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > window.innerWidth ||
      document.getElementById('cartScrollBody').scrollWidth > document.getElementById('cartScrollBody').clientWidth
    );
    expect(overflow).toBe(false);
    await testInfo.attach('cart-checkout-' + viewport.width + 'px', {
      body: await page.screenshot({ fullPage: false }),
      contentType: 'image/png',
    });
  }
  await page.setViewportSize(desktopViewport);

  const checkoutSections = page.locator('.checkoutForm > .checkout-section');
  await expect(checkoutSections).toHaveCount(3);
  await expect(checkoutSections.nth(0).locator('h4')).toHaveText('Получение заказа');
  await expect(checkoutSections.nth(0).locator('.checkout-recipient-card')).toContainText('Данные получателя');
  await expect(checkoutSections.nth(0).locator('.checkout-recipient-card')).toContainText('Тестовый гость');
  await expect(checkoutSections.nth(0).locator('.checkout-recipient-card')).toContainText('+7 999 123-45-67');
  await expect(checkoutSections.nth(1).locator('h4')).toHaveText('Когда и как оплатить');
  await expect(checkoutSections.nth(2).locator('h4')).toHaveText('Проверка заказа');
  await expect(checkoutSections.nth(0).locator('#checkoutMethod')).toHaveCount(1);
  await expect(checkoutSections.nth(0).locator('#checkoutPlace, #checkoutStreet, #checkoutHouse')).toHaveCount(3);
  await expect(checkoutSections.nth(1).locator('#checkoutSlot, #checkoutPay')).toHaveCount(2);
  await expect(checkoutSections.nth(2).locator('#checkoutComment')).toHaveCount(1);
  await expect(checkoutSections.nth(2).locator('.cart-promo-section')).toHaveCount(1);
  await expect(page.locator('#cartItems').evaluate((el) => el.compareDocumentPosition(document.querySelector('.checkoutForm')) & Node.DOCUMENT_POSITION_FOLLOWING)).toBeTruthy();

  const timeMode = page.locator('#checkoutTimeModeSeg');
  await expect(timeMode).toHaveAttribute('role', 'group');
  await expect(timeMode).toHaveAttribute('aria-label', 'Когда получить заказ');
  const asapMode = timeMode.locator('[data-tmode="asap"]');
  const scheduledMode = timeMode.locator('[data-tmode="slot"]');
  await expect(asapMode).toHaveAttribute('aria-pressed', 'true');
  await expect(scheduledMode).toHaveAttribute('aria-pressed', 'false');
  await scheduledMode.click();
  await expect(scheduledMode).toHaveAttribute('aria-pressed', 'true');
  await expect(asapMode).toHaveAttribute('aria-pressed', 'false');
  await asapMode.click();
  await expect(asapMode).toHaveAttribute('aria-pressed', 'true');
  await expect(scheduledMode).toHaveAttribute('aria-pressed', 'false');

  const summaryOrder = await page.evaluate(() => {
    const ids = ['cartSubtotal', 'cartDiscount', 'cartPromoDiscount', 'cartFee'];
    return ids.map((id) => Array.from(document.querySelector('.cart-summary-lines').children)
      .findIndex((node) => node.id === id));
  });
  expect(summaryOrder).toEqual([...summaryOrder].sort((a, b) => a - b));
});


test('checkout time mode follows programmatic preorder slot selection', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-02T15:00:00.000Z') });
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    localStorage.setItem('zt_inst_hide', '1');
    localStorage.setItem('zt_cart', JSON.stringify([{
      key: 'pz-marg_1',
      id: 'pz-marg',
      oi: 1,
      name: 'Маргарита',
      opt: '35 см, пышное',
      price: 735,
      sz: 35,
      qty: 1
    }]));
    localStorage.removeItem('zt_cartpromo');
    localStorage.removeItem('zt_saved_address');
    localStorage.removeItem('zt_saved_addresses');
    sessionStorage.removeItem('zt_checkout_draft');
    sessionStorage.setItem('splashDone', '1');
  });

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    let body = { ok: true, items: [], orders: [], pending: [], customers: [], threads: [], messages: [], promos: [] };
    if (url.pathname === '/api/dmenu') {
      body = { items: [MENU_ITEM], updatedAt: '2026-11-03T10:00:00.000Z' };
    } else if (url.pathname === '/api/delivery/info') {
      const isPreorderFixture = new Date().getTime() >= Date.parse('2026-11-02T20:30:00.000Z');
      body = {
        zones: [{ fee: 200, min: 0, places: ['Янтарный'] }],
        today: { isOpen: true, canAcceptAsap: !isPreorderFixture, open: 11, close: isPreorderFixture ? 20 : 22 },
        schedule: { open: 11, close: isPreorderFixture ? 20 : 22 },
        days: [
          { offset: 0, date: '2026-11-02', isOpen: true, open: 11, close: isPreorderFixture ? 20 : 22 },
          { offset: 1, date: '2026-11-03', isOpen: true, open: 11, close: 22 }
        ],
        busySlots: [],
        weekPromo: null,
        pizzaMonth: null
      };
    } else if (url.pathname === '/api/me/free-delivery') {
      body = { code: '' };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });

  await page.goto('/?brand=delivery');
  await expect.poll(() => page.evaluate(() => Array.isArray(window.DMENU) && window.DMENU.some((item) => item.id === 'pz-marg'))).toBe(true);
  await page.evaluate(() => window.refreshDeliveryInfo());
  await page.evaluate(() => {
    document.getElementById('cartPanel').classList.add('open');
    window.renderCart();
  });

  const timeMode = page.locator('#checkoutTimeModeSeg');
  const asapMode = timeMode.locator('[data-tmode="asap"]');
  const scheduledMode = timeMode.locator('[data-tmode="slot"]');
  await expect(asapMode).toHaveAttribute('aria-pressed', 'true');
  await expect(scheduledMode).toHaveAttribute('aria-pressed', 'false');
  await scheduledMode.click();
  await expect(scheduledMode).toHaveAttribute('aria-pressed', 'true');
  await expect(asapMode).toHaveAttribute('aria-pressed', 'false');
  await asapMode.click();
  await expect(asapMode).toHaveAttribute('aria-pressed', 'true');
  await expect(scheduledMode).toHaveAttribute('aria-pressed', 'false');

  await page.clock.setFixedTime(new Date('2026-11-02T20:30:00.000Z'));
  await page.evaluate(() => window.refreshDeliveryInfo());
  const missingPreorderSlot = await page.evaluate(() => window.CheckoutValidation.resolveSlot());
  expect(missingPreorderSlot).toMatchObject({ ok: false, message: 'Выберите время доставки для предзаказа ⏰' });
  await expect(page.locator('#checkoutSlot')).toHaveValue('');
  await expect(scheduledMode).toHaveAttribute('aria-pressed', 'true');
  await expect(asapMode).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#checkoutSlot').locator('xpath=..')).toBeVisible();
});

test('checkout reuses the same idempotency key after a network failure and reload', async ({ page }) => {
  // Keep checkout inside opening hours so the test exercises ASAP retry, not pre-order slot validation.
  await page.clock.install({ time: new Date('2026-11-04T13:00:00.000Z') });
  const submittedIds = [];
  let firstAttempt = true;

  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    localStorage.setItem('zt_inst_hide', '1');
    localStorage.setItem('zt_user', 'checkout-idempotency-test-token');
    localStorage.setItem('zt_cart', JSON.stringify([{
      key: 'pz-marg_1',
      id: 'pz-marg',
      oi: 1,
      name: 'Маргарита',
      opt: '35 см, пышное',
      price: 735,
      sz: 35,
      qty: 1
    }]));
    sessionStorage.setItem('splashDone', '1');
  });

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    let body = { ok: true, items: [], orders: [], pending: [], customers: [], threads: [], messages: [], promos: [] };

    if (url.pathname === '/api/me') {
      body = {
        customer: {
          id: 'checkout-idempotency-guest',
          name: 'Checkout Guest',
          phone: '+7 999 123-45-67',
          role: 'guest',
          verified: 1,
          cups: 0,
          stamps: 0,
          free: 0,
          history: [],
          qr: 'checkout-idempotency-guest'
        }
      };
    } else if (url.pathname === '/api/dmenu') {
      body = { items: [MENU_ITEM], updatedAt: '2026-11-03T10:00:00.000Z' };
    } else if (url.pathname === '/api/delivery/info') {
      body = {
        zones: [{ fee: 200, min: 0, places: ['Янтарный'] }],
        today: { isOpen: true, canAcceptAsap: true, open: 11, close: 22 },
        schedule: { open: 11, close: 22 },
        days: [
          { offset: 0, date: '2026-11-04', isOpen: true, open: 11, close: 22 },
          { offset: 1, date: '2026-11-05', isOpen: true, open: 11, close: 22 }
        ],
        busySlots: [],
        weekPromo: null,
        pizzaMonth: null
      };
    } else if (url.pathname === '/api/me/free-delivery') {
      body = { code: null };
    } else if (url.pathname === '/api/promo/info') {
      body = { ok: true, kind: 'fixed', value: 0, code: url.searchParams.get('code') };
    } else if (url.pathname === '/api/orders/mine') {
      body = { orders: [] };
    } else if (url.pathname === '/api/orders' && request.method() === 'POST') {
      const payload = request.postDataJSON();
      submittedIds.push(payload.client_order_id);
      if (firstAttempt) {
        firstAttempt = false;
        await route.abort('failed');
        return;
      }
      body = {
        order: {
          id: 'idempotency-order-1',
          no: 901,
          status: 'new',
          total: 735,
          items: [{ id: 'pz-marg', name: 'Маргарита', qty: 1, price: 735 }]
        }
      };
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body)
    });
  });

  await page.goto('/?brand=delivery');
  await page.waitForFunction(() =>
    window.me && window.me.id === 'checkout-idempotency-guest' &&
    Array.isArray(window.DMENU) && window.DMENU.some(item => item.id === 'pz-marg')
  );
  await page.locator('#cartFab').click();
  await page.locator('#checkoutMethod').selectOption('pickup');
  await page.locator('#checkoutBtn').click();

  await expect.poll(() => submittedIds.length).toBe(1);
  await expect(page.locator('#checkoutBtn')).toBeEnabled();
  const firstId = submittedIds[0];
  expect(firstId).toMatch(/^ord_[A-Za-z0-9_-]+$/);
  await expect.poll(() => page.evaluate(() =>
    localStorage.getItem('zt_pending_order_id:checkout-idempotency-guest')
  )).toBe(firstId);

  await page.reload();
  await page.waitForFunction(() =>
    window.me && window.me.id === 'checkout-idempotency-guest' &&
    Array.isArray(window.DMENU) && window.DMENU.some(item => item.id === 'pz-marg')
  );
  await page.locator('#cartFab').click();
  await page.locator('#checkoutMethod').selectOption('pickup');
  await page.locator('#checkoutBtn').click();

  await expect.poll(() => submittedIds.length).toBe(2);
  expect(submittedIds[1]).toBe(firstId);
  await expect(page.locator('#orderTrackModal')).toHaveClass(/show/);
  await expect.poll(() => page.evaluate(() =>
    localStorage.getItem('zt_pending_order_id:checkout-idempotency-guest')
  )).toBeNull();
  await expect.poll(() => page.evaluate(() =>
    sessionStorage.getItem('zt_checkout_draft')
  )).toBeNull();

  await page.reload();
  await page.waitForFunction(() =>
    window.me && window.me.id === 'checkout-idempotency-guest' &&
    Array.isArray(window.DMENU) && window.DMENU.some(item => item.id === 'pz-marg')
  );
  await expect(page.locator('#checkoutMethod')).toHaveValue('delivery');
  await expect(page.locator('#checkoutPlace')).toHaveValue('');
});

test('successful preorder keeps an explicit empty time selection for the next order', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-02T20:30:00.000Z') });
  let submittedOrders = 0;
  const submittedSlots = [];

  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    localStorage.setItem('zt_inst_hide', '1');
    localStorage.setItem('zt_cart', JSON.stringify([{
      key: 'pz-marg_1',
      id: 'pz-marg',
      oi: 1,
      name: 'Маргарита',
      opt: '35 см, пышное',
      price: 735,
      sz: 35,
      qty: 1
    }]));
    localStorage.removeItem('zt_cartpromo');
    localStorage.setItem('zt_user', 'successful-preorder-test-token');
    sessionStorage.setItem('splashDone', '1');
    sessionStorage.removeItem('zt_checkout_draft');
  });

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    let body = { ok: true, items: [], orders: [], pending: [], customers: [], threads: [], messages: [], promos: [] };

    if (url.pathname === '/api/me') {
      body = {
        customer: {
          id: 'successful-preorder-test-guest',
          name: 'Preorder Test Guest',
          phone: '+7 999 123-45-67',
          role: 'guest',
          verified: 1,
          cups: 0,
          stamps: 0,
          free: 0,
          history: [],
          qr: 'successful-preorder-test-guest'
        }
      };
    } else if (url.pathname === '/api/dmenu') {
      body = { items: [MENU_ITEM], updatedAt: '2026-11-03T10:00:00.000Z' };
    } else if (url.pathname === '/api/delivery/info') {
      body = {
        zones: [{ fee: 200, min: 0, places: ['Янтарный'] }],
        today: { isOpen: true, canAcceptAsap: false, open: 11, close: 20 },
        schedule: { open: 11, close: 20 },
        days: [
          { offset: 0, date: '2026-11-02', isOpen: true, open: 11, close: 20 },
          { offset: 1, date: '2026-11-03', isOpen: true, open: 11, close: 22 }
        ],
        busySlots: [],
        weekPromo: null,
        pizzaMonth: null
      };
    } else if (url.pathname === '/api/me/free-delivery') {
      body = { code: '' };
    } else if (url.pathname === '/api/orders' && request.method() === 'POST') {
      submittedOrders += 1;
      submittedSlots.push(request.postDataJSON().slot);
      body = {
        order: {
          id: 'preorder-reset-order-1',
          no: 902,
          status: 'new',
          total: 735,
          slot: request.postDataJSON().slot,
          items: [{ id: 'pz-marg', name: 'Маргарита', qty: 1, price: 735 }]
        }
      };
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body)
    });
  });

  await page.goto('/?brand=delivery');
  await expect.poll(() => page.evaluate(() =>
    Array.isArray(window.DMENU) && window.DMENU.some((item) => item.id === 'pz-marg')
  )).toBe(true);
  await page.evaluate(() => window.refreshDeliveryInfo());
  await page.evaluate(() => {
    document.getElementById('cartPanel').classList.add('open');
    window.renderCart();
  });

  const slot = page.locator('#checkoutSlot');
  const slotLabel = slot.locator('xpath=..');
  const mode = page.locator('#checkoutTimeModeSeg');
  const asap = mode.locator('[data-tmode="asap"]');
  const scheduled = mode.locator('[data-tmode="slot"]');
  await expect(scheduled).toHaveAttribute('aria-pressed', 'true');
  await expect(asap).toHaveAttribute('aria-pressed', 'false');
  await expect(slotLabel).toBeVisible();
  await expect(slot).toHaveValue('');

  const availableSlot = await slot.locator('option:not([disabled])').evaluateAll((options) =>
    options.map((option) => option.value).find((value) => value && value !== 'asap')
  );
  expect(availableSlot).toBeTruthy();
  await slot.selectOption(availableSlot);

  await page.locator('#checkoutPlace').selectOption('Янтарный');
  await page.locator('#checkoutStreet').fill('Советская');
  await page.locator('#checkoutHouse').fill('1');
  await page.locator('#checkoutBtn').click();
  await expect.poll(() => submittedOrders).toBe(1);
  expect(submittedSlots).toEqual([availableSlot]);
  await expect(page.locator('#orderTrackModal')).toHaveClass(/show/);
  await page.evaluate(() => { window.__cartReferenceBeforeRepeat = window.cart; });

  await page.locator('#orderTrackModal [data-ot-repeat]').click();
  await expect(page.locator('#cartPanel')).toHaveClass(/open/);
  await expect.poll(() => page.evaluate(() => window.cart.reduce((sum, item) => sum + (Number(item.qty) || 1), 0))).toBe(1);
  await expect.poll(() => page.evaluate(() => window.cart === window.__cartReferenceBeforeRepeat)).toBe(true);
  // The FAB is intentionally hidden while the cart drawer is open; verify it returns after close.
  const cartFab = page.locator('#cartFab');
  await expect(cartFab).toBeHidden();
  await expect(slot).toHaveValue('');
  await expect(scheduled).toHaveAttribute('aria-pressed', 'true');
  await expect(asap).toHaveAttribute('aria-pressed', 'false');
  await expect(slotLabel).toBeVisible();

  await page.locator('#cartClose').click();
  await expect(page.locator('#cartPanel')).not.toHaveClass(/open/);
  await expect(cartFab).toBeVisible();
  await cartFab.click();
  await expect(page.locator('#cartPanel')).toHaveClass(/open/);

  await page.locator('#checkoutPlace').selectOption('Янтарный');
  await page.locator('#checkoutStreet').fill('Советская');
  await page.locator('#checkoutHouse').fill('1');
  await page.locator('#checkoutBtn').click();
  await expect.poll(() => submittedOrders).toBe(1);
  await expect(page.locator('#checkoutSlot')).toHaveClass(/field-error|need-slot/);
});


test('scheduled mode without a selected slot survives checkout draft restore', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-02T13:00:00.000Z') });
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    localStorage.setItem('zt_inst_hide', '1');
    localStorage.setItem('zt_cart', JSON.stringify([{
      key: 'pz-marg_1', id: 'pz-marg', oi: 1, name: 'Маргарита',
      opt: '35 см, пышное', price: 735, sz: 35, qty: 1
    }]));
    sessionStorage.setItem('splashDone', '1');
  });
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    let body = { ok: true, items: [], orders: [], pending: [], customers: [], threads: [], messages: [], promos: [] };
    if (url.pathname === '/api/dmenu') {
      body = { items: [MENU_ITEM], updatedAt: '2026-11-03T10:00:00.000Z' };
    } else if (url.pathname === '/api/delivery/info') {
      body = {
        zones: [{ fee: 200, min: 0, places: ['Янтарный'] }],
        today: { isOpen: true, canAcceptAsap: true, open: 11, close: 22 },
        schedule: { open: 11, close: 22 },
        days: [
          { offset: 0, date: '2026-11-02', isOpen: true, open: 11, close: 22 },
          { offset: 1, date: '2026-11-03', isOpen: true, open: 11, close: 22 }
        ],
        busySlots: [], weekPromo: null, pizzaMonth: null
      };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });

  await page.goto('/?brand=delivery');
  await expect.poll(() => page.evaluate(() => window.DMENU.some(item => item.id === 'pz-marg'))).toBe(true);
  await page.evaluate(() => window.refreshDeliveryInfo());
  await page.evaluate(() => {
    document.getElementById('cartPanel').classList.add('open');
    window.renderCart();
  });
  const asap = page.locator('#checkoutTimeModeSeg [data-tmode="asap"]');
  const scheduled = page.locator('#checkoutTimeModeSeg [data-tmode="slot"]');
  const slot = page.locator('#checkoutSlot');
  await expect(asap).toHaveAttribute('aria-pressed', 'true');
  await scheduled.click();
  await expect(scheduled).toHaveAttribute('aria-pressed', 'true');
  await expect(slot).toHaveValue('');
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('zt_checkout_draft') || '{}').timeMode)).toBe('slot');

  await page.reload();
  await expect.poll(() => page.evaluate(() => window.DMENU.some(item => item.id === 'pz-marg'))).toBe(true);
  await page.evaluate(() => window.refreshDeliveryInfo());
  await page.evaluate(() => {
    document.getElementById('cartPanel').classList.add('open');
    window.renderCart();
  });

  const restoredState = await page.evaluate(() => {
    const slot = document.getElementById('checkoutSlot');
    const draft = JSON.parse(sessionStorage.getItem('zt_checkout_draft') || '{}');
    return {
      draftMode: draft.timeMode,
      draftSlot: draft.slot,
      slotMode: slot.dataset.checkoutTimeMode || slot.__checkoutTimeMode || null,
      slotValue: slot.value,
      selectedMode: document.querySelector('#checkoutTimeModeSeg [data-tmode="slot"]')?.getAttribute('aria-pressed')
    };
  });
  expect(restoredState).toEqual({
    draftMode: 'slot',
    draftSlot: '',
    slotMode: 'slot',
    slotValue: '',
    selectedMode: 'true'
  });
  await expect(page.locator('#checkoutSlot').locator('xpath=..')).toBeVisible();
  const result = await page.evaluate(() => window.CheckoutValidation.resolveSlot());
  expect(result).toMatchObject({ ok: false });
  await expect(page.locator('#checkoutSlot')).toHaveValue('');
});

test('scheduled mode stays active until a slot is selected during service hours', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-02T15:00:00.000Z') });
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    localStorage.setItem('zt_inst_hide', '1');
    localStorage.setItem('zt_cart', JSON.stringify([{
      key: 'pz-marg_1',
      id: 'pz-marg',
      oi: 1,
      name: 'Маргарита',
      opt: '35 см, пышное',
      price: 735,
      sz: 35,
      qty: 1
    }]));
    sessionStorage.setItem('splashDone', '1');
  });

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    let body = { ok: true, items: [], orders: [], pending: [], customers: [], threads: [], messages: [], promos: [] };
    if (url.pathname === '/api/dmenu') {
      body = { items: [MENU_ITEM], updatedAt: '2026-11-03T10:00:00.000Z' };
    } else if (url.pathname === '/api/delivery/info') {
      body = {
        zones: [{ fee: 200, min: 0, places: ['Янтарный'] }],
        today: { isOpen: true, canAcceptAsap: true, open: 11, close: 22 },
        schedule: { open: 11, close: 22 },
        days: [
          { offset: 0, date: '2026-11-02', isOpen: true, open: 11, close: 22 },
          { offset: 1, date: '2026-11-03', isOpen: true, open: 11, close: 22 }
        ],
        busySlots: [],
        weekPromo: null,
        pizzaMonth: null
      };
    } else if (url.pathname === '/api/me/free-delivery') {
      body = { code: '' };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });

  await page.goto('/?brand=delivery');
  await expect.poll(() => page.evaluate(() => Array.isArray(window.DMENU) && window.DMENU.some((item) => item.id === 'pz-marg'))).toBe(true);
  await page.evaluate(() => window.refreshDeliveryInfo());
  await page.evaluate(() => {
    document.getElementById('cartPanel').classList.add('open');
    window.renderCart();
  });

  const mode = page.locator('#checkoutTimeModeSeg');
  const asap = mode.locator('[data-tmode="asap"]');
  const scheduled = mode.locator('[data-tmode="slot"]');
  const slot = page.locator('#checkoutSlot');
  const slotLabel = slot.locator('xpath=..');

  await expect(asap).toHaveAttribute('aria-pressed', 'true');
  await scheduled.click();
  await expect(scheduled).toHaveAttribute('aria-pressed', 'true');
  await expect(asap).toHaveAttribute('aria-pressed', 'false');
  await expect(slotLabel).toBeVisible();
  await expect(slot).toHaveValue('');

  const availableSlot = await slot.locator('option:not([disabled])').evaluateAll((options) =>
    options.map((option) => option.value).find((value) => value && value !== 'asap')
  );
  expect(availableSlot).toBeTruthy();
  await slot.selectOption(availableSlot);
  await expect(slot).toHaveValue(availableSlot);
  await expect(scheduled).toHaveAttribute('aria-pressed', 'true');

  await asap.click();
  await expect(asap).toHaveAttribute('aria-pressed', 'true');
  await expect(scheduled).toHaveAttribute('aria-pressed', 'false');
  await expect(slot).toHaveValue('asap');
  await expect(slotLabel).toBeHidden();
});
