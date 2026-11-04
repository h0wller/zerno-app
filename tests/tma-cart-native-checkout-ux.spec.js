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
    window.cart = [{ qty: 1, price: 304 }];
    window.totalsNow = () => ({ total: 304 });

    const panel = document.getElementById('cartPanel');
    panel.classList.add('open');
    window.TgUx.updateMainButton();

    const hint = document.createElement('div');
    hint.id = 'zoneFeeHint';
    hint.className = 'addr-fee-hint';
    hint.textContent = 'Янтарный: доставка бесплатно';
    document.querySelector('.checkoutForm').append(hint);

    const discount = document.createElement('div');
    discount.className = 'csl-row discount';
    discount.innerHTML = '<span class="csl-main"><span>Обеденная акция</span><strong>−131 ₽</strong></span>';
    document.querySelector('.cart-summary-lines').append(discount);
  });

  await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('tg-native-main'))).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__testTgMainButton.visible)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__testTgMainButton.params?.text)).toBe('Оформить заказ · 304 ₽');

  await expect(page.locator('#cartPanel')).toHaveCSS('height', '844px');
  await expect(page.locator('#checkoutBtn')).toHaveCSS('display', 'none');
  await expect(page.locator('#cartClose')).toHaveCSS('display', 'none');
  await expect(page.locator('#cartAddons')).toHaveCSS('display', 'none');
  await expect(page.locator('#zoneFeeHint')).toHaveCSS('display', 'none');
  await expect(page.locator('.csl-row.discount')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(page.locator('.csl-row.discount')).toHaveCSS('border-left-width', '0px');
});
