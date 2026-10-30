import { test, expect } from '@playwright/test';

const orderFixture = {
  "id": "profile-order-1",
  "no": "P-1042",
  "created": "2026-10-30T12:00:00.000Z",
  "status": "way",
  "total": 1290,
  "eta": "19:10",
  "items": [
    {
      "qty": 1,
      "name": "Филадельфия с огурцом"
    }
  ],
  "gifts": []
};

test.describe('Модуль заказов профиля', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('zt_onb', '1');
      sessionStorage.setItem('splashDone', '1');
    });
    await page.route('**/api/orders/mine', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ orders: [orderFixture] })
    }));
    await page.goto('/?brand=delivery', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      window.me = {
        id: 'profile-test',
        name: 'Тестовый гость',
        phone: '+7 900 000-00-00',
        role: 'guest',
        cups: 2,
        stamps: 2,
        free: 0,
        history: [],
        verified: 1
      };
      window.brand = 'delivery';
      window.renderProfile();
    });
    await expect(page.locator('#myOrdersBtn')).toBeVisible();
  });

  test('выводит последний заказ в профиле и список в отдельной модалке', async ({ page }) => {
    await expect(page.locator('#myOrders .myOrderCard')).toContainText('Заказ #P-1042');
    await expect(page.locator('#myOrders .myOrderCard')).toContainText('Филадельфия с огурцом');

    await page.locator('#myOrdersBtn').click();

    const modal = page.locator('#ordersModal');
    await expect(modal).toHaveClass(/show/);
    await expect(modal.locator('#omList .myOrderCard')).toContainText('Заказ #P-1042');
    await expect(modal.locator('[data-open-track="profile-order-1"]')).toBeVisible();

    await modal.locator('.omClose').click();
    await expect(modal).not.toHaveClass(/show/);
  });
});
