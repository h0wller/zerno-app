import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.join('artifacts', 'ui-baseline');
const ADMIN = process.env.UI_ADMIN_CODE || '1234';
const CASHIER = process.env.UI_CASHIER_CODE || '2468';

test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('zt_onb', '1'));
});

const shot = (page, name) => page.screenshot({ path: path.join(OUT, name + '.png') });

async function closeOverlay(page) {
  await page.evaluate(() => {
    const ov = document.getElementById('overlay');
    if (ov) { ov.classList.remove('show', 'ov-high'); ov.style.pointerEvents = 'none'; }
  });
}

/** Вход без UI: регистрация через API → токен в localStorage → бут уже залогиненным. */
async function loginAs(page, { code } = {}) {
  const d = '9' + String(Date.now()).slice(-9);
  const res = await page.request.post('/api/auth/register', {
    data: { name: 'Baseline ' + d.slice(-4), phone: '+7' + d, pin: '1234', consent: 1 },
  });
  if (res.status() !== 200) throw new Error('register API: ' + res.status() + ' ' + (await res.text()));
  const { token } = await res.json();
  if (code) {
    const r2 = await page.request.post('/api/auth/activate', {
      data: { code },
      headers: { Authorization: 'Bearer ' + token },
    });
    if (r2.status() !== 200) throw new Error('activate API (' + code + '): ' + r2.status());
  }
  await page.addInitScript((t) => {
  localStorage.setItem('zt_user', t);
  localStorage.setItem('zt_onb', '1');
  sessionStorage.setItem('splashDone', '1'); // пропускаем бренд-сплэш: он прячет весь UI через visibility:hidden
}, token);
  await page.goto('/');
  await closeOverlay(page);
  return { digits: d, token };
}

test('baseline: гостевые экраны', async ({ page }) => {
  // пропускаем бренд-сплэш: он прячет UI через visibility:hidden — иначе гонка с page.goto
  await page.addInitScript(() => sessionStorage.setItem('splashDone', '1'));
  await page.goto('/');
  await closeOverlay(page);

  await expect(page.locator('#grid .card').first()).toBeVisible({ timeout: 10000 });
  await shot(page, '02-coffee-menu');

  await closeOverlay(page);
  await page.locator('#brandSeg [data-brand="delivery"]').click();
  await expect(page.locator('#deliveryGrid .card').first()).toBeVisible();
  await shot(page, '03-delivery-menu');

  await page.locator('#deliveryGrid .opts button').first().click().catch(() => {});
  await page.locator('#deliveryGrid [data-add]').first().click();
  await page.locator('#cartFab').click();
  await shot(page, '04-cart');
  await page.locator('#cartClose').click();
  await page.locator('#chatFab').click();
  await shot(page, '05-chat');
});

test('baseline: профиль и бонусы (зарегистрирован)', async ({ page }) => {
  await loginAs(page);
  await page.locator('#profileTopBtn').click();
  await expect(page.locator('#profileBox')).toBeVisible();
  await shot(page, '06-profile');
  await page.locator('.tabs [data-tab="bonus"]').click();
  await shot(page, '07-bonus');
});

test('baseline: стафф-режимы', async ({ page }) => {
  const { token } = await loginAs(page, { code: CASHIER });
  await page.locator('#modeSeg [data-mode="cashier"]').click();
  await expect(page.locator('#cashierView')).toBeVisible();
  await shot(page, '08-cashier');
  const r2 = await page.request.post('/api/auth/activate', {
    data: { code: ADMIN },
    headers: { Authorization: 'Bearer ' + token },
  });
  if (r2.status() !== 200) throw new Error('activate admin: ' + r2.status());
  await page.goto('/');
  await closeOverlay(page);
  await page.locator('#modeSeg [data-mode="admin"]').click();
  await shot(page, '09-admin-menu');
  await page.locator('#dashToggle').click();
  await shot(page, '10-dashboard');
});

test('baseline: оверлей поддержки', async ({ page }) => {
  await page.goto('/?src=tg&tab=chat&support=choose');
  await expect(page.locator('#supportChooseOverlay')).toBeVisible({ timeout: 6000 });
  await shot(page, '11-support-overlay');
});