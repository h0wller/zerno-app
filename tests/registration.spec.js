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

  test('guest employee access remains available as a discreet profile link', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('zt_user', 'guest-profile-ui-test-token');
    });
    await page.route('**/api/**', async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      const body = pathname === '/api/me'
        ? {
            customer: {
              id: 'guest-ui-test',
              name: 'Guest UI Test',
              phone: '+7 999 100-00-00',
              role: 'guest',
              cups: 0,
              stamps: 0,
              free: 0,
              history: [],
              qr: 'guest-ui-test'
            }
          }
        : { ok: true, items: [], orders: [], pending: [], customers: [], threads: [], msgs: [], promos: [] };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body)
      });
    });

    await page.goto('/?brand=delivery');
    const documentHtml = await page.evaluate(async () => await (await fetch(location.href)).text());
    const settingsCssRefs = documentHtml.match(/\/app\/ui\/theme\/110-panel\.css\?v=\d+/g) || [];
    expect(settingsCssRefs).toHaveLength(2);
    expect(new Set(settingsCssRefs).size).toBe(1);
    await page.waitForFunction(() => window.me && window.me.role === 'guest');
    await page.click('#profileTopBtn');

    const entry = page.locator('#activateBtn');
    const settings = page.locator('#settingsModal');
    await expect(entry).toBeHidden();
    await page.locator('#profileSettingsBtn').click();
    await expect(settings).toHaveClass(/show/);
    await expect(entry).toBeVisible();
    await expect(entry).toHaveText('Доступ сотрудника');
    await expect(entry).toHaveClass(/staff-access-link/);
    await expect(entry).toHaveAttribute('aria-label', 'Открыть вход по коду сотрудника');

    const geometry = await entry.evaluate((element) => ({
      width: element.getBoundingClientRect().width,
      height: element.getBoundingClientRect().height,
      fontSize: getComputedStyle(element).fontSize,
      background: getComputedStyle(element).backgroundColor
    }));
    expect(geometry.width).toBeLessThan(180);
    expect(geometry.height).toBeGreaterThanOrEqual(32);
    expect(geometry.fontSize).toBe('12px');
    expect(geometry.background).toBe('rgba(0, 0, 0, 0)');

    await entry.click();
    await expect(settings).not.toHaveClass(/show/);
    await expect(page.locator('#pinModal')).toHaveClass(/show/);

  });

  test('cashier admin upgrade remains available inside profile settings', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('zt_user', 'cashier-profile-ui-test-token');
    });
    await page.route('**/api/**', async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      const body = pathname === '/api/me'
        ? {
            customer: {
              id: 'cashier-ui-test',
              name: 'Cashier UI Test',
              phone: '+7 999 100-00-01',
              role: 'cashier',
              cups: 0,
              stamps: 0,
              free: 0,
              history: [],
              qr: 'cashier-ui-test'
            }
          }
        : { ok: true, items: [], orders: [], pending: [], customers: [], threads: [], msgs: [], promos: [] };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body)
      });
    });

    await page.goto('/?brand=delivery');
    await page.waitForFunction(() => window.me && window.me.role === 'cashier');
    await page.click('#profileTopBtn');
    await page.locator('#profileSettingsBtn').click();

    const entry = page.locator('#activateBtn');
    await expect(entry).toBeVisible();
    await expect(entry).toHaveText('Повысить до администратора');
    await entry.click();
    await expect(page.locator('#settingsModal')).not.toHaveClass(/show/);
    await expect(page.locator('#pinModal')).toHaveClass(/show/);
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
    await expect(page.locator('.auth-registration-help')).toHaveCount(0);
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

  test.describe('cross-tab storage synchronization without service worker interception', () => {
    test.use({ serviceWorkers: 'block' });

    test('staff catalog replaces the public preload after authentication', async ({ page }) => {
      let releasePublicMenu;
      let markPublicRequested;
      let markStaffRequested;
      const publicRequested = new Promise((resolve) => { markPublicRequested = resolve; });
      const staffRequested = new Promise((resolve) => { markStaffRequested = resolve; });
      const publicMenuGate = new Promise((resolve) => { releasePublicMenu = resolve; });
      let staffRequestCount = 0;

      await page.addInitScript(() => {
        localStorage.setItem('zt_user', 'catalog-race-test-token');
        localStorage.setItem('zt_role', 'admin');
      });

      await page.route('**/api/**', async (route) => {
        const pathname = new URL(route.request().url()).pathname;
        if (pathname === '/api/me') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ customer: { id: 900003, name: 'Catalog Admin', role: 'admin' } })
          });
          return;
        }
        if (pathname === '/api/dmenu') {
          markPublicRequested();
          await publicMenuGate;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              items: [{ id: 900004, name: 'Public item', section: 'delivery', cat: 'pizza', price: 500, on: 1, opts: [], comp: [] }]
            })
          });
          return;
        }
        if (pathname === '/api/menu/all') {
          staffRequestCount += 1;
          markStaffRequested();
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              items: [
                { id: 900004, name: 'Public item', section: 'delivery', cat: 'pizza', price: 500, on: 1, opts: [], comp: [] },
                { id: 900005, name: 'Stopped staff item', section: 'delivery', cat: 'pizza', price: 600, on: 0, opts: [], comp: [] }
              ]
            })
          });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, items: [], orders: [], pending: [], customers: [], threads: [], messages: [], promos: [] })
        });
      });

      await page.goto('/?brand=delivery');
      await publicRequested;
      await expect.poll(() => page.evaluate(() => document.documentElement.hasAttribute('data-staff-ready'))).toBe(true);
      expect(staffRequestCount).toBe(0);

      releasePublicMenu();
      await staffRequested;
      await expect.poll(() => page.evaluate(() => (window.DMENU || []).map((item) => item.id)))
        .toEqual([900004, 900005]);
    });

    test('cross-tab login is revalidated before role adoption and logout clears the session', async ({ page, context }) => {
    let releaseMe;
    let markMeRequested;
    const meRequested = new Promise((resolve) => { markMeRequested = resolve; });
    const meGate = new Promise((resolve) => { releaseMe = resolve; });

    let meRequestCount = 0;
    await context.route('**/api/**', async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname !== '/api/me') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            items: [],
            orders: [],
            pending: [],
            customers: [],
            threads: [],
            messages: [],
            promos: [],
            today: { open: 11, close: 22 },
            schedule: { open: 11, close: 22 },
            days: []
          })
        });
        return;
      }

      meRequestCount += 1;
      markMeRequested();
      await meGate;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          customer: {
            id: 900002,
            name: 'Cross-tab Staff',
            role: 'admin',
            phone: '+70000000002',
            qr: 'cross-tab-staff',
            stamps: 0,
            free: 0,
            cups: 0,
            verified: 1,
            history: []
          }
        })
      });
    });

    await page.goto('/?brand=delivery');
    await page.waitForFunction(() => typeof window.setUser === 'function');
    expect(await page.evaluate(() => ({
      token: localStorage.getItem('zt_user'),
      role: document.documentElement.getAttribute('data-staff-role')
    }))).toEqual({ token: null, role: null });

    const secondTab = await context.newPage();
    await secondTab.route('**/*', (route) => route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><html><head></head><body>storage source</body></html>'
    }));
    await secondTab.goto('/');

    const reload = page.waitForEvent('framenavigated', (frame) => frame === page.mainFrame());
    await secondTab.evaluate(() => {
      localStorage.setItem('zt_role', 'admin');
      localStorage.setItem('zt_user', 'cross-tab-login-token');
    });
    await Promise.all([reload, meRequested]);

    // The guest tab restarts boot() and waits for the server response.
    expect(await page.evaluate(() => document.documentElement.hasAttribute('data-staff-ready'))).toBe(false);
    releaseMe();
    await expect.poll(() => page.evaluate(() => ({
      ready: document.documentElement.hasAttribute('data-staff-ready'),
      role: document.documentElement.getAttribute('data-staff-role'),
      verifiedRole: window.me && window.me.role
    }))).toEqual({ ready: true, role: 'admin', verifiedRole: 'admin' });

    // A role-hint change must also trigger server revalidation, not leave stale staff layout.
    const requestsBeforeRoleChange = meRequestCount;
    await secondTab.evaluate(() => localStorage.removeItem('zt_role'));
    await expect.poll(() => meRequestCount).toBe(requestsBeforeRoleChange + 1);
    await expect.poll(() => page.evaluate(() => ({
      ready: document.documentElement.hasAttribute('data-staff-ready'),
      role: document.documentElement.getAttribute('data-staff-role'),
      verifiedRole: window.me && window.me.role
    }))).toEqual({ ready: true, role: 'admin', verifiedRole: 'admin' });

    // Logout clears the other tab immediately, even while a cached role remains.
    await secondTab.evaluate(() => localStorage.removeItem('zt_user'));
    await expect.poll(() => page.evaluate(() => ({
      token: localStorage.getItem('zt_user'),
      role: document.documentElement.getAttribute('data-staff-role')
    }))).toEqual({ token: null, role: null });
  });
  });

  test('staff activation immediately reveals the role switcher without a reload', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('zt_user', 'guest-to-cashier-token');
    });
    await page.route('**/api/**', async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      let body = { ok: true, items: [], orders: [], pending: [], customers: [], threads: [], msgs: [], promos: [] };
      if (pathname === '/api/me') {
        body = { customer: {
          id: 'guest-to-cashier',
          name: 'Guest To Cashier',
          phone: '+7 999 100-00-02',
          role: 'guest',
          cups: 0, stamps: 0, free: 0, history: [], qr: 'guest-to-cashier'
        } };
      } else if (pathname === '/api/auth/activate') {
        body = { customer: {
          id: 'guest-to-cashier',
          name: 'Guest To Cashier',
          phone: '+7 999 100-00-02',
          role: 'cashier',
          cups: 0, stamps: 0, free: 0, history: [], qr: 'guest-to-cashier'
        } };
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body)
      });
    });

    await page.goto('/?brand=coffee');
    await page.waitForFunction(() => window.me && window.me.role === 'guest');
    await page.evaluate(() => window.openPin());
    await page.fill('#pinInput', 'test-cashier-code');
    await page.click('#pinGo');

    await expect.poll(() => page.evaluate(() => ({
      role: window.me && window.me.role,
      staffRole: document.documentElement.getAttribute('data-staff-role'),
      ready: document.documentElement.hasAttribute('data-staff-ready')
    }))).toEqual({ role: 'cashier', staffRole: 'cashier', ready: true });
    await expect(page.locator('#modeSeg')).toBeVisible();
    await expect(page.locator('#modeSeg [data-mode="cashier"]')).toHaveText('Кассир');
  });

});

