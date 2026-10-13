/* eslint-disable playwright/no-conditional-expect */
/* eslint-disable playwright/no-conditional-in-test */
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

test.describe('Спринт 2 — Сетка опций пиццы, отступ корзины, sticky-рейл и чекаут', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('1. Опции пиццы в 2 колонки + подсветка .sel, отступ #deliveryGrid, sticky #deliveryRail и блокировка минимальной суммы', async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('splashDone', '1');
    });

    await page.goto('/?brand=delivery');

    const firstPizzaCard = page.locator('#deliveryGrid .card:has(.opts button)').first();
    await expect(firstPizzaCard).toBeVisible({ timeout: 10000 });

    // ── Задача 1: Сетка опций пиццы (.opts) и активное состояние .sel ──
    const optsGrid = firstPizzaCard.locator('.opts');
    const gridStyle = await optsGrid.evaluate((el) => window.getComputedStyle(el).display);
    expect(gridStyle).toBe('grid');

    const firstOpt = optsGrid.locator('button').first();
    await firstOpt.click();
    await expect(firstOpt).toHaveClass(/sel/);

    // Выбранная опция окрашена акцентным цветом кнопки (--flame #C03B2A), а текст белый (#FFFFFF)
    await expect(firstOpt).toHaveCSS('color', 'rgb(255, 255, 255)');
    await expect(firstOpt).toHaveCSS('background-color', 'rgb(192, 59, 42)');

    // ── Задача 2: Безопасный нижний отступ #deliveryGrid (>= 88px под плавающую корзину) ──
    const padBottom = await page.locator('#deliveryGrid').evaluate((el) => parseFloat(window.getComputedStyle(el).paddingBottom));
    expect(padBottom).toBeGreaterThanOrEqual(88);

    // ── Задача 3: Сайдбар категорий #deliveryRail имеет position: sticky ──
    const railPos = await page.locator('#deliveryRail').evaluate((el) => window.getComputedStyle(el).position);
    expect(railPos).toBe('sticky');

    // ── Задача 4: Контраст полей чекаута, прижатие шторки к bottom=viewport.height и скрытие #cartFab ──
    await firstPizzaCard.locator('.steprow .cta, [data-add]').first().click();
    await page.locator('#cartFab').click();
    const cartPanel = page.locator('#cartPanel');
    await expect(cartPanel).toHaveClass(/open/);

    // Жёсткая проверка геометрии: низ шторки корзины обязан лежать ровно на нижней границе экрана (844px), а не висеть у потолка!
    await expect.poll(async () => {
      const box = await cartPanel.boundingBox();
      return box ? Math.round(box.y + box.height) : 0;
    }, { timeout: 3000 }).toBe(page.viewportSize().height);

    // Верх шторки должен быть ниже верха экрана (оставляя ~10% шапки/оверлея сверху)
    const panelBox = await cartPanel.boundingBox();
    expect(panelBox.y).toBeGreaterThan(40);

    // Плавающая пилюля #cartFab и #chatFab под открытой шторкой обязаны быть скрыты (display: none)
    await expect(page.locator('#cartFab')).toBeHidden();
    await expect(page.locator('#chatFab')).toBeHidden();

    // Устанавливаем порог минимального заказа выше текущей корзины (например, 3000 ₽)
    await page.evaluate(() => {
      window.MIN_DELIVERY_ORDER = 3000;
      if (typeof window.paintTotals === 'function') window.paintTotals();
    });

    const checkoutBtn = page.locator('#checkoutBtn');
    await expect(checkoutBtn).toBeDisabled();
    await expect(checkoutBtn).toContainText('Мин. сумма доставки');

    // Снимаем повышенный порог — кнопка снова активна
    await page.evaluate(() => {
      window.MIN_DELIVERY_ORDER = 0;
      if (typeof window.paintTotals === 'function') window.paintTotals();
    });
    await expect(checkoutBtn).toBeEnabled();
  });
});

