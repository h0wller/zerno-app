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
        boxSizing: getComputedStyle(cardEl).boxSizing,
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
    expect(layout.boxSizing).toBe('border-box');
    expect(layout.contentScrollWidth).toBeLessThanOrEqual(layout.contentWidth + 1);

    const telegramCta = card.locator('#regTgBtn');
    await telegramCta.scrollIntoViewIfNeeded();
    await expect(telegramCta).toBeInViewport();
    expect(await telegramCta.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);

    const submit = card.locator('#regBtn');
    if (viewport.height <= 560) {
      await card.hover();
      await page.mouse.wheel(0, 800);
      await expect.poll(() => card.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    }
    // A short landscape form needs multiple scroll gestures; scroll the final CTA
    // into view and assert that the card—not the document—exposes it to the user.
    await submit.scrollIntoViewIfNeeded();
    const submitGeometry = await submit.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        top: rect.top,
        bottom: rect.bottom,
        viewportHeight: window.innerHeight,
        cardScrollTop: element.closest('.authcard').scrollTop,
        cardScrollHeight: element.closest('.authcard').scrollHeight,
        cardClientHeight: element.closest('.authcard').clientHeight,
      };
    });
    expect(submitGeometry.top, JSON.stringify(submitGeometry)).toBeGreaterThanOrEqual(-1);
    expect(submitGeometry.bottom, JSON.stringify(submitGeometry)).toBeLessThanOrEqual(submitGeometry.viewportHeight + 1);
    if (viewport.height <= 560) {
      expect(submitGeometry.cardScrollTop, JSON.stringify(submitGeometry)).toBeGreaterThan(0);
    }
    await expect(submit).toBeInViewport();
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
    trigger.style.cssText = 'position:fixed;top:8px;left:8px;z-index:2000;';
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

  const benefit = page.locator('#authModal .msub');
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
  await expect(benefit).toContainText('Войдите по номеру телефона');
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
    trigger.style.cssText = 'position:fixed;top:8px;left:8px;z-index:2000;';
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

test('auth modal explains the coffee stamp card before registration and avoids a gift promise during login', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    sessionStorage.setItem('splashDone', '1');
  });
  await page.goto('/?brand=coffee');
  await page.waitForFunction(() => typeof window.openAuth === 'function');

  const subtitle = page.locator('#authModal .msub');
  await page.evaluate(() => window.openAuth(false));
  await expect(subtitle).toContainText('Сначала создайте профиль');
  await expect(subtitle).toContainText('После подтверждения номера');
  await expect(subtitle).toContainText('10 штампов дают 1 бесплатный кофе');
  await expect(subtitle).toContainText('QR');

  await page.evaluate(() => window.openAuth(true));
  await expect(subtitle).toContainText('Войдите по номеру телефона');
  await expect(subtitle).not.toContainText(/бесплатный кофе|приветственн|начисления сервером/i);
});

test('auth modal explains Friday delivery value in registration and avoids it in login mode', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    sessionStorage.setItem('splashDone', '1');
  });
  await page.goto('/?brand=delivery');
  await page.waitForFunction(() => typeof window.openAuth === 'function');

  const benefit = page.locator('#authModal .msub');
  await page.evaluate(() => window.openAuth(false));
  await expect(benefit).toContainText('Сначала создайте профиль');
  await expect(benefit).toContainText('После подтверждения номера');
  await expect(benefit).toContainText('персональный бонус доставки');
  await expect(benefit).toHaveCSS('max-width', '100%');

  await page.evaluate(() => window.openAuth(true));
  await expect(benefit).toContainText('Войдите по номеру телефона');
  await expect(benefit).not.toContainText(/бесплатн|сервер назначит|корзина/i);
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

  await page.locator('#regPin').focus();
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

test('Telegram Mini App registration subtitle explains native confirmation without cashier instructions', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    sessionStorage.setItem('splashDone', '1');
    window.__isTgMiniApp = true;
    window.__tgInitData = 'signed-mini-app-test-data';
  });
  await page.goto('/?src=tg&brand=delivery');
  await page.waitForFunction(() => typeof window.openAuth === 'function');
  await page.evaluate(() => window.openAuth(false));

  const modal = page.locator('#authModal');
  const subtitle = modal.locator('.msub');
  await expect(modal).toHaveClass(/tg-mode/);
  await expect(subtitle).toContainText('Создайте профиль — подтвердим номер через Telegram');
  await expect(subtitle).not.toContainText(/кассир/i);
});

