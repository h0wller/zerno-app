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

test.describe('Strava integration in guest profile', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('zt_onb', '1');
      localStorage.setItem('zt_inst_hide', '1');
      sessionStorage.setItem('splashDone', '1');
    });

    await page.route('**/api/fitness/strava/status', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ enabled: true, connected: false })
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

    await page.goto('/?brand=coffee');
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
  });

  test('asks for explicit consent before opening Strava OAuth', async ({ page }) => {
    const section = page.locator('#stravaProfileSection');
    await expect(section).toContainText('Аккаунт Strava не подключён.');
    await section.getByRole('button', { name: 'Подключить Strava' }).click();
    await expect(section).toContainText('Данные показываются только в вашем профиле');
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
  });

  test('shows only activity summary fields and supports account disconnection', async ({ page }) => {
    const section = page.locator('#stravaProfileSection');

    await page.route('**/api/fitness/strava/status', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ enabled: true, connected: true, scopes: ['activity:read'] })
      });
    });
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));

    await expect(section).toContainText('Аккаунт Strava подключён.');
    await section.getByRole('button', { name: 'Показать тренировки' }).click();
    await expect(section).toContainText('Утренняя пробежка');
    await expect(section).toContainText('5,23 км');
    await expect(section).toContainText('30 мин');
    await expect(section.getByRole('link', { name: 'View on Strava' }))
      .toHaveAttribute('href', 'https://www.strava.com/activities/987654321');
    await expect(section).toContainText('Powered by Strava');
    await expect(section).not.toContainText('must-not-be-rendered');
    await expect(section.locator('a[href*="polyline"]')).toHaveCount(0);

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
