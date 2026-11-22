import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

async function installWaitingServiceWorker(page, { standalone = true } = {}) {
  await page.addInitScript((isStandalone) => {
    Object.defineProperty(navigator, 'standalone', {
      configurable: true,
      value: isStandalone,
    });
  }, standalone);

  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    sessionStorage.setItem('splashDone', '1');

    const activatedKey = '__test_sw_update_activated';
    const container = new EventTarget();
    const activeController = {
      state: 'activated',
      scriptURL: location.origin + '/sw.js',
    };
    container.controller = activeController;

    const candidate = new EventTarget();
    candidate.state = 'installed';
    candidate.scriptURL = location.origin + '/sw.js';
    candidate.postMessage = function (message) {
      if (!message || message.type !== 'SKIP_WAITING') return;
      sessionStorage.setItem(activatedKey, '1');
      candidate.state = 'activated';
      container.controller = candidate;
      container.dispatchEvent(new Event('controllerchange'));
    };

    const registration = new EventTarget();
    registration.installing = null;
    registration.waiting = sessionStorage.getItem(activatedKey) === '1' ? null : candidate;
    registration.update = () => Promise.resolve();

    const ready = Promise.resolve(registration);
    container.register = () => ready;
    container.getRegistration = () => ready;
    container.ready = ready;

    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: container,
    });
  });
}

test('an update waits for explicit choice and stays visible until dismissed', async ({ page }, testInfo) => {
  await installWaitingServiceWorker(page);

  for (const brand of ['coffee', 'delivery']) {
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto('/?brand=' + brand);

      const dialog = page.getByRole('dialog', { name: 'Доступно обновление' });
      const later = page.getByRole('button', { name: 'Позже' });
      const update = page.getByRole('button', { name: 'Обновить приложение' });

      await expect(dialog).toBeVisible();
      await expect(later).toBeVisible();
      await expect(update).toBeVisible();
      await expect(page.locator('#toasts .toast', { hasText: 'Приложение обновлено' })).toHaveCount(0);

      const buttonSizes = await Promise.all(
        [later, update].map((button) => button.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return { width: rect.width, height: rect.height };
        }))
      );
      expect(buttonSizes.every((size) => size.width > 0 && size.height >= 44)).toBe(true);

      await testInfo.attach(
        'sw-update-' + brand + '-' + viewport.width + 'x' + viewport.height + '.png',
        { body: await page.screenshot({ fullPage: false }), contentType: 'image/png' }
      );

      // A transient toast would have disappeared by now; the update prompt must remain.
      await page.waitForTimeout(3600);
      await expect(dialog).toBeVisible();

      await later.click();
      await expect(dialog).toBeHidden();

      // "Later" postpones this page session. Returning to the app re-offers the waiting update.
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await expect(dialog).toBeVisible();
    }
  }
});

test('does not interrupt an active checkout modal', async ({ page }) => {
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const blocker = document.createElement('div');
      blocker.id = 'sw-update-test-blocker';
      blocker.className = 'modal show';
      document.body.appendChild(blocker);
    }, { once: true });
  });
  await installWaitingServiceWorker(page);
  await page.goto('/?brand=delivery');

  const dialog = page.getByRole('dialog', { name: 'Доступно обновление' });
  await expect(page.locator('#sw-update-test-blocker')).toHaveClass(/show/);
  await expect(dialog).toHaveCount(0);

  await page.evaluate(() => {
    document.getElementById('sw-update-test-blocker').classList.remove('show');
    document.dispatchEvent(new Event('click', { bubbles: true }));
  });
  await expect(dialog).toBeVisible();
});

test('shows the success toast only after activation and reload', async ({ page }) => {
  await installWaitingServiceWorker(page);
  await page.goto('/?brand=coffee');

  await expect(page.getByRole('dialog', { name: 'Доступно обновление' })).toBeVisible();
  await expect(page.locator('#toasts .toast', { hasText: 'Приложение обновлено' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Обновить приложение' }).click();
  await expect(page.locator('#toasts .toast', { hasText: 'Приложение обновлено' })).toBeVisible();
});

test('does not show update dialog in regular browser tabs on desktop or mobile', async ({ page }) => {
  await installWaitingServiceWorker(page, { standalone: false });
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/?brand=coffee');

    await expect(page.getByRole('dialog', { name: 'Доступно обновление' })).toHaveCount(0);
    await page.waitForTimeout(3600);
    await expect(page.getByRole('dialog', { name: 'Доступно обновление' })).toHaveCount(0);
    await expect(page.locator('#toasts .toast', { hasText: 'Приложение обновлено' })).toHaveCount(0);
  }
});

test('new service workers wait until the page sends SKIP_WAITING', async ({ request }) => {
  const response = await request.get('/sw.js');
  expect(response.ok()).toBe(true);
  const source = await response.text();
  const installHandler = source.match(/self\.addEventListener\('install',[\s\S]*?\n\}\);/);

  expect(installHandler).not.toBeNull();
  expect(installHandler[0]).not.toContain('skipWaiting');
  expect(source).toContain("e.data.type === 'SKIP_WAITING'");
});
