import { test, expect } from '@playwright/test';

test.describe('PWA update prompt and brand splash', () => {
  test.use({ serviceWorkers: 'block' });

  for (const platform of ['iOS standalone', 'Android standalone']) {
    test(`keeps the brand chooser interactive on ${platform} and offers a waiting update after selection`, async ({ page }) => {
      await page.addInitScript((targetPlatform) => {
        Object.defineProperty(navigator, 'standalone', {
          configurable: true,
          value: targetPlatform === 'iOS standalone'
        });

        const nativeMatchMedia = window.matchMedia.bind(window);
        window.matchMedia = (query) => {
          if (query === '(display-mode: standalone)') {
            return {
              matches: targetPlatform === 'Android standalone',
              media: query,
              onchange: null,
              addListener() {},
              removeListener() {},
              addEventListener() {},
              removeEventListener() {},
              dispatchEvent() { return false; }
            };
          }
          return nativeMatchMedia(query);
        };

        window.__fakeSwRegistered = false;
        const waitingWorker = {
          state: 'installed',
          postMessage() {}
        };
        const controller = { state: 'activated' };
        Object.defineProperty(navigator, 'serviceWorker', {
          configurable: true,
          value: {
            controller,
            register: async () => {
              window.__fakeSwRegistered = true;
              return {
                waiting: waitingWorker,
                update: async () => {},
                addEventListener() {}
              };
            },
            addEventListener() {}
          }
        });
      }, platform);

      await page.goto('/?splash=1', { waitUntil: 'load' });

      const splash = page.locator('#brandSplashStatic, #brandSplash');
      await expect(splash).toBeVisible();
      await expect.poll(() => page.evaluate(() => window.__fakeSwRegistered)).toBe(true);
      await expect(page.locator('.sw-update-dialog')).toHaveCount(0);

      await splash.locator('[data-go="coffee"]').click();

      await expect(page.locator('html')).toHaveAttribute('data-brand', 'coffee');
      await expect(page.locator('#brandSplashStatic, #brandSplash')).toHaveCount(0);
      await expect(page.locator('.sw-update-dialog')).toBeVisible();
      await expect(page.locator('[data-sw-update-accept]')).toBeVisible();
    });
  }
});
