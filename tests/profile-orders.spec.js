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
    await page.route('**/api/orders/mine', route => {
      mineRequestCount += 1;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ orders: [orderFixture] })
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
    await page.keyboard.press('Escape');
    await expect(modal).not.toHaveClass(/show/);
    await expect(page.locator('#myOrdersBtn')).toBeFocused();
  });

  test('настройки профиля содержат управление аккаунтом без общего сброса хранилища', async ({ page }) => {
    await page.locator('#profileBox .gear').click();

    const settings = page.locator('#settingsModal');
    await expect(settings).toHaveClass(/show/);
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

  test('при смене пользователя кэш заказов обновляется', async ({ page }) => {
    await expect(page.locator('#myOrders .myOrderCard')).toContainText('Заказ #P-1042');
    expect(mineRequestCount).toBe(1);

    await page.evaluate(() => {
      window.me = { ...window.me, id: 'profile-test-second-account' };
      window.loadMyOrders();
    });
    await expect.poll(() => mineRequestCount).toBe(2);
  });

  test('история показывает последние записи и раскрывает полный список', async ({ page }) => {
    await expect(page.locator('#histList .hmini')).toHaveCount(3);
    const toggle = page.locator('#historyToggleBtn');
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(page.locator('#histList .hmini')).toHaveCount(5);
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await toggle.click();
    await expect(page.locator('#histList .hmini')).toHaveCount(3);
  });

  test('содержимое профиля меняется вместе с брендом, вкладки доступны с клавиатуры', async ({ page }) => {
    await expect(page.locator('#profileOrdersSection')).toBeVisible();
    await expect(page.locator('#profileCoffeeSection')).toBeHidden();
    await expect(page.locator('#tabBonus')).toBeHidden();
    await page.evaluate(() => window.setTab('bonus'));
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
