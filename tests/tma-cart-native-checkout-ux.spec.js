import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('TMA cart uses one native checkout action when Telegram becomes ready after app bootstrap', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const mainButton = {
      visible: false,
      params: null,
      clickHandler: null,
      setParams(params) {
        this.params = params;
        this.visible = Boolean(params.is_visible);
      },
      onClick(handler) {
        this.clickHandler = handler;
      },
      show() {
        this.visible = true;
      },
      hide() {
        this.visible = false;
      }
    };
    const backButton = {
      isVisible: false,
      show() {
        this.isVisible = true;
      },
      hide() {
        this.isVisible = false;
      },
      onClick() {}
    };

    window.__testTgMainButton = mainButton;
    window.Telegram = {
      WebApp: {
        isStub: false,
        initData: '',
        initDataUnsafe: {},
        MainButton: mainButton,
        BackButton: backButton,
        ready() {},
        expand() {},
        enableClosingConfirmation() {},
        disableVerticalSwipes() {}
      }
    };

    localStorage.setItem('zt_brand', 'delivery');
    localStorage.setItem('zt_onb', '1');
    localStorage.setItem('zt_inst_hide', '1');
    localStorage.setItem('zt_cart', JSON.stringify([{
      key: 'tma-pizza_1', id: 'tma-pizza', name: 'Маргарита', opt: '25 см', price: 304, qty: 1
    }]));
    sessionStorage.setItem('splashDone', '1');
  });

  await page.route('**/telegram-web-app.js', (route) => route.abort());
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    let body = { ok: true, items: [], orders: [], pending: [], customers: [], threads: [], messages: [], promos: [] };

    if (url.pathname === '/api/dmenu') {
      body = { items: [], updatedAt: '2026-11-04T00:00:00.000Z' };
    } else if (url.pathname === '/api/delivery/info') {
      body = {
        zones: [],
        today: { isOpen: true, canAcceptAsap: true, open: 11, close: 22 },
        schedule: { open: 11, close: 22 },
        days: [],
        busySlots: [],
        weekPromo: null,
        pizzaMonth: null
      };
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body)
    });
  });

  await page.goto('/?brand=delivery');
  await expect.poll(() => page.evaluate(() => typeof window.TgUx?.updateMainButton)).toBe('function');

  await page.evaluate(() => {
    // Simulate Telegram's WebApp object becoming fully initialized after state.js ran.
    window.Telegram.WebApp.initData = 'auth_date=1793750400&hash=test';
    window.totalsNow = () => ({ total: 304 });
    window.renderCart();

    const scrollBody = document.getElementById('cartScrollBody');
    const spacer = document.createElement('div');
    spacer.id = 'test-cart-scroll-spacer';
    spacer.style.height = '600px';
    scrollBody.append(spacer);

    const discount = document.createElement('div');
    discount.id = 'test-discount-row';
    discount.className = 'csl-row discount';
    discount.innerHTML = '<span class="csl-main"><span>Обеденная акция</span><strong>−131 ₽</strong><small class="csl-explain">Скидка действует в обеденное окно</small></span>';
    document.querySelector('.cart-summary-lines').append(discount);

    const fab = document.getElementById('cartFab');
    fab.hidden = false;
    fab.click();

    // First open the cart so its scroll container has a real, measurable viewport.
    scrollBody.scrollTop = 180;
    window.__staleCartScrollTop = scrollBody.scrollTop;
    if (window.__staleCartScrollTop !== 180) {
      throw new Error('Test setup failed: cart did not become scrollable after opening');
    }

    // Reopening must reset the previous scroll position.
    document.getElementById('cartPanel').classList.remove('open');
    fab.click();
  });

  await expect(page.locator('#cartPanel')).toHaveClass(/open/);
  await expect.poll(() => page.evaluate(() => window.__staleCartScrollTop)).toBe(180);
  await expect.poll(() => page.evaluate(() => document.getElementById('cartScrollBody').scrollTop)).toBe(0);
  await expect(page.locator('#cartItems .cartItem')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('tg-native-main'))).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__testTgMainButton.visible)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__testTgMainButton.params?.text)).toBe('Оформить заказ · 304 ₽');

  await expect(page.locator('#cartPanel')).toHaveCSS('height', '844px');
  await expect(page.locator('#checkoutBtn')).toHaveCSS('display', 'none');
  await expect(page.locator('#cartTopClose')).toHaveCSS('display', 'none');
  await expect(page.locator('#cartClose')).toHaveCSS('display', 'none');
  await expect(page.locator('#cartAddons')).toHaveCSS('display', 'none');
  await expect(page.locator('#zoneFeeHint')).toHaveCSS('display', 'none');
  await expect(page.locator('#test-discount-row')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(page.locator('#test-discount-row')).toHaveCSS('border-left-width', '0px');
});
