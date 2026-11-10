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

    // ── Mobile subfilters: compact 32px height with natural width preserved ──
    const subchip = page.locator('.subchip').first();
    if ((await subchip.count()) > 0) {
      await expect(subchip).toBeVisible();
      const chipBox = await subchip.boundingBox();
      expect(Math.round(chipBox.height)).toBe(40);
      expect(chipBox.width).toBeGreaterThanOrEqual(58);
    }

    // ── Проверка Задачи 3: Степпер +/− скрыт при qty=0 и 40x40px при qty>0 ──
    const firstCard = page.locator('#deliveryGrid .card:not(.skeleton-card)').first();
    await expect(firstCard).toBeVisible({ timeout: 10000 });

    // Если у карточки есть выбор размера (пицца), кликаем первый размер
    const optBtn = firstCard.locator('.opts label.opt-btn').first();
    if ((await optBtn.count()) > 0) {
      await optBtn.click();
    }

    const ctaBtn = firstCard.locator('.steprow .cta, [data-add]').first();
    await ctaBtn.click();

    const stepPlus = firstCard.locator('.steprow .step, .steprow [data-step]').last();
    await expect(stepPlus).toBeVisible();

    const stepBox = await stepPlus.boundingBox();
    expect(Math.round(stepBox.width)).toBe(44);
    expect(Math.round(stepBox.height)).toBe(44);
  });
});

const num = (s) => parseInt(String(s).replace(/[^0-9]/g, ''), 10) || 0;

test('delivery schedule and promo ticker hydrate before the cart is opened', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    localStorage.setItem('zt_inst_hide', '1');
    sessionStorage.setItem('splashDone', '1');
  });

  const info = {
    today: { open: 11, close: 22 },
    days: [],
    zones: [],
    weekPromo: { text: 'Тестовая акция недели' },
    pizzaMonth: { name: 'Тестовая пицца' }
  };
  await page.route('**/api/delivery/info', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(info)
  }));

  const scheduleResponse = page.waitForResponse((response) =>
    new URL(response.url()).pathname === '/api/delivery/info'
  , { timeout: 10000 });
  await page.goto('/?brand=delivery');
  const response = await scheduleResponse;
  expect(response.ok()).toBeTruthy();

  await expect.poll(() => page.evaluate(() => !!window.deliveryInfo)).toBe(true);
  await expect(page.locator('#tickerTrack')).toContainText(info.weekPromo.text);
  await expect(page.locator('#tickerTrack')).toContainText(info.pizzaMonth.name);
  await expect(page.locator('#cartPanel')).not.toHaveClass(/open/);
});

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
  await card.locator('.opts label.opt-btn', { hasText: '35 см' }).first().click({ timeout: 10000 });
  await card.locator('button', { hasText: 'Добавить' }).first().click();
  await page.locator('#cartFab').click();
  await expect(page.locator('#cartClose')).toBeVisible();
  await expect(page.locator('#cartClose')).toHaveAccessibleName('Продолжить покупки');

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
  await expect(page.locator('#cartClose')).toBeVisible();
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

// Закрываем модалку заказов и удаляем тестовую сессию перед сменой бренда.
  await ordersModal.locator('.omClose').click();
  await expect(ordersModal).toBeHidden();
  await page.evaluate(() => {
    localStorage.removeItem('zt_user');
    sessionStorage.removeItem('zt_user');
  });

  // Открываем отдельный coffee document вместо мутации brand внутри активного TMA delivery panel.
  await page.goto('/?brand=coffee');
  await expect.poll(() => page.evaluate(() => document.documentElement.getAttribute('data-brand'))).toBe('coffee');
  await page.waitForFunction(() => typeof window.openPanel === 'function' && typeof window.setUser === 'function');
  await page.evaluate(() => {
    window.setUser('qr-regression-coffee-token', {
      id: 777777, name: 'QR regression guest', phone: '+79990001122',
      stamps: 5, free: 1, cups: 15, qr: 'Z-777777', role: 'guest', verified: 1
    });
    window.__profileMeReady();
    window.renderAll();
    window.openPanel('profile');
  });
  await expect(page.locator('#panel')).toHaveClass(/open/);
  await expect(page.locator('#tabBonus, #tabProfile, #pvBonus')).toHaveCount(0);
  await expect(page.locator('#pvProfile')).toBeVisible();

  // ── Проверка Задачи 6: единственный QR action в профиле и Screen Wake Lock ──
  const bonusQrButton = page.locator('#qrOpenProfile');
  await expect(bonusQrButton).toBeVisible();
  await expect(page.locator('#qrOpenProfile')).toHaveCount(1);
  await bonusQrButton.click();

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

