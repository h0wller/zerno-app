import { test, expect } from '@playwright/test';

test.describe('PWA update prompt and brand splash', () => {
  test.use({ serviceWorkers: 'block' });

  test('keeps the brand chooser interactive and offers a waiting update after selection', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'standalone', {
        configurable: true,
        value: true
      });

      const waitingWorker = {
        state: 'installed',
        postMessage() {}
      };
      const controller = { state: 'activated' };
      Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: {
          controller,
          register: async () => ({
            waiting: waitingWorker,
            update: async () => {},
            addEventListener() {}
          }),
          addEventListener() {}
        }
      });
    });

    await page.goto('/?splash=1', { waitUntil: 'load' });

    const splash = page.locator('#brandSplashStatic, #brandSplash');
    await expect(splash).toBeVisible();
    await expect(page.locator('.sw-update-dialog')).toHaveCount(0);

    await splash.locator('[data-go="coffee"]').click();

    await expect(page.locator('html')).toHaveAttribute('data-brand', 'coffee');
    await expect(page.locator('#brandSplashStatic, #brandSplash')).toHaveCount(0);
    await expect(page.locator('.sw-update-dialog')).toBeVisible();
    await expect(page.locator('[data-sw-update-accept]')).toBeVisible();
  });
});
