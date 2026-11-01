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

test('контакт из заказа открывает доставочный чат с историей и номером заказа', async ({ page }) => {
  const threadKeys = [];
  await page.route('**/api/chat/thread**', async route => {
    threadKeys.push(new URL(route.request().url()).searchParams.get('key') || '');
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
  expect(threadKeys.some(key => key.endsWith(':d'))).toBe(true);
  await expect(page.locator('#orderTrackModal')).not.toHaveClass(/show/);
});
