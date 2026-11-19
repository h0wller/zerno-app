import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

const staff = {
  id: 'cashier-pin-e2e-staff',
  name: 'Cashier E2E',
  phone: '+7 900 000-00-01',
  role: 'admin',
  verified: 1,
  cups: 0,
  stamps: 0,
  free: 0,
  history: [],
  qr: 'cashier-pin-e2e-staff'
};

const guest = {
  id: 'cashier-pin-e2e-guest',
  name: 'Guest E2E',
  phone: '+7 900 000-00-02',
  role: 'guest',
  verified: 1,
  cups: 10,
  stamps: 0,
  free: 1,
  history: [],
  qr: 'cashier-pin-e2e-guest'
};

async function mockCashierSession(page, onRequest = () => {}) {
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    localStorage.setItem('zt_inst_hide', '1');
    localStorage.setItem('zt_user', 'cashier-pin-e2e-token');
    localStorage.setItem('zt_role', 'admin');
    sessionStorage.setItem('splashDone', '1');
  });
  await page.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const path = url.pathname;
    let body = { ok: true, items: [], orders: [], pending: [], customers: [], threads: [], msgs: [], promos: [], log: [] };

    if (path === '/api/me') body = { customer: staff };
    if (path === '/api/staff/customers' && method === 'GET') body = { customers: [guest] };
    if (path === '/api/staff/customers' && method === 'POST') {
      onRequest('create', request.postDataJSON());
      body = { customer: { ...guest, name: request.postDataJSON().name, phone: request.postDataJSON().phone }, created: true, reused: false, pinSet: true };
    }
    if (path === '/api/staff/redeem' && method === 'POST') {
      onRequest('redeem', request.postDataJSON());
      body = { customer: { ...guest, free: 0 } };
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body)
    });
  });
}

async function enterCashierMode(page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?brand=coffee');
  await page.waitForFunction(() =>
    window.me && window.me.role === 'admin' &&
    document.documentElement.hasAttribute('data-staff-ready') &&
    typeof window.setMode === 'function'
  );
  await page.evaluate(() => window.setMode('cashier'));
  await expect(page.locator('#cashierView')).toBeVisible();
}

test('cashier guest form submits a four-digit PIN with the new profile request', async ({ page }) => {
  let submitted = null;
  await mockCashierSession(page, (type, payload) => {
    if (type === 'create') submitted = payload;
  });
  await enterCashierMode(page);

  await page.locator('#newGuestBtn').click();
  await expect(page.locator('#ngCard')).toBeVisible();
  await page.locator('#ngName').fill('New Guest');
  await page.locator('#ngPhone').fill('+7 900 000-00-03');
  await page.locator('#ngPin').fill('4826');
  await page.locator('#ngSave').click();

  await expect.poll(() => submitted).toMatchObject({
    name: 'New Guest',
    phone: '+7 900 000-00-03',
    pin: '4826'
  });
  await expect(page.locator('#ngCard')).toBeHidden();
  await expect(page.locator('#custName')).toHaveText('New Guest');
});

test('cashier gift redemption waits for drink selection and submits exactly once', async ({ page }, testInfo) => {
  const redemptions = [];
  await mockCashierSession(page, (type, payload) => {
    if (type === 'redeem') redemptions.push(payload);
  });
  await enterCashierMode(page);

  await page.locator('#findInput').fill('Guest E2E');
  await page.locator('#findBtn').click();
  await expect(page.locator('#redeemBtn')).toBeVisible();

  const modal = page.locator('#redeemPick');
  await page.locator('#redeemBtn').click();
  await expect(modal).toHaveClass(/show/);
  await expect(modal).toBeVisible();
  expect(redemptions).toHaveLength(0);

  await modal.locator('.omClose').click();
  await expect(modal).not.toHaveClass(/show/);
  expect(redemptions).toHaveLength(0);

  await page.locator('#redeemBtn').click();
  await expect(modal).toHaveClass(/show/);
  await modal.locator('[data-rp="Капучино"]').click();

  await expect.poll(() => redemptions).toHaveLength(1);
  expect(redemptions[0]).toEqual({
    id: guest.id,
    item: 'Капучино'
  });
  await expect(modal).not.toHaveClass(/show/);
  await expect(page.locator('#custFree')).toBeHidden();

  await testInfo.attach('cashier-gift-drink-picker-open.png', {
    body: await page.screenshot({ animations: 'disabled' }),
    contentType: 'image/png'
  });
});
