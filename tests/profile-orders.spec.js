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
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('zt_onb', '1');
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
        history: [
          { ts: '2026-10-29T12:00:00.000Z', a: 'Начислен штамп', by: 'Кассир' },
          { ts: '2026-10-28T12:00:00.000Z', a: 'Покупка кофе', by: 'Кофейня' },
          { ts: '2026-10-27T12:00:00.000Z', a: 'Начислен штамп', by: 'Кассир' },
          { ts: '2026-10-26T12:00:00.000Z', a: 'Покупка кофе', by: 'Кофейня' },
          { ts: '2026-10-25T12:00:00.000Z', a: 'Начислен штамп', by: 'Кассир' }
        ],
        verified: 1
      };
      window.brand = 'delivery';
      if (typeof window.__profileMeReady !== 'function') {
        throw new Error('Profile readiness hook was not initialized');
      }
      window.__profileMeReady();
      window.renderProfile();
      window.openPanel('profile');
    });
    await expect(page.locator('#myOrdersBtn')).toBeVisible();
  });

  test('выводит последний заказ в профиле и список в отдельной модалке', async ({ page }) => {
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
    expect(mineRequestCount).toBe(1);

    await expect(modal.locator('.omClose')).toBeFocused();
    const closeColors = await modal.locator('.omClose').evaluate(element => {
      const style = getComputedStyle(element);
      return { color: style.color, background: style.backgroundColor };
    });
    expect(closeColors.color).toBe('rgb(255, 255, 255)');
    expect(closeColors.background).toBe('rgb(18, 58, 107)');

    await modal.locator('[data-open-track="profile-order-1"]').click();
    const trackModal = page.locator('#orderTrackModal');
    await expect(trackModal).toHaveClass(/show/);
    await expect(trackModal.locator('.ot-card')).toBeVisible();
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

  test('настройки профиля содержат управление аккаунтом без общего сброса хранилища', async ({ page }) => {
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
      window.me = { ...window.me, id: 'profile-test-second-account' };
      window.loadMyOrders();
    });
    await expect.poll(() => mineRequestCount).toBe(2);
    await expect.poll(() => page.evaluate(() => typeof window.__releaseOldOrdersResponse)).toBe('function');
    await expect(host).toContainText('Загрузка заказа…');
    await expect(host).not.toContainText('P-1042');

    await page.evaluate(() => {
      window.me = { ...window.me, id: 'profile-test-third-account' };
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
    await expect(info).toContainText('пн–вс · 11:00–22:00');
    await expect(info).toContainText('Октябрь–апрель');
    await expect(info).toContainText('пн–чт · 11:00–21:00');
    await expect(info).toContainText('пт–вс · 11:00–22:00');
    await expect(info).not.toContainText('самовывоз');
    await expect(info).not.toContainText('Ежедневно 11:00–22:00');

    const vk = info.getByRole('link', { name: 'ВКонтакте' });
    const yandex = info.getByRole('link', { name: 'Яндекс Карты' });
    await expect(vk).toHaveAttribute('href', 'https://vk.ru/fridaypizza39');
    await expect(vk.locator('svg')).toHaveCount(1);
    await expect(yandex).toHaveAttribute('href', 'https://yandex.ru/maps/org/pyatnitsa/33658031357/reviews/');
    await expect(yandex.locator('svg')).toHaveCount(1);
    await expect(info.locator('.friday-info-review')).toBeVisible();
    expect(await info.evaluate(element => getComputedStyle(element).textAlign)).toBe('left');
  });

  test('содержимое профиля меняется вместе с брендом, вкладки доступны с клавиатуры', async ({ page }) => {
    await expect(page.locator('#profileOrdersSection')).toBeVisible();
    await expect(page.locator('#profileCoffeeSection')).toBeHidden();
    await expect(page.locator('#tabBonus')).toBeHidden();
    await page.evaluate(() => window.openPanel('bonus'));
    await expect(page.locator('#tabProfile')).toHaveAttribute('aria-selected', 'true');
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

    const bonusTab = page.locator('#tabBonus');
    const profileTab = page.locator('#tabProfile');
    await profileTab.focus();
    await profileTab.press('ArrowLeft');
    await expect(bonusTab).toHaveAttribute('aria-selected', 'true');
    await expect(profileTab).toHaveAttribute('aria-selected', 'false');
  });
});