test('P0: an existing customer returns to the profile without a repeated welcome offer', async ({ page }) => {
  await page.route('**/api/auth/login', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      token: 'p0-existing-login-token',
      customer: {
        id: 'p0-existing-customer',
        name: 'Existing Guest',
        phone: '+7 900 000-00-06',
        role: 'guest',
        cups: 0,
        stamps: 4,
        free: 0,
        qr: 'Z-P0EXISTING',
        verified: 1,
        welcome: 1,
        tg: 1,
        history: []
      }
    })
  }));
  await page.route('**/api/orders/mine', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ orders: [] })
  }));

  await page.goto('/?brand=coffee');
  await page.waitForFunction(() => typeof window.openAuth === 'function');
  await page.evaluate(() => window.openAuth(true));
  await page.locator('#logPhone').fill('+7 900 000-00-06');
  await page.locator('#logPin').fill('1357');
  await page.locator('#logBtn').click();

  await expect(page.locator('#profileBox')).toBeVisible();
  await expect(page.locator('#toasts .toast').last()).toContainText('С возвращением');
  await expect(page.locator('#toasts .toast').last()).not.toContainText(/приветствен|бонус активирован/i);
});

test('P0: closing auth during the phone registration request preserves the result', async ({ page }) => {
  // This test uses a deliberately fake token. Keep background profile hydration
  // deterministic instead of letting /api/orders/mine invalidate that fixture.
  await page.route('**/api/orders/mine', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ orders: [] })
  }));
  let markStarted;
  let releaseRequest;
  const requestStarted = new Promise((resolve) => { markStarted = resolve; });
  const responseGate = new Promise((resolve) => { releaseRequest = resolve; });

  await page.route('**/api/auth/register', async (route) => {
    markStarted();
    await responseGate;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        token: 'p0-closed-network-token',
        customer: {
          id: 'p0-closed-network',
          name: 'P0 Closed Network',
          phone: '+7 900 000-00-07',
          role: 'guest',
          cups: 0,
          stamps: 0,
          free: 0,
          qr: 'Z-P0NETWORK',
          verified: 0,
          welcome: 0,
          tg: 0,
          history: []
        }
      })
    });
  });

  await page.goto('/?brand=delivery');
  await page.waitForFunction(() => typeof window.openAuth === 'function' && typeof window.__profileMeReady === 'function');
  await page.evaluate(() => { window.__profileMeReady(); window.openAuth(false); });
  await page.locator('#regName').fill('P0 Closed Network');
  await page.locator('#regPhone').fill('+7 900 000-00-07');
  await page.locator('#regPin').fill('1357');
  await page.locator('#consentBox').check();

  const registrationResponse = page.waitForResponse((response) =>
    response.url().endsWith('/api/auth/register') && response.status() === 200
  );
  await page.locator('#regBtn').click();
  await requestStarted;

  await page.evaluate(() => window.closeAuth());
  await expect(page.locator('#authModal')).not.toHaveClass(/show/);
  releaseRequest();
  await registrationResponse;

  await expect.poll(() => page.evaluate(() => window.me && window.me.name), { timeout: 10000 })
    .toBe('P0 Closed Network');
  await expect(page.locator('#verifyNote')).toBeVisible();
  await expect(page.locator('#verifyNote')).toContainText('Профиль не активирован');
  await expect(page.locator('#verifyNote')).toContainText('После активации станут доступны заказы.');
  await expect(page.locator('#authModal')).not.toHaveClass(/show/);
});

