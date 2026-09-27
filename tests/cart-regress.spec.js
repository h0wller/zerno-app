import { test, expect } from '@playwright/test';

const num = (s) => parseInt(String(s).replace(/[^0-9]/g, ''), 10) || 0;

test('корзина: 1 клик = +1, подарок 2×35, пустая = 0 ₽', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    localStorage.setItem('zt_inst_hide', '1');
    localStorage.setItem('zt_ios_hide', '1');
    sessionStorage.setItem('splashDone', '1');
  });
  await page.goto('/?brand=delivery');
  const card = page.locator('#deliveryGrid .card').first();
  await card.locator('.opts button', { hasText: '35 см' }).first().click({ timeout: 10000 });
  await card.locator('button', { hasText: 'Добавить' }).first().click();
  await page.locator('#cartFab').click();
  const total = page.locator('#cartTotal');
  const fee = num(await page.locator('#cartFee').textContent());
  const t1 = num(await total.textContent());
  const price = t1 - fee;
  expect(price).toBeGreaterThan(0);
  await page.locator('#cartItems [data-act="+"]').first().click();
  await expect.poll(async () => num(await total.textContent()), { timeout: 5000 }).toBe(t1 + price); // НЕ +2
  await page.waitForFunction(() => window.deliveryInfo, null, { timeout: 10000 });
  const pm = await page.evaluate(() => (window.deliveryInfo && window.deliveryInfo.pizzaMonth && window.deliveryInfo.pizzaMonth.name) || '');
  if (pm) await expect(page.locator('#cartGifts')).toContainText('подарок', { timeout: 5000 });
  else await expect(page.locator('#cartGifts')).toHaveText('', { timeout: 5000 });
  /* Ф5.23: снятие количества карточным «−» за один тап */
  await page.locator('#cartClose').click();
  await page.locator('#deliveryGrid .step[data-step="-1"]').first().click();
  await page.locator('#cartFab').click();
  await expect.poll(async () => num(await total.textContent()), { timeout: 5000 }).toBe(t1);
  await page.locator('#cartItems [data-act="-"]').first().click(); /* qty 1→0: карточный «−» уже снял один (Ф5.23) */
  await expect(page.locator('#cartItems')).toContainText('Корзина пуста');
  await expect(total).toContainText('0 ₽');
  await expect(page.locator('#cartFee')).toHaveText('');
  expect(errs).toEqual([]);
});