test.describe('Спринт 2 — Сетка опций пиццы, отступ корзины, rail доставки и чекаут', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('1. Опции пиццы в 2 колонки + подсветка .sel, отступ #deliveryGrid, rail рядом с карточками и чекаут от одной позиции', async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('splashDone', '1');
    });

    await page.goto('/?brand=delivery');

    const firstPizzaCard = page.locator('#deliveryGrid .card:has(.opts input[type="radio"])').first();
    await expect(firstPizzaCard).toBeVisible({ timeout: 10000 });

    // ── Задача 1: Сетка опций пиццы (.opts) и checked-state radio ──
    const optsGrid = firstPizzaCard.locator('.opts');
    const gridStyle = await optsGrid.evaluate((el) => window.getComputedStyle(el).display);
    expect(gridStyle).toBe('grid');

    const firstOpt = optsGrid.locator('label.opt-btn').first();
    const firstRadio = firstOpt.locator('input[type="radio"]');
    await firstOpt.click();
    await expect(firstRadio).toBeChecked();

    // Выбранная опция окрашена акцентным цветом кнопки (--flame #C03B2A), а текст белый (#FFFFFF)
    await expect(firstOpt).toHaveCSS('color', 'rgb(255, 255, 255)');
    await expect(firstOpt).toHaveCSS('background-color', 'rgb(192, 59, 42)');

    // ── Задача 2: Безопасный нижний отступ #deliveryGrid (>= 88px под плавающую корзину) ──
    const padBottom = await page.locator('#deliveryGrid').evaluate((el) => parseFloat(window.getComputedStyle(el).paddingBottom));
    expect(padBottom).toBeGreaterThanOrEqual(88);

    // ── Задача 3: delivery rail starts aligned to the first product-card row ──
    const railGeometry = await page.evaluate(() => {
      const rail = document.querySelector('#deliveryRail').getBoundingClientRect();
      const grid = document.querySelector('#deliveryGrid').getBoundingClientRect();
      return {
        position: getComputedStyle(document.querySelector('#deliveryRail')).position,
        topDelta: Math.abs(rail.top - grid.top),
      };
    });
    expect(railGeometry.position).toBe('relative');
    expect(railGeometry.topDelta).toBeLessThanOrEqual(2);

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

    // Минимальной суммы заказа нет: одной позиции достаточно для перехода к оформлению.
    const checkoutBtn = page.locator('#checkoutBtn');
    await expect(page.locator('#cartItems .cartItem')).toHaveCount(1);
    await expect(checkoutBtn).toBeEnabled();
    await expect(checkoutBtn).toHaveText('Оформить заказ');

    // Степпер корзины использует тёплый токен бренда «Пятница», а не холодный цвет кофейни.
    await expect(page.locator('#cartItems .qty button').first()).toHaveCSS(
      'background-color',
      'rgb(201, 158, 110)'
    );
  });
});

  test('1. Нативный BackButton и Haptics (medium/light/success), зоны Янтарный/Синявино, слоты и Live Tracking с поллингом', async ({ page }) => {
    // ── РЕАЛЬНАЯ регистрация гостя через API (по образцу ui-baseline.spec.js::loginAs) ──
    // Раньше был фейковый 'test-token' → live.js::refreshProfileLive раз в 5с дёргал
    // GET /api/me → 401 → api() вызывал setUser(null, null) → checkoutBtn.onclick выходил
    // рано на `if (!me) return` → #orderTrackModal не создавался (флейк, подтверждён трейсом).
    // 10 цифр после +7 (ph10 требует ≥10, иначе 400 «Введите номер полностью»).
    // Паттерн идентичен ui-baseline.spec.js::loginAs и Sprint 5 этого файла.
    const digits = String(Math.floor(100000000 + Math.random() * 899999999));
    const regPhone = '+79' + digits;
    let reg = await page.request.post('/api/auth/register', {
      data: { name: 'Мария', phone: regPhone, pin: '1234', consent: 1 },
    });
    if (reg.status() === 409) {
      reg = await page.request.post('/api/auth/login', {
        data: { phone: regPhone, pin: '1234' },
      });
    }
    if (!reg.ok()) throw new Error('register: ' + reg.status() + ' ' + (await reg.text()));
    const { token, customer } = await reg.json();

    await page.addInitScript((t) => {
      window.USER_TOKEN = t;
      localStorage.setItem('zt_user', t);
      localStorage.setItem('zt_onb', '1');
      sessionStorage.setItem('splashDone', '1');
    }, token);

    // Telegram stub
    await page.addInitScript(() => {
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
          MainButton: { show() {}, hide() {}, setText() {}, setParams() {}, onClick(fn) { window.__mainButtonClick = fn; }, showProgress() {}, hideProgress() {} },
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
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ orders: [] })
        });
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

    // Пустой ответ на фейковый tg-link (initData не пройдёт HMAC на сервере).
    // Иначе api() на 401 зовёт setUser(null, null) ДО того, как сработает настоящая авторизация.
    await page.route('**/api/auth/tg-link', (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ ok: true })
          })
        : route.continue()
    );

    await page.goto('/?brand=delivery&src=tg');

    // Ждём, пока boot() подтвердит реальную роль через /api/me (200 для настоящего токена).
    await page.waitForFunction(
      () => window.me && window.me.id && window.me.name === 'Мария',
      null,
      { timeout: 15000 }
    );

    // Детерминируем часы работы: CI может запускаться после закрытия кухни.
    await page.evaluate(() => {
      window.getKaliningradTime = () => ({ hour: 12, minute: 30 });
    });

    const firstCard = page.locator('#deliveryGrid .card:has(.opts input[type="radio"])').first();
    await expect(firstCard).toBeVisible({ timeout: 10000 });

    // ── Задача 1: Haptics на выбор опции, первичное добавление (medium) и степпер (light) ──
    await firstCard.locator('.opts label.opt-btn', { hasText: '35 см' }).first().click();
    await firstCard.locator('.steprow .cta, [data-add]').first().click();
    await firstCard.locator('.steprow [data-step="1"], .steprow .step').last().click();

    const hapticsAfterAdd = await page.evaluate(() => (window.__tgEvents && window.__tgEvents.hapticCalls) || []);
    expect(hapticsAfterAdd).toContain('medium');
    expect(hapticsAfterAdd).toContain('light');

    // Открываем корзину и проверяем, что BackButton показался
    await page.locator('#cartFab').click();
    await expect(page.locator('#cartPanel')).toHaveClass(/open/);
    await expect(page.locator('html')).toHaveClass(/tg-native-back/);
    expect(await page.evaluate(() => window.__backBtnVisible)).toBe(true);

    // Нажимаем нативную кнопку «Назад» — шторка корзины закрывается, BackButton прячется
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

    await page.waitForFunction(() => window.deliveryInfo, null, { timeout: 10000 });

    // Снова открываем корзину для проверки Задачи 2
    await page.locator('#cartFab').click();
    await expect(page.locator('#cartPanel')).toHaveClass(/open/);

    // ── Задача 2: Автоподстановка данных гостя, зоны и выбор времени ──
    await expect(page.locator('#checkoutGuestName')).toHaveText('Мария');
    // Телефон динамический — берём у реально зарегистрированного гостя.
    // customer.phone имеет формат '+7 9XX XXX-XX-XX'; сверяем последние 5 знаков (уникальны).
    const last5 = String(customer.phone).slice(-5);
    await expect(page.locator('#checkoutGuestPhone')).toContainText(last5);

    const placeSelect = page.locator('#checkoutPlace');
    await placeSelect.selectOption('Синявино');
    await expect(page.locator('#zoneFeeHint')).toContainText('Синявино');
    await expect(page.locator('#zoneFeeHint')).toContainText('250 ₽');

    await placeSelect.selectOption('Янтарный');
    await expect(page.locator('#zoneFeeHint')).toContainText('Янтарный');

    const timeSegSlot = page.locator('#checkoutTimeModeSeg [data-tmode="slot"]');
    await timeSegSlot.click();
    await expect(page.locator('#checkoutSlot')).toBeVisible();

    // Проверяем режим «Ко времени», но оформляем заказ через ASAP:
    // доступные слоты зависят от актуального расписания на момент CI-запуска.
    await page.locator('#checkoutTimeModeSeg [data-tmode="asap"]').click();

    await page.locator('#checkoutStreet').fill('Советская');
    await page.locator('#checkoutHouse').fill('70');
    await expect(page.locator('#checkoutBtn')).toBeEnabled();

    // ── Задача 3: Повторное нажатие MainButton во время валидации не дублирует заказ ──
    // Gate the actual slot-validation function, not a delivery-info network request:
    // background refreshes can otherwise win the route race and make this test nondeterministic.
    await page.evaluate(() => {
      const validation = window.CheckoutValidation;
      const resolveSlot = validation.resolveSlot.bind(validation);
      window.__checkoutValidationStarted = false;
      window.__releaseCheckoutValidation = null;
      validation.resolveSlot = () => {
        window.__checkoutValidationStarted = true;
        return new Promise((resolve, reject) => {
          window.__releaseCheckoutValidation = () => {
            resolveSlot().then(resolve, reject);
          };
        });
      };
    });

    let checkoutPosts = 0;
    page.on('request', (request) => {
      if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/orders') {
        checkoutPosts += 1;
      }
    });

    await page.locator('#checkoutBtn').dispatchEvent('click');
    await page.waitForFunction(() => window.__checkoutValidationStarted);

    // During the pending slot validation, Telegram's native button calls checkoutBtn.click().
    await page.evaluate(() => window.__mainButtonClick());
    expect(checkoutPosts).toBe(0);
    await expect(page.locator('#checkoutBtn')).toBeDisabled();

    const orderResponsePromise = page.waitForResponse((response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === '/api/orders'
    );
    await page.evaluate(() => window.__releaseCheckoutValidation());
    const orderResponse = await orderResponsePromise;
    expect(orderResponse.ok()).toBeTruthy();
    await expect.poll(() => checkoutPosts).toBe(1);
    await expect(page.locator('#checkoutBtn')).toBeEnabled();
    expect(checkoutPosts).toBe(1);

    const trackModal = page.locator('#orderTrackModal');
    await expect(trackModal).toBeVisible();
    await expect(trackModal).toHaveClass(/show/);
    await expect(trackModal.locator('.ot-title')).toContainText('#777');

    const hapticsAfterOrder = await page.evaluate(() => (window.__tgEvents && window.__tgEvents.hapticCalls) || []);
    expect(hapticsAfterOrder).toContain('success');

    currentTrackStatus = 'way';
    await page.evaluate(async () => {
      const r = await window.api('/orders/mine');
      if (r && r.orders && r.orders[0] && typeof window.openOrderTrackModal === 'function') {
        window.openOrderTrackModal(r.orders[0]);
      }
    });
    await expect(trackModal.locator('.ot-progress')).toHaveAttribute('data-step-idx', '2');

    await trackModal.locator('[data-ot-repeat]').click();
    await expect(trackModal).not.toHaveClass(/show/);
    await expect(page.locator('#cartPanel')).toHaveClass(/open/);
    await expect(page.locator('#cartItems .cartItem').first()).toContainText('Маргарита');
  });

