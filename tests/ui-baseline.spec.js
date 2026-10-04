import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.join('artifacts', 'ui-baseline');
const ADMIN = process.env.UI_ADMIN_CODE || '3364';
const CASHIER = process.env.UI_CASHIER_CODE || '2468';

/* SW кеширует /api/* и ломает авторизацию между тестами — блокируем целиком */
test.use({ serviceWorkers: 'block' });

test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('zt_onb', '1');        // не открывать authModal в boot()
    sessionStorage.setItem('splashDone', '1');  // пропустить бренд-сплэш
  });
});

const shot = (page, name) => page.screenshot({ path: path.join(OUT, name + '.png') });

async function closeOverlay(page) {
  await page.evaluate(() => {
    const ov = document.getElementById('overlay');
    if (ov) { ov.classList.remove('show', 'ov-high'); ov.style.pointerEvents = 'none'; }
  });
}

/** Префлайт-диагностика: жив ли шаблон inline-ядра (grid/panel создаются бутом). */
async function assertBootTemplate(page) {
  const diag = await page.evaluate(() => ({
    grid: !!document.getElementById('grid'),
    panel: !!document.getElementById('panel'),
    modeSeg: !!document.getElementById('modeSeg'),
  }));
  if (!diag.grid || !diag.panel) {
    throw new Error(
      'Бут не создал DOM (#grid/#panel отсутствуют): побита шаблонная строка inline-ядра в index.html. ' +
      'Выполни: git checkout -- public/index.html  |  diag=' + JSON.stringify(diag),
    );
  }
}

/** Вход без UI: register (retry при 409) → activate → токен в localStorage ДО загрузки. */
async function loginAs(page, { code } = {}) {
  const expectedRole = code ? (code === ADMIN ? 'admin' : 'cashier') : 'guest';
  let token = null;
  let digits = '';

  for (let attempt = 0; attempt < 5 && !token; attempt++) {
    // Уникальный номер: 7 цифр времени + 2 случайные → не коллидирует в параллельных воркерах
    digits = '9' + String(Date.now()).slice(-7) + String(Math.floor(Math.random() * 100)).padStart(2, '0');
    const res = await page.request.post('/api/auth/register', {
      data: { name: 'Baseline ' + digits.slice(-4), phone: '+7' + digits, pin: (process.env.ZERNO_STAFF_CODE || '1234') /* TEST-FIX v2 */, consent: 1 },
    });
    if (res.ok()) { token = (await res.json()).token; break; }
    if (res.status() === 409) { await page.waitForTimeout(30 + attempt * 40); continue; }
    throw new Error('register: ' + res.status() + ' ' + (await res.text()));
  }
  if (!token) throw new Error('register: 409-коллизия после 5 попыток');

  if (code) {
    const r2 = await page.request.post('/api/auth/activate', {
      data: { code },
      headers: { Authorization: 'Bearer ' + token },
    });
    if (!r2.ok()) throw new Error('activate(' + code + '): ' + r2.status() + ' ' + (await r2.text()));
    const r2Data = await r2.json().catch(() => ({}));
    if (r2Data.token) token = r2Data.token;
  }

  await page.addInitScript((t) => {
    localStorage.setItem('zt_user', t);
    window.USER_TOKEN = t;
    localStorage.setItem('zt_onb', '1');
    sessionStorage.setItem('splashDone', '1');
  }, token);

  const mePromise = page.waitForResponse('**/api/me', { timeout: 15000 }).catch(() => null);
  await page.goto('/');
  const meResponse = await mePromise;
  if (meResponse && !meResponse.ok()) throw new Error('Auth failed: /api/me → ' + meResponse.status());

  await page.waitForFunction((role) => window.me && window.me.id && window.me.role === role,
    expectedRole, { timeout: 15000 });
  await closeOverlay(page);
  return { digits, token };
}

