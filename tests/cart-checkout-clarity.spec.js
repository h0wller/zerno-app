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

test('cart keeps the current selected price and explains every amount without guessing the address', async ({ page }) => {
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
    sessionStorage.removeItem('zt_checkout_draft');
    sessionStorage.setItem('splashDone', '1');
  });

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    let body = { ok: true, items: [], orders: [], pending: [], customers: [], threads: [], messages: [], promos: [] };

    if (url.pathname === '/api/dmenu') {
      body = { items: [MENU_ITEM], updatedAt: '2026-11-03T10:00:00.000Z' };
    } else if (url.pathname === '/api/delivery/info') {
      const isPreorderFixture = new Date().getTime() >= new Date('2026-11-02T20:30:00.000Z').getTime();
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

  const row = page.locator('#cartItems .cartItem[data-cart-idx="0"]');
  await expect(row.locator('.ci-unit-price')).toHaveText('735 ₽ / шт.');
  await expect(row.locator('.ci-line-total')).toHaveText('735 ₽');
  await expect(row.locator('.ci-name')).toHaveText('Маргарита');
  await expect(row.locator('.ci-opt')).toHaveText('35 см, пышное');

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

  const checkoutSections = page.locator('.checkoutForm > .checkout-section');
  await expect(checkoutSections).toHaveCount(3);
  await expect(checkoutSections.nth(0).locator('h4')).toHaveText('Получение');
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

  await page.clock.setFixedTime(new Date('2026-11-02T20:30:00.000Z'));
  await page.evaluate(() => window.refreshDeliveryInfo());
  await page.evaluate(() => window.CheckoutValidation.resolveSlot());
  await expect(page.locator('#checkoutSlot')).not.toHaveValue('asap');
  await expect(scheduledMode).toHaveAttribute('aria-pressed', 'true');
  await expect(asapMode).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#checkoutSlot').locator('xpath=..')).not.toHaveAttribute('hidden', '');
  await page.evaluate(() => {
    const slot = document.getElementById('checkoutSlot');
    slot.value = 'asap';
    slot.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(asapMode).toHaveAttribute('aria-pressed', 'true');
  await expect(scheduledMode).toHaveAttribute('aria-pressed', 'false');
  await page.evaluate(() => window.CheckoutValidation.ensureTimeModeToggle());
  await expect(asapMode).toHaveAttribute('aria-pressed', 'true');
  await expect(scheduledMode).toHaveAttribute('aria-pressed', 'false');

  const summaryOrder = await page.evaluate(() => {
    const ids = ['cartSubtotal', 'cartDiscount', 'cartPromoDiscount', 'cartFee'];
    return ids.map((id) => Array.from(document.querySelector('.cart-summary-lines').children)
      .findIndex((node) => node.id === id));
  });
  expect(summaryOrder).toEqual([...summaryOrder].sort((a, b) => a - b));

  await page.locator('#checkoutMethod').selectOption('pickup');
  await expect(page.locator('#checkoutDeliveryGroup')).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.totalsNow().total)).toBe(1223);
  await page.locator('#checkoutMethod').selectOption('delivery');
  await expect(page.locator('#checkoutDeliveryGroup')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.totalsNow().total)).toBe(1570);
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
        days: [],
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
});