test('registration offers Telegram and keeps consent compact without SMS controls', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    sessionStorage.setItem('splashDone', '1');
  });

  for (const brand of ['coffee', 'delivery']) {
    await page.goto('/?brand=' + brand);
    await page.waitForFunction(() => typeof window.openAuth === 'function');
    await page.waitForFunction(() => {
      const link = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
        .find((item) => item.href.includes('160-14-auth-modal.css'));
      return link && link.media === 'all' && Array.from(document.styleSheets)
        .some((sheet) => sheet.href === link.href);
    });
    await page.evaluate(() => window.openAuth(false));

    await expect(page.locator('#regTgBtn')).toBeVisible();
    await expect(page.locator('#regTgBtn')).toHaveText('Войти через Telegram');
    await expect(page.locator('#regTgRow')).toHaveCount(0);
    await expect(page.locator('#regOtpBtn')).toHaveCount(0);
    await expect(page.locator('#regOtpRow')).toHaveCount(0);
    await expect(page.locator('#consentBox')).not.toBeChecked();

    const consentMetrics = await page.locator('#consentRow').evaluate((element) => ({
      fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
      width: element.getBoundingClientRect().width,
      height: element.getBoundingClientRect().height,
      right: element.getBoundingClientRect().right,
      viewportWidth: window.innerWidth,
      text: element.innerText,
    }));
    expect(consentMetrics.fontSize).toBeGreaterThanOrEqual(12);
    expect(consentMetrics.width).toBeLessThanOrEqual(300);
    expect(consentMetrics.right).toBeLessThanOrEqual(consentMetrics.viewportWidth);
    expect(consentMetrics.height).toBeGreaterThanOrEqual(44);
    expect(consentMetrics.text).toContain('персональных данных');
    expect(consentMetrics.text).toContain('Политика конфиденциальности');

    const readRegistrationTokens = () => page.evaluate(() => {
      const tabStyle = getComputedStyle(document.getElementById('toReg'));
      const ctaStyle = getComputedStyle(document.getElementById('regBtn'));
      return {
        tabBackground: tabStyle.backgroundColor,
        ctaBackground: ctaStyle.backgroundColor,
        tabBorder: tabStyle.border,
        ctaBorder: ctaStyle.border,
        tabShadow: tabStyle.boxShadow,
        ctaShadow: ctaStyle.boxShadow,
      };
    });
    await expect.poll(async () => {
      const tokens = await readRegistrationTokens();
      return [tokens.tabBackground, tokens.tabBorder, tokens.tabShadow];
    }).toEqual(await page.locator('#regBtn').evaluate((element) => {
      const style = getComputedStyle(element);
      return [style.backgroundColor, style.border, style.boxShadow];
    }));

    const consentContrast = await page.locator('#consentRow a').evaluate((link) => {
      const parseRgb = (value) => {
        const match = value.match(/[\d.]+/g);
        if (!match || match.length < 3) throw new Error('Unsupported computed color: ' + value);
        return match.slice(0, 3).map(Number);
      };
      const luminance = (value) => {
        const channels = parseRgb(value).map((channel) => {
          const normalized = channel / 255;
          return normalized <= 0.04045 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
      };
      const foreground = luminance(getComputedStyle(link).color);
      const background = luminance(getComputedStyle(link.parentElement.parentElement).backgroundColor);
      return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
    });
    expect(consentContrast).toBeGreaterThanOrEqual(4.5);

    await testInfo.attach('auth-registration-' + brand + '-390x844.png', {
      body: await page.screenshot({ fullPage: false }),
      contentType: 'image/png',
    });

    await page.locator('#toLogin').click();
    await expect.poll(() => page.evaluate(() => {
      const tabStyle = getComputedStyle(document.getElementById('toLogin'));
      const ctaStyle = getComputedStyle(document.getElementById('logBtn'));
      return [tabStyle.backgroundColor, tabStyle.border, tabStyle.boxShadow].join('|') ===
        [ctaStyle.backgroundColor, ctaStyle.border, ctaStyle.boxShadow].join('|');
    })).toBe(true);
  }
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

test('login completes and creates a session when the modal is closed mid-request', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    sessionStorage.setItem('splashDone', '1');
  });
  // Keep the fake login session valid for the profile's follow-up orders request.
  await page.route('**/api/orders/mine', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ orders: [] })
  }));
  let markRequestStarted;
  let releaseRequest;
  const requestStarted = new Promise((resolve) => { markRequestStarted = resolve; });
  const responseGate = new Promise((resolve) => { releaseRequest = resolve; });
  let requestCount = 0;
  await page.route('**/api/auth/login', async (route) => {
    requestCount += 1;
    markRequestStarted();
    await responseGate;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        token: 'auth-modal-login-test',
        customer: { id: 888889, name: 'Auth Login Test' }
      })
    });
  });
  await page.goto('/?brand=delivery');
  await page.waitForFunction(() => typeof window.openAuth === 'function');
  await page.evaluate(() => window.openAuth(true));
  await page.locator('#logPhone').fill('+79001234567');
  await page.locator('#logPin').fill('1234');
  await page.locator('#logBtn').click();
  await requestStarted;
  await expect(page.locator('#logBtn')).toBeDisabled();

  await page.evaluate(() => window.closeAuth());
  releaseRequest();
  await expect.poll(() => page.evaluate(() => window.me && window.me.name)).toBe('Auth Login Test');
  await expect(page.locator('#authModal')).not.toHaveClass(/show/);
  expect(requestCount).toBe(1);
});