test.describe('P0 cashier activation UI', () => {
  test.use({ serviceWorkers: 'block' });
  test('P0: cashier activation validates the code and reports only server-backed benefits', async ({ page }, testInfo) => {
    await page.route('**/api/orders/mine', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ orders: [] })
    }));
    await page.route('**/api/chat/**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({})
    }));
  
    let scenario = { brand: 'coffee', deliveryCode: null };
    let activationCalls = 0;
    await page.route('**/api/auth/activate-guest', async (route) => {
      activationCalls += 1;
      const body = route.request().postDataJSON() || {};
      if (scenario.brand === 'coffee' && body.code !== '2468') {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Неверный код' })
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          customer: {
            id: 'p0-cashier-' + scenario.brand,
            name: 'P0 Cashier Guest',
            phone: '+7 900 000-00-21',
            role: 'guest',
            cups: 0,
            stamps: 0,
            free: scenario.brand === 'coffee' ? 1 : 0,
            qr: 'Z-P0CASHIER',
            verified: 1,
            welcome: scenario.brand === 'coffee' ? 1 : 0,
            tg: 1,
            history: []
          }
        })
      });
    });
    await page.route('**/api/me/free-delivery', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: scenario.deliveryCode })
    }));
  
    const cases = [
      { brand: 'coffee', deliveryCode: null },
      { brand: 'delivery', deliveryCode: null },
      { brand: 'delivery', deliveryCode: 'B1234ABCD' }
    ];
  
    for (const next of cases) {
      scenario = next;
      if (page.url().startsWith('http')) {
        await page.evaluate(() => {
          localStorage.removeItem('zt_user');
          localStorage.removeItem('zt_role');
        });
      }
      await page.goto('/?brand=' + scenario.brand);
      await page.waitForFunction(() =>
        typeof window.setUser === 'function' &&
        typeof window.renderProfile === 'function' &&
        typeof window.renderVerifyNote === 'function' &&
        typeof window.__profileMeReady === 'function'
      );
      await page.evaluate(() => {
        window.__profileMeReady();
        window.setUser('p0-cashier-pending-token', {
          id: 'p0-cashier-pending',
          name: 'P0 Cashier Guest',
          phone: '+7 900 000-00-21',
          role: 'guest',
          cups: 0,
          stamps: 0,
          free: 0,
          qr: 'Z-P0CASHIER',
          verified: 0,
          welcome: 0,
          tg: 0,
          history: []
        });
        window.renderProfile();
        window.renderVerifyNote();
        window.openPanel();
      });
  
      await page.locator('#verifyNote .profile-activation-details summary').click();
      await page.locator('#showCashierCodeBtn').click();
      await expect(page.locator('#actCode')).toBeVisible();
      if (scenario.brand === 'coffee') {
        const beforeInvalid = activationCalls;
        await page.locator('#actCode').fill('12');
        await page.locator('#actBtn').click();
        await expect(page.locator('#toasts .toast').last()).toContainText('4-значный код');
        expect(activationCalls).toBe(beforeInvalid);
  
        await page.locator('#actCode').fill('9999');
        await page.locator('#actBtn').click();
        await expect(page.locator('#toasts .toast').last()).toContainText('Неверный код');
        await expect(page.locator('#actBtn')).toBeEnabled();
  
        await page.locator('#actCode').fill('2468');
        await page.locator('#actBtn').click();
        await expect(page.locator('#verifyNote .profile-loyalty-help')).toBeVisible();
        await expect(page.locator('#actCode')).toHaveCount(0);
        await expect(page.locator('#qrOpenProfile')).toBeVisible();
        await expect(page.locator('#toasts .toast').last()).toContainText('на карте 1 бесплатный кофе');
        await expect(page.locator('#toasts .toast').last()).toContainText('Покажите QR');
        await testInfo.attach('p0-coffee-activation-success.png', {
          body: await page.screenshot({ fullPage: false }),
          contentType: 'image/png'
        });
      } else {
        await page.locator('#actCode').fill('2468');
        await page.locator('#actBtn').click();
        await expect(page.locator('#verifyNote')).toBeHidden();
        await expect(page.locator('#deliveryView')).toBeVisible();
        if (scenario.deliveryCode) {
          await expect(page.locator('#toasts .toast').last()).toContainText('Бесплатная первая доставка доступна');
          await expect(page.locator('#toasts .toast').last()).toContainText('корзине');
          await testInfo.attach('p0-friday-delivery-code-available.png', {
            body: await page.screenshot({ fullPage: false }),
            contentType: 'image/png'
          });
        } else {
          await expect(page.locator('#toasts .toast').last()).toContainText('код бесплатной первой доставки сейчас не назначен');
          await expect(page.locator('#toasts .toast').last()).not.toContainText('первая доставка доступна');
        }
      }
    }
    });
  });

