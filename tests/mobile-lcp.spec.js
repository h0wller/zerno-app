import { test, expect } from '@playwright/test';


function imageCatalogItems(brand) {
  const delivery = brand === 'delivery';
  return Array.from({ length: 6 }, (_, index) => ({
    id: `${brand}-image-${index + 1}`,
    section: delivery ? 'delivery' : 'coffee',
    cat: delivery ? 'pizza' : 'coffee',
    e: delivery ? '🍕' : '☕',
    name: `${delivery ? 'Пицца' : 'Кофе'} ${index + 1}`,
    desc: 'Тестовая позиция с изображением',
    comp: ['тестовый состав'],
    vol: delivery ? '25/35 см' : '200 мл',
    price: delivery ? '0' : '180',
    on: 1,
    opts: delivery ? [
      { l: '25 см, пышное', w: '415 г', p: 535, sz: 25 },
      { l: '35 см, пышное', w: '750 г', p: 735, sz: 35 },
      { l: '25 см, тонкое', w: '335 г', p: 435, sz: 25 },
      { l: '35 см, тонкое', w: '550 г', p: 635, sz: 35 }
    ] : [],
    img: `/media/dishes/${brand}-image-${index + 1}.webp?v=1`,
    imgSrcset: `/media/dishes/resized/${brand}-image-${index + 1}-300.webp?v=1 300w, /media/dishes/resized/${brand}-image-${index + 1}-600.webp?v=1 600w`
  }));
}

async function routeImageCatalog(page, brand, { delayMs = 0 } = {}) {
  const endpoint = brand === 'delivery' ? '**/dmenu**' : '**/api/menu';
  await page.route(endpoint, async (route) => {
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: imageCatalogItems(brand), updatedAt: Date.now() })
    });
  });
  await page.route('**/media/dishes/**', (route) => route.fulfill({
    status: 200,
    contentType: 'image/webp',
    body: Buffer.from('UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAUAmJaQAA3AA/vz0AAA=', 'base64')
  }));
}