test('Telegram login code request completes after the auth modal is closed', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    sessionStorage.setItem('splashDone', '1');
  });
  let markRequestStarted;
  let releaseRequest;
  const requestStarted = new Promise((resolve) => { markRequestStarted = resolve; });
  const responseGate = new Promise((resolve) => { releaseRequest = resolve; });
  await page.route('**/api/auth/request-otp', async (route) => {
    markRequestStarted();
    await responseGate;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });
  await page.goto('/?brand=delivery');
  await page.waitForFunction(() => typeof window.openAuth === 'function');
  await page.evaluate(() => window.openAuth(true));
  await page.locator('#logPhone').fill('+79001234567');
  await page.locator('#otpBtn').click();
  await requestStarted;

  await page.evaluate(() => window.closeAuth());
  releaseRequest();
  await page.waitForFunction(() => document.getElementById('logOtpWrap').style.display !== 'none');
  await page.evaluate(() => window.openAuth(true));
  await expect(page.locator('#logOtp')).toBeVisible();
  await expect(page.locator('#logOtpHint')).toContainText('Код отправлен в Telegram');
  await expect(page.locator('#otpBtn')).toBeEnabled();
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
  await expect(regPin).toBeFocused();
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

test('registration completes and creates a session when the modal is closed mid-request', async ({ page }) => {
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
  await page.route('**/api/me/free-delivery', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ code: null })
  }));
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    sessionStorage.setItem('splashDone', '1');
  });
  await page.route('**/api/orders/mine', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ orders: [] })
  }));
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
        customer: { id: 888888, name: 'Auth Modal Test', role: 'guest', verified: 0 }
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
  await page.evaluate(() => window.closeAuth());
  await expect(page.locator('#authModal')).not.toHaveClass(/show/);
  releaseRequest();
  await expect.poll(() => page.evaluate(() => window.me && window.me.name)).toBe('Auth Modal Test');
  await expect.poll(() => page.evaluate(() => window.me && Number(window.me.verified))).toBe(0);
  await expect(page.locator('#authModal')).not.toHaveClass(/show/);
  expect(requestCount).toBe(1);
});

test('registration never exposes SMS controls even when the server opts in', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let registrationSmsRequests = 0;
  await page.route('**/api/config', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ tgUsername: 'test_bot', smsAuthEnabled: true }),
  }));
  await page.route('**/api/auth/request-reg-otp', async (route) => {
    registrationSmsRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, via: 'sms' }),
    });
  });
  await page.route('**/api/auth/request-otp', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true }),
  }));
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    sessionStorage.setItem('splashDone', '1');
  });

  await page.goto('/?brand=coffee');
  await page.waitForFunction(() => window.SMS_AUTH_ENABLED === true);
  await page.evaluate(() => window.openAuth(false));

  await expect(page.locator('#regTgBtn')).toBeVisible();
  await expect(page.locator('#regTgBtn')).toHaveText('Войти через Telegram');
  await expect(page.locator('#regOtpBtn')).toHaveCount(0);
  await expect(page.locator('#regOtpRow')).toHaveCount(0);
  await expect(page.locator('#regOtp')).toHaveCount(0);
  await page.locator('#toLogin').click();
  await expect(page.locator('#otpBtn')).toContainText('получить код');
  await expect(page.locator('#otpBtn')).not.toContainText('SMS');
  await expect(page.locator('#logOtp')).toHaveAttribute('aria-describedby', 'logOtpHint');

  await page.locator('#logPhone').fill('+7 999 123-45-67');
  await page.locator('#otpBtn').click();
  await expect(page.locator('#logOtp')).toBeVisible();
  expect(registrationSmsRequests).toBe(0);
});

