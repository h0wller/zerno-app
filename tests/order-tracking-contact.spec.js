import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

async function openDeliveryApp(page) {
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    localStorage.setItem('zt_inst_hide', '1');
    localStorage.removeItem('zt_chatctx');
    localStorage.setItem('zt_cart', JSON.stringify([{
      key: 'pickup-test', id: 'pickup-test', oi: -1, name: 'Тестовая позиция',
      price: 100, qty: 1, sz: 0
    }]));
    sessionStorage.removeItem('zt_support_ctx');
    sessionStorage.setItem('splashDone', '1');
  });
  await page.goto('/?brand=delivery');
}

test('самовывоз скрывает адресную группу без ошибок DOM', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  // Fix the browser clock at 17:00 Kaliningrad time so the normal pickup discount is deterministic.
  await page.clock.install({ time: new Date('2026-11-02T15:00:00.000Z') });
  await openDeliveryApp(page);
  await page.waitForFunction(() => typeof window.renderCart === 'function');
  await page.evaluate(() => document.getElementById('cartPanel').classList.add('open'));

  const deliveryGroup = page.locator('#checkoutDeliveryGroup');
  await expect(deliveryGroup).toBeVisible();

  await page.locator('#checkoutMethod').selectOption('pickup');
  await expect(deliveryGroup).toBeHidden();
  await expect(page.locator('#cartDiscount')).toContainText('10%');

  await page.locator('#checkoutMethod').selectOption('delivery');
  await expect(deliveryGroup).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('регистрационная бесплатная доставка сохраняется во время обеденной акции', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-02T10:00:00.000Z') });
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    localStorage.setItem('zt_inst_hide', '1');
    localStorage.setItem('zt_user', 'registered-guest-lunch-test-token');
    localStorage.removeItem('zt_cartpromo');
    localStorage.setItem('zt_cart', JSON.stringify([{
      key: 'registration-free-delivery-test',
      id: 'registration-free-delivery-test',
      oi: -1,
      name: 'Тестовая позиция',
      price: 1000,
      qty: 1,
      sz: 0
    }]));
    sessionStorage.setItem('splashDone', '1');
  });

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    let body = { ok: true, items: [], orders: [], pending: [], customers: [], threads: [], msgs: [], promos: [] };
    if (url.pathname === '/api/me') {
      body = {
        customer: {
          id: 'registered-guest-lunch-test',
          name: 'Lunch Guest',
          phone: '+7 999 123-45-67',
          role: 'guest',
          verified: 1,
          cups: 0,
          stamps: 0,
          free: 0,
          history: [],
          qr: 'registered-guest-lunch-test'
        }
      };
    } else if (url.pathname === '/api/me/free-delivery') {
      body = { code: 'B1234ABCD' };
    } else if (url.pathname === '/api/promo/info') {
      body = {
        ok: true,
        kind: 'freeship',
        value: 0,
        code: url.searchParams.get('code')
      };
    } else if (url.pathname === '/api/delivery/info') {
      body = {
        zones: [{ fee: 200, places: ['Янтарный'] }],
        today: { isOpen: true, canAcceptAsap: true, open: 11, close: 22 },
        schedule: { open: 11, close: 22 },
        days: [],
        busySlots: [],
        weekPromo: null,
        pizzaMonth: null
      };
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body)
    });
  });

  await page.goto('/?brand=delivery');
  await page.waitForFunction(() => window.me && window.me.id === 'registered-guest-lunch-test');
  await page.waitForFunction(() => typeof window.refreshDeliveryInfo === 'function');
  await page.evaluate(() => window.refreshDeliveryInfo());
  await page.waitForFunction(() => typeof window.renderCart === 'function');
  await page.evaluate(() => {
    document.getElementById('cartPanel').classList.add('open');
    window.renderCart();
  });
  await page.locator('#checkoutPlace').selectOption('Янтарный');

  await expect(page.locator('#cartSubtotal')).toContainText('1 000 ₽');
  await expect(page.locator('#cartDiscount')).toContainText('Обеденная акция · 20%');
  await expect(page.locator('#cartDiscount')).toContainText('−200 ₽');
  await expect(page.locator('#cartDiscount')).toContainText('Будни, 11:00–15:00');
  await expect(page.locator('#cartFee')).toContainText('Бесплатно');
  await expect(page.locator('#cartFee')).toHaveClass(/is-free/);
  await expect(page.locator('#cartFee')).toContainText('Бонус за регистрацию');
  await expect(page.locator('#cartFee')).toContainText('экономия 200 ₽');
  await expect(page.locator('#cartPromoLine')).toContainText('Бонус за регистрацию применён');
  await expect.poll(() => page.evaluate(() => window.totalsNow().total)).toBe(800);
});

test('контакт из заказа открывает доставочный чат с историей и номером заказа', async ({ page }) => {
  const threadKeys = [];
  await page.route('**/api/chat/thread**', async route => {
    const request = route.request();
    const queryKey = new URL(request.url()).searchParams.get('key') || '';
    threadKeys.push(queryKey || request.headers()['x-chat-capability'] || '');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ msgs: [] })
    });
  });
  await page.route('**/api/orders/mine', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ orders: [] })
  }));

  await openDeliveryApp(page);
  await page.waitForFunction(() =>
    typeof window.openOrderTrackModal === 'function' &&
    typeof window.reloadChatThread === 'function' &&
    window.chatState
  );

  await page.evaluate(() => window.openOrderTrackModal({
    id: 'order-1234',
    no: 1234,
    status: 'new',
    total: 890,
    items: [{ id: 1, name: 'Пицца', price: 890, qty: 1 }]
  }));

  await page.locator('#orderTrackModal [data-ot-chat]').click();

  await expect(page.locator('#chatPanel')).toHaveClass(/open/);
  await expect(page.locator('#chatPanel .chatHead')).toContainText('доставка');
  await expect(page.locator('#chatMsgs')).toContainText('Привет! Я Ника, поддержка доставки');
  await expect(page.locator('#chatInput')).toHaveValue(
    'Здравствуйте! У меня вопрос по заказу №1234.'
  );
  await expect.poll(() => threadKeys.some(key => key.endsWith(':d'))).toBe(true);
  await expect(page.locator('#orderTrackModal')).not.toHaveClass(/show/);
});
