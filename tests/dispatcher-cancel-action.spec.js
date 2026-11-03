import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('dispatcher cards render one cancel action for active orders and none for terminal orders', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    localStorage.setItem('zt_inst_hide', '1');
    localStorage.setItem('zt_user', 'dispatcher-cancel-test-token');
    sessionStorage.setItem('splashDone', '1');
  });

  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    let body = { ok: true, items: [], orders: [], pending: [], customers: [], threads: [], msgs: [], promos: [] };

    if (url.pathname === '/api/me') {
      body = { customer: {
        id: 'dispatcher-cancel-test', name: 'Dispatcher Test', phone: '+7 900 000-00-00',
        role: 'dispatch', verified: 1, cups: 0, stamps: 0, free: 0, history: []
      } };
    } else if (url.pathname === '/api/orders') {
      body = { orders: [
        {
          id: 'active-order', no: 51, status: 'new', name: 'Test Buyer',
          phone: '+7 900 000-00-00', method: 'delivery', place: 'Янтарный', addr: 'Советская, 1',
          slot: 'asap', pay: 'cash', created: '2026-11-03T19:00:00.000Z', total: 500,
          items: [{ qty: 1, name: 'Пицца' }]
        },
        {
          id: 'cancelled-order', no: 50, status: 'cancel', name: 'Test Buyer',
          phone: '+7 900 000-00-00', method: 'delivery', place: 'Янтарный', addr: 'Советская, 1',
          slot: 'asap', pay: 'cash', created: '2026-11-03T18:00:00.000Z', total: 500,
          items: [{ qty: 1, name: 'Пицца' }]
        }
      ] };
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body)
    });
  });

  await page.goto('/?brand=delivery');
  await page.waitForFunction(() => window.me && window.me.role === 'dispatch');
  await page.evaluate(() => window.setMode('orders'));

  const active = page.locator('.orderCard[data-oid="active-order"]');
  const cancelled = page.locator('.orderCard[data-oid="cancelled-order"]');
  await expect(active).toBeVisible();
  await expect(active.locator('[data-os="cancel"]')).toHaveCount(1);
  await expect(active.getByRole('button', { name: '❌ Отменить' })).toHaveCount(1);
  await expect(active.locator('[data-os="accept"]')).toHaveCount(1);
  await expect(active.locator('[data-os="done"]')).toHaveCount(1);

  await expect(cancelled).toBeVisible();
  await expect(cancelled.locator('.ocStatus')).toContainText('Отменён');
  await expect(cancelled.locator('[data-os]')).toHaveCount(0);
});