test('reduced motion removes auth overlay travel without changing focus or layout', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    sessionStorage.setItem('splashDone', '1');
  });

  const viewports = [
    { name: 'portrait', width: 390, height: 844 },
    { name: 'compact-landscape', width: 844, height: 390 },
    { name: 'desktop', width: 1280, height: 900 },
  ];

  for (const brand of ['coffee', 'delivery']) {
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/?brand=' + brand);
      await page.waitForFunction(() => typeof window.openAuth === 'function');
      await page.waitForFunction(() => {
        const names = ['90-modals.css', '160-14-auth-modal.css'];
        return names.every((name) => {
          const link = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
            .find((item) => item.href.includes(name));
          return link && link.media === 'all' && Array.from(document.styleSheets)
            .some((sheet) => sheet.href === link.href);
        });
      });

      await page.evaluate(() => {
        const trigger = document.createElement('button');
        trigger.id = 'reducedMotionAuthTrigger';
        trigger.type = 'button';
        trigger.textContent = 'Open account';
        trigger.style.cssText = 'position:fixed;top:8px;left:8px;z-index:99999;opacity:0;';
        trigger.addEventListener('click', () => window.openAuth(false));
        document.body.appendChild(trigger);
      });

      const trigger = page.locator('#reducedMotionAuthTrigger');
      const modal = page.locator('#authModal');
      const card = modal.locator('.modal-card');
      const overlay = page.locator('#overlay');

      await trigger.click();
      await expect(modal).toBeVisible();
      await expect(modal).toHaveAttribute('role', 'dialog');
      await expect(modal).toHaveAttribute('aria-modal', 'true');
      await expect(modal.locator('#regName')).toBeFocused();
      await expect(overlay).toHaveAttribute('aria-hidden', 'false');
      await expect(overlay).toHaveCSS('opacity', '1');

      await expect.poll(() => overlay.evaluate((element) => getComputedStyle(element).transitionDuration))
        .toBe('0s');
      await expect.poll(() => card.evaluate((element) => {
        const duration = getComputedStyle(element).transitionDuration.split(',')[0].trim();
        const value = Number.parseFloat(duration);
        return duration.endsWith('ms') ? value / 1000 : value;
      })).toBeLessThanOrEqual(0.00001);

      const openImage = await page.screenshot({ fullPage: false });
      await testInfo.attach('auth-reduced-' + brand + '-' + viewport.name + '-open.png', {
        body: openImage,
        contentType: 'image/png',
      });

      await page.keyboard.press('Escape');
      await expect(modal).not.toHaveClass(/show/);
      await expect(trigger).toBeFocused();
      await expect(overlay).toHaveAttribute('aria-hidden', 'true');
      await expect(overlay).toHaveCSS('pointer-events', 'none');
      await expect(overlay).toHaveCSS('opacity', '0');

      const closedImage = await page.screenshot({ fullPage: false });
      await testInfo.attach('auth-reduced-' + brand + '-' + viewport.name + '-closed.png', {
        body: closedImage,
        contentType: 'image/png',
      });
    }
  }
});

