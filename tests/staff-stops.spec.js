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