test('P0 registration baseline: capture guest, registration and the separate profile activation state', async ({ page }, testInfo) => {
  test.setTimeout(180000);
  await page.route('**/api/config', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ tgUsername: 'test_bot', smsAuthEnabled: false })
  }));
  await page.route('**/api/orders/mine', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ orders: [] })
  }));
  await page.route('**/api/chat/**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({})
  }));
  await page.route('**/api/auth/register', async (route) => {
    const body = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        token: 'p0-registration-session',
        customer: {
          id: 900001,
          name: body.name,
          phone: body.phone,
          role: 'guest',
          cups: 0,
          stamps: 0,
          free: 0,
          qr: 'Z-P0BASE',
          verified: 0,
          welcome: 0,
          tg: 0,
          history: []
        }
      })
    });
  });
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    sessionStorage.setItem('splashDone', '1');
  });

  const viewports = [
    { width: 320, height: 640 },
    { width: 360, height: 640 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 820, height: 1024 },
    { width: 1440, height: 900 }
  ];
  for (const brand of ['coffee', 'delivery']) {
    for (const viewport of viewports) {
      if (page.url().startsWith('http')) {
        await page.evaluate(() => {
          localStorage.removeItem('zt_user');
          localStorage.removeItem('zt_role');
        });
      }
      await page.setViewportSize(viewport);
      await page.goto('/?brand=' + brand);
      await page.waitForFunction(() =>
        typeof window.openAuth === 'function' &&
        typeof window.renderProfile === 'function' &&
        typeof window.renderVerifyNote === 'function' &&
        typeof window.__profileMeReady === 'function'
      );
      await page.evaluate(() => {
        window.__profileMeReady();
        return document.fonts.ready;
      });

      const prefix = 'p0-registration-' + brand + '-' + viewport.width + 'x' + viewport.height;
      await testInfo.attach(prefix + '-guest.png', {
        body: await page.screenshot({ fullPage: false }),
        contentType: 'image/png'
      });

      await page.evaluate(() => window.openAuth(false));
      await expect(page.locator('#regTgBtn')).toBeVisible();
      await expect(page.locator('#regTgBtn')).toHaveText('Войти через Telegram');
      await expect(page.locator('#regTgRow')).toHaveCount(0);
      await expect(page.locator('#regOtpBtn')).toHaveCount(0);
      await expect(page.locator('#regOtpRow')).toHaveCount(0);
      await testInfo.attach(prefix + '-registration.png', {
        body: await page.screenshot({ fullPage: false }),
        contentType: 'image/png'
      });

      const registrationGeometry = await page.evaluate(() => {
        const card = document.querySelector('#authModal .authcard');
        const consent = document.getElementById('consentRow');
        const submit = document.getElementById('regBtn');
        const regTab = document.getElementById('toReg');
        const loginTab = document.getElementById('toLogin');
        const regPin = document.getElementById('regPin');
        const cardRect = card.getBoundingClientRect();
        const cardStyle = getComputedStyle(card);
        const cardCanScroll = card.scrollHeight > card.clientHeight &&
          ['auto', 'scroll'].includes(cardStyle.overflowY);
        const dimensions = (element) => {
          const rect = element.getBoundingClientRect();
          return { width: rect.width, height: rect.height };
        };
        return {
          horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
          cardFitsOrScrolls: (cardRect.top >= 0 && cardRect.bottom <= window.innerHeight) || cardCanScroll,
          consentFontSize: Number.parseFloat(getComputedStyle(consent).fontSize),
          consent: dimensions(consent),
          submit: dimensions(submit),
          regTab: dimensions(regTab),
          loginTab: dimensions(loginTab),
          regPin: dimensions(regPin),
        };
      });
      expect(registrationGeometry.horizontalOverflow).toBe(false);
      expect(registrationGeometry.cardFitsOrScrolls).toBe(true);
      expect(registrationGeometry.consentFontSize).toBeGreaterThanOrEqual(12);
      expect(registrationGeometry.consent.width).toBeLessThanOrEqual(300);
      for (const target of ['consent', 'submit', 'regTab', 'loginTab', 'regPin']) {
        expect(registrationGeometry[target].width, target + ' hit target width').toBeGreaterThanOrEqual(44);
        expect(registrationGeometry[target].height, target + ' hit target height').toBeGreaterThanOrEqual(44);
      }

      await page.locator('#regPin').focus();
      await expect(page.locator('#regPin')).toBeFocused();
      await page.locator('#regPin').scrollIntoViewIfNeeded();
      await testInfo.attach(prefix + '-registration-pin-focused.png', {
        body: await page.screenshot({ fullPage: false }),
        contentType: 'image/png'
      });

      await page.locator('#consentRow').scrollIntoViewIfNeeded();
      await expect(page.locator('#consentRow')).toBeInViewport();
      await page.locator('#regBtn').scrollIntoViewIfNeeded();
      await expect(page.locator('#regBtn')).toBeInViewport();
      await testInfo.attach(prefix + '-registration-cta-visible.png', {
        body: await page.screenshot({ fullPage: false }),
        contentType: 'image/png'
      });

      const miniAppPage = await page.context().newPage();
      await miniAppPage.setViewportSize(viewport);
      await miniAppPage.route('**/api/config', (route) => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ tgUsername: 'test_bot', smsAuthEnabled: false })
      }));
      await miniAppPage.addInitScript(() => {
        localStorage.setItem('zt_onb', '1');
        sessionStorage.setItem('splashDone', '1');
        window.__isTgMiniApp = true;
        window.__tgInitData = 'mini-app-visual-fixture';
      });
      await miniAppPage.goto('/?src=tg&brand=' + brand);
      await miniAppPage.waitForFunction(() => typeof window.openAuth === 'function');
      await miniAppPage.evaluate(() => window.openAuth(false));
      await expect(miniAppPage.locator('#authModal')).toHaveClass(/tg-mode/);
      await expect(miniAppPage.locator('#authModal .msub')).not.toContainText(/кассир/i);
      await testInfo.attach(prefix + '-mini-app.png', {
        body: await miniAppPage.screenshot({ fullPage: false }),
        contentType: 'image/png'
      });
      await miniAppPage.close();

      await page.locator('#regName').fill('P0 Baseline Guest');
      await page.locator('#regPhone').fill('+7 900 000-00-01');
      await page.locator('#regPin').fill('2580');
      await page.locator('#consentBox').check();
      await page.locator('#regBtn').click();

      await expect(page.locator('#verifyNote')).toBeVisible();
      await expect(page.locator('#verifyNote')).toContainText('Профиль не активирован');
      if (brand === 'delivery') {
        await expect(page.locator('#profileOrdersSection')).toBeHidden();
      } else {
        await expect(page.locator('#profileCoffeeSection')).toBeHidden();
      }
      const activationDetails = page.locator('#verifyNote .profile-activation-details');
      await expect(activationDetails).toBeVisible();
      await expect(activationDetails).not.toHaveAttribute('open', '');
      await expect(page.locator('#verifyNote #actCode')).toBeHidden();
      await testInfo.attach(prefix + '-pending-activation.png', {
        body: await page.screenshot({ fullPage: false }),
        contentType: 'image/png'
      });

      await activationDetails.locator('summary').click();
      await expect(page.locator('#verifyNote #actTgBtn')).toHaveText('Войти через Telegram');
      await expect(page.locator('#verifyNote #showCashierCodeBtn')).toHaveText('Ввести код кассира');
      await expect(page.locator('#verifyNote .profile-activation-details-content')).toContainText('Подтвердите свой номер');
      await testInfo.attach(prefix + '-pending-activation-expanded.png', {
        body: await page.screenshot({ fullPage: false }),
        contentType: 'image/png'
      });

      await page.locator('#showCashierCodeBtn').click();
      await expect(page.locator('#verifyNote #actCode')).toBeVisible();
      await expect(page.locator('#verifyNote #actBtn')).toBeVisible();

      if (viewport.width === 820 || viewport.width === 1440) {
        const pendingGeometry = await page.evaluate(() => {
          const note = document.getElementById('verifyNote');
          const code = document.getElementById('actCode');
          const submit = document.getElementById('actBtn');
          const telegram = document.getElementById('actTgBtn');
          const cashier = document.getElementById('showCashierCodeBtn');
          const noteRect = note.getBoundingClientRect();
          const dimensions = (element) => {
            const rect = element.getBoundingClientRect();
            return { width: rect.width, height: rect.height };
          };
          let hasScrollableAncestor = false;
          for (let node = note.parentElement; node && node !== document.body; node = node.parentElement) {
            const style = getComputedStyle(node);
            if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1) {
              hasScrollableAncestor = true;
              break;
            }
          }
          return {
            horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
            noteFitsOrScrolls:
              (noteRect.top >= 0 && noteRect.bottom <= window.innerHeight) || hasScrollableAncestor,
            noteFitsHorizontally: noteRect.left >= 0 && noteRect.right <= window.innerWidth,
            code: dimensions(code),
            submit: dimensions(submit),
            telegram: dimensions(telegram),
            cashier: dimensions(cashier)
          };
        });

        expect(pendingGeometry.horizontalOverflow).toBe(false);
        expect(pendingGeometry.noteFitsHorizontally).toBe(true);
        expect(pendingGeometry.noteFitsOrScrolls).toBe(true);
        for (const target of ['code', 'submit', 'telegram', 'cashier']) {
          expect(pendingGeometry[target].width, 'pending ' + target + ' hit target width').toBeGreaterThanOrEqual(44);
          expect(pendingGeometry[target].height, 'pending ' + target + ' hit target height').toBeGreaterThanOrEqual(44);
        }
      }

      await testInfo.attach(prefix + '-pending-activation-cashier.png', {
        body: await page.screenshot({ fullPage: false }),
        contentType: 'image/png'
      });
    }
  }
});