test.describe('Спринт 4 — Тикер, полноширинная шапка меню, рейл и стабильность шапки', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('1. Пустой тикер скрывает содержимое без схлопывания 34px, поиск не наезжает на #deliveryRail, шапка не прыгает и логотип строго по центру', async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('splashDone', '1');
    });

    await page.goto('/?brand=delivery');
    await expect(page.locator('#deliveryGrid .card:not(.skeleton-card)').first()).toBeVisible({ timeout: 10000 });

    // ── Тикер резервирует 34px под полноширинную строку без кнопки паузы ──
    const ticker = page.locator('#ticker, .ticker').first();
    const activeTicker = await ticker.evaluate((element) => ({
      height: element.getBoundingClientRect().height,
      overflowX: getComputedStyle(element).overflowX,
    }));
    expect(activeTicker.height).toBe(34);
    expect(activeTicker.overflowX).toBe('hidden');

    const emptyTicker = await page.evaluate(() => {
      window.BRANDS.delivery.ticker = [];
      window.deliveryInfo = null;
      window.applyBrandChrome(true);
      const track = document.getElementById('tickerTrack');
      const container = track.closest('.ticker');
      const style = getComputedStyle(container);
      return {
        empty: container.classList.contains('is-empty'),
        hiddenAttribute: container.hidden,
        visibility: style.visibility,
        height: container.getBoundingClientRect().height,
        itemCount: track.children.length,
      };
    });
    expect(emptyTicker.empty).toBe(true);
    expect(emptyTicker.hiddenAttribute).toBe(false);
    expect(emptyTicker.visibility).toBe('hidden');
    expect(emptyTicker.height).toBe(34);
    expect(emptyTicker.itemCount).toBe(0);

    // ── Задача 2: Поиск НЕ наезжает на левый сайдбар #deliveryRail + sticky-позиция при скролле ──
    const rail = page.locator('#deliveryRail');
    const search = page.locator('#deliveryView #dSearch').locator('xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " search ")]').first();
    await expect(rail).toBeVisible();
    await expect(search).toBeVisible();

    const railBox = await rail.boundingBox();
    const searchBox = await search.boundingBox();
    const menuHeadBox = await page.locator('#deliveryView .menu-head').boundingBox();
    const searchLayout = await page.locator('#deliveryView .mh-top').evaluate((element) => ({
      display: getComputedStyle(element).display,
      gridRows: getComputedStyle(element).gridTemplateRows,
      searchParentWidth: element.querySelector('.mh-right').getBoundingClientRect().width,
      searchParentLeft: element.querySelector('.mh-right').getBoundingClientRect().left,
    }));
    expect(searchLayout.display).toBe('grid');
    // Поиск находится в полноширинной шапке над рейлом: горизонтальное пересечение колонок допустимо,
    // но сами элементы не должны пересекаться по вертикали.
    expect(searchBox.x).toBeGreaterThanOrEqual(menuHeadBox.x);
    expect(searchBox.x + searchBox.width).toBeLessThanOrEqual(menuHeadBox.x + menuHeadBox.width);
    expect(searchBox.y + searchBox.height).toBeLessThanOrEqual(railBox.y + 1);

    // ── Задача 3: Стабильность высоты .topbar, центрирование логотипа и мгновенная смена иконки 🍕 / 🌊 ──
    const topbar = page.locator('.topbar');
    const brandEl = page.locator('.topbar .brand');
    const venueToggle = page.locator('#venueToggle');

    await expect(venueToggle).toContainText('🍕');
    const topbarBoxDelivery = await topbar.boundingBox();
    const brandBoxDelivery = await brandEl.boundingBox();

    // Центр логотипа в доставке строго по центру экрана (390 / 2 = 195px ± 6px)
    const brandCenterDelivery = brandBoxDelivery.x + brandBoxDelivery.width / 2;
    expect(Math.abs(brandCenterDelivery - 195)).toBeLessThanOrEqual(6);

    // Переключаем заведение через дропдаун на «Кофейня»
    await venueToggle.click();
    await page.locator('#brandSeg button[data-brand="coffee"]').click();

    // Иконка в дропдауне мгновенно стала 🌊
    await expect(venueToggle).toContainText('🌊');

    const topbarBoxCoffee = await topbar.boundingBox();
    const brandBoxCoffee = await brandEl.boundingBox();

    // Высота шапки НЕ скачет при переключении брендов!
    expect(Math.round(topbarBoxCoffee.height)).toBe(Math.round(topbarBoxDelivery.height));

    // Центр логотипа в кофейне также строго по центру экрана (195px ± 6px)
    const brandCenterCoffee = brandBoxCoffee.x + brandBoxCoffee.width / 2;
    expect(Math.abs(brandCenterCoffee - 195)).toBeLessThanOrEqual(6);
  });
});

