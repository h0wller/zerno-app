import { test, expect } from '@playwright/test';

test.describe('Спринт 1 — Задачи 2, 3, 4: Аватар, Степпер карточек, Сабфильтры', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('Контраст и буква аватара, геометрия степпера 40x40 и чипсы сабфильтров', async ({ page }) => {
    // Мокаем /api/orders/mine, чтобы тестовый токен не вызывал 401 и сброс setUser(null, null)
    await page.route('**/api/orders/mine', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ orders: [] }) })
    );

    // Открываем сразу доставку «Пятница»
    await page.goto('/?brand=delivery');

    // ── Проверка Задачи 2: Буква аватара и контраст цвета текста с фоном ──
    await page.evaluate(() => {
      if (typeof window.setUser === 'function') {
        window.setUser('test-token', {
          id: 777,
          name: 'Алексей',
          phone: '+79990001122',
          stamps: 3,
          free: 0,
          cups: 3,
          qr: 'Z-777777',
          role: 'guest'
        });
      }
      if (typeof window.renderProfile === 'function') window.renderProfile();
    });

    const topBtn = page.locator('#profileTopBtn');
    await expect(topBtn).toHaveText('А');

    const avaStyles = await topBtn.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return { color: cs.color, bg: cs.backgroundColor, bgImg: cs.backgroundImage };
    });
    // Цвет текста не должен совпадать с цветом фона
    expect(avaStyles.color).not.toBe(avaStyles.bg);

    // ── Проверка Задачи 4: Сабфильтры не сплющены, высота чипса 34px ──
    const subchip = page.locator('.subchip').first();
    if ((await subchip.count()) > 0) {
      await expect(subchip).toBeVisible();
      const chipBox = await subchip.boundingBox();
      expect(Math.round(chipBox.height)).toBe(34);
    }

    // ── Проверка Задачи 3: Степпер +/− скрыт при qty=0 и 40x40px при qty>0 ──
    const firstCard = page.locator('#deliveryGrid .card:not(.skeleton-card)').first();
    await expect(firstCard).toBeVisible({ timeout: 10000 });

    // Если у карточки есть выбор размера (пицца), кликаем первый размер
    const optBtn = firstCard.locator('.opts button').first();
    if ((await optBtn.count()) > 0) {
      await optBtn.click();
    }

    const ctaBtn = firstCard.locator('.steprow .cta, [data-add]').first();
    await ctaBtn.click();

    const stepPlus = firstCard.locator('.steprow .step, .steprow [data-step]').last();
    await expect(stepPlus).toBeVisible();

    const stepBox = await stepPlus.boundingBox();
    expect(Math.round(stepBox.width)).toBe(40);
    expect(Math.round(stepBox.height)).toBe(40);
  });
});

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

test('Задачи 5 и 6: Модалка «Мои заказы» в TMA и полноэкранный QR с Wake Lock', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  await page.addInitScript(() => {
    window.__wakeLockRequested = false;

    Object.defineProperty(navigator, 'wakeLock', {
      value: {
        request: async (type) => {
          if (type === 'screen') window.__wakeLockRequested = true;
          return {
            released: false,
            release: async function () { this.released = true; },
            addEventListener() {}
          };
        }
      },
      configurable: true
    });

    window.Telegram = {
      WebApp: {
        initData: 'query_id=AAHdF6IQAAAAAN0XohDhrOrc&user=%7B%22id%22%3A123456%2C%22first_name%22%3A%22Test%22%7D',
        initDataUnsafe: { query_id: 'AAHdF6IQAAAAAN0XohDhrOrc', user: { id: 123456, first_name: 'Test' } },
        platform: 'ios',
        ready() {},
        expand() {},
        enableClosingConfirmation() {},
        disableVerticalSwipes() {},
        BackButton: { show() {}, hide() {}, onClick() {} },
        MainButton: { show() {}, hide() {}, setText() {}, setParams() {}, onClick() {} },
        HapticFeedback: { impactOccurred() {}, notificationOccurred() {}, selectionChanged() {} }
      }
    };
  });

  await page.route('**/api/orders/mine', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        orders: [
          { id: 'ord-1', no: 105, status: 'cook', total: 890, created_at: new Date().toISOString(), items: [{ name: 'Пепперони', qty: 1, price: 890 }] }
        ]
      })
    })
  );

  await page.goto('/?brand=delivery&src=tg');

  // Авторизуем тестового гостя
  await page.evaluate(() => {
    if (typeof window.setUser === 'function') {
      window.setUser('test-token', {
        id: 777,
        name: 'Алексей',
        phone: '+79990001122',
        stamps: 5,
        free: 1,
        cups: 15,
        qr: 'Z-777777',
        role: 'guest'
      });
    }
    if (typeof window.renderAll === 'function') window.renderAll();
  });

  // Открываем профиль по клику на аватар в шапке
  await page.locator('#profileTopBtn').click();
  await expect(page.locator('#panel')).toHaveClass(/open/);

  // ── Проверка Задачи 5: Клик по «📦 Мои заказы» открывает #ordersModal поверх профиля в TMA ──
  const myOrdersBtn = page.locator('#myOrdersBtn');
  await expect(myOrdersBtn).toBeVisible();
  await myOrdersBtn.click();

  const ordersModal = page.locator('#ordersModal');
  await expect(ordersModal).toBeVisible();
  await expect(ordersModal).toHaveClass(/show/);

// Закрываем модалку заказов
  await ordersModal.locator('.omClose').click();
  await expect(ordersModal).toBeHidden();

  // Переключаем бренд на Кофейню, где в профиле отображается QR-код гостя
  await page.evaluate(() => {
    window.brand = 'coffee';
    if (typeof window.syncBrandViews === 'function') window.syncBrandViews();
    if (typeof window.renderProfile === 'function') window.renderProfile();
  });

  // ── Проверка Задачи 6: Полноэкранный QR (100vw x 100dvh, #FFFFFF) и Screen Wake Lock ──
  await page.locator('#qrOpenProfile, #qrMain').first().click();

  const qrModal = page.locator('#qrModal');
  await expect(qrModal).toBeVisible();
  await expect(qrModal).toHaveClass(/show/);

  const qrBox = await qrModal.locator('.qrcard').boundingBox();
  const viewport = page.viewportSize();
  expect(Math.round(qrBox.width)).toBe(viewport.width);
  expect(Math.round(qrBox.height)).toBe(viewport.height);

  const qrBg = await qrModal.evaluate((el) => window.getComputedStyle(el).backgroundColor);
  expect(qrBg).toBe('rgb(255, 255, 255)');

  const wakeLockActive = await page.evaluate(() => window.__wakeLockRequested);
  expect(wakeLockActive).toBe(true);
});