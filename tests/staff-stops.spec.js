import { test, expect } from '@playwright/test';

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
    const up = await request.post('/api/auth/activate', { data: { code: process.env.ADMIN_CODE || '3364' }, headers: auth });
    expect(up.status()).toBe(200);
    const down = await request.post('/api/auth/activate', { data: { code: process.env.CASHIER_CODE || '2468' }, headers: auth });
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
    const auth = { Authorization: 'Bearer ' + await staffToken(request, process.env.CASHIER_CODE || '2468', 'F368 Cashier') };
    // Cashier may change availability of coffee items, but cannot update other menu fields.
    expect((await request.put('/api/menu/cap', { data: { on: 0 }, headers: auth })).status()).toBe(200);
    expect((await request.put('/api/menu/cap', { data: { on: 1 }, headers: auth })).status()).toBe(200);
    expect((await request.put('/api/menu/pz-marg', { data: { name: 'Hacked' }, headers: auth })).status()).toBe(403);
    expect((await request.post('/api/menu', { data: { name: 'X' }, headers: auth })).status()).toBe(403);
  });
  test('dispatch cannot delete menu items', async ({ request }) => {
    const tok = await staffToken(request, process.env.DISPATCH_CODE || '5719', 'F368 Dispatch');
    expect((await request.delete('/api/menu/pz-marg', { headers: { Authorization: 'Bearer ' + tok } })).status()).toBe(403);
  });
});


test('cashier and dispatcher can toggle only their own menu section', async ({ request }) => {
  const cashierAuth = {
    Authorization: 'Bearer ' + await staffToken(request, process.env.CASHIER_CODE || '2468', 'Section Cashier')
  };
  const dispatchAuth = {
    Authorization: 'Bearer ' + await staffToken(request, process.env.DISPATCH_CODE || '5719', 'Section Dispatch')
  };
  const adminAuth = {
    Authorization: 'Bearer ' + await staffToken(request, process.env.ADMIN_CODE || '3364', 'Section Admin')
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
