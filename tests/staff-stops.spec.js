import { test, expect } from '@playwright/test';

const staffCode = (value, fallback) => String(value || '').length >= 16 ? value : fallback;
const TEST_ADMIN_CODE = staffCode(process.env.ADMIN_CODE, 'ci-admin-role-code-2026');
const TEST_CASHIER_CODE = staffCode(process.env.CASHIER_CODE, 'ci-cashier-role-code-2026');
const TEST_DISPATCH_CODE = staffCode(process.env.DISPATCH_CODE, 'ci-dispatch-role-code-2026');

test.describe('Staff Stops & Guards Suite (F3.68)', () => {
  test('cashier cannot perform full menu put update', async ({ request }) => {
    const res = await request.put('/api/menu/pz-marg', {
      data: { name: 'Hacked Name' }
    });
    // Без авторизации или под кассиром полный PUT без прав должен быть отвергнут
    expect(res.status()).toBeGreaterThanOrEqual(401);
  });
});

test.describe('Staff Codes Suite (F3.60)', () => {
  test('diag codes_present + admin self-demotion forbidden', async ({ request }) => {
    const digits = '9' + String(Date.now()).slice(-9);
    const reg = await request.post('/api/auth/register', {
      data: { name: 'F360 Admin', phone: '+7' + digits, pin: '1234', consent: 1 }
    });
    expect(reg.ok()).toBeTruthy();
    const { token } = await reg.json();
    const auth = { Authorization: 'Bearer ' + token };
    const up = await request.post('/api/auth/activate', { data: { code: TEST_ADMIN_CODE }, headers: auth });
    expect(up.status()).toBe(200);
    const down = await request.post('/api/auth/activate', { data: { code: TEST_CASHIER_CODE }, headers: auth });
    expect(down.status()).toBe(409);
    const diag = await request.get('/api/tg/diag', { headers: auth });
    expect(diag.status()).toBe(200);
    const d = await diag.json();
    expect(typeof d.codes_present.admin).toBe('boolean');
    expect(typeof d.codes_present.cashier).toBe('boolean');
    expect(typeof d.codes_present.dispatch).toBe('boolean');
  });
});

/* ── F3.68: права стоп-листа vs редактор (серверные guard'ы) ── */
let staffPhoneSequence = 0;
async function staffToken(request, code, name) {
  const digits = '9' + String(Date.now() + staffPhoneSequence++).slice(-9);
  const reg = await request.post('/api/auth/register', { data: { name, phone: '+7' + digits, pin: '1234', consent: 1 } });
  const { token } = await reg.json();
  const act = await request.post('/api/auth/activate', { data: { code }, headers: { Authorization: 'Bearer ' + token } });
  expect(act.status()).toBe(200);
  return token;
}

test.describe('Stop-list Guards (F3.68)', () => {
  test('cashier toggles coffee stop-list but cannot edit/create', async ({ request }) => {
    const auth = { Authorization: 'Bearer ' + await staffToken(request, TEST_CASHIER_CODE, 'F368 Cashier') };
    // Cashier may change availability of coffee items, but cannot update other menu fields.
    expect((await request.put('/api/menu/cap', { data: { on: 0 }, headers: auth })).status()).toBe(200);
    expect((await request.put('/api/menu/cap', { data: { on: 1 }, headers: auth })).status()).toBe(200);
    expect((await request.put('/api/menu/pz-marg', { data: { name: 'Hacked' }, headers: auth })).status()).toBe(403);
    expect((await request.post('/api/menu', { data: { name: 'X' }, headers: auth })).status()).toBe(403);
  });
  test('dispatch cannot delete menu items', async ({ request }) => {
    const tok = await staffToken(request, TEST_DISPATCH_CODE, 'F368 Dispatch');
    expect((await request.delete('/api/menu/pz-marg', { headers: { Authorization: 'Bearer ' + tok } })).status()).toBe(403);
  });
});


