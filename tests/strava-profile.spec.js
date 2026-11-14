import { test, expect } from '@playwright/test';

const athleteActivities = [{
  id: '987654321',
  name: 'Утренняя пробежка',
  type: 'Run',
  sportType: 'Run',
  distanceMeters: 5230,
  movingTimeSeconds: 1815,
  elapsedTimeSeconds: 1900,
  startedAt: '2026-11-13T07:30:00Z',
  averageSpeedMetersPerSecond: 2.88,
  map: { summary_polyline: 'must-not-be-rendered' }
}];

for (const brand of ['coffee', 'delivery']) {
test.describe('Strava integration in guest profile — ' + brand, () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }, testInfo) => {
    let stravaConnected = false;
    page.setStravaConnected = value => { stravaConnected = Boolean(value); };
    await page.addInitScript(() => {
      window.__stravaStatusForTest = { connected: false };
      localStorage.setItem('zt_onb', '1');
      localStorage.setItem('zt_inst_hide', '1');
      sessionStorage.setItem('splashDone', '1');
    });

    await page.route('**/api/orders/mine', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ orders: [] }),
    }));
    await page.route('**/api/fitness/strava/status', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ enabled: true, connected: stravaConnected, scopes: stravaConnected ? ['activity:read'] : [] })
      });
    });
    await page.route('**/api/fitness/strava/consent', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          enabled: true,
          notice: {
            version: '2026-11-14-v1',
            data: ['ID аккаунта', 'Название, тип, дата, дистанция и время активности'],
            collection: 'Активности запрашиваются напрямую из Strava по вашему действию.',
            purpose: 'Просмотр только в вашем профиле. Не используется для наград или объединения с заказами.',
            storage: 'Токены хранятся зашифрованными; активности и маршруты не сохраняются.',
            withdrawal: 'Отключение в приложении или в настройках Strava.',
            deletion: 'Локальная связь удаляется при отключении.'
          }
        })
      });
    });
    await page.route('**/api/fitness/strava/connect', async route => {
      const body = route.request().postDataJSON();
      expect(body).toEqual({ consent: true, consentVersion: '2026-11-14-v1' });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          authorizationUrl: 'https://www.strava.com/oauth/authorize?client_id=12345&scope=activity%3Aread&state=test',
          scope: 'activity:read',
          expiresInSeconds: 600
        })
      });
    });
    await page.route('**/api/fitness/strava/activities**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ page: 1, perPage: 10, activities: athleteActivities })
      });
    });
    await page.route('**/api/fitness/strava/disconnect', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, disconnected: true, revoked: true })
      });
    });

    await page.goto('/?brand=' + brand);
    await expect.poll(() => page.evaluate(() =>
      typeof window.setUser === 'function' &&
      typeof window.renderProfile === 'function' &&
      document.documentElement.getAttribute('data-staff-ready') === '1'
    )).toBe(true);

    await page.evaluate(() => {
      const customer = {
        id: 'strava-profile-test',
        name: 'Тестовый гость',
        phone: '+7 900 000-00-00',
        role: 'guest',
        cups: 0,
        stamps: 0,
        free: 0,
        qr: 'strava-test',
        history: [],
        verified: 1
      };
      window.setUser('strava-profile-token', customer);
      window.__profileMeReady();
      window.renderProfile();
      window.openPanel('profile');
    });

    await expect(page.locator('#stravaProfileSection')).toBeVisible();
    await expect(page.locator('#stravaProfileStyles')).toHaveCount(1);
    await expect(page.locator('#stravaProfileSection')).toHaveCSS('display', 'grid');
    await expect(page.locator('#stravaProfileSection')).toContainText('Аккаунт Strava не подключён.');
    await page.screenshot({
      path: testInfo.outputPath('strava-profile-' + brand + '-portrait-390x844.png'),
      fullPage: true,
    });
  });

  test('asks for explicit consent before opening Strava OAuth', async ({ page }, testInfo) => {
    const section = page.locator('#stravaProfileSection');
    await expect(section).toContainText('Аккаунт Strava не подключён.');
    await section.getByRole('button', { name: 'Подключить Strava' }).click();
    await expect(section).toContainText('Просмотр только в вашем профиле');
    await expect(section).toContainText('не сохраняются');
    const consent = section.getByRole('checkbox');
    await expect(consent).not.toBeChecked();
    const continueButton = section.getByRole('button', { name: 'Продолжить на Strava' });
    await expect(continueButton).toBeDisabled();
    await consent.check();
    await expect(continueButton).toBeEnabled();

    await page.context().route(/^https:\/\/www\.strava\.com\/oauth\/authorize/, route => route.fulfill({
      status: 200, contentType: 'text/html', body: '<title>Strava OAuth test stub</title>'
    }));
    const popupPromise = page.waitForEvent('popup');
    await continueButton.click();
    const popup = await popupPromise;
    await expect(popup).toHaveURL(/^https:\/\/www\.strava\.com\/oauth\/authorize\?/);
    await expect(popup).toHaveURL(/scope=activity%3Aread/);
    await popup.close();

    await page.setViewportSize({ width: 320, height: 740 });
    await expect(section).toBeVisible();
    const bounds = await section.evaluate(node => {
      const rect = node.getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: rect.width, scrollWidth: node.scrollWidth, clientWidth: node.clientWidth };
    });
    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(320);
    expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.clientWidth + 1);
    await page.screenshot({
      path: testInfo.outputPath('strava-profile-' + brand + '-narrow-320x740.png'),
      fullPage: true,
    });

    await page.setViewportSize({ width: 844, height: 390 });
    const landscape = await section.evaluate(node => {
      const rect = node.getBoundingClientRect();
      return { left: rect.left, right: rect.right, scrollWidth: node.scrollWidth, clientWidth: node.clientWidth };
    });
    expect(landscape.left).toBeGreaterThanOrEqual(0);
    expect(landscape.right).toBeLessThanOrEqual(844);
    expect(landscape.scrollWidth).toBeLessThanOrEqual(landscape.clientWidth + 1);
    await page.screenshot({
      path: testInfo.outputPath('strava-profile-' + brand + '-landscape-844x390.png'),
      fullPage: true,
    });
  });


  test('keeps the initiating browser context in an installed PWA', async ({ page }) => {
    const section = page.locator('#stravaProfileSection');
    await section.getByRole('button', { name: 'Подключить Strava' }).click();
    await section.getByRole('checkbox').check();
    await page.evaluate(() => {
      Object.defineProperty(window.navigator, 'standalone', {
        configurable: true,
        value: true,
      });
    });
    await page.context().route(/^https:\/\/www\.strava\.com\/oauth\/authorize/, route => route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<title>Strava OAuth PWA test stub</title>',
    }));

    const popupPromise = page.waitForEvent('popup', { timeout: 1000 }).catch(() => null);
    await section.getByRole('button', { name: 'Продолжить на Strava' }).click();
    const popup = await popupPromise;

    expect(popup).toBeNull();
    await expect(page).toHaveURL(/^https:\/\/www\.strava\.com\/oauth\/authorize\?/);
    await expect(page).toHaveURL(/scope=activity%3Aread/);
  });


  test('requires the ordinary browser for the browser-bound OAuth flow in Telegram Mini App', async ({ page }) => {
    await page.evaluate(() => {
      window.__isTgMiniApp = true;
      window.setUser('strava-profile-token', {
        id: 'strava-profile-test', name: 'Тестовый гость', phone: '+7 900 000-00-00',
        role: 'guest', cups: 0, stamps: 0, free: 0, qr: 'strava-test', history: [], verified: 1
      });
      window.renderProfile();
    });
    const section = page.locator('#stravaProfileSection');
    await expect(section).toContainText('В Telegram Mini App это не гарантируется');
    await expect(section.getByRole('link', { name: 'Открыть Zerno App в браузере' }))
      .toHaveAttribute('href', /[?]brand=/);
    await expect(section.getByRole('button', { name: 'Подключить Strava' })).toHaveCount(0);
  });

  test('shows only activity summary fields and supports account disconnection', async ({ page }, testInfo) => {
    const section = page.locator('#stravaProfileSection');

    page.setStravaConnected(true);
    await page.evaluate(() => {
      window.setUser('strava-profile-token', {
        id: 'strava-profile-test', name: 'Тестовый гость', phone: '+7 900 000-00-00',
        role: 'guest', cups: 0, stamps: 0, free: 0, qr: 'strava-test', history: [], verified: 1
      });
      window.renderProfile();
    });

    await expect(section).toContainText('Аккаунт Strava подключён.');
    await section.getByRole('button', { name: 'Показать тренировки' }).click();
    await expect(section).toContainText('Утренняя пробежка');
    await expect(section).toContainText('5,23 км');
    await expect(section).toContainText('30 мин');
    await expect(section.getByRole('link', { name: 'View on Strava' }))
      .toHaveAttribute('href', 'https://www.strava.com/activities/987654321');
    await expect(section.getByRole('link', { name: 'View on Strava' }))
      .toHaveCSS('color', 'rgb(252, 76, 2)');
    await expect(section.locator('.strava-wordmark')).toHaveCSS('color', 'rgb(252, 76, 2)');
    await expect(section).toContainText('Powered by Strava');
    await expect(section).not.toContainText('must-not-be-rendered');
    await expect(section.locator('a[href*="polyline"]')).toHaveCount(0);
    await page.screenshot({
      path: testInfo.outputPath('strava-profile-' + brand + '-activities-390x844.png'),
      fullPage: true,
    });

    page.once('dialog', dialog => dialog.accept());
    await section.getByRole('button', { name: 'Отключить Strava' }).click();
    await expect(section).toContainText('Strava отключена. Разрешение отозвано.');
    await expect(section.getByRole('button', { name: 'Подключить Strava' })).toBeVisible();
  });

  test('does not show Strava integration for unverified guests or staff', async ({ page }) => {
    await page.evaluate(() => {
      window.setUser('strava-unverified', { ...window.me, id: 'unverified', verified: 0 });
      window.renderProfile();
    });
    await expect(page.locator('#stravaProfileSection')).toBeHidden();

    await page.evaluate(() => {
      window.setUser('strava-staff', { ...window.me, id: 'staff', role: 'cashier', verified: 1 });
      window.renderProfile();
    });
    await expect(page.locator('#stravaProfileSection')).toBeHidden();
  });
});
}