test.describe('Initial catalog image priorities', () => {
  test.use({ serviceWorkers: 'block' });

  test('Lighthouse audit selects coffee deterministically even when delivery is stored', async ({ page }) => {
    await routeImageCatalog(page, 'coffee');
    await page.addInitScript(() => {
      localStorage.setItem('zt_brand', 'delivery');
      localStorage.setItem('zt_onb', '1');
      localStorage.setItem('zt_inst_hide', '1');
      sessionStorage.removeItem('splashDone');
    });

    await page.goto('/?lighthouse=1');
    await expect(page.locator('html')).toHaveAttribute('data-brand', 'coffee');
    await expect(page.locator('#brandSplashStatic, #brandSplash')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => Array.isArray(window.MENU) && window.MENU.length > 0)).toBe(true);
    await expect(page.locator('#grid > .card').first()).toBeVisible();
  });

  test('coffee startup does not request the hidden delivery hero image', async ({ page }) => {
    const deliveryHeroRequests = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname === '/media/dishes/1-card.webp') {
        deliveryHeroRequests.push(request.url());
      }
    });

    await page.addInitScript(() => {
      localStorage.setItem('zt_brand', 'coffee');
      localStorage.setItem('zt_onb', '1');
      localStorage.setItem('zt_inst_hide', '1');
      sessionStorage.setItem('splashDone', '1');
    });
    await routeImageCatalog(page, 'coffee', { delayMs: 350 });
    await page.goto('/?brand=coffee');
    await expect(page.locator('#grid > .card').first()).toBeAttached({ timeout: 15000 });
    await expect.poll(() => page.evaluate(() => Array.isArray(window.MENU) && window.MENU.length > 0)).toBe(true);

    const hiddenDeliveryHero = page.locator('#deliveryGrid > .card img').first();
    await expect(hiddenDeliveryHero).toHaveAttribute('loading', 'lazy');
    await expect(hiddenDeliveryHero).toHaveAttribute('fetchpriority', 'auto');
    expect(deliveryHeroRequests).toHaveLength(0);
  });

  test('splash coffee choice does not preload the hidden delivery hero', async ({ page }) => {
    const deliveryHeroRequests = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname === '/media/dishes/1-card.webp') {
        deliveryHeroRequests.push(request.url());
      }
    });

    await page.addInitScript(() => {
      localStorage.setItem('zt_brand', 'delivery');
      localStorage.setItem('zt_onb', '1');
      localStorage.setItem('zt_inst_hide', '1');
      localStorage.removeItem('zt_user');
      sessionStorage.removeItem('splashDone');
    });
    await page.route('**/api/menu', async (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: imageCatalogItems('coffee'), updatedAt: Date.now() })
    }));
    await page.route('**/api/dmenu', async (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: imageCatalogItems('delivery'), updatedAt: Date.now() })
    }));
    await page.route('**/media/dishes/**', (route) => route.fulfill({
      status: 200,
      contentType: 'image/webp',
      body: Buffer.from('UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAUAmJaQAA3AA/vz0AAA=', 'base64')
    }));

    await page.goto('/');
    const splash = page.locator('#brandSplashStatic, #brandSplash').first();
    await expect(splash).toBeVisible();
    // The boot must wait for the explicit brand choice instead of fetching the
    // previously stored delivery catalog while the splash is still visible.
    await expect.poll(() => page.evaluate(() => window.__dlReq || 0)).toBe(0);
    await splash.locator('[data-go="coffee"]').click();
    await expect(page.locator('html')).toHaveAttribute('data-brand', 'coffee');
    await expect.poll(() => page.evaluate(() => Array.isArray(window.MENU) && window.MENU.length > 0)).toBe(true);
    await expect.poll(() => deliveryHeroRequests.length).toBe(0);
    await expect(page.locator('#deliveryGrid > .card img').first()).not.toHaveAttribute('src', '/media/dishes/1-card.webp');
  });

  test('C8 mismatch preloads only the saved delivery image and does not activate its hero after coffee is chosen', async ({ page }) => {
    const apiRequests = [];
    const deliveryImageRequests = [];
    await page.addInitScript(() => {
      localStorage.setItem('zt_brand', 'delivery');
      localStorage.setItem('zt_onb', '1');
      localStorage.setItem('zt_inst_hide', '1');
      localStorage.removeItem('zt_user');
      sessionStorage.removeItem('splashDone');
    });
    await page.route('**/api/menu', route => {
      apiRequests.push('/api/menu');
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ items: imageCatalogItems('coffee'), updatedAt: Date.now() })
      });
    });
    await page.route('**/api/dmenu', route => {
      apiRequests.push('/api/dmenu');
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ items: imageCatalogItems('delivery'), updatedAt: Date.now() })
      });
    });
    await page.route('**/media/dishes/**', route => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname.includes('/delivery-image-')) deliveryImageRequests.push(pathname);
      return route.fulfill({
        status: 200, contentType: 'image/webp',
        body: Buffer.from('UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAUAmJaQAA3AA/vz0AAA=', 'base64')
      });
    });

    await page.goto('/');
    const splash = page.locator('#brandSplashStatic, #brandSplash').first();
    await expect(splash).toBeVisible();
    await expect.poll(() => apiRequests.filter(path => path === '/api/dmenu').length).toBe(1);
    const predictedPreload = page.locator('#zt-delivery-lcp-preload');
    await expect(predictedPreload).toHaveAttribute('href', '/media/dishes/delivery-image-1.webp?v=1');
    await expect.poll(() => deliveryImageRequests.length).toBe(1);

    await page.evaluate(() => {
      const apply = window.__ztApplyDeliveryHero;
      window.__ztDeliveryHeroApplyCount = 0;
      window.__ztApplyDeliveryHero = function (item) {
        window.__ztDeliveryHeroApplyCount += 1;
        return apply(item);
      };
    });
    await splash.locator('[data-go="coffee"]').click();
    await expect(page.locator('#grid > .card').first()).toBeVisible();
    expect(apiRequests.filter(path => path === '/api/dmenu')).toHaveLength(1);
    expect(apiRequests.filter(path => path === '/api/menu')).toHaveLength(1);
    expect(deliveryImageRequests).toEqual(['/media/dishes/resized/delivery-image-1-600.webp']);
    expect(await page.evaluate(() => window.__ztDeliveryHeroApplyCount)).toBe(0);
    await expect(page.locator('html')).toHaveAttribute('data-brand', 'coffee');
  });

  test('splash delivery choice preloads the first visible pizza when another category sorts first', async ({ page }) => {
    const sauceItem = {
      ...deliveryHeroFixture,
      id: 'sauce-1',
      cat: 'sauces',
      name: 'Соус',
      img: '/media/dishes/sauce-card.webp',
      imgSrcset: '/media/dishes/resized/sauce-card-300.webp?v=456 300w, /media/dishes/resized/sauce-card-600.webp?v=456 600w'
    };
    const firstPizza = {
      ...deliveryHeroFixture,
      id: '3',
      name: 'Ветчина и грибы',
      img: '/media/dishes/3-card.webp',
      imgSrcset: '/media/dishes/resized/3-card-300.webp?v=456 300w, /media/dishes/resized/3-card-600.webp?v=456 600w'
    };
    const dishResourceCount = (fragment) => page.evaluate((needle) => (
      performance.getEntriesByType('resource').filter(entry => {
        try {
          return new URL(entry.name).pathname.includes(needle);
        } catch {
          return false;
        }
      }).length
    ), fragment);
    await page.route('**/api/dmenu', async route => {
      await new Promise(resolve => setTimeout(resolve, 180));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [sauceItem, firstPizza, deliveryHeroFixture], updatedAt: Date.now() })
      });
    });
    await page.route('**/media/dishes/**', route => route.fulfill({
      status: 200,
      contentType: 'image/webp',
      body: Buffer.from('UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAUAmJaQAA3AA/vz0AAA=', 'base64')
    }));
    await page.addInitScript(() => {
      localStorage.setItem('zt_brand', 'delivery');
      localStorage.removeItem('zt_onb');
      localStorage.removeItem('zt_user');
      localStorage.setItem('zt_inst_hide', '1');
      sessionStorage.removeItem('splashDone');
    });

    await page.goto('/');
    const splash = page.locator('#brandSplashStatic, #brandSplash').first();
    await expect(splash).toBeVisible();
    await expect(page.locator('#zt-delivery-lcp-preload'))
      .toHaveAttribute('href', '/media/dishes/3-card.webp');
    expect(await dishResourceCount('/3-card')).toBe(1);
    expect(await dishResourceCount('/sauce-card')).toBe(0);

    await page.locator('#brandSplashStatic [data-go="delivery"], #brandSplash [data-go="delivery"]').first().click();

    const firstCard = page.locator('#deliveryGrid > .card').first();
    await expect(firstCard).toHaveAttribute('data-product-id', '3');
    await expect(firstCard.locator('h3')).toHaveText('Ветчина и грибы');
    const image = firstCard.locator('.media img');
    await expect(image).toHaveAttribute('src', firstPizza.img);
    await expect(image).toHaveAttribute('srcset', firstPizza.imgSrcset);
    await expect(image).toHaveAttribute('loading', 'eager');
    await expect(image).toHaveAttribute('fetchpriority', 'high');
    await expect.poll(() => image.evaluate(node => !!node.currentSrc)).toBe(true);
    await expect(page.locator('link#zt-delivery-lcp-preload')).toHaveAttribute('href', firstPizza.img);
    await expect.poll(() => page.evaluate(() => window.__ztPendingDeliveryHero)).toBeNull();
    const currentSrc = await image.evaluate(node => node.currentSrc);
    const currentPath = new URL(currentSrc).pathname;
    expect(currentPath).toContain('/3-card');
    await expect.poll(() => page.evaluate(src => (
      performance.getEntriesByName(src, 'resource').length
    ), currentSrc)).toBe(1);
    expect(await dishResourceCount('/sauce-card')).toBe(0);
  });

  test('first catalog hero keeps card motion while only its image receives high priority', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });

    for (const brand of ['coffee', 'delivery']) {
      await routeImageCatalog(page, brand);
      await page.addInitScript((selectedBrand) => {
        localStorage.setItem('zt_brand', selectedBrand);
        localStorage.setItem('zt_onb', '1');
        localStorage.setItem('zt_inst_hide', '1');
        sessionStorage.setItem('splashDone', '1');
      }, brand);

      await page.goto('/?brand=' + brand);
      const grid = page.locator(brand === 'delivery' ? '#deliveryGrid' : '#grid');
      await expect.poll(() => grid.locator(':scope > .card:not(.skeleton-card)').count()).toBeGreaterThan(1);

      const cards = grid.locator(':scope > .card:not(.skeleton-card)');
      const firstCard = cards.first();
      const secondCard = cards.nth(1);
      await expect.poll(() => firstCard.evaluate(card => getComputedStyle(card).animationName)).toBe('card-enter');
      await expect.poll(() => secondCard.evaluate(card => getComputedStyle(card).animationName)).toBe('card-enter');

      const firstRowTop = await firstCard.evaluate(card => card.getBoundingClientRect().top);
      const firstRowImages = await cards.evaluateAll((nodes, top) => nodes
        .filter(card => Math.abs(card.getBoundingClientRect().top - top) <= 1)
        .map(card => card.querySelector('.media img[src]'))
        .filter(Boolean)
        .map(image => ({
          loading: image.getAttribute('loading'),
          priority: image.getAttribute('fetchpriority')
        })), firstRowTop);
      expect(firstRowImages.length).toBeGreaterThan(0);
      expect(firstRowImages.filter(image => image.priority === 'high')).toHaveLength(1);
      expect(firstRowImages[0]).toEqual({ loading: 'eager', priority: 'high' });
      await expect(firstCard.locator('.media img')).toHaveAttribute('loading', 'eager');
      await expect(firstCard.locator('.media img')).toHaveAttribute('fetchpriority', 'high');
    }
  });

  test('explicit delivery activates its static LCP image before the main bundle finishes loading', async ({ page }) => {
    let mainBundleResponded = false;
    await routeDeliveryHero(page);
    await page.route('**/dist/main.bundle.js*', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 1200));
      await route.continue();
    });
    page.on('response', response => {
      if (new URL(response.url()).pathname === '/dist/main.bundle.js') {
        mainBundleResponded = true;
      }
    });
    await page.addInitScript(() => {
      localStorage.setItem('zt_brand', 'delivery');
      localStorage.setItem('zt_onb', '1');
      localStorage.setItem('zt_inst_hide', '1');
      localStorage.removeItem('zt_user');
      sessionStorage.setItem('splashDone', '1');
    });

    await page.goto('/?brand=delivery', { waitUntil: 'commit' });
    const image = page.locator('#deliveryGrid > .card:first-child .media img');
    await expect(image).toHaveAttribute('src', deliveryHeroFixture.img, { timeout: 900 });
    expect(mainBundleResponded).toBe(false);
    await expect(image).toHaveAttribute('srcset', deliveryHeroFixture.imgSrcset);
    await expect(image).toHaveAttribute('loading', 'eager');
    await expect(image).toHaveAttribute('fetchpriority', 'high');
    await expect.poll(() => mainBundleResponded).toBe(true);
    await expect(page.locator('#deliveryGrid')).toHaveAttribute('data-catalog-ready', '1');
  });

  test('delivery startup retains its first-card hero request', async ({ page }) => {
    await routeImageCatalog(page, 'delivery');
    await page.addInitScript(() => {
      localStorage.setItem('zt_brand', 'delivery');
      localStorage.setItem('zt_onb', '1');
      localStorage.setItem('zt_inst_hide', '1');
      sessionStorage.setItem('splashDone', '1');
    });

    const heroRequest = page.waitForRequest((request) =>
      new URL(request.url()).pathname.includes('/delivery-image-1')
    );
    await page.goto('/?brand=delivery');
    await expect(page.locator('#deliveryGrid > .card').first()).toBeAttached();
    await heroRequest;
    await expect(page.locator('#deliveryGrid > .card img').first()).toHaveAttribute('src', '/media/dishes/delivery-image-1.webp?v=1');
    await expect(page.locator('#deliveryGrid > .card img').first()).toHaveAttribute('srcset', '/media/dishes/resized/delivery-image-1-300.webp?v=1 300w, /media/dishes/resized/delivery-image-1-600.webp?v=1 600w');
    await expect(page.locator('#deliveryGrid > .card img').first()).toHaveAttribute('fetchpriority', 'high');
  });

  const deliveryHeroFixture = {
    id: '1',
    section: 'delivery',
    cat: 'pizza',
    e: '🍕',
    name: 'Маргарита',
    desc: 'Красный соус, моцарелла',
    comp: ['красный соус', 'моцарелла'],
    vol: '25/35 см',
    price: '0',
    on: 1,
    opts: [{ l: '25 см, пышное', w: '415 г', p: 535, sz: 25 }],
    img: '/media/dishes/1-card.webp',
    imgSrcset: '/media/dishes/resized/1-card-300.webp?v=123 300w, /media/dishes/resized/1-card-600.webp?v=123 600w'
  };

  async function routeDeliveryHero(page) {
    await page.route('**/api/dmenu', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 180));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [deliveryHeroFixture], updatedAt: Date.now() })
      });
    });
    await page.route('**/media/dishes/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'image/webp',
        body: Buffer.from('UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAUAmJaQAA3AA/vz0AAA=', 'base64')
      });
    });
  }

  test('delivery hero preload and retained static card use the API responsive image set', async ({ page }) => {
    const heroRequests = [];
    await page.setViewportSize({ width: 390, height: 844 });
    page.on('request', request => {
      if (new URL(request.url()).pathname.includes('/media/dishes/1-card') ||
          new URL(request.url()).pathname.includes('/media/dishes/resized/1-card')) {
        heroRequests.push(request.url());
      }
    });
    await routeDeliveryHero(page);
    await page.addInitScript(() => {
      localStorage.setItem('zt_brand', 'delivery');
      localStorage.setItem('zt_onb', '1');
      localStorage.setItem('zt_inst_hide', '1');
      sessionStorage.setItem('splashDone', '1');
    });

    await page.goto('/?brand=delivery');
    const firstCard = page.locator('#deliveryGrid > .card').first();
    await expect(firstCard).toHaveAttribute('data-product-id', '1');
    const image = firstCard.locator('.media img');
    await expect(image).toHaveAttribute('src', deliveryHeroFixture.img);
    await expect(image).toHaveAttribute('srcset', deliveryHeroFixture.imgSrcset);
    await expect(image).toHaveAttribute('sizes', '(max-width: 519px) calc(100vw - 110px), (max-width: 1180px) 42vw, (max-width: 1599px) 30vw, 23vw');
    await expect(image).toHaveAttribute('loading', 'eager');
    await expect(image).toHaveAttribute('fetchpriority', 'high');

    const preload = page.locator('link[rel="preload"][as="image"][href="/media/dishes/1-card.webp"]');
    await expect(preload).toHaveCount(1);
    await expect(preload).toHaveAttribute('imagesrcset', deliveryHeroFixture.imgSrcset);
    await expect(preload).toHaveAttribute('imagesizes', '(max-width: 519px) calc(100vw - 110px), (max-width: 1180px) 42vw, (max-width: 1599px) 30vw, 23vw');
    await expect.poll(() => image.evaluate(node => !!node.currentSrc)).toBe(true);
    const currentSrc = await image.evaluate(node => node.currentSrc);
    await expect.poll(() => heroRequests.filter(url => url === currentSrc).length).toBe(1);
    expect(heroRequests.filter(url => url === currentSrc)).toHaveLength(1);
  });

  test('delivery preloader applies the static hero source before catalog rendering', async ({ page }) => {
    await routeDeliveryHero(page);
    await page.addInitScript(() => {
      let applyDeliveryHero;
      window.__deliveryHeroPrimedBeforeCatalog = false;
      Object.defineProperty(window, '__ztApplyDeliveryHero', {
        configurable: true,
        get() { return applyDeliveryHero; },
        set(callback) {
          applyDeliveryHero = function (item) {
            const applied = callback(item);
            const grid = document.getElementById('deliveryGrid');
            if (applied && grid && grid.dataset.catalogReady !== '1') {
              window.__deliveryHeroPrimedBeforeCatalog = true;
            }
            return applied;
          };
        }
      });
      localStorage.setItem('zt_brand', 'delivery');
      localStorage.setItem('zt_onb', '1');
      localStorage.setItem('zt_inst_hide', '1');
      sessionStorage.setItem('splashDone', '1');
    });

    await page.goto('/?brand=delivery');
    await expect.poll(() => page.evaluate(() => window.__deliveryHeroPrimedBeforeCatalog)).toBe(true);
    const grid = page.locator('#deliveryGrid');
    const image = grid.locator('> .card:first-child .media img');
    await expect(image).toHaveAttribute('src', deliveryHeroFixture.img);
    await expect(image).toHaveAttribute('srcset', deliveryHeroFixture.imgSrcset);
    await expect(grid).toHaveAttribute('data-catalog-ready', '1');
  });

  test('C8 matching delivery prediction is reused after the splash choice', async ({ page }) => {
    const deliveryMenuRequests = [];
    const deliveryImageRequests = [];
    await page.addInitScript(() => {
      localStorage.setItem('zt_brand', 'delivery');
      localStorage.setItem('zt_onb', '1');
      localStorage.setItem('zt_inst_hide', '1');
      localStorage.removeItem('zt_user');
      sessionStorage.removeItem('splashDone');
    });
    await page.route('**/api/dmenu', route => {
      deliveryMenuRequests.push('/api/dmenu');
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ items: imageCatalogItems('delivery'), updatedAt: Date.now() })
      });
    });
    await page.route('**/media/dishes/**', route => {
      if (new URL(route.request().url()).pathname.includes('/delivery-image-')) {
        deliveryImageRequests.push(new URL(route.request().url()).pathname);
      }
      return route.fulfill({
        status: 200, contentType: 'image/webp',
        body: Buffer.from('UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAUAmJaQAA3AA/vz0AAA=', 'base64')
      });
    });

    await page.goto('/');
    const splash = page.locator('#brandSplashStatic, #brandSplash').first();
    await expect(splash).toBeVisible();
    await expect.poll(() => deliveryMenuRequests.length).toBe(1);
    await expect(page.locator('#zt-delivery-lcp-preload'))
      .toHaveAttribute('href', '/media/dishes/delivery-image-1.webp?v=1');
    await expect.poll(() => deliveryImageRequests.length).toBe(1);
    expect(deliveryImageRequests).toEqual(['/media/dishes/resized/delivery-image-1-600.webp']);

    await splash.locator('[data-go="delivery"]').click();
    await expect(page.locator('#deliveryGrid > .card').first()).toBeVisible();
    expect(deliveryMenuRequests).toHaveLength(1);
    expect(deliveryImageRequests[0]).toBe('/media/dishes/resized/delivery-image-1-600.webp');
    expect(deliveryImageRequests.every(path => path.includes('/delivery-image-'))).toBe(true);
  });

  test('coffee startup replaces the catalog grid only once after menu data arrives', async ({ page }) => {
    await routeImageCatalog(page, 'coffee');
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
      localStorage.setItem('zt_brand', 'coffee');
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
    await routeImageCatalog(page, 'coffee');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('zt_brand', 'coffee');
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
    await routeImageCatalog(page, 'delivery');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('zt_brand', 'delivery');
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


  test('coffee early menu response preloads the exact first-card image once', async ({ page }) => {
    const firstImage = '/media/dishes/espresso-card.webp?v=12345';
    const firstSrcset = '/media/dishes/resized/espresso-card-300.webp?v=12345 300w, /media/dishes/resized/espresso-card-600.webp?v=12345 600w';
    const imageRequests = [];
    await page.setViewportSize({ width: 390, height: 844 });
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.includes('espresso-card')) imageRequests.push(request.url());
    });
    await page.route('**/media/dishes/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'image/webp',
        body: Buffer.from('UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAUAmJaQAA3AA/vz0AAA=', 'base64')
      });
    });
    await page.addInitScript(() => {
      window.__preloadExistedAtFirstCoffeeImage = null;
      const observer = new MutationObserver(() => {
        if (window.__preloadExistedAtFirstCoffeeImage !== null) return;
        if (document.querySelector('#grid > .card img')) {
          window.__preloadExistedAtFirstCoffeeImage = !!document.querySelector('#zt-menu-lcp-preload');
        }
      });
      observer.observe(document, { childList: true, subtree: true });
      localStorage.setItem('zt_brand', 'coffee');
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

    const image = page.locator('#grid > .card img').first();
    await expect.poll(() => image.evaluate((node) => !!node.currentSrc)).toBe(true);
    await expect.poll(() => imageRequests.length).toBeGreaterThan(0);
    const currentSrc = await image.evaluate((node) => node.currentSrc);
    expect(imageRequests.filter((url) => url === currentSrc)).toHaveLength(1);
    expect(imageRequests).toHaveLength(1);
  });


  test('explicit coffee document advertises the first active coffee image in its Link header', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('zt_brand', 'coffee');
      localStorage.setItem('zt_onb', '1');
      localStorage.setItem('zt_inst_hide', '1');
      sessionStorage.setItem('splashDone', '1');
    });

    const response = await page.goto('/?brand=coffee');
    expect(response).not.toBeNull();
    const menuResponse = await page.request.get('/api/menu');
    expect(menuResponse.ok()).toBe(true);
    const menu = await menuResponse.json();
    const firstImage = menu.items.find((item) =>
      item && item.on && item.cat === 'coffee' && item.img
    );
    const hasEligibleLocalImage = Boolean(
      firstImage && firstImage.img.startsWith('/media/dishes/')
    );

    const linkHeader = await response.headerValue('link');
    if (!hasEligibleLocalImage) {
      expect(linkHeader).toBeNull();
      return;
    }

    expect(linkHeader).toContain('rel=preload');
    expect(linkHeader).toContain('as=image');
    expect(linkHeader).toContain('fetchpriority=high');
    expect(linkHeader).toContain('<' + firstImage.img.split('?')[0] + '>');
  });
  test('default splash and explicit delivery documents do not advertise the coffee image', async ({ page }) => {
    const splashResponse = await page.goto('/');
    expect(splashResponse).not.toBeNull();
    expect(await splashResponse.headerValue('link')).toBeNull();

    const deliveryResponse = await page.goto('/?brand=delivery');
    expect(deliveryResponse).not.toBeNull();
    expect(await deliveryResponse.headerValue('link')).toBeNull();
  });


  test('C8 matching coffee prediction is reused by the selected catalog request', async ({ page }) => {
    const apiRequests = [];
    const coffeeImageRequests = [];
    await page.addInitScript(() => {
      localStorage.setItem('zt_brand', 'coffee');
      localStorage.setItem('zt_onb', '1');
      localStorage.setItem('zt_inst_hide', '1');
      localStorage.removeItem('zt_user');
      sessionStorage.removeItem('splashDone');
    });
    await page.route('**/api/menu', route => {
      apiRequests.push('/api/menu');
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ items: imageCatalogItems('coffee'), updatedAt: Date.now() })
      });
    });
    await page.route('**/api/dmenu', route => {
      apiRequests.push('/api/dmenu');
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ items: imageCatalogItems('delivery'), updatedAt: Date.now() })
      });
    });
    await page.route('**/media/dishes/**', route => {
      if (new URL(route.request().url()).pathname.includes('/coffee-image-')) {
        coffeeImageRequests.push(new URL(route.request().url()).pathname);
      }
      return route.fulfill({
        status: 200, contentType: 'image/webp',
        body: Buffer.from('UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAUAmJaQAA3AA/vz0AAA=', 'base64')
      });
    });

    await page.goto('/');
    const splash = page.locator('#brandSplashStatic, #brandSplash').first();
    await expect(splash).toBeVisible();
    await expect.poll(() => apiRequests.filter(path => path === '/api/menu').length).toBe(1);
    await expect(page.locator('#zt-menu-lcp-preload'))
      .toHaveAttribute('href', '/media/dishes/coffee-image-1.webp?v=1');
    await expect.poll(() => coffeeImageRequests.length).toBe(1);
    expect(coffeeImageRequests).toEqual(['/media/dishes/resized/coffee-image-1-600.webp']);
    await splash.locator('[data-go="coffee"]').click();
    await expect(page.locator('#grid > .card').first()).toBeVisible();
    expect(apiRequests.filter(path => path === '/api/menu')).toHaveLength(1);
    expect(apiRequests.filter(path => path === '/api/dmenu')).toHaveLength(0);
    expect(coffeeImageRequests[0]).toBe('/media/dishes/resized/coffee-image-1-600.webp');
  });

  test('C8 late mismatched prediction cannot preload or activate the hidden delivery hero', async ({ page }) => {
    const apiRequests = [];
    const deliveryImageRequests = [];
    let releaseDelivery;
    const deliveryResponseGate = new Promise(resolve => { releaseDelivery = resolve; });
    await page.addInitScript(() => {
      localStorage.setItem('zt_brand', 'delivery');
      localStorage.setItem('zt_onb', '1');
      localStorage.setItem('zt_inst_hide', '1');
      localStorage.removeItem('zt_user');
      sessionStorage.removeItem('splashDone');
    });
    await page.route('**/api/dmenu', async route => {
      apiRequests.push('/api/dmenu');
      await deliveryResponseGate;
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ items: imageCatalogItems('delivery'), updatedAt: Date.now() })
      });
    });
    await page.route('**/api/menu', route => {
      apiRequests.push('/api/menu');
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ items: imageCatalogItems('coffee'), updatedAt: Date.now() })
      });
    });
    await page.route('**/media/dishes/**', route => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname.includes('/delivery-image-')) deliveryImageRequests.push(pathname);
      return route.fulfill({
        status: 200, contentType: 'image/webp',
        body: Buffer.from('UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAUAmJaQAA3AA/vz0AAA=', 'base64')
      });
    });

    await page.goto('/');
    const splash = page.locator('#brandSplashStatic, #brandSplash').first();
    await expect(splash).toBeVisible();
    await expect.poll(() => apiRequests.includes('/api/dmenu')).toBe(true);
    await page.evaluate(() => {
      const apply = window.__ztApplyDeliveryHero;
      window.__ztDeliveryHeroApplyCount = 0;
      window.__ztApplyDeliveryHero = function (item) {
        window.__ztDeliveryHeroApplyCount += 1;
        return apply(item);
      };
    });
    await splash.locator('[data-go="coffee"]').click();
    await expect(page.locator('#grid > .card').first()).toBeVisible();
    releaseDelivery();
    await expect.poll(() => page.evaluate(() => window.__ztDeliveryHeroApplyCount)).toBe(0);
    await expect(page.locator('#zt-delivery-lcp-preload')).toHaveCount(0);
    expect(deliveryImageRequests).toHaveLength(0);
    expect(apiRequests.filter(path => path === '/api/menu')).toHaveLength(1);
    expect(apiRequests.filter(path => path === '/api/dmenu')).toHaveLength(1);
  });

  test('C8 does not predict a brand for an authenticated splash session', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('zt_brand', 'delivery');
      localStorage.setItem('zt_user', 'authenticated-user');
      localStorage.setItem('zt_onb', '1');
      localStorage.setItem('zt_inst_hide', '1');
      sessionStorage.removeItem('splashDone');
    });
    await page.goto('/');
    await expect(page.locator('#brandSplashStatic, #brandSplash').first()).toBeVisible();
    await expect(page.locator('#zt-delivery-lcp-preload, #zt-menu-lcp-preload')).toHaveCount(0);
  });

  test('saved zt_brand does not bypass the explicit splash choice', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('zt_brand', 'delivery');
      localStorage.setItem('zt_onb', '1');
      localStorage.setItem('zt_inst_hide', '1');
      sessionStorage.removeItem('splashDone');
    });
    await page.goto('/');
    await expect(page.locator('#brandSplashStatic, #brandSplash').first()).toBeVisible();
    await page.locator('#brandSplashStatic [data-go="coffee"], #brandSplash [data-go="coffee"]').first().click();
    await expect(page.locator('html')).toHaveAttribute('data-brand', 'coffee');
  });

});