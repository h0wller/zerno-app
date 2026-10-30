import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

const viewports = [
  { name: 'coffee desktop', brand: 'coffee', width: 1280, height: 900 },
  { name: 'delivery desktop', brand: 'delivery', width: 1280, height: 900 },
  { name: 'delivery compact phone', brand: 'delivery', width: 360, height: 640 },
  { name: 'coffee landscape phone', brand: 'coffee', width: 844, height: 390 },
];

for (const viewport of viewports) {
  test(`auth modal stays usable: ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.addInitScript(() => {
      localStorage.setItem('zt_onb', '1');
      sessionStorage.setItem('splashDone', '1');
    });

    await page.goto(`/?brand=${viewport.brand}`);
    await page.waitForFunction(() => typeof window.openAuth === 'function');
    await page.waitForFunction(() => {
      const link = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).find((item) =>
        item.href.includes('160-14-auth-modal.css')
      );
      return link && link.media === 'all' && Array.from(document.styleSheets).some((sheet) =>
        sheet.href === link.href
      );
    });

    await page.evaluate(() => window.openAuth(false));
    const modal = page.locator('#authModal');
    const card = modal.locator('.authcard');
    await expect(modal).toBeVisible();
    await expect(modal).toHaveAttribute('role', 'dialog');
    await expect(modal).toHaveAttribute('aria-modal', 'true');
    await expect(modal.locator('.auth-logo')).toHaveCount(0);
    await expect(modal.locator('#authClose')).toHaveCount(0);
    await expect(card.locator('#regName')).toBeVisible();

    await page.waitForFunction(() => {
      const cardEl = document.querySelector('#authModal .authcard');
      return cardEl && getComputedStyle(cardEl).opacity === '1';
    });

    const layout = await page.evaluate(() => {
      const cardEl = document.querySelector('#authModal .authcard');
      const input = document.querySelector('#authModal #regName');
      const rect = (el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
      };
      return {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        documentWidth: document.documentElement.scrollWidth,
        card: rect(cardEl),
        input: rect(input),
        overflowY: getComputedStyle(cardEl).overflowY,
        contentWidth: cardEl.clientWidth,
        contentScrollWidth: cardEl.scrollWidth,
      };
    });

    expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewport.width);
    expect(layout.card.x).toBeGreaterThanOrEqual(-1);
    expect(layout.card.y).toBeGreaterThanOrEqual(-1);
    expect(layout.card.right).toBeLessThanOrEqual(layout.viewport.width + 1);
    expect(layout.card.bottom).toBeLessThanOrEqual(layout.viewport.height + 1);
    expect(layout.input.height).toBeGreaterThanOrEqual(44);
    expect(layout.overflowY).toBe('auto');
    expect(layout.contentScrollWidth).toBeLessThanOrEqual(layout.contentWidth + 1);

    await card.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await expect(card.locator('#regBtn')).toBeInViewport();
  });
}

test('auth modal closes with Escape and restores the invoking control focus', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    sessionStorage.setItem('splashDone', '1');
  });
  await page.goto('/?brand=coffee');
  await page.waitForFunction(() => typeof window.openAuth === 'function');
  await page.evaluate(() => {
    const trigger = document.createElement('button');
    trigger.id = 'authTestTrigger';
    trigger.textContent = 'Open profile';
    trigger.addEventListener('click', () => window.openAuth(false));
    document.body.appendChild(trigger);
  });

  const trigger = page.locator('#authTestTrigger');
  const modal = page.locator('#authModal');
  await trigger.click();
  await expect(page.locator('#regName')).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(modal).not.toHaveClass(/show/);
  await expect(trigger).toBeFocused();
});

test('auth modal traps keyboard focus at its boundaries', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    sessionStorage.setItem('splashDone', '1');
  });
  await page.goto('/?brand=coffee');
  await page.waitForFunction(() => typeof window.openAuth === 'function');
  await page.evaluate(() => window.openAuth(false));

  const modal = page.locator('#authModal');
  const focusable = modal.locator(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  ).filter({ visible: true });
  const firstControl = focusable.first();
  const lastControl = focusable.last();

  await lastControl.focus();
  await page.keyboard.press('Tab');
  await expect(firstControl).toBeFocused();

  await page.keyboard.press('Shift+Tab');
  await expect(lastControl).toBeFocused();
});

test('registration and login tabs stay in sync with the active form and keyboard', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    sessionStorage.setItem('splashDone', '1');
  });
  await page.goto('/?brand=coffee');
  await page.waitForFunction(() => typeof window.openAuth === 'function');
  await page.evaluate(() => window.openAuth(false));

  const registerTab = page.locator('#toReg');
  const loginTab = page.locator('#toLogin');
  await expect(registerTab).toHaveAttribute('type', 'button');
  await expect(loginTab).toHaveAttribute('type', 'button');
  await expect(registerTab).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#regForm')).toBeVisible();
  const registerStyle = await registerTab.evaluate((el) => ({
    background: getComputedStyle(el).backgroundColor,
    color: getComputedStyle(el).color,
  }));
  const loginStyle = await loginTab.evaluate((el) => ({
    background: getComputedStyle(el).backgroundColor,
    color: getComputedStyle(el).color,
  }));
  expect(registerStyle.background).not.toBe(loginStyle.background);
  expect(registerStyle.color).not.toBe(loginStyle.color);

  await page.evaluate(() => window.openAuth(true));
  await expect(loginTab).toHaveAttribute('aria-pressed', 'true');
  await expect(registerTab).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#loginForm')).toBeVisible();
  const activeLoginStyle = await loginTab.evaluate((el) => ({
    background: getComputedStyle(el).backgroundColor,
    color: getComputedStyle(el).color,
  }));
  const inactiveRegisterStyle = await registerTab.evaluate((el) => ({
    background: getComputedStyle(el).backgroundColor,
    color: getComputedStyle(el).color,
  }));
  expect(activeLoginStyle.background).not.toBe(inactiveRegisterStyle.background);
  expect(activeLoginStyle.color).not.toBe(inactiveRegisterStyle.color);

  // Mouse/touch activation must keep the selected tab and visible panel synchronized.
  await registerTab.click();
  await expect(registerTab).toHaveAttribute('aria-pressed', 'true');
  await expect(loginTab).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#regForm')).toBeVisible();
  await expect(page.locator('#loginForm')).toBeHidden();

  await loginTab.click();
  await expect(loginTab).toHaveAttribute('aria-pressed', 'true');
  await expect(registerTab).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#loginForm')).toBeVisible();
  await expect(page.locator('#regForm')).toBeHidden();

  // Arrow keys still switch the active mode.
  await registerTab.focus();
  await page.keyboard.press('ArrowRight');
  await expect(loginTab).toBeFocused();
  await expect(loginTab).toHaveAttribute('aria-pressed', 'true');
  await expect(registerTab).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#loginForm')).toBeVisible();

  await page.keyboard.press('ArrowLeft');
  await expect(registerTab).toBeFocused();
  await expect(registerTab).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#regForm')).toBeVisible();

  // Tab proceeds through both mode buttons before entering the selected form.
  await registerTab.focus();
  await page.keyboard.press('Tab');
  await expect(loginTab).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#regName')).toBeFocused();

  // The login button is also reachable by Tab while registration is active.
  await registerTab.focus();
  await page.keyboard.press('Tab');
  await expect(loginTab).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(loginTab).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#loginForm')).toBeVisible();
  await expect(page.locator('#logPhone')).toBeFocused();
});

test('auth modal closes on backdrop click but stays open for card clicks', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    sessionStorage.setItem('splashDone', '1');
  });
  await page.goto('/?brand=coffee');
  await page.waitForFunction(() => typeof window.openAuth === 'function');
  await page.evaluate(() => {
    const trigger = document.createElement('button');
    trigger.id = 'authBackdropTrigger';
    trigger.textContent = 'Open profile';
    trigger.addEventListener('click', () => window.openAuth(false));
    document.body.appendChild(trigger);
  });

  const trigger = page.locator('#authBackdropTrigger');
  const modal = page.locator('#authModal');
  await trigger.click();
  await expect(modal).toHaveClass(/show/);
  await modal.locator('.authcard').click({ position: { x: 12, y: 12 } });
  await expect(modal).toHaveClass(/show/);
  await modal.click({ position: { x: 2, y: 2 } });
  await expect(modal).not.toHaveClass(/show/);
  await expect(trigger).toBeFocused();
});






test('auth modal keeps the short unified-profile registration benefit visible in both modes', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    sessionStorage.setItem('splashDone', '1');
  });
  await page.goto('/?brand=delivery');
  await page.waitForFunction(() => typeof window.openAuth === 'function');

  const benefit = page.locator('#authModal .msub');
  const expected = 'Единый профиль: напиток в подарок · доставка 0 ₽';

  await page.evaluate(() => window.openAuth(false));
  await expect(benefit).toHaveText(expected);
  await expect(benefit).toHaveCSS('width', '100%');
  await expect(benefit).toHaveCSS('max-width', '100%');
  await page.evaluate(() => window.openAuth(true));
  await expect(benefit).toHaveText(expected);
});

test('auth fields expose mobile autofill and next/done keyboard hints', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    sessionStorage.setItem('splashDone', '1');
  });
  await page.goto('/?brand=delivery');
  await page.waitForFunction(() => typeof window.openAuth === 'function');
  await page.evaluate(() => window.openAuth(false));

  await expect(page.locator('#regName')).toHaveAttribute('autocomplete', 'name');
  await expect(page.locator('#regName')).toHaveAttribute('enterkeyhint', 'next');
  await expect(page.locator('#regPhone')).toHaveAttribute('type', 'tel');
  await expect(page.locator('#regPhone')).toHaveAttribute('autocomplete', 'tel');
  await expect(page.locator('#regPhone')).toHaveAttribute('enterkeyhint', 'next');
  await expect(page.locator('#regPhone')).toHaveAttribute('maxlength', '16');
  expect(await page.locator('#regPhone').evaluate((el) => el.maxLength)).toBe(16);
  await expect(page.locator('#regPin')).toHaveAttribute('enterkeyhint', 'done');

  await page.evaluate(() => window.openAuth(true));
  await expect(page.locator('#logPhone')).toHaveAttribute('type', 'tel');
  await expect(page.locator('#logPhone')).toHaveAttribute('enterkeyhint', 'next');
  await expect(page.locator('#logPhone')).toHaveAttribute('maxlength', '16');
  expect(await page.locator('#logPhone').evaluate((el) => el.maxLength)).toBe(16);
  await expect(page.locator('#logPin')).toHaveAttribute('enterkeyhint', 'done');
  await expect(page.locator('#logOtp')).toHaveAttribute('enterkeyhint', 'done');
});


test('consent checkbox and its full row show a visible keyboard focus indicator', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    sessionStorage.setItem('splashDone', '1');
  });
  await page.goto('/?brand=delivery');
  await page.waitForFunction(() => typeof window.openAuth === 'function');
  await page.evaluate(() => window.openAuth(false));

  const phone = page.locator('#regPhone');
  const checkbox = page.locator('#consentBox');
  const row = page.locator('#consentRow');

  await phone.focus();
  await page.keyboard.press('Tab');
  await expect(checkbox).toBeFocused();

  const focusStyles = await row.evaluate((el) => ({
    outlineStyle: getComputedStyle(el).outlineStyle,
    outlineWidth: getComputedStyle(el).outlineWidth,
    boxShadow: getComputedStyle(el).boxShadow,
  }));
  expect(focusStyles.outlineStyle).toBe('solid');
  expect(focusStyles.outlineWidth).toBe('3px');
  expect(focusStyles.boxShadow).not.toBe('none');
});

test('Telegram registration action uses its own icon instead of the robot emoji', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    sessionStorage.setItem('splashDone', '1');
  });
  await page.goto('/?brand=delivery');
  await page.waitForFunction(() => typeof window.openAuth === 'function');
  await page.evaluate(() => window.openAuth(false));

  const button = page.locator('#regTgBtn');
  const icon = button.locator('.auth-telegram-icon');
  await expect(icon).toHaveAttribute('viewBox', '0 0 24 24');
  await expect(icon).toHaveAttribute('aria-hidden', 'true');
  await expect(button).toContainText('Подтвердить в Telegram · бесплатно');
  expect(await button.innerText()).not.toContain('🤖');
});

test('desktop auth modal scrolls without displaying scrollbar tracks', async ({ browser }) => {
  const context = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
    viewport: { width: 1280, height: 900 },
    isMobile: false,
    hasTouch: false,
    serviceWorkers: 'block',
  });
  const page = await context.newPage();

  try {
    await page.addInitScript(() => {
      localStorage.setItem('zt_onb', '1');
      sessionStorage.setItem('splashDone', '1');
    });
    await page.goto('/?brand=coffee');
    await page.waitForFunction(() => typeof window.openAuth === 'function');
    await page.evaluate(() => window.openAuth(false));

    const card = page.locator('#authModal .authcard');
    await card.evaluate((el) => { el.style.maxHeight = '220px'; });

    const metrics = await page.evaluate(() => {
      const modal = document.getElementById('authModal');
      const cardEl = modal.querySelector('.authcard');
      return {
        desktopPointer: matchMedia('(hover: hover) and (pointer: fine)').matches,
        modalScrollbar: getComputedStyle(modal).scrollbarWidth,
        cardScrollbar: getComputedStyle(cardEl).scrollbarWidth,
        modalOverflow: getComputedStyle(modal).overflowY,
        cardOverflow: getComputedStyle(cardEl).overflowY,
        cardHasOverflow: cardEl.scrollHeight > cardEl.clientHeight,
      };
    });

    expect(metrics.desktopPointer).toBe(true);
    expect(metrics.modalScrollbar).toBe('none');
    expect(metrics.cardScrollbar).toBe('none');
    expect(metrics.modalOverflow).toBe('auto');
    expect(metrics.cardOverflow).toBe('auto');
    expect(metrics.cardHasOverflow).toBe(true);

    await card.hover();
    await page.mouse.wheel(0, 480);
    await expect.poll(() => card.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  } finally {
    await context.close();
  }
});


test('Telegram registration shows request progress, pending status and resets on close', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    sessionStorage.setItem('splashDone', '1');
  });

  let markRequestStarted;
  let releaseRequest;
  const requestStarted = new Promise((resolve) => { markRequestStarted = resolve; });
  const responseGate = new Promise((resolve) => { releaseRequest = resolve; });
  await page.route('**/api/auth/request-reg-otp', async (route) => {
    markRequestStarted();
    await responseGate;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.goto('/?brand=delivery');
  await page.waitForFunction(() => typeof window.openAuth === 'function');
  await page.evaluate(() => window.openAuth(false));
  await page.locator('#regName').fill('Test Customer');
  await page.locator('#regPhone').fill('+7 999 123-45-67');
  await page.locator('#consentBox').check();

  const button = page.locator('#regTgBtn');
  const label = button.locator('span');
  const status = page.locator('#regTgRow');
  await button.click();
  await requestStarted;

  await expect(button).toBeDisabled();
  await expect(button).toHaveAttribute('aria-busy', 'true');
  await expect(label).toHaveText('Отправляем запрос…');

  releaseRequest();
  await expect(button).toBeEnabled();
  await expect(button).not.toHaveAttribute('aria-busy', 'true');
  await expect(label).toHaveText('Отправить повторно в Telegram');
  await expect(status).toBeVisible();
  await expect(status).toHaveAttribute('role', 'status');
  await expect(status).toHaveAttribute('aria-live', 'polite');
  await expect(status).toHaveClass('auth-tg-pending');
  await expect(status).toHaveText('Ожидаем подтверждение в Telegram…');

  await page.evaluate(() => window.closeAuth());
  await expect(status).toBeHidden();
  await expect(button).toBeEnabled();
  await expect(button).not.toHaveAttribute('aria-busy', 'true');
  await expect(label).toHaveText('Подтвердить в Telegram · бесплатно');
});

test('registration consent is placed before Telegram verification and gates its request', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    sessionStorage.setItem('splashDone', '1');
  });

  let requestCount = 0;
  await page.route('**/api/auth/request-reg-otp', async (route) => {
    requestCount += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.goto('/?brand=delivery');
  await page.waitForFunction(() => typeof window.openAuth === 'function');
  await page.evaluate(() => window.openAuth(false));

  const consentRow = page.locator('#consentRow');
  const consent = page.locator('#consentBox');
  const telegramButton = page.locator('#regTgBtn');
  await page.locator('#regName').fill('Test Customer');
  await page.locator('#regPhone').fill('+7 999 123-45-67');
  const consentTop = await consentRow.evaluate((el) => el.getBoundingClientRect().top);
  const telegramTop = await telegramButton.evaluate((el) => el.getBoundingClientRect().top);
  expect(consentTop).toBeLessThan(telegramTop);

  await telegramButton.click();
  await expect(page.locator('.toast', { hasText: 'Сначала подтвердите согласие' })).toBeVisible();
  expect(requestCount).toBe(0);

  await consent.check();
  const request = page.waitForRequest((item) =>
    item.url().includes('/api/auth/request-reg-otp')
  );
  await telegramButton.click();
  const sent = await request;
  expect(sent.postDataJSON()).toMatchObject({
    phone: '+7 999 123-45-67',
    name: 'Test Customer',
    via: 'tg',
  });
  expect(requestCount).toBe(1);
  await page.evaluate(() => window.closeAuth());
});

test('guest menu action is available from registration and login', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    sessionStorage.setItem('splashDone', '1');
  });
  await page.goto('/?brand=delivery');
  await page.waitForFunction(() => typeof window.openAuth === 'function');

  const modal = page.locator('#authModal');
  const skipAuth = page.locator('#skipAuth');

  await page.evaluate(() => window.openAuth(false));
  await expect(page.locator('#regForm')).toBeVisible();
  await expect(skipAuth).toBeVisible();
  await skipAuth.click();
  await expect(modal).not.toHaveClass(/show/);

  await page.evaluate(() => window.openAuth(true));
  await expect(page.locator('#loginForm')).toBeVisible();
  await expect(skipAuth).toBeVisible();
  await skipAuth.click();
  await expect(modal).not.toHaveClass(/show/);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('zt_onb'))).toBe('1');
});


test('Enter skips the consent checkbox while Tab and Space keep it keyboard-accessible', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    sessionStorage.setItem('splashDone', '1');
  });
  await page.goto('/?brand=delivery');
  await page.waitForFunction(() => typeof window.openAuth === 'function');
  await page.evaluate(() => window.openAuth(false));

  const regPhone = page.locator('#regPhone');
  const regPin = page.locator('#regPin');
  const consent = page.locator('#consentBox');

  await regPhone.focus();
  await page.keyboard.press('Enter');
  await expect(regPin).toBeFocused();

  await regPhone.focus();
  await page.keyboard.press('Tab');
  await expect(consent).toBeFocused();
  await page.keyboard.press('Space');
  await expect(consent).toBeChecked();

  await page.evaluate(() => window.openAuth(true));
  const loginPhone = page.locator('#logPhone');
  await loginPhone.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#logPin')).toBeFocused();

  await page.route('**/api/auth/request-otp', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true }),
  }));
  await loginPhone.fill('+7 999 123-45-67');
  await page.locator('#otpBtn').click();
  await expect(page.locator('#logOtp')).toBeVisible();
  await loginPhone.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#logOtp')).toBeFocused();
});

test('switching to and from Telegram code entry moves focus to the active field', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    sessionStorage.setItem('splashDone', '1');
  });
  await page.route('**/auth/request-otp', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true }),
  }));
  await page.goto('/?brand=coffee');
  await page.waitForFunction(() => typeof window.openAuth === 'function');
  await page.evaluate(() => window.openAuth(true));
  await page.locator('#logPhone').fill('+79001234567');
  let markRequestStarted;
  let releaseRequest;
  const requestStarted = new Promise((resolve) => { markRequestStarted = resolve; });
  const responseGate = new Promise((resolve) => { releaseRequest = resolve; });
  await page.unroute('**/auth/request-otp');
  await page.route('**/api/auth/request-otp', async (route) => {
    markRequestStarted();
    await responseGate;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });
  const otpButton = page.locator('#otpBtn');
  await otpButton.click();
  await requestStarted;
  await expect(otpButton).toBeDisabled();
  await expect(otpButton).toHaveAttribute('aria-busy', 'true');
  await expect(otpButton).toHaveText('Отправляем код…');
  releaseRequest();
  await expect(page.locator('#logOtp')).toBeVisible();
  await expect(page.locator('#logOtp')).toBeFocused();
  await expect(page.locator('#logOtpHint')).toContainText('Код отправлен в Telegram');
  await expect(otpButton).toBeEnabled();
  await page.locator('#otpBack').click();
  await expect(page.locator('#logPin')).toBeFocused();
});


test('registration submit exposes a loading state and prevents duplicate requests', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    sessionStorage.setItem('splashDone', '1');
  });
  let markRequestStarted;
  let releaseRequest;
  const requestStarted = new Promise((resolve) => { markRequestStarted = resolve; });
  const responseGate = new Promise((resolve) => { releaseRequest = resolve; });
  let requestCount = 0;
  await page.route('**/api/auth/register', async (route) => {
    requestCount += 1;
    markRequestStarted();
    await responseGate;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        token: 'auth-modal-register-test',
        customer: { id: 888888, name: 'Auth Modal Test', verified: true }
      })
    });
  });
  await page.goto('/?brand=delivery');
  await page.waitForFunction(() => typeof window.openAuth === 'function');
  await page.evaluate(() => window.openAuth(false));
  await page.locator('#regName').fill('Auth Modal Test');
  await page.locator('#regPhone').fill('+79001234567');
  await page.locator('#regPin').fill('1234');
  await page.locator('#consentBox').check();

  const submit = page.locator('#regBtn');
  await submit.click();
  await requestStarted;
  await expect(submit).toBeDisabled();
  await expect(submit).toHaveAttribute('aria-busy', 'true');
  await expect(submit).toHaveText('Создаём профиль…');
  releaseRequest();
  await expect(page.locator('#authModal')).not.toHaveClass(/show/);
  expect(requestCount).toBe(1);
});
