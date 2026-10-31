// tests/registration.spec.js
import { test, expect } from '@playwright/test';

const TG_STUB = () => {
  window.Telegram = { WebApp: {
    initData: 'query_id=AAH&user=%7B%22id%22%3A1%2C%22first_name%22%3A%22T%22%7D',
    initDataUnsafe: { user: { id: 1, first_name: 'T' } }, platform: 'ios',
    ready() {}, expand() {}, openTelegramLink() {}, // в настоящем TMA ссылка на бота открывается нативно, страница не уходит enableClosingConfirmation() {}, disableVerticalSwipes() {},
    BackButton: { show() {}, hide() {}, onClick() {} },
    MainButton: { show() {}, hide() {}, setText() {}, setParams() {}, onClick() {} },
    HapticFeedback: { impactOccurred() {}, notificationOccurred() {}, selectionChanged() {} }
  } };
};

test.describe('Registration & Auth Suite (F3.61 - F3.63)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('zt_onb', '1');
      sessionStorage.setItem('splashDone', '1');
    });
  });

  test('F3.61: consent visible, not pre-checked, submit gated without it', async ({ page }) => {
    await page.goto('/?brand=delivery');
    await page.click('#profileTopBtn');
    const consent = page.locator('#consentBox');
    await expect(consent).toBeVisible();
    await expect(consent).not.toBeChecked(); // 152-ФЗ: согласие действием, не предустановкой
    await page.click('#regBtn');
    await expect(page.locator('.toast', { hasText: 'согласие' })).toBeVisible();
    await consent.check();
    await page.click('#regBtn');
    await expect(page.locator('.toast', { hasText: 'Введите имя' })).toBeVisible();
    expect(await page.locator('#consentRow a').getAttribute('target')).toBe('_blank');
  });

  test('auth modal resets consent and OTP mode after close/reopen', async ({ page }) => {
    await page.route('**/api/auth/request-otp', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    );
    await page.goto('/?brand=delivery');
    await page.click('#profileTopBtn');

    const consent = page.locator('#consentBox');
    await consent.check();
    await page.click('#toLogin');
    // OTP mode is entered only after a valid phone passes client-side validation.
    await page.fill('#logPhone', '+7 999 123-45-67');
    await page.click('#otpBtn');
    await expect(page.locator('#logOtpWrap')).toBeVisible();

    await page.evaluate(() => window.closeAuth());
    await page.click('#profileTopBtn');
    await expect(consent).not.toBeChecked();

    await page.click('#toLogin');
    await expect(page.locator('#logPinRow')).toBeVisible();
    await expect(page.locator('#logOtpWrap')).toBeHidden();
    await expect(page.locator('#otpBackRow')).toBeHidden();
    await expect(page.locator('#logBtn')).toHaveText('Войти');
  });

  test('closing auth modal keeps Telegram registration polling and completes login in background', async ({ page }) => {
    let markCheckStarted;
    let resolveCheck;
    const checkStarted = new Promise((resolve) => { markCheckStarted = resolve; });
    await page.route('**/api/orders/mine', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ orders: [] })
    }));

    await page.route('**/api/auth/request-reg-otp', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    );
    await page.route('**/api/auth/check-reg*', (route) => {
      markCheckStarted();
      return new Promise((resolve) => {
        resolveCheck = async () => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              confirmed: true,
              token: 'stale-registration-token',
              customer: { name: 'Stale Registration' }
            })
          });
          resolve();
        };
      });
    });

    await page.goto('/?brand=delivery');
    await page.click('#profileTopBtn');
    await page.fill('#regName', 'Test Customer');
    await page.fill('#regPhone', '+7 999 123-45-67');
    await page.check('#consentBox');
    await page.click('#regTgBtn');

    await checkStarted;
    await page.evaluate(() => window.closeAuth());
    resolveCheck();

    await expect.poll(() => page.evaluate(() => window.me && window.me.name)).toBe('Stale Registration');
    await expect(page.locator('#authModal')).not.toHaveClass(/show/);
    expect(await page.evaluate(() => localStorage.getItem('zt_user'))).toBe('stale-registration-token');
  });

  test('auth-session owns persisted user state and clears it centrally', async ({ page }) => {
    // The app starts chat/profile requests in the background. Their auth responses
    // must not invalidate this test's deliberately synthetic session token.
    await page.route('**/api/**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{}'
    }));
    await page.goto('/?brand=delivery');
    await page.waitForFunction(() => typeof window.setUser === 'function' && window.setUser.__deepWrap === 1);

    await page.evaluate(() => window.setUser('session-test-token', { name: 'Session Test' }));
    await expect.poll(() => page.evaluate(() => localStorage.getItem('zt_user'))).toBe('session-test-token');
    await expect.poll(() => page.evaluate(() => window.me && window.me.name)).toBe('Session Test');
    expect(await page.evaluate(() => window.setUser.__deepWrap)).toBe(1);

    const afterSet = await page.evaluate(() => ({
      token: window.USER_TOKEN,
      storedToken: localStorage.getItem('zt_user'),
      customerName: window.me && window.me.name,
      avatar: document.getElementById('profileTopBtn').textContent
    }));
    expect(afterSet).toEqual({
      token: 'session-test-token',
      storedToken: 'session-test-token',
      customerName: 'Session Test',
      avatar: 'S'
    });

    await page.evaluate(() => window.setUser(null, null));
    await expect.poll(() => page.evaluate(() => localStorage.getItem('zt_user'))).toBeNull();
    const afterReset = await page.evaluate(() => ({
      token: window.USER_TOKEN,
      storedToken: localStorage.getItem('zt_user'),
      customer: window.me
    }));
    expect(afterReset).toEqual({ token: null, storedToken: null, customer: null });
  });

  test('role hint storage failure does not invalidate staff sessions', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('zt_user', 'role-cache-test-token');
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === 'zt_role') throw new DOMException('Storage quota exceeded', 'QuotaExceededError');
        return setItem.call(this, key, value);
      };
    });
    await page.route('**/api/**', async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      const body = pathname === '/api/me'
        ? { customer: { id: 1, name: 'Role Cache Admin', role: 'admin', qr: 'role-cache-test' } }
        : { ok: true, items: [], orders: [], pending: [], customers: [], threads: [], messages: [], promos: [] };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });

    await page.goto('/?brand=delivery');
    await page.waitForFunction(() => document.documentElement.hasAttribute('data-staff-ready'));
    expect(await page.evaluate(() => ({
      token: window.USER_TOKEN,
      role: window.me && window.me.role,
      staffRole: document.documentElement.getAttribute('data-staff-role'),
      cachedRole: localStorage.getItem('zt_role')
    }))).toEqual({
      token: 'role-cache-test-token',
      role: 'admin',
      staffRole: 'admin',
      cachedRole: null
    });

    await page.evaluate(() => window.setUser('next-session-token', { name: 'Role Cache Admin', role: 'admin' }));
    expect(await page.evaluate(() => ({
      token: window.USER_TOKEN,
      role: window.me && window.me.role,
      staffRole: document.documentElement.getAttribute('data-staff-role')
    }))).toEqual({
      token: 'next-session-token',
      role: 'admin',
      staffRole: 'admin'
    });
  });

  test('set PIN modal preserves claim and manage modes', async ({ page }) => {
    await page.goto('/?brand=delivery');

    const modal = page.locator('#setPinModal');
    const otpAlternative = page.locator('#setPinOtp');

    await page.evaluate(() => window.openSetPin('claim', '+7 999 123-45-67'));
    await expect(modal).toHaveClass(/show/);
    await expect(modal.locator('.msub')).toContainText('до введения PIN');
    await expect(otpAlternative).toBeVisible();

    await page.click('#setPinClose');
    await expect(modal).not.toHaveClass(/show/);

    await page.evaluate(() => window.openSetPin('manage', ''));
    await expect(modal).toHaveClass(/show/);
    await expect(modal.locator('.msub')).toContainText('смените PIN');
    await expect(otpAlternative).toBeHidden();

    await page.fill('#setPinInput', '12x4');
    await page.click('#setPinGo');
    await expect(page.locator('.toast', { hasText: 'PIN — ровно 4 цифры' })).toBeVisible();
  });

  test('F3.62: consent stays visible in Telegram Mini App', async ({ page }) => {
    await page.route('https://telegram.org/**', (r) => r.abort()); // реальный telegram-web-app.js затирает заглушку
    await page.addInitScript(TG_STUB);
    await page.goto('/?src=tg&brand=delivery');
    await page.click('#profileTopBtn');
    await expect(page.locator('#authModal')).toHaveClass(/tg-mode/);
    await expect(page.locator('#consentBox')).toBeVisible();
  });

  test('F3.63: TMA chain needPhone → needBotConfirm → token', async ({ page }) => {
    // В CI есть интернет: настоящий telegram-web-app.js подменяет window.Telegram, и его openTelegramLink
    // уводит страницу на t.me. Блокируем скрипт, остаётся только наша заглушка.
    await page.route('https://telegram.org/**', (r) => r.abort());
    await page.addInitScript(TG_STUB);
    // Ветка выбирается по телу запроса, а не по номеру вызова: автологин может дёрнуть tg-link не один раз.
    let botAsked = false;
    await page.route('**/api/auth/tg-link', async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      const body = route.request().postDataJSON();
      if (!body.phone) {
        return route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ needPhone: true, tgUser: { id: 1, name: 'Tg User' } }) });
      }
      if (!botAsked) {
        botAsked = true;
        return route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ needBotConfirm: true, tgUrl: 'https://t.me/test_bot?start=reg_abc' }) });
      }
      const reg = await page.request.post('/api/auth/register', {
        data: { name: body.name, phone: body.phone, pin: body.pin || '1234', consent: 1 } });
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(await reg.json()) });
    });
    await page.goto('/?src=tg&brand=delivery');
    await page.click('#profileTopBtn');
    await expect(page.locator('#regName')).toHaveValue('Tg User');
    await page.fill('#regPhone', '+7 9' + String(Date.now()).slice(-9));
    await page.fill('#regPin', '1234');
    await page.check('#consentBox'); // 152-ФЗ: без галочки регистрация в TMA не уходит на сервер
    await page.click('#regBtn');
    await expect(page.locator('.toast', { hasText: 'Подтвердите номер в боте' })).toBeVisible();
    await page.click('#regBtn');
    await page.waitForFunction(() => !!window.me && window.me.name === 'Tg User', null, { timeout: 10000 });
  });

  test('cross-tab logout clears the cached staff hint even when the role key remains', async ({ browser }) => {
    const context = await browser.newContext();
    const firstTab = await context.newPage();
    await firstTab.goto('/?brand=delivery');
    await firstTab.waitForFunction(() => typeof window.setUser === 'function');

    await firstTab.evaluate(() => {
      window.USER_TOKEN = 'stale-in-memory-token';
      localStorage.setItem('zt_user', 'stale-in-memory-token');
      localStorage.setItem('zt_role', 'admin');
      document.documentElement.setAttribute('data-staff-role', 'admin');
    });

    const secondTab = await context.newPage();
    await secondTab.route('**/*', (route) => route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><html><head></head><body>storage source</body></html>'
    }));
    await secondTab.goto('/');
    await secondTab.evaluate(() => localStorage.removeItem('zt_user'));

    await expect.poll(() => firstTab.evaluate(() => ({
      hint: document.documentElement.getAttribute('data-staff-role'),
      cachedRole: localStorage.getItem('zt_role')
    }))).toEqual({ hint: null, cachedRole: 'admin' });
    await context.close();
  });

});
