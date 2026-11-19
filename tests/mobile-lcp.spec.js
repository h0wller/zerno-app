import { test, expect } from '@playwright/test';

test.describe('Initial catalog image priorities', () => {
  test.use({ serviceWorkers: 'block' });

  test('coffee startup does not request the hidden delivery hero image', async ({ page }) => {
    const deliveryHeroRequests = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname === '/media/dishes/1-card.webp') {
        deliveryHeroRequests.push(request.url());
      }
    });

    await page.addInitScript(() => {
      localStorage.setItem('zt_onb', '1');
      localStorage.setItem('zt_inst_hide', '1');
      sessionStorage.setItem('splashDone', '1');
    });
    await page.goto('/?brand=coffee');
    await expect(page.locator('#grid article').first()).toBeAttached();
    await page.waitForTimeout(700);

    expect(deliveryHeroRequests).toHaveLength(0);
  });

  test('delivery startup retains its first-card hero request', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('zt_onb', '1');
      localStorage.setItem('zt_inst_hide', '1');
      sessionStorage.setItem('splashDone', '1');
    });

    const heroRequest = page.waitForRequest((request) =>
      new URL(request.url()).pathname === '/media/dishes/1-card.webp'
    );
    await page.goto('/?brand=delivery');
    await expect(page.locator('#deliveryGrid > .card').first()).toBeAttached();
    await heroRequest;
    await expect(page.locator('#deliveryGrid > .card img').first()).toHaveAttribute('fetchpriority', 'high');
  });

  test('coffee startup replaces the catalog grid only once after menu data arrives', async ({ page }) => {
    await page.addInitScript(() => {
      const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
      window.__coffeeGridWrites = 0;
      Object.defineProperty(Element.prototype, 'innerHTML', {
        configurable: descriptor.configurable,
        enumerable: descriptor.enumerable,
        get: descriptor.get,
        set(value) {
          if (this.id === 'grid') window.__coffeeGridWrites += 1;
          return descriptor.set.call(this, value);
        }
      });
      localStorage.setItem('zt_onb', '1');
      localStorage.setItem('zt_inst_hide', '1');
      sessionStorage.setItem('splashDone', '1');
    });

    await page.goto('/?brand=coffee');
    await expect(page.locator('#grid article').first()).toBeAttached();
    await expect.poll(() => page.evaluate(() => window.__coffeeGridWrites)).toBe(1);
  });


  test('coffee prioritizes only the actual LCP card image', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('zt_onb', '1');
      localStorage.setItem('zt_inst_hide', '1');
      sessionStorage.setItem('splashDone', '1');
    });
    await page.goto('/?brand=coffee');
    const images = page.locator('#grid > .card img');
    await expect(images.first()).toBeAttached();
    await expect.poll(() => images.count()).toBeGreaterThan(1);
    await expect.poll(async () => images.evaluateAll((nodes) =>
      nodes.filter((image) => image.getAttribute('fetchpriority') === 'high').length
    )).toBe(1);
    await expect.poll(async () => images.evaluateAll((nodes) =>
      nodes.filter((image) => image.getAttribute('loading') === 'eager').length
    )).toBe(1);
  });

});