/** Ждем, пока sv()/renderProfile() снимут hidden с #modeSeg; иначе — диагноз. */
async function waitModeSeg(page) {
  const ok = await page.waitForFunction(
    () => { const m = document.getElementById('modeSeg'); return m && !m.hidden; },
    null, { timeout: 8000 },
  ).then(() => true).catch(() => false);
  if (!ok) {
    const diag = await page.evaluate(() => ({
      role: window.me && window.me.role,
      hidden: document.getElementById('modeSeg')?.hidden,
    }));
    throw new Error('#modeSeg скрыт после входа: ' + JSON.stringify(diag) +
      ' — проверь ms.hidden в sv() и крюк syncBrandViews() в renderProfile()');
  }
}

const modeBtn = (page, mode, text) =>
  page.locator(`#modeSeg [data-mode="${mode}"], #modeSeg button:has-text("${text}")`).first();

test('baseline: гостевые экраны', async ({ page }) => {
  // Генерируем гостевой токен, так как бэкенд требует 401 без него
  const d = '9' + String(Date.now()).slice(-9);
  const res = await page.request.post('/api/auth/register', {
    data: { name: 'Guest ' + d.slice(-4), phone: '+7' + d, pin: (process.env.ZERNO_STAFF_CODE || '1234') /* TEST-FIX v2 */, consent: 1 },
  });
  if (res.ok()) {
    const { token } = await res.json();
    await page.addInitScript((t) => {
      window.USER_TOKEN = t;
      localStorage.setItem('zt_user', t);
    }, token);
  }

 // tests/ui-baseline.spec.js (строка 121)
const menuPromise = page.waitForResponse(r => /\/api\/menu(\/all)?/.test(r.url()));
await page.goto('/');
const menuResponse = await menuPromise;
  
  if (!menuResponse.ok()) {
    console.warn(`⚠️ Menu API вернул статус: ${menuResponse.status()}`);
  }
  
await expect(page.locator('#grid .card:not(.skeleton-card), #grid .menu-card, #grid article').first()).toBeVisible({ timeout: 15000 });
  await shot(page, '01-coffee-menu');
  
  await page.locator('#venueToggle').click();
  await page.locator('#brandSeg [data-brand="delivery"]').click();
  await expect(page.locator('#deliveryGrid .card:not(.skeleton-card), #deliveryGrid .menu-card, #deliveryGrid article').first()).toBeVisible({ timeout: 15000 });
  await shot(page, '02-delivery-menu');
});

test('baseline: профиль и бонусы (зарегистрирован)', async ({ page }) => {
  await loginAs(page);
  await assertBootTemplate(page);

  await page.locator('#profileTopBtn').click();
  const panel = page.locator('#panel');
  await expect(panel).toBeVisible({ timeout: 8000 });

  await panel.locator('.tabs button[data-tab="profile"]').click();
  await expect(page.locator('#profileBox')).toBeVisible({ timeout: 10000 });
  await shot(page, '03-profile');

  await panel.locator('.tabs button[data-tab="bonus"]').click();
  await expect(page.locator('#bonusBox')).toBeVisible({ timeout: 10000 });
  await shot(page, '04-bonus');
});

test('baseline: кассир', async ({ page }) => {
  await loginAs(page, { code: CASHIER });
  await waitModeSeg(page);

  await modeBtn(page, 'cashier', 'Кассир').click();
  await expect(page.locator('#cashierView')).toBeVisible({ timeout: 10000 });
  await shot(page, '05-cashier');

  await modeBtn(page, 'orders', 'Заказы').click();
  await expect(page.locator('#ordersView')).toBeVisible({ timeout: 10000 });
  await shot(page, '06-orders');
});