test('pending profile opens Telegram and preserves the delivery profile return route', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let activationRequest = null;
  await page.route('**/api/auth/tg-link/request', async (route) => {
    activationRequest = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        tgUrl: 'https://t.me/test_bot?start=activate_' + 'a'.repeat(48),
        expiresAt: new Date(Date.now() + 600000).toISOString()
      })
    });
  });
  await page.route('https://t.me/**', (route) => route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: '<title>Telegram test route</title>'
  }));

  await page.goto('/?brand=delivery');
  await page.waitForFunction(() => typeof window.renderVerifyNote === 'function');
  await page.evaluate(() => {
    localStorage.setItem('zt_user', 'pending-profile-test-session');
    window.brand = 'delivery';
    window.me = {
      id: 987654,
      role: 'guest',
      verified: 0,
      name: 'Pending Profile',
      phone: '+7 900 000-00-01',
      free: 0,
      stamps: 0,
      welcome: 0
    };
    const panel = document.getElementById('panel');
    const profileTab = document.getElementById('pvProfile');
    if (panel) panel.classList.add('open');
    if (profileTab) profileTab.hidden = false;
    window.renderVerifyNote();
  });

  await page.locator('#verifyNote .profile-activation-details summary').click();
  await page.locator('#actTgBtn').click();
  await expect(page).toHaveURL(/https:\/\/t\.me\/test_bot\?start=activate_[a-f0-9]{48}$/);
  expect(activationRequest).toEqual({
    returnTo: '/?brand=delivery&tab=profile'
  });
});