test('cashier and dispatcher can toggle only their own menu section', async ({ request }) => {
  const cashierAuth = {
    Authorization: 'Bearer ' + await staffToken(request, TEST_CASHIER_CODE, 'Section Cashier')
  };
  const dispatchAuth = {
    Authorization: 'Bearer ' + await staffToken(request, TEST_DISPATCH_CODE, 'Section Dispatch')
  };
  const adminAuth = {
    Authorization: 'Bearer ' + await staffToken(request, TEST_ADMIN_CODE, 'Section Admin')
  };

  const menuResponse = await request.get('/api/menu/all', { headers: adminAuth });
  expect(menuResponse.status()).toBe(200);
  const items = (await menuResponse.json()).items || [];
  const coffeeItem = items.find(item => item.section === 'coffee');
  const deliveryItem = items.find(item => item.section === 'delivery');
  expect(coffeeItem, 'a coffee menu item is required for the stop-list test').toBeTruthy();
  expect(deliveryItem, 'a delivery menu item is required for the stop-list test').toBeTruthy();

  async function toggleAndRestore(item, auth) {
    const nextOn = Number(item.on) ? 0 : 1;
    const changed = await request.put('/api/menu/' + item.id, {
      data: { on: nextOn },
      headers: auth
    });
    expect(changed.status()).toBe(200);
    expect((await changed.json()).on).toBe(nextOn);

    const restored = await request.put('/api/menu/' + item.id, {
      data: { on: Number(item.on) ? 1 : 0 },
      headers: auth
    });
    expect(restored.status()).toBe(200);
  }

  await toggleAndRestore(coffeeItem, cashierAuth);
  await toggleAndRestore(deliveryItem, dispatchAuth);
  await toggleAndRestore(coffeeItem, adminAuth);
  await toggleAndRestore(deliveryItem, adminAuth);

  async function expectForbiddenWithoutMutation(item, auth) {
    const response = await request.put('/api/menu/' + item.id, {
      data: { on: Number(item.on) ? 0 : 1 },
      headers: auth
    });
    if (response.status() !== 403) {
      await request.put('/api/menu/' + item.id, {
        data: { on: Number(item.on) ? 1 : 0 },
        headers: adminAuth
      });
    }
    expect(response.status()).toBe(403);

    const refreshed = await request.get('/api/menu/all', { headers: adminAuth });
    const unchanged = (await refreshed.json()).items.find(entry => entry.id === item.id);
    expect(Number(unchanged.on)).toBe(Number(item.on));
  }

  await expectForbiddenWithoutMutation(deliveryItem, cashierAuth);
  await expectForbiddenWithoutMutation(coffeeItem, dispatchAuth);
});

test.describe('Cashier guest PIN and reward picker', () => {
  test.use({ serviceWorkers: 'block' });

  const cashierStaff = {
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
  const cashierGuest = {
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

      if (path === '/api/me') body = { customer: cashierStaff };
      if (path === '/api/staff/customers' && method === 'GET') body = { customers: [cashierGuest] };
      if (path === '/api/staff/customers' && method === 'POST') {
        onRequest('create', request.postDataJSON());
        body = {
          customer: { ...cashierGuest, name: request.postDataJSON().name, phone: request.postDataJSON().phone },
          created: true,
          reused: false,
          pinSet: true
        };
      }
      if (path === '/api/staff/redeem' && method === 'POST') {
        onRequest('redeem', request.postDataJSON());
        body = { customer: { ...cashierGuest, free: 0 } };
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

  test('guest form sends a four-digit PIN when cashier creates a profile', async ({ page }) => {
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

  test('gift redemption waits for drink selection and submits exactly once', async ({ page }, testInfo) => {
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
    await testInfo.attach('cashier-gift-drink-picker-open.png', {
      body: await page.screenshot({ animations: 'disabled' }),
      contentType: 'image/png'
    });

    await modal.locator('.omClose').click();
    await expect(modal).not.toHaveClass(/show/);
    expect(redemptions).toHaveLength(0);

    await page.locator('#redeemBtn').click();
    await expect(modal).toHaveClass(/show/);
    await modal.locator('[data-rp="Капучино"]').click();

    await expect.poll(() => redemptions).toHaveLength(1);
    expect(redemptions[0]).toEqual({
      id: cashierGuest.id,
      item: 'Капучино'
    });
    await expect(modal).not.toHaveClass(/show/);
    await expect(page.locator('#redeemBtn')).toBeHidden();
  });
});