test('PIN error feedback and fullscreen QR are static under reduced motion', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    sessionStorage.setItem('splashDone', '1');
  });
  await page.goto('/?brand=delivery');
  await page.waitForFunction(() =>
    typeof window.openPin === 'function' && typeof window.openQRFull === 'function'
  );
  await page.evaluate(() => window.openPin());
  const pinInput = page.locator('#pinInput');
  await expect(page.locator('#pinModal')).toHaveClass(/show/);
  await pinInput.evaluate((element) => element.classList.add('err'));
  await expect(pinInput).toHaveCSS('animation-name', 'none');
  await expect(pinInput).toHaveCSS('animation-duration', '0s');
  await testInfo.attach('pin-error-reduced-delivery-390x844.png', {
    body: await page.screenshot({ fullPage: false }),
    contentType: 'image/png',
  });

  await page.evaluate(() => {
    window.closePin();
    window.me = { name: 'Motion Test', phone: '+70000000000', qr: 'motion-test', stamps: 0, free: 0 };
    window.openQRFull();
  });
  const qrModal = page.locator('#qrModal');
  const qrCanvas = page.locator('#qrFull');
  await expect(qrModal).toHaveClass(/show/);
  await expect(qrCanvas).toHaveCSS('animation-name', 'none');
  await expect(qrCanvas).toHaveCSS('animation-duration', '0s');
  await expect(qrModal.locator('.qrcard')).toHaveCSS('transition-duration', '0s');
  await testInfo.attach('fullscreen-qr-reduced-delivery-390x844.png', {
    body: await page.screenshot({ fullPage: false }),
    contentType: 'image/png',
  });
  await page.evaluate(() => window.closeQRFull());
});

test('generic modal and shared overlay are immediate under reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    sessionStorage.setItem('splashDone', '1');
  });
  await page.goto('/?brand=coffee');
  await page.waitForFunction(() => typeof window.syncOverlay === 'function');
  await page.evaluate(() => {
    document.getElementById('emModal').classList.add('show');
    window.syncOverlay();
  });

  const modal = page.locator('#emModal');
  const card = modal.locator('.modal-card');
  const overlay = page.locator('#overlay');
  await expect(modal).toHaveClass(/show/);
  await expect(card).toBeVisible();
  await expect(overlay).toHaveClass(/show/);
  await expect(overlay).toHaveAttribute('aria-hidden', 'false');
  await expect(overlay).toHaveCSS('transition-duration', '0s');
  await expect(card).toHaveCSS('transition-duration', '0s');

  await page.evaluate(() => {
    document.getElementById('emModal').classList.remove('show');
    window.syncOverlay();
  });
  await expect(overlay).toHaveAttribute('aria-hidden', 'true');
  await expect(overlay).toHaveCSS('pointer-events', 'none');
});

test('confetti does not start or keep running under reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    sessionStorage.setItem('splashDone', '1');
  });
  await page.goto('/?brand=coffee');
  await page.waitForFunction(() => typeof window.confetti === 'function');

  await page.evaluate(() => {
    const canvas = document.getElementById('fx');
    const getContext = canvas.getContext.bind(canvas);
    window.__confettiContextCalls = 0;
    canvas.getContext = function (...args) {
      window.__confettiContextCalls += 1;
      return getContext(...args);
    };
    window.confetti();
  });

  await expect.poll(() => page.evaluate(() => window.__confettiContextCalls)).toBe(0);
});

test('active confetti loop stops on a live switch to reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    sessionStorage.setItem('splashDone', '1');
  });
  await page.goto('/?brand=coffee');
  await page.waitForFunction(() => typeof window.confetti === 'function');
  await page.evaluate(() => {
    window.__motionRafCalls = 0;
    window.__motionRafCallback = null;
    window.requestAnimationFrame = (callback) => {
      window.__motionRafCalls += 1;
      window.__motionRafCallback = callback;
      return window.__motionRafCalls;
    };
    window.confetti();
  });
  expect(await page.evaluate(() => window.__motionRafCalls)).toBe(1);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => window.__motionRafCallback());
  expect(await page.evaluate(() => window.__motionRafCalls)).toBe(1);
});

