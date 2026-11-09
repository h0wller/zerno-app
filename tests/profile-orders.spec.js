import { test, expect } from '@playwright/test';

let mineRequestCount = 0;

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
  test.use({ viewport: { width: 390, height: 844 } });
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('zt_onb', '1');
      localStorage.setItem('zt_inst_hide', '1');
      sessionStorage.setItem('splashDone', '1');
    });
    mineRequestCount = 0;
    await page.route('**/api/orders/mine', async route => {
      mineRequestCount += 1;
      const orders = mineRequestCount === 2
        ? [{ ...orderFixture, no: 'P-OLD' }]
        : mineRequestCount === 3
          ? [{ ...orderFixture, no: 'P-2044' }]
          : [orderFixture];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ orders })
      });
    });

    await page.goto('/?brand=delivery');
    await expect.poll(() => page.evaluate(() =>
      typeof window.boot === 'function' &&
      typeof window.syncBrandViews === 'function' &&
      typeof window.setUser === 'function' &&
      typeof window.openPanel === 'function'
    )).toBe(true);
    await expect.poll(() => page.evaluate(() =>
      document.documentElement.getAttribute('data-staff-ready') === '1' &&
      Array.isArray(window.DMENU) && window.DMENU.length > 0
    )).toBe(true);

    await page.evaluate(() => {
      const customer = {
        id: 'profile-test',
        name: 'Тестовый гость',
        phone: '+7 900 000-00-00',
        role: 'guest',
        cups: 2,
        stamps: 2,
        free: 0,
        qr: 'profile-test',
        history: [
          { ts: '2026-10-29T12:00:00.000Z', a: 'Начислен штамп', by: 'Кассир' },
          { ts: '2026-10-28T12:00:00.000Z', a: 'Покупка кофе', by: 'Кофейня' },
          { ts: '2026-10-27T12:00:00.000Z', a: 'Начислен штамп', by: 'Кассир' },
          { ts: '2026-10-26T12:00:00.000Z', a: 'Покупка кофе', by: 'Кофейня' },
          { ts: '2026-10-25T12:00:00.000Z', a: 'Начислен штамп', by: 'Кассир' }
        ],
        verified: 1
      };
      window.setUser('profile-test-token', customer);
      window.__profileMeReady();
      window.renderProfile();
      window.openPanel('profile');
    });

    await expect(page.locator('#panel')).toHaveClass(/open/);
    await expect(page.locator('#tabBonus, #tabProfile, #pvBonus')).toHaveCount(0);
    await expect(page.locator('#pvProfile')).toBeVisible();
    await expect(page.locator('#profileBox')).toBeVisible();
    await expect(page.locator('#myOrdersBtn')).toBeVisible();
    await expect(page.locator('#fridayInfo')).toBeVisible();
    await expect(page.locator('#fridayInfo a[aria-label="ВКонтакте"]')).toHaveAttribute('href', 'https://vk.ru/fridaypizza39');
    await expect(page.locator('#fridayInfo a[aria-label="Яндекс Карты"]')).toHaveAttribute('href', /yandex\.ru\/maps/);
    await expect.poll(() => page.locator('#fridayInfo').evaluate(element =>
      element.nextElementSibling?.classList.contains('profile-history-section')
    )).toBe(true);
  });
  test('профиль доставки использует общую плоскую композицию', async ({ page }, testInfo) => {
    const details = page.locator('#fridayInfo .friday-info-details');
    const summary = details.locator('summary');
    await expect(details).toHaveCount(1);
    await expect(summary.locator('span').first()).toHaveText('О заведении');
    await expect(details).not.toHaveAttribute('open', '');

    const presentation = await page.evaluate(() => {
      const identity = document.querySelector('#profileBox > .profile-identity');
      const history = document.querySelector('#profileBox > .profile-history-section');
      const order = document.querySelector('#profileBox .myOrderCard');
      const details = document.querySelector('#fridayInfo .friday-info-details');
      const summary = details.querySelector('summary');
      const body = details.querySelector('.friday-info-body');
      const address = details.querySelector('.friday-info-address');
      return {
        identityBackground: getComputedStyle(identity).backgroundColor,
        identityBorder: getComputedStyle(identity).borderTopWidth,
        historyBackground: getComputedStyle(history).backgroundColor,
        orderShadow: getComputedStyle(order).boxShadow,
        orderBorder: getComputedStyle(order).borderTopWidth,
        detailsRadius: getComputedStyle(details).borderRadius,
        detailsShadow: getComputedStyle(details).boxShadow,
        summaryDisplay: getComputedStyle(summary).display,
        summaryMinHeight: Number.parseFloat(getComputedStyle(summary).minHeight),
        iconDisplay: getComputedStyle(summary.querySelector('span:first-child'), '::before').display,
        bodyBackground: getComputedStyle(body).backgroundColor,
        addressBackground: getComputedStyle(address).backgroundColor
      };
    });

    expect(presentation.identityBackground).toBe('rgba(0, 0, 0, 0)');
    expect(presentation.identityBorder).toBe('0px');
    expect(presentation.historyBackground).toBe('rgba(0, 0, 0, 0)');
    expect(presentation.orderShadow).toBe('none');
    expect(presentation.orderBorder).toBe('1px');
    expect(presentation.detailsRadius).toBe('0px');
    expect(presentation.detailsShadow).toBe('none');
    expect(presentation.summaryDisplay).toBe('flex');
    expect(presentation.summaryMinHeight).toBeGreaterThanOrEqual(44);
    expect(presentation.iconDisplay).toBe('none');
    expect(presentation.bodyBackground).toBe('rgba(0, 0, 0, 0)');
    expect(presentation.addressBackground).toBe('rgba(0, 0, 0, 0)');

    await testInfo.attach('delivery-profile-composition-390px', {
      body: await page.screenshot({ animations: 'disabled' }),
      contentType: 'image/png'
    });

    await summary.click();
    await expect(details).toHaveAttribute('open', '');
    await expect(details.locator('.friday-info-body')).toBeVisible();
    await expect(details.locator('.friday-info-hours-row')).toHaveCount(2);
    await expect(details.getByRole('link', { name: 'ВКонтакте' })).toBeVisible();
    await expect(details.getByRole('link', { name: 'Яндекс Карты' })).toBeVisible();
    await testInfo.attach('delivery-profile-about-expanded-390px', {
      body: await page.screenshot({ animations: 'disabled' }),
      contentType: 'image/png'
    });
  });
  test('выводит последний заказ в профиле и список в отдельной модалке', async ({ page }, testInfo) => {
    await expect(page.locator('#profileOrdersSection .profile-section-heading')).toContainText('Последний заказ');
    await expect(page.locator('#myOrders .myOrderCard')).toContainText('Заказ #P-1042');
    await expect(page.locator('#myOrders .myOrderCard')).toContainText('Филадельфия с огурцом');

    await page.evaluate(() => {
      const render = window.renderOrdersModal;
      window.__ordersModalRenderCount = 0;
      window.renderOrdersModal = function () {
        window.__ordersModalRenderCount += 1;
        return render.apply(this, arguments);
      };
    });

    await page.locator('#myOrdersBtn').click();
    await expect.poll(() => page.evaluate(() => window.__ordersModalRenderCount)).toBe(1);

    const modal = page.locator('#ordersModal');
    await expect(modal).toHaveClass(/show/);
    await expect(modal.locator('#omList .myOrderCard')).toContainText('Заказ #P-1042');
    await expect(modal.locator('[data-open-track="profile-order-1"]')).toBeVisible();
    await testInfo.attach('delivery-profile-orders-modal-390px', {
      body: await page.screenshot({ animations: 'disabled' }),
      contentType: 'image/png'
    });
    expect(mineRequestCount).toBe(1);

    await expect(modal.locator('.omClose')).toBeFocused();
    const closePresentation = await modal.locator('.omClose').evaluate(element => {
      const style = getComputedStyle(element);
      return {
        background: style.backgroundColor,
        borderWidth: style.borderTopWidth,
        shadow: style.boxShadow
      };
    });
    expect(closePresentation.background).toBe('rgba(0, 0, 0, 0)');
    expect(closePresentation.borderWidth).toBe('1px');
    expect(closePresentation.shadow).toBe('none');

    await modal.locator('[data-open-track="profile-order-1"]').click();
    const trackModal = page.locator('#orderTrackModal');
    await expect(trackModal).toHaveClass(/show/);
    await expect(trackModal.locator('.ot-card')).toBeVisible();
    await testInfo.attach('delivery-profile-tracking-modal-390px', {
      body: await page.screenshot({ animations: 'disabled' }),
      contentType: 'image/png'
    });
    const stack = await page.evaluate(() => {
      const orders = document.getElementById('ordersModal');
      const track = document.getElementById('orderTrackModal');
      const rect = track.getBoundingClientRect();
      const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return {
        orders: Number(getComputedStyle(orders).zIndex),
        track: Number(getComputedStyle(track).zIndex),
        topLayer: top && top.closest('#orderTrackModal') ? 'orderTrackModal' : 'other'
      };
    });
    expect(stack.track).toBeGreaterThan(stack.orders);
    expect(stack.topLayer).toBe('orderTrackModal');
    await trackModal.locator('[data-ot-close]').click();
    await expect(trackModal).not.toHaveClass(/show/);
    await expect(modal).toHaveClass(/show/);

    await page.keyboard.press('Escape');
    await expect(modal).not.toHaveClass(/show/);
    await expect(page.locator('#myOrdersBtn')).toBeFocused();
  });

  test('настройки профиля содержат управление аккаунтом без общего сброса хранилища', async ({ page }, testInfo) => {
    await page.locator('#profileBox .gear').click();

    const settings = page.locator('#settingsModal');
    await expect(settings).toHaveClass(/show/);
    const settingsWidth = await settings.locator('.settings-card').evaluate(element => element.getBoundingClientRect().width);
    expect(settingsWidth).toBeLessThanOrEqual(401);
    await expect(settings.locator('#setPinGo2')).toBeVisible();
    await expect(settings.locator('#ntTg2')).toBeVisible();
    await expect(settings.locator('#ntWeb2')).toBeVisible();
    await expect(settings.locator('#logoutBtn')).toBeVisible();
    await expect(settings.locator('#deleteAccBtn')).toBeVisible();
    await expect(settings.locator('#deleteConfirmPanel')).toBeHidden();
    await expect(settings.locator('#deleteConfirmBtn')).toBeDisabled();
    await testInfo.attach('delivery-profile-settings-390px', {
      body: await page.screenshot({ animations: 'disabled' }),
      contentType: 'image/png'
    });
    await expect(page.locator('#setPinBtn, #notifyDetails, #ntTg, #ntWeb, #resetBtn, #resetGo2')).toHaveCount(0);

    await settings.locator('#deleteAccBtn').click();
    await expect(settings.locator('#deleteConfirmPanel')).toBeVisible();
    await settings.locator('#deleteConfirmInput').fill('неверно');
    await expect(settings.locator('#deleteConfirmBtn')).toBeDisabled();
    await settings.locator('#deleteConfirmInput').fill('УДАЛИТЬ');
    await expect(settings.locator('#deleteConfirmBtn')).toBeEnabled();
    await settings.locator('#deleteCancelBtn').click();
    await expect(settings.locator('#deleteConfirmPanel')).toBeHidden();

    await settings.locator('#setPinGo2').click();
    await expect(page.locator('#setPinModal')).toHaveClass(/show/);
  });

  test('клик по затемнению закрывает настройки, но оставляет профиль открытым', async ({ page }) => {
    const panel = page.locator('#panel');
    const panelWasOpen = await panel.evaluate(element => element.classList.contains('open'));

    await page.locator('#profileBox .gear').click();
    const settings = page.locator('#settingsModal');
    await expect(settings).toHaveClass(/show/);

    await settings.click({ position: { x: 8, y: 8 } });
    await expect(settings).not.toHaveClass(/show/);
    await expect.poll(() => panel.evaluate(element => element.classList.contains('open'))).toBe(panelWasOpen);
  });

  test('Escape closes settings without closing the profile panel', async ({ page }) => {
    const panel = page.locator('#panel');
    const panelWasOpen = await panel.evaluate(element => element.classList.contains('open'));

    await page.locator('#profileBox .gear').click();
    const settings = page.locator('#settingsModal');
    await expect(settings).toHaveClass(/show/);

    await page.keyboard.press('Escape');
    await expect(settings).not.toHaveClass(/show/);
    await expect.poll(() => panel.evaluate(element => element.classList.contains('open'))).toBe(panelWasOpen);
  });

  test('имя редактируется явно и сохраняется отдельным действием', async ({ page }) => {
    await page.route('**/api/me', async route => {
      if (route.request().method() !== 'PUT') return route.continue();
      const payload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          customer: {
            id: 'profile-test',
            name: payload.name,
            phone: '+7 900 000-00-00',
            role: 'guest',
            cups: 2,
            stamps: 2,
            free: 0,
            history: [],
            verified: 1
          }
        })
      });
    });

    const name = page.locator('#nameInput');
    await expect(name).toHaveAttribute('readonly', '');
    await page.locator('#nameEditBtn').click();
    await expect(name).not.toHaveAttribute('readonly', '');
    await name.fill('Новое имя');
    await page.locator('#nameSaveBtn').click();
    await expect(name).toHaveAttribute('readonly', '');
    await expect(name).toHaveValue('Новое имя');
  });

  test('смена аккаунта очищает старый заказ и игнорирует поздний ответ прежней сессии', async ({ page }) => {
    const host = page.locator('#myOrders');
    await expect(host).toContainText('Заказ #P-1042');
    expect(mineRequestCount).toBe(1);

    await page.evaluate(() => {
      const nativeFetch = window.fetch.bind(window);
      let delayed = false;
      window.fetch = function (input, init) {
        const url = typeof input === 'string' ? input : input.url;
        const response = nativeFetch(input, init);
        if (!delayed && url.includes('/api/orders/mine')) {
          delayed = true;
          return response.then(result => new Promise(resolve => {
            window.__releaseOldOrdersResponse = function () { resolve(result); };
          }));
        }
        return response;
      };
      window.setUser('profile-test-token-second', { ...window.me, id: 'profile-test-second-account' });
      window.loadMyOrders();
    });
    await expect.poll(() => mineRequestCount).toBe(2);
    await expect.poll(() => page.evaluate(() => typeof window.__releaseOldOrdersResponse)).toBe('function');
    await expect(host).toContainText('Загрузка заказа…');
    await expect(host).not.toContainText('P-1042');

    await page.evaluate(() => {
      window.setUser('profile-test-token-third', { ...window.me, id: 'profile-test-third-account' });
      window.loadMyOrders();
    });
    await expect.poll(() => mineRequestCount).toBe(3);
    await expect(host).toContainText('Заказ #P-2044');

    await page.evaluate(() => window.__releaseOldOrdersResponse());
    await expect(host).toContainText('Заказ #P-2044');
    await expect(host).not.toContainText('P-OLD');
  });

  test('история показывает последние записи и раскрывает полный список', async ({ page }) => {
    await expect(page.locator('#histList .hmini')).toHaveCount(3);
    await expect(page.locator('#historyCount')).toHaveText('5 записей');
    const toggle = page.locator('#historyToggleBtn');
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(page.locator('#histList .hmini')).toHaveCount(5);
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await toggle.click();
    await expect(page.locator('#histList .hmini')).toHaveCount(3);
  });

  test('элементы профиля помещаются на узком экране, верхняя граница danger zone видима', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await page.evaluate(() => window.openPanel('profile'));

    const panel = page.locator('#panel');
    await expect(panel).toHaveClass(/open/);
    const heading = page.locator('#profileOrdersSection .profile-section-heading');
    const layout = await heading.evaluate(element => {
      const button = element.querySelector('#myOrdersBtn');
      const headingRect = element.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      return {
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        buttonRight: buttonRect.right,
        headingRight: headingRect.right
      };
    });
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
    expect(layout.buttonRight).toBeLessThanOrEqual(layout.headingRight + 1);

    const editButton = page.locator('#nameEditBtn');
    await expect(editButton).toHaveAttribute('aria-label', 'Изменить имя');
    await expect(editButton.locator('svg')).toHaveCount(1);

    await page.locator('#profileSettingsBtn').click();
    const dangerZone = page.locator('#settingsModal .settings-danger-zone');
    await expect(dangerZone).toBeVisible();
    const settingsCard = await page.locator('#settingsModal .settings-card').boundingBox();
    expect(settingsCard.width).toBeLessThanOrEqual(285);
    expect(settingsCard.x).toBeGreaterThanOrEqual(17);
    const border = await dangerZone.evaluate(element => {
      const style = getComputedStyle(element);
      return { topStyle: style.borderTopStyle, topColor: style.borderTopColor };
    });
    expect(border.topStyle).toBe('solid');
    expect(border.topColor).toBe('rgb(179, 55, 43)');
  });

  test('информация о Пятнице показывает актуальное расписание и брендовые ссылки', async ({ page }) => {
    const info = page.locator('#fridayInfo');
    await expect(info).toBeVisible();
    await expect(info).toContainText('п. Янтарный, ул. Советская, 38А · доставка из приложения');
    await expect(info).toContainText('Май–сентябрь');
    await expect(info).toContainText('пн–вс 11:00–22:00');
    await expect(info).toContainText('Октябрь–апрель');
    await expect(info).toContainText('пн–чт 11:00–21:00');
    await expect(info).toContainText('пт–вс 11:00–22:00');
    await expect(info).not.toContainText('самовывоз');
    await expect(info).not.toContainText('Ежедневно 11:00–22:00');

    await info.locator('.friday-info-details summary').click();
    await expect(info.locator('.friday-info-body')).toBeVisible();

    const vk = info.getByRole('link', { name: 'ВКонтакте' });
    const yandex = info.getByRole('link', { name: 'Яндекс Карты' });
    await expect(vk).toHaveAttribute('href', 'https://vk.ru/fridaypizza39');
    await expect(vk.locator('svg')).toHaveCount(1);
    await expect(yandex).toHaveAttribute('href', 'https://yandex.ru/maps/org/pyatnitsa/33658031357/reviews/');
    await expect(yandex.locator('svg')).toHaveCount(1);
    const socialRow = info.locator('.friday-info-links');
    const socialLayout = await socialRow.evaluate(element => {
      const [first, second] = element.querySelectorAll('.friday-info-link');
      const row = element.getBoundingClientRect();
      const firstRect = first.getBoundingClientRect();
      const secondRect = second.getBoundingClientRect();
      return {
        justifyContent: getComputedStyle(element).justifyContent,
        gap: getComputedStyle(element).columnGap,
        distance: secondRect.left - firstRect.right,
        centerOffset: Math.abs((firstRect.left + secondRect.right) / 2 - (row.left + row.width / 2)),
        bottom: row.bottom
      };
    });
    expect(socialLayout.justifyContent).toBe('flex-start');
    expect(socialLayout.gap).toBe('18px');
    expect(socialLayout.distance).toBeGreaterThanOrEqual(17);
    expect(socialLayout.distance).toBeLessThanOrEqual(19);
    expect(socialLayout.centerOffset).toBeLessThanOrEqual(1);

    const summerHours = info.locator('.friday-info-hours-row').first().locator('span');
    await expect.poll(() => summerHours.evaluate(element => getComputedStyle(element).textAlign))
      .toBe('right');

    const review = info.locator('.friday-info-review');
    await expect(review).toBeVisible();
    await expect(review).toHaveText('Оставить отзыв');
    await expect(review.locator('svg')).toHaveCount(0);
    const reviewLayout = await review.evaluate(element => {
      const rect = element.getBoundingClientRect();
      const parent = element.parentElement.getBoundingClientRect();
      return {
        display: getComputedStyle(element).display,
        justifyContent: getComputedStyle(element).justifyContent,
        textAlign: getComputedStyle(element).textAlign,
        centerOffset: Math.abs(rect.left + rect.width / 2 - (parent.left + parent.width / 2)),
        top: rect.top
      };
    });
    expect(reviewLayout.display).toBe('flex');
    expect(reviewLayout.justifyContent).toBe('center');
    expect(reviewLayout.textAlign).toBe('center');
    expect(reviewLayout.centerOffset).toBeLessThanOrEqual(1);
    expect(reviewLayout.top).toBeGreaterThanOrEqual(socialLayout.bottom);

    expect(await info.evaluate(element => getComputedStyle(element).textAlign)).toBe('left');
  });

  test('кнопка закрытия списка заказов остаётся нейтральной в обоих брендах', async ({ page }) => {
    await page.locator('#myOrdersBtn').click();
    const close = page.locator('#ordersModal .omClose');
    await expect(close).toBeVisible();

    for (const brand of ['delivery', 'coffee']) {
      await page.evaluate(value => {
        document.documentElement.setAttribute('data-brand', value);
        document.body.setAttribute('data-brand', value);
      }, brand);
      await expect.poll(() => close.evaluate(element => getComputedStyle(element).backgroundColor))
        .toBe('rgba(0, 0, 0, 0)');
      await expect.poll(() => close.evaluate(element => getComputedStyle(element).boxShadow))
        .toBe('none');
      await expect.poll(() => close.evaluate(element => getComputedStyle(element).borderTopWidth))
        .toBe('1px');
    }
  });

  test('содержимое профиля меняется вместе с брендом, единая панель без вкладок', async ({ page }) => {
    await expect(page.locator('#profileOrdersSection')).toBeVisible();
    await expect(page.locator('#profileCoffeeSection')).toBeHidden();
    await expect(page.locator('#qrOpenProfile')).toBeHidden();
    await expect(page.locator('#profileBox .coffee-venue-card')).toBeHidden();
    await expect(page.locator('#profileBox .coffee-review-card')).toBeHidden();
    await expect(page.locator('#tabBonus, #tabProfile, #pvBonus')).toHaveCount(0);
    await page.evaluate(() => window.openPanel('bonus'));
    await expect(page.locator('#pvProfile')).toBeVisible();
    await expect(page.locator('#fridayInfo')).toBeVisible();
    await expect(page.locator('#fridayInfo').evaluate(el => el.parentElement.id)).resolves.toBe('profileBox');

    await page.evaluate(() => {
      window.brand = 'coffee';
      window.applyProfileBrand();
    });
    await expect(page.locator('#profileCoffeeSection')).toBeVisible();
    await expect(page.locator('#profileOrdersSection')).toBeHidden();
    await expect(page.locator('#fridayInfo')).toBeHidden();
    await expect(page.locator('#profileBox .coffee-venue-card')).toBeVisible();
    await expect(page.locator('#profileBox .coffee-review-card')).toBeVisible();

    const coffeeVenue = page.locator('#profileBox .coffee-venue-card');
    await expect(coffeeVenue).toContainText('п. Янтарный, ул. Советская, 70г');
    await expect(coffeeVenue).toContainText('Май–сентябрь');
    await expect(coffeeVenue).toContainText('Октябрь–апрель');
    const telegram = coffeeVenue.getByRole('link', { name: 'Telegram-канал' });
    const instagram = coffeeVenue.getByRole('link', { name: 'Instagram' });
    const bot = coffeeVenue.getByRole('link', { name: 'Бот с бонусами' });
    await expect(telegram).toHaveAttribute('href', 'https://t.me/and_coffee39');
    await expect(instagram).toHaveAttribute('href', 'https://www.instagram.com/and_coffee39/');
    await expect(bot).toHaveAttribute('href', 'https://t.me/and_coffee_bot');
    await expect(coffeeVenue).not.toContainText('t.me/and_coffee39');
    await expect(coffeeVenue).not.toContainText('instagram.com/and_coffee39');
    await expect(coffeeVenue.locator('.coffee-place-link svg')).toHaveCount(3);

    const coffeeReview = page.locator('#reviewBtn');
    await expect(coffeeReview).toContainText('Оставить отзыв');
    await expect(coffeeReview.locator('svg')).toHaveCount(0);
    await expect.poll(() => coffeeReview.evaluate(element => getComputedStyle(element).justifyContent))
      .toBe('center');

    await page.evaluate(() => {
      window.me = null;
      window.renderProfile();
      window.applyProfileBrand();
    });
    await expect(page.locator('#profileNoUser')).toBeVisible();
    await expect(page.locator('#profileCoffeePrompt')).toBeVisible();
    await expect(page.locator('#profileDeliveryPrompt')).toBeHidden();

    await page.evaluate(() => {
      window.brand = 'delivery';
      window.applyProfileBrand();
    });
    await expect(page.locator('#profileDeliveryPrompt')).toBeVisible();
    await expect(page.locator('#profileCoffeePrompt')).toBeHidden();

    await page.evaluate(() => {
      window.brand = 'coffee';
      window.syncBrandViews();
    });

    await expect(page.locator('#tabBonus, #tabProfile, #pvBonus')).toHaveCount(0);
    await page.locator('#panel .tabs .btn-back').focus();
    await expect(page.locator('#panel .tabs .btn-back')).toBeFocused();
  });

  test('delivery profile back action fits at narrow mobile widths', async ({ page }, testInfo) => {
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(page.locator('#panel')).toHaveClass(/open/);
      await expect(page.locator('#tabBonus, #tabProfile, #pvBonus')).toHaveCount(0);

      const layout = await page.evaluate(() => {
        const back = document.querySelector('#panel .tabs .btn-back');
        const footer = document.querySelector('#panel .tabs');
        const rect = element => {
          const box = element.getBoundingClientRect();
          return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height };
        };
        return {
          back: rect(back),
          footer: rect(footer),
          childCount: footer.children.length,
        };
      });

      expect(layout.childCount, 'only the back action remains in the panel toolbar').toBe(1);
      expect(layout.back.height, 'Back action keeps a comfortable touch target').toBeGreaterThanOrEqual(44);
      expect(layout.back.width, 'Back action is not compressed into an icon-width button').toBeGreaterThan(100);
      expect(layout.back.left).toBeGreaterThanOrEqual(layout.footer.left);
      expect(layout.back.right).toBeLessThanOrEqual(layout.footer.right);
      await testInfo.attach(`delivery-profile-footer-${width}px`, {
        body: await page.screenshot({ animations: 'disabled' }),
        contentType: 'image/png',
      });
    }
  });

});