test('registration Telegram CTA completes the signup and returns to the originating brand profile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => { window.Telegram = null; window.__tgInitData = null; });
  let registrationRequest = null;
  let polls = 0;
  await page.route('**/api/auth/request-reg-otp', async (route) => {
    registrationRequest = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        pollToken: 'b'.repeat(64),
        tgUrl: 'https://t.me/test_bot?start=reg_' + 'c'.repeat(32),
        expiresAt: new Date(Date.now() + 600000).toISOString()
      })
    });
  });
  await page.route('**/api/auth/check-reg', async (route) => {
    polls += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(polls === 1
        ? { confirmed: false }
        : {
            confirmed: true,
            token: 'telegram-registration-session',
            customer: {
              id: 'telegram-registration-customer',
              name: 'Telegram Guest',
              phone: '+7 900 000-00-03',
              role: 'guest',
              verified: 1,
              pin: 'configured',
              stamps: 0,
              free: 0,
              cups: 0,
              welcome: 0,
              tg: '900003',
              qr: 'Z-TG-REGISTER'
            }
          })
    });
  });
  await page.context().route('https://t.me/**', (route) => route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: '<title>Telegram registration test</title>'
  }));

  await page.goto('/?brand=delivery&campaign=registration-test#menu');
  await page.waitForFunction(() => typeof window.openAuth === 'function');
  await page.evaluate(() => window.openAuth(false));
  await page.locator('#regName').fill('Telegram Guest');
  await page.locator('#regPhone').fill('+7 900 000-00-03');
  await page.locator('#regPin').fill('2468');
  await page.locator('#consentBox').check();

  const popupPromise = page.waitForEvent('popup');
  await page.locator('#regTgBtn').click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(/https:\/\/t\.me\/test_bot\?start=reg_[a-f0-9]{32}$/);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('zt_user')), { timeout: 10000 })
    .toBe('telegram-registration-session');
  await expect(page.locator('#panel')).not.toHaveClass(/open/);

  expect(registrationRequest).toMatchObject({
    name: 'Telegram Guest',
    phone: '+7 900 000-00-03',
    pin: '2468',
    consent: 1,
    via: 'tg',
    returnTo: '/?brand=delivery&campaign=registration-test#menu'
  });
  expect(registrationRequest.returnTo).not.toContain('auth_token');
});