test('baseline: стафф-режим прячет delivery-меню сразу (бренд Пятница)', async ({ page }) => {
  // бренд Пятница — через localStorage, URL-параметр state.js не читает
  await page.addInitScript(() => {
    localStorage.setItem('zt_brand', 'delivery');
  });
  await page.goto('/', { waitUntil: 'networkidle' });
  await loginAs(page, { code: CASHIER });
  await waitModeSeg(page);

  await modeBtn(page, 'cashier', 'Кассир').click();
  await expect(page.locator('#deliveryView')).toBeHidden({ timeout: 2000 });
  await expect(page.locator('#menuView')).toBeHidden({ timeout: 2000 });
  await expect(page.locator('#rail')).toBeHidden({ timeout: 2000 });

  await modeBtn(page, 'orders', 'Заказы').click();
  await expect(page.locator('#deliveryView')).toBeHidden({ timeout: 2000 });
  await expect(page.locator('#menuView')).toBeHidden({ timeout: 2000 });
  await shot(page, '15-delivery-cashier-clean');
});

test('baseline: админ', async ({ page }) => {
  await loginAs(page, { code: ADMIN });
  await waitModeSeg(page);

  await modeBtn(page, 'admin', 'Админ').click();
  await expect(page.locator('#adminBar')).toBeVisible({ timeout: 10000 });
  await shot(page, '07-admin');
});

test('baseline: оверлей поддержки', async ({ page }) => {
  await page.goto('/?src=tg&tab=chat&support=choose');
  await expect(page.locator('#supportChooseOverlay')).toBeVisible({ timeout: 6000 });
  await shot(page, '08-support-overlay');
});
test('baseline: кассир — pending-кнопки «Активировать» на месте', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await loginAs(page, { code: CASHIER });
  await waitModeSeg(page);
  /* сид неактивированного гостя: verified=0 + actcode → строка в /staff/pending */
  const phone = '+7 9' + String(Date.now()).slice(-7) + Math.floor(10 + Math.random() * 89);
  await page.request.post('/api/auth/register', { data: { name: 'Pending Guest', phone } });
  await modeBtn(page, 'cashier', 'Кассир').click();
  await expect(page.locator('#pendingBox button', { hasText: 'Активировать' }).first())
    .toBeVisible({ timeout: 8000 });
  expect(errs).toEqual([]);
});

test('baseline: админ — редактор открывается и сохраняет без «is not defined»', async ({ page }) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await loginAs(page, { code: ADMIN });
  await waitModeSeg(page);
  await modeBtn(page, 'admin', 'Админ').click();
  await expect(page.locator('#editToggle')).toBeVisible({ timeout: 8000 });
  await page.locator('#editToggle').click();
  await page.locator('#grid .card [data-ed]').first().click({ timeout: 8000 });
  await expect(page.locator('#emModal')).toBeVisible({ timeout: 8000 });
  const save = page.locator('#emSave');
  if (await save.count()) await save.click();
  else await page.locator('#emModal button', { hasText: 'Сохранить' }).click();
  await expect.poll(async () => page.evaluate(() => !document.getElementById('emModal').classList.contains('show')), { timeout: 8000 }).toBe(true); /* opacity:0 ≠ hidden для Playwright */
  await expect(page.locator('.toast', { hasText: 'not defined' })).toHaveCount(0);
  expect(errs).toEqual([]);
});
test('baseline: геометрия марки соответствует манифесту', async ({ page }) => {
  // Кофейня
  await page.evaluate(() => { window.brand = 'coffee'; window.sv(); });
  await page.waitForTimeout(100);
  let box = await page.locator('#brandMark img, #brandMark svg').first().boundingBox();
  expect(box).not.toBeNull();
  expect(box.width).toBeGreaterThanOrEqual(38);
  expect(box.width).toBeLessThanOrEqual(46);
  expect(box.height).toBeGreaterThanOrEqual(38);
  
  // Пятница (Mobile Chrome эмуляция, реальный кейс Ф5.39)
  await page.evaluate(() => { window.brand = 'delivery'; window.sv(); });
  await page.waitForTimeout(100);
  box = await page.locator('#brandMark img, #brandMark svg').first().boundingBox();
  expect(box).not.toBeNull();
  expect(box.width).toBeGreaterThanOrEqual(140);
  expect(box.height).toBeGreaterThanOrEqual(32);
  expect(box.height).toBeLessThanOrEqual(44);
});