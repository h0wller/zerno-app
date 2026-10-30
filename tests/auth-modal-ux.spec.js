import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

const viewports = [
  { name: 'coffee desktop', brand: 'coffee', width: 1280, height: 900 },
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
    await expect(modal.locator('.auth-kicker')).toHaveText('Единый профиль');
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

test('switching between registration and login moves focus to the active form', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    sessionStorage.setItem('splashDone', '1');
  });
  await page.goto('/?brand=coffee');
  await page.waitForFunction(() => typeof window.openAuth === 'function');
  await page.evaluate(() => window.openAuth(false));

  await page.locator('#toLogin').click();
  await expect(page.locator('#logPhone')).toBeFocused();
  await page.locator('#toReg').click();
  await expect(page.locator('#regName')).toBeFocused();
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


test('auth modal close button restores focus to its invoking control', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    sessionStorage.setItem('splashDone', '1');
  });
  await page.goto('/?brand=coffee');
  await page.waitForFunction(() => typeof window.openAuth === 'function');
  await page.evaluate(() => {
    const trigger = document.createElement('button');
    trigger.id = 'authCloseTrigger';
    trigger.textContent = 'Open profile';
    trigger.addEventListener('click', () => window.openAuth(false));
    document.body.appendChild(trigger);
  });

  const trigger = page.locator('#authCloseTrigger');
  await trigger.click();
  await page.locator('#authClose').click();
  await expect(page.locator('#authModal')).not.toHaveClass(/show/);
  await expect(trigger).toBeFocused();
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
  await page.locator('#otpBtn').click();
  await expect(page.locator('#logOtp')).toBeFocused();
  await page.locator('#otpBack').click();
  await expect(page.locator('#logPin')).toBeFocused();
});