test('confetti cancels its active frame and clears the canvas while the document is hidden', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    sessionStorage.setItem('splashDone', '1');
  });
  await page.goto('/?brand=coffee');
  await page.waitForFunction(() => typeof window.confetti === 'function');

  await page.evaluate(() => {
    let visibility = 'visible';
    const pendingFrames = new Map();
    let nextFrameId = 0;
    window.__pendingConfettiFrames = pendingFrames;
    window.__cancelledAnimationFrames = [];
    window.__confettiClearCalls = 0;
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibility
    });
    window.requestAnimationFrame = (callback) => {
      const id = ++nextFrameId;
      pendingFrames.set(id, callback);
      return id;
    };
    window.cancelAnimationFrame = (id) => {
      window.__cancelledAnimationFrames.push(id);
      pendingFrames.delete(id);
    };

    const context = {
      clearRect: () => { window.__confettiClearCalls += 1; },
      save: () => {},
      translate: () => {},
      rotate: () => {},
      fillRect: () => {},
      restore: () => {},
      set fillStyle(_value) {}
    };
    document.getElementById('fx').getContext = () => context;
    window.__setConfettiVisibility = (next) => {
      visibility = next;
      document.dispatchEvent(new Event('visibilitychange'));
    };
    window.confetti();
    window.__confettiFrameId = Array.from(pendingFrames.keys())[0];
  });

  const confettiFrameId = await page.evaluate(() => window.__confettiFrameId);
  expect(confettiFrameId).toBeTruthy();
  expect(await page.evaluate(() => window.__pendingConfettiFrames.size)).toBe(1);

  await page.evaluate(() => window.__setConfettiVisibility('hidden'));
  const cancellation = await page.evaluate(() => ({
    cancelled: window.__cancelledAnimationFrames,
    pending: Array.from(window.__pendingConfettiFrames.keys()),
    frameId: window.__confettiFrameId
  }));
  expect(cancellation.cancelled).toContain(confettiFrameId);
  expect(cancellation.pending).not.toContain(confettiFrameId);
  expect(await page.evaluate(() => window.__confettiClearCalls)).toBeGreaterThanOrEqual(2);

  const pendingBeforeHiddenConfetti = await page.evaluate(() => Array.from(window.__pendingConfettiFrames.keys()));
  await page.evaluate(() => window.confetti());
  expect(await page.evaluate(() => Array.from(window.__pendingConfettiFrames.keys()))).toEqual(pendingBeforeHiddenConfetti);

  await page.evaluate(() => window.__setConfettiVisibility('visible'));
  const framesBeforeExplicitRestart = await page.evaluate(() => Array.from(window.__pendingConfettiFrames.keys()));
  await page.evaluate(() => window.confetti());
  const framesAfterExplicitRestart = await page.evaluate(() => Array.from(window.__pendingConfettiFrames.keys()));
  expect(framesAfterExplicitRestart.filter((id) => !framesBeforeExplicitRestart.includes(id))).toHaveLength(1);
});

test('ambient service hints stop pulsing and entering under reduced motion', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    sessionStorage.setItem('splashDone', '1');
  });
  await page.goto('/?brand=coffee');
  await page.waitForFunction(() => {
    const link = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .find((item) => item.href.includes('130-service.css'));
    return link && link.media === 'all' && Array.from(document.styleSheets)
      .some((sheet) => sheet.href === link.href);
  });

  await page.evaluate(() => {
    const host = document.createElement('div');
    host.id = 'motionAmbientFixtures';
    host.innerHTML = [
      '<div class="mbonus"><span class="mb-free">Подарок</span></div>',
      '<button type="button" class="demoBtn glow">Подсказка</button>',
      '<span class="ava pulse-hint">A</span>',
      '<div class="pushHint">Подсказка</div>',
      '<div class="freeBanner">Бесплатная доставка</div>'
    ].join('');
    document.body.appendChild(host);
  });

  const names = await page.evaluate(() => {
    const host = document.getElementById('motionAmbientFixtures');
    const read = (selector) => {
      const style = getComputedStyle(host.querySelector(selector));
      return { animation: style.animationName, transition: style.transitionDuration };
    };
    return {
      gift: read('.mb-free'),
      demo: read('.demoBtn'),
      avatar: read('.ava'),
      pushHint: read('.pushHint'),
      freeBanner: read('.freeBanner'),
      mbonus: read('.mbonus')
    };
  });
  expect(names.gift.animation).toBe('freePulse');
  expect(names.demo.animation).toBe('glowPulse');
  expect(names.avatar.animation).toBe('pulse-hint');
  expect(names.pushHint.animation).toBe('tin');
  expect(names.freeBanner.animation).toBe('rise');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => page.evaluate(() => {
    const host = document.getElementById('motionAmbientFixtures');
    return Array.from(host.querySelectorAll('.mb-free, .demoBtn, .ava, .pushHint, .freeBanner'))
      .map((element) => getComputedStyle(element).animationName);
  })).toEqual(['none', 'none', 'none', 'none', 'none']);
  await expect(page.locator('#motionAmbientFixtures .mbonus')).toHaveCSS('transition-duration', '0s');
});

