import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

const MENU_ITEM = {
  id: 'pz-marg',
  section: 'delivery',
  cat: 'pizza',
  e: '🍕',
  name: 'Маргарита',
  desc: 'Красный соус, моцарелла',
  comp: ['красный соус', 'моцарелла'],
  vol: '25/35 см',
  price: '0',
  on: 1,
  opts: [
    { l: '25 см, пышное', w: '415 г', p: 535, sz: 25 },
    { l: '35 см, пышное', w: '750 г', p: 735, sz: 35 }
  ]
};

test('cart keeps the current selected price and explains every amount without guessing the address', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-02T15:00:00.000Z') });
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    localStorage.setItem('zt_inst_hide', '1');
    localStorage.setItem('zt_cart', JSON.stringify([{
      key: 'pz-marg_1',
      id: 'pz-marg',
      oi: 1,
      name: 'Old product name',
      opt: 'Old option label',
      price: 690,
      sz: 35,
      qty: 1
    }]));
    localStorage.setItem('zt_cartpromo', 'SAVE100');
    localStorage.setItem('zt_saved_address', JSON.stringify({
      place: 'Синявино',
      street: 'Садовая',
      house: '10'
    }));
    sessionStorage.removeItem('zt_checkout_draft');
    sessionStorage.setItem('splashDone', '1');
  });

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    let body = { ok: true, items: [], orders: [], pending: [], customers: [], threads: [], messages: [], promos: [] };

    if (url.pathname === '/api/dmenu') {
      body = { items: [MENU_ITEM], updatedAt: '2026-11-03T10:00:00.000Z' };
    } else if (url.pathname === '/api/delivery/info') {
      body = {
        zones: [
          { fee: 200, min: 0, places: ['Янтарный'] },
          { fee: 250, min: 1000, places: ['Синявино'] }
        ],
        today: { isOpen: true, canAcceptAsap: true, open: 11, close: 22 },
        schedule: { open: 11, close: 22 },
        days: [],
        busySlots: [],
        weekPromo: null,
        pizzaMonth: null
      };
    } else if (url.pathname === '/api/promo/info') {
      body = { ok: true, kind: 'fixed', value: 100, code: url.searchParams.get('code') };
    } else if (url.pathname === '/api/me/free-delivery') {
      body = { code: '' };
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body)
    });
  });

  await page.goto('/?brand=delivery');
  await expect(page.locator('#deliveryGrid [data-product-id="pz-marg"]')).toBeAttached();
  await expect.poll(() => page.evaluate(() => window.DMENU.some((item) => item.id === 'pz-marg'))).toBe(true);
  await page.evaluate(() => {
    document.getElementById('cartPanel').classList.add('open');
    window.renderCart();
  });

  const row = page.locator('#cartItems .cartItem[data-cart-idx="0"]');
  await expect(row.locator('.ci-unit-price')).toHaveText('735 ₽ / шт.');
  await expect(row.locator('.ci-line-total')).toHaveText('735 ₽');
  await expect(row.locator('.ci-name')).toHaveText('Маргарита');
  await expect(row.locator('.ci-opt')).toHaveText('35 см, пышное');

  await expect(page.locator('#checkoutPlace')).toHaveValue('');
  await expect(page.locator('#checkoutStreet')).toHaveValue('');
  await expect(page.locator('#checkoutHouse')).toHaveValue('');
  await expect(page.locator('#cartFee')).toContainText('Выберите населённый пункт');
  await expect(page.locator('#cartTotalLabel')).toHaveText('Сумма без доставки');

  await page.locator('#deliveryGrid [data-product-id="pz-marg"] .opts button').nth(1).click();
  await page.locator('#deliveryGrid [data-product-id="pz-marg"] [data-add]').click();
  await expect(row.locator('.qty span')).toHaveText('2');
  await expect(row.locator('.ci-unit-price')).toHaveText('735 ₽ / шт.');
  await expect(row.locator('.ci-line-total')).toHaveText('1 470 ₽');
  await expect(page.locator('#cartSubtotal')).toContainText('1 470 ₽');
  await expect(page.locator('#cartPromoDiscount')).toContainText('−100 ₽');
  await expect(page.locator('#cartPromoLine')).toContainText('SAVE100');

  await page.locator('#checkoutPlace').selectOption('Янтарный');
  await expect(page.locator('#cartFee')).toContainText('Янтарный');
  await expect(page.locator('#cartFee')).toContainText('200 ₽');
  await expect(page.locator('#cartTotalLabel')).toHaveText('Итого к оплате');
  await expect.poll(() => page.evaluate(() => window.totalsNow().total)).toBe(1570);

  const summaryOrder = await page.evaluate(() => {
    const ids = ['cartSubtotal', 'cartDiscount', 'cartPromoDiscount', 'cartFee'];
    return ids.map((id) => Array.from(document.querySelector('.cart-summary-lines').children)
      .findIndex((node) => node.id === id));
  });
  expect(summaryOrder).toEqual([...summaryOrder].sort((a, b) => a - b));
});
