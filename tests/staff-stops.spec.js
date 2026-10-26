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
