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
    await expect(page.locator('#grid > .card img').first()).toBeAttached({ timeout: 15000 });
    await expect.poll(() => page.evaluate(() => Array.isArray(window.MENU) && window.MENU.length > 0)).toBe(true);

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


  async function assertFirstRowPriorities(page, gridSelector) {
    const cards = page.locator(`${gridSelector} > .card`);
    await expect.poll(async () => cards.evaluateAll((nodes) => {
      if (!nodes.length) return false;
      const top = nodes[0].offsetTop;
      const firstRow = nodes
        .filter((node) => Math.abs(node.offsetTop - top) < 1)
        .map((node) => node.querySelector('.media img[src]'))
        .filter(Boolean);
      const otherRows = nodes
        .filter((node) => node.offsetTop > top + 1)
        .map((node) => node.querySelector('.media img[src]'))
        .filter(Boolean);
      return firstRow.length > 0 &&
        firstRow.every((image) => image.getAttribute('loading') === 'eager') &&
        firstRow[0].getAttribute('fetchpriority') === 'high' &&
        firstRow.slice(1).every((image) => image.getAttribute('fetchpriority') !== 'high') &&
        otherRows.every((image) => image.getAttribute('loading') === 'lazy');
    })).toBe(true);

    await expect(page.locator(`${gridSelector} > .card img[fetchpriority="high"]`)).toHaveCount(1);
  }

  test('coffee eagerly loads every image in the actual first row after viewport changes', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('zt_onb', '1');
      localStorage.setItem('zt_inst_hide', '1');
      sessionStorage.setItem('splashDone', '1');
    });
    await page.goto('/?brand=coffee');
    await expect(page.locator('#grid > .card').first()).toBeAttached();
    await expect.poll(() => page.locator('#grid > .card img').count()).toBeGreaterThan(1);

    await assertFirstRowPriorities(page, '#grid');
    await page.setViewportSize({ width: 390, height: 844 });
    await assertFirstRowPriorities(page, '#grid');
    await page.setViewportSize({ width: 1440, height: 900 });
    await assertFirstRowPriorities(page, '#grid');
  });

  test('delivery eagerly loads every image in the actual first row after viewport changes', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('zt_onb', '1');
      localStorage.setItem('zt_inst_hide', '1');
      sessionStorage.setItem('splashDone', '1');
    });
    await page.goto('/?brand=delivery');
    await expect(page.locator('#deliveryGrid > .card').first()).toBeAttached();
    await expect.poll(() => page.locator('#deliveryGrid > .card img').count()).toBeGreaterThan(1);

    await assertFirstRowPriorities(page, '#deliveryGrid');
    await page.setViewportSize({ width: 390, height: 844 });
    await assertFirstRowPriorities(page, '#deliveryGrid');
    await page.setViewportSize({ width: 1440, height: 900 });
    await assertFirstRowPriorities(page, '#deliveryGrid');
  });


  test('coffee early menu response preloads the exact first-card image URL', async ({ page }) => {
    const firstImage = '/media/dishes/espresso-card.webp?v=12345';
    const firstSrcset = '/media/dishes/resized/espresso-card-300.webp?v=12345 300w, /media/dishes/resized/espresso-card-600.webp?v=12345 600w';
    await page.addInitScript(() => {
      window.__preloadExistedAtFirstCoffeeImage = null;
      const observer = new MutationObserver(() => {
        if (window.__preloadExistedAtFirstCoffeeImage !== null) return;
        if (document.querySelector('#grid > .card img')) {
          window.__preloadExistedAtFirstCoffeeImage = !!document.querySelector('#zt-menu-lcp-preload');
        }
      });
      observer.observe(document, { childList: true, subtree: true });
      localStorage.setItem('zt_onb', '1');
      localStorage.setItem('zt_inst_hide', '1');
      sessionStorage.setItem('splashDone', '1');
    });
    await page.route('**/api/menu', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 250));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [{
            id: 'espresso', cat: 'coffee', section: 'coffee', name: 'Эспрессо',
            desc: '', comp: [], opts: [], price: '180', e: '☕', on: 1,
            img: firstImage, imgSrcset: firstSrcset
          }],
          updatedAt: Date.now()
        })
      });
    });

    await page.goto('/?brand=coffee');
    const preload = page.locator('link#zt-menu-lcp-preload');
    await expect(preload).toHaveCount(1);
    await expect(preload).toHaveAttribute('href', firstImage);
    await expect(preload).toHaveAttribute('imagesrcset', firstSrcset);
    await expect(preload).toHaveAttribute('fetchpriority', 'high');
    await expect.poll(() => page.evaluate(() => window.__preloadExistedAtFirstCoffeeImage)).toBe(true);
  });

});