test.describe('Спринт 3 — TgUx (BackButton & Haptics), Зоны/Слоты и Live Tracking заказа', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('1. Нативный BackButton и Haptics (medium/light/success), зоны Янтарный/Синявино, слоты и Live Tracking с поллингом', async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('splashDone', '1');
      window.__backBtnVisible = false;
      window.__backClickCallbacks = [];

      window.Telegram = {
        WebApp: {
          initData: 'query_id=AAHdF6IQAAAAAN0XohDhrOrc&user=%7B%22id%22%3A123456%2C%22first_name%22%3A%22Test%22%7D',
          initDataUnsafe: { query_id: 'AAHdF6IQAAAAAN0XohDhrOrc', user: { id: 123456, first_name: 'Test' } },
          platform: 'ios',
          ready() {},
          expand() {},
          enableClosingConfirmation() {},
          disableVerticalSwipes() {},
          BackButton: {
            show() { window.__backBtnVisible = true; },
            hide() { window.__backBtnVisible = false; },
            onClick(fn) { window.__backClickCallbacks.push(fn); }
          },
          MainButton: { show() {}, hide() {}, setText() {}, setParams() {}, onClick() {}, showProgress() {}, hideProgress() {} },
          HapticFeedback: { impactOccurred() {}, notificationOccurred() {}, selectionChanged() {} }
        }
      };
    });

    let currentTrackStatus = 'new';
    await page.route('**/api/orders', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            order: {
              id: 'ord-777',
              no: 777,
              status: 'new',
              total: 935,
              slot: '18:00–19:00',
              items: [{ id: 1, name: 'Маргарита', opt: '35 см', price: 735, qty: 1 }]
            }
          })
        });
      } else {
        await route.continue();
      }
    });

    await page.route('**/api/orders/mine', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          orders: [
            {
              id: 'ord-777',
              no: 777,
              status: currentTrackStatus,
              total: 935,
              slot: '18:00–19:00',
              items: [{ id: 1, name: 'Маргарита', opt: '35 см', price: 735, qty: 1 }]
            }
          ]
        })
      });
    });

    await page.goto('/?brand=delivery&src=tg');

    // Авторизуем гостя для проверки автоподстановки me.name и me.phone
    await page.evaluate(() => {
      if (typeof window.setUser === 'function') {
        window.setUser('test-token', {
          id: 777,
          name: 'Мария',
          phone: '+7 999 123-45-67',
          stamps: 2,
          free: 0,
          cups: 2,
          qr: 'Z-777777',
          role: 'guest'
        });
      }
    });

    const firstCard = page.locator('#deliveryGrid .card:has(.opts button)').first();
    await expect(firstCard).toBeVisible({ timeout: 10000 });

    // ── Задача 1: Haptics на выбор опции, первичное добавление (medium) и степпер (light) ──
    await firstCard.locator('.opts button', { hasText: '35 см' }).first().click();
    await firstCard.locator('.steprow .cta, [data-add]').first().click();
    await firstCard.locator('.steprow [data-step="1"], .steprow .step').last().click();

    const hapticsAfterAdd = await page.evaluate(() => (window.__tgEvents && window.__tgEvents.hapticCalls) || []);
    expect(hapticsAfterAdd).toContain('medium');
    expect(hapticsAfterAdd).toContain('light');

    // Открываем корзину и проверяем, что BackButton показался (синхронизирован с оверлеем)
    await page.locator('#cartFab').click();
    await expect(page.locator('#cartPanel')).toHaveClass(/open/);
    await expect(page.locator('html')).toHaveClass(/tg-native-back/);
    expect(await page.evaluate(() => window.__backBtnVisible)).toBe(true);

    // Нажимаем нативную кнопку «Назад» Telegram -> шторка корзины закрывается, BackButton прячется
    await page.evaluate(() => {
      if (window.__backClickCallbacks && window.__backClickCallbacks.length) {
        window.__backClickCallbacks.forEach((fn) => fn());
      } else if (window.TgUx && typeof window.TgUx.closeTop === 'function') {
        window.TgUx.closeTop();
      }
    });
    await expect(page.locator('#cartPanel')).not.toHaveClass(/open/);
    await expect(page.locator('html')).not.toHaveClass(/tg-native-back/);
    expect(await page.evaluate(() => window.__backBtnVisible)).toBe(false);

    // Снова открываем корзину для проверки Задачи 2 (Зоны, слоты, автоподстановка гостя)
    await page.locator('#cartFab').click();
    await expect(page.locator('#cartPanel')).toHaveClass(/open/);

    // ── Задача 2: Автоподстановка данных гостя, зоны Синявино/Янтарный и выбор времени ──
    await expect(page.locator('#checkoutGuestName')).toHaveText('Мария');
    await expect(page.locator('#checkoutGuestPhone')).toContainText('+7 999 123-45-67');

    // Переключаем зону на Синявино (тариф 250 ₽)
    const placeSelect = page.locator('#checkoutPlace');
    await placeSelect.selectOption('Синявино');
    await expect(page.locator('#zoneFeeHint')).toContainText('Синявино');
    await expect(page.locator('#zoneFeeHint')).toContainText('250 ₽');

    // Возвращаем Янтарный (при сумме >= 1500 ₽ доставка бесплатная, иначе 200 ₽)
    await placeSelect.selectOption('Янтарный');
    await expect(page.locator('#zoneFeeHint')).toContainText('Янтарный');

    // Переключатель времени: выбираем «⏰ Ко времени»
    const timeSegSlot = page.locator('#checkoutTimeModeSeg [data-tmode="slot"]');
    await timeSegSlot.click();
    await expect(page.locator('#checkoutSlot')).toBeVisible();

    // Заполняем улицу и дом из справочника Янтарного
    await page.locator('#checkoutStreet').fill('Советская');
    await page.locator('#checkoutHouse').fill('70');

    // ── Задача 3: Отправка заказа (в TMA #checkoutBtn скрыт под нативной MainButton, кликаем программно как MainButton) ──
    await page.locator('#checkoutBtn').dispatchEvent('click');

    const trackModal = page.locator('#orderTrackModal');
    await expect(trackModal).toBeVisible();
    await expect(trackModal).toHaveClass(/show/);
    await expect(trackModal.locator('.ot-title')).toContainText('#777');

    // Проверяем, что сработал notificationOccurred('success')
    const hapticsAfterOrder = await page.evaluate(() => (window.__tgEvents && window.__tgEvents.hapticCalls) || []);
    expect(hapticsAfterOrder).toContain('success');

    // Проверяем смену статуса на прогресс-баре («Курьер в пути» -> индекс 2)
    currentTrackStatus = 'way';
    await page.evaluate(async () => {
      const r = await window.api('/orders/mine');
      if (r && r.orders && r.orders[0] && typeof window.openOrderTrackModal === 'function') {
        window.openOrderTrackModal(r.orders[0]);
      }
    });
    await expect(trackModal.locator('.ot-progress')).toHaveAttribute('data-step-idx', '2');

    // Проверяем кнопку «🔁 Повторить заказ» в 1 клик
    await trackModal.locator('[data-ot-repeat]').click();
    await expect(trackModal).not.toHaveClass(/show/);
    await expect(page.locator('#cartPanel')).toHaveClass(/open/);
    await expect(page.locator('#cartItems .cartItem').first()).toContainText('Маргарита');
  });
});