test.describe('Спринт 5 — Сетка Админа/Заказов, умный чат Ника, цены Кофейни без 0 ₽ и чистый тикер', () => {
  test.use({ viewport: { width: 390, height: 844 } });

test('1. Чат Ника без ложного вызова сотрудника на «выпьем?», нет нулевых цен в кофейном меню, сетка Админа и Заказов', async ({ page }) => {  // ── РЕАЛЬНАЯ авторизация админа через API ──
  // Фейковый 'admin-token' → /api/menu/all отвечал 401 → api() звал setUser(null, null)
  // → me=null → следующий setMode('orders') резался гардом в views.js и #ordersView оставался hidden.
  const adminCode = process.env.ADMIN_CODE || '3364';
  const digits = '9' + String(Date.now()).slice(-9);
  const reg = await page.request.post('/api/auth/register', {
    data: { name: 'Regress Admin', phone: '+7' + digits, pin: '1234', consent: 1 },
  });
  if (!reg.ok()) throw new Error('register: ' + reg.status() + ' ' + (await reg.text()));
  const { token } = await reg.json();

  const act = await page.request.post('/api/auth/activate', {
    data: { code: adminCode },
    headers: { Authorization: 'Bearer ' + token },
  });
  if (!act.ok()) throw new Error('activate admin: ' + act.status() + ' ' + (await act.text()));

  await page.addInitScript((t) => {
    window.USER_TOKEN = t;
    localStorage.setItem('zt_user', t);
    localStorage.setItem('zt_onb', '1');
    sessionStorage.setItem('splashDone', '1');
  }, token);

  await page.goto('/?brand=delivery');
  // Ждём, пока boot() подтвердит роль admin через /api/me
  await page.waitForFunction(
    () => window.me && window.me.id && window.me.role === 'admin',
    null,
    { timeout: 15000 },
  );
  await expect(page.locator('#deliveryGrid .card:not(.skeleton-card)').first()).toBeVisible({ timeout: 10000 });

  // ── Задача 4: В #tickerTrack нет пустых <span> ──
  const emptySpans = page.locator('#tickerTrack span:empty');
  await expect(emptySpans).toHaveCount(0);

  // ── Задача 2: Чат «Ника» в Доставке здоровается от «Пятницы» и не взводит красную кнопку на «выпьем?» ──
  await page.locator('#chatFab').click();
  await expect(page.locator('#chatPanel')).toHaveClass(/open/);
  await expect(page.locator('#chatMsgs')).toContainText(/Пятница|доставк/i, { timeout: 5000 });

  await page.locator('#chatInput').fill('выпьем?');
  await page.locator('#chatInput').press('Enter');

  await expect(page.locator('#chatMsgs .msg.bot').last()).toContainText(/подсказать по зонам|Позвать сотрудника/i, { timeout: 5000 });
  const armedCount = page.locator('#chatHintsBar .chatHint.armed');
  await expect(armedCount).toHaveCount(0);

  await page.locator('#chatClose').click();

  // ── Задача 1: Режим Админа (роль уже настоящая, setUser-фейк не нужен) ──
  await page.evaluate(() => window.setMode('admin'));

  const adminBar = page.locator('#adminBar');
  await expect(adminBar).toBeVisible();
  for (const action of ['#promoToggle', '#dashToggle', '#chatsToggle2']) {
    await expect(page.locator(action)).toBeVisible();
  }
  await expect(page.locator('#deliveryView .menu-head .menu-controls-row')).toBeVisible();
  await expect(page.locator('#modeSeg')).toBeVisible();
  await expect(page.locator('#editToggle')).toBeVisible();

  const delViewBox = await page.locator('#deliveryView').boundingBox();
  expect(delViewBox.x).toBeLessThan(120);
  expect(delViewBox.x + delViewBox.width).toBeLessThanOrEqual(392);

  // ── В режиме «Заказы» (#ordersView) список заказов #ordersList находится ВЫШЕ блока «Активация гостей» (#pendingBoxD) ──
  await page.evaluate(() => window.setMode('orders'));
  const ordersViewEl = page.locator('#ordersView');
  await expect(ordersViewEl).toBeVisible({ timeout: 5000 });
  const ordersListBox = await page.locator('#ordersList').boundingBox();
  const pendingBoxD = await page.locator('#pendingBoxD').boundingBox();
  expect(ordersListBox).not.toBeNull();
  expect(pendingBoxD).not.toBeNull();
  expect(ordersListBox.y).toBeLessThan(pendingBoxD.y);

  // ── Задача 3: Переключаемся в Кофейню и проверяем, что у Капучино/Латте нет цены «0 ₽» ──
  await page.evaluate(() => window.setMode('guest'));
  await page.locator('#venueToggle').click();
  await page.locator('#brandSeg button[data-brand="coffee"]').click();
  await expect(page.locator('#grid .card').first()).toBeVisible({ timeout: 10000 });

  const zeroPrices = page.locator('#grid .card .price', { hasText: /^0\s*₽$/ });
  await expect(zeroPrices).toHaveCount(0);
});
});

test('cart keeps expanded modifiers attached to the same row after removing an earlier item', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    localStorage.setItem('zt_inst_hide', '1');
    sessionStorage.setItem('splashDone', '1');
  });

  await page.route('**/api/delivery/info', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ today: { open: 11, close: 22 }, days: [], zones: [] })
  }));

  await page.goto('/?brand=delivery');
  await page.waitForFunction(() => Array.isArray(window.DMENU) && window.DMENU.length > 0);
  await page.evaluate(() => {
    // Ensure the test has an active pizza topping even when the CI menu fixture has none.
    window.DMENU.push({
      id: 'playwright-cart-topping',
      name: 'Чеддер',
      cat: 'sauces',
      on: 1,
      price: 50,
    });
  });

  // Match the native radio labels introduced by PR #133.
  const cards = page.locator('#deliveryGrid .card:has(.opts)');
  await expect(cards.first()).toBeVisible({ timeout: 10000 });
  await expect(cards.nth(1)).toBeVisible({ timeout: 10000 });

  // Add two different cart rows, then open modifiers only on the second one.
  for (const card of [cards.nth(0), cards.nth(1)]) {
    const option = card.locator('.opts label.opt-btn, .opts button').first();
    await option.click();
    await card.locator('.steprow .cta, [data-add]').first().click();
  }

  await page.locator('#cartFab').click();
  await expect(page.locator('#cartItems .cartItem')).toHaveCount(2);
  const secondRow = page.locator('#cartItems .cartItem').nth(1);
  await secondRow.locator('[data-toggle-mods]').click();
  await expect(secondRow.locator('.ci-mod-chips-wrap')).toBeVisible();

  // Removing the first row shifts the expanded row from index 1 to index 0.
  await page.locator('#cartItems .cartItem').first().locator('[data-ci][data-act="-"]').click();
  const remainingRow = page.locator('#cartItems .cartItem').first();
  await expect(page.locator('#cartItems .cartItem')).toHaveCount(1);
  await expect(remainingRow.locator('.ci-mod-chips-wrap')).toBeVisible();
  await expect(remainingRow.locator('[data-toggle-mods]')).toContainText('Скрыть добавки');
});


