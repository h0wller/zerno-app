import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('dispatcher cards render one cancel action for active orders and none for terminal orders', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    localStorage.setItem('zt_inst_hide', '1');
    sessionStorage.setItem('splashDone', '1');
  });

  await page.route('**/api/orders', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ orders: [
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
    ] })
  }));

  await page.goto('/?brand=delivery');
  await page.waitForFunction(() => typeof window.setUser === 'function' && typeof window.renderOrders === 'function');
  await page.evaluate(() => {
    window.setUser('dispatcher-cancel-test-token', {
      id: 'dispatcher-cancel-test',
      name: 'Dispatcher Test',
      phone: '+7 900 000-00-00',
      role: 'dispatch',
      cups: 0, stamps: 0, free: 0, history: [], verified: 1
    });
    window.setMode('orders');
  });

  const active = page.locator('.orderCard[data-oid="active-order"]');
  const cancelled = page.locator('.orderCard[data-oid="cancelled-order"]');
  await expect(active).toBeVisible();
  await expect(active.locator('[data-os="cancel"]')).toHaveCount(1);
  await expect(active.getByRole('button', { name: /Отменить/ })).toHaveCount(1);
  await expect(active.locator('[data-os="accept"]')).toHaveCount(1);
  await expect(active.locator('[data-os="done"]')).toHaveCount(1);

  await expect(cancelled).toBeVisible();
  await expect(cancelled.locator('.ocStatus')).toContainText('Отменён');
  await expect(cancelled.locator('[data-os]')).toHaveCount(0);
});