test.describe('Cart add-on recommendations: actual 44px touch targets', () => {
  for (const viewport of [
    { name: 'iPhone SE', width: 375, height: 667 },
    { name: 'iPhone 14/15', width: 390, height: 844 },
    { name: 'Desktop', width: 1280, height: 800 },
  ]) {
    test(viewport.name + ' (' + viewport.width + 'px): add, minus and plus buttons have 44px hit areas', async ({ page }, testInfo) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.addInitScript(() => {
        localStorage.setItem('zt_onb', '1');
        localStorage.setItem('zt_inst_hide', '1');
        sessionStorage.setItem('splashDone', '1');
      });

      await page.route('**/api/delivery/info', (route) => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ today: { open: 11, close: 22 }, days: [], zones: [] })
      }));
      await page.route('**/dmenu**', (route) => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: 'cart-addon-pizza', name: 'Тестовая пицца', section: 'delivery',
              cat: 'pizza', on: 1, price: 500, desc: 'Томатный соус и сыр',
              opts: [{ l: '25 см, пышное', w: '400 г', p: 500, sz: 25 }],
              comp: ['томатный соус', 'моцарелла'], e: '🍕'
            },
            {
              id: 'cart-addon-drink', name: 'Лимонад', section: 'delivery',
              cat: 'drinks', on: 1, price: 120, e: '🥤'
            }
          ]
        })
      }));

      await page.goto('/?brand=delivery');
      await expect(page.locator('#deliveryGrid .card[data-product-id="cart-addon-pizza"]')).toBeVisible({ timeout: 10000 });

      const pizza = page.locator('#deliveryGrid .card[data-product-id="cart-addon-pizza"]');
      await pizza.locator('.opts label.opt-btn').first().click();
      await pizza.locator('[data-add]').click();

      await page.locator('#cartFab').click();
      await expect(page.locator('#cartPanel')).toHaveClass(/open/);
      const addonCard = page.locator('#cartAddons .addon-pill-card').filter({ hasText: 'Лимонад' });
      await expect(addonCard).toBeVisible({ timeout: 5000 });

      const initialGeometry = await addonCard.evaluate((card) => {
        const rect = (element) => {
          const box = element.getBoundingClientRect();
          return { width: box.width, height: box.height };
        };
        return {
          card: rect(card),
          action: rect(card.querySelector('.ac-act')),
          info: rect(card.querySelector('.ac-info')),
          button: rect(card.querySelector('.ac-add-btn')),
        };
      });
      expect(initialGeometry.card.width).toBe(240);
      expect(initialGeometry.card.height).toBe(54);
      expect(initialGeometry.action.width).toBe(88);
      expect(initialGeometry.action.height).toBe(44);
      expect(initialGeometry.info.width).toBeGreaterThanOrEqual(80);
      expect(initialGeometry.button.width).toBeGreaterThanOrEqual(44);
      expect(initialGeometry.button.height).toBeGreaterThanOrEqual(44);

      const addButton = addonCard.locator('.ac-add-btn');
      await expect(addButton).toHaveAccessibleName('Добавить Лимонад в корзину');
      await expect(addButton.locator('.ac-add-label')).toHaveText('Добавить');
      await expect(addButton).toHaveCSS('width', '88px');
      await expect(addButton).toHaveCSS('background-color', 'rgb(192, 59, 42)');
      await expect(addButton).toHaveCSS('color', 'rgb(255, 255, 255)');
      await expect(addButton).toHaveCSS('border-style', 'solid');
      await addButton.click();
      await expect(addonCard).toHaveClass(/in-cart/);
      const stepper = addonCard.locator('.ac-stepper');
      await expect(stepper).toBeVisible();

      const stepGeometry = await stepper.evaluate((stepperElement) => {
        const rect = (element) => {
          const box = element.getBoundingClientRect();
          return { width: box.width, height: box.height };
        };
        return {
          stepper: rect(stepperElement),
          buttons: [...stepperElement.querySelectorAll('.ac-step')].map(rect),
        };
      });
      expect(stepGeometry.stepper.width).toBe(104);
      expect(stepGeometry.stepper.height).toBe(44);
      expect(stepGeometry.buttons).toHaveLength(2);
      for (const button of stepGeometry.buttons) {
        expect(button.width).toBeGreaterThanOrEqual(44);
        expect(button.height).toBeGreaterThanOrEqual(44);
      }

      const minus = addonCard.locator('[data-ac-act="minus"]');
      const plus = addonCard.locator('[data-ac-act="plus"]');
      await expect(minus).toHaveAccessibleName('Уменьшить количество Лимонад');
      await expect(plus).toHaveAccessibleName('Увеличить количество Лимонад');
      await plus.click();
      await expect(addonCard.locator('.ac-qty')).toHaveText('2');
      await minus.click();
      await expect(addonCard.locator('.ac-qty')).toHaveText('1');

      await testInfo.attach('cart-addons-' + viewport.width + 'px', {
        body: await page.screenshot({ fullPage: false }),
        contentType: 'image/png',
      });
    });
  }
});
