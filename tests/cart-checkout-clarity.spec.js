import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

const MENU_ITEM = {
  id: 'pz-marg',
  section: 'delivery',
  cat: 'pizza',
  e: '🍕',
  name: 'Маргарита',
  desc: 'Красный соус, моцарелла',
  comp: ['красный соус', 'моцарелла'],
  vol: '25/35 см',
  price: '0',
  on: 1,
  opts: [
    { l: '25 см, пышное', w: '415 г', p: 535, sz: 25 },
    { l: '35 см, пышное', w: '750 г', p: 735, sz: 35 }
  ]
};

const RECOMMENDED_ITEMS = [
  { id: 'test-drink', cat: 'drinks', name: 'Лимонад к заказу', price: 180, on: 1, e: '🥤' },
  { id: 'test-sauce', cat: 'sauces', name: 'Соус сырный', price: 70, on: 1, e: '🥫' },
  { id: 'test-topping', cat: 'sauces', name: 'Шампиньоны', price: 90, on: 1, e: '🍄' },
  { id: 'test-drink-2', cat: 'drinks', name: 'Морс клюквенный', price: 160, on: 1, e: '🥤' },
  { id: 'test-drink-3', cat: 'drinks', name: 'Вода без газа', price: 90, on: 1, e: '💧' },
  { id: 'test-sauce-2', cat: 'sauces', name: 'Соус барбекю', price: 70, on: 1, e: '🥫' },
  { id: 'test-sauce-3', cat: 'sauces', name: 'Кетчуп', price: 50, on: 1, e: '🥫' }
];

async function expectCompact44pxHitTarget(locator, visibleFace) {
  const metrics = await locator.evaluate((button) => {
    const rect = button.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const points = [
      [cx - 21, cy - 21],
      [cx + 21, cy - 21],
      [cx - 21, cy + 21],
      [cx + 21, cy + 21],
      [cx, cy - 21],
      [cx + 21, cy],
      [cx, cy + 21],
      [cx - 21, cy]
    ];
    const pseudo = window.getComputedStyle(button, '::before');
    return {
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      edgeHits: points.map(([x, y]) => document.elementFromPoint(x, y)?.closest('button') === button),
      faceWidth: Number.parseFloat(pseudo.width),
      faceHeight: Number.parseFloat(pseudo.height)
    };
  });

  expect(metrics.width).toBeGreaterThanOrEqual(44);
  expect(metrics.height).toBeGreaterThanOrEqual(44);
  expect(metrics.edgeHits.every(Boolean)).toBe(true);

  await locator.focus();
  await locator.press('Shift');
  const focus = await locator.evaluate((button) => {
    const style = getComputedStyle(button);
    const face = getComputedStyle(button, '::before');
    return {
      active: document.activeElement === button,
      visible: button.matches(':focus-visible'),
      outlineStyle: style.outlineStyle,
      outlineWidth: Number.parseFloat(style.outlineWidth),
      outlineOffset: Number.parseFloat(style.outlineOffset),
      faceOutlineStyle: face.outlineStyle,
      faceOutlineWidth: Number.parseFloat(face.outlineWidth),
      faceOutlineOffset: Number.parseFloat(face.outlineOffset),
    };
  });
  expect(focus.active).toBe(true);
  expect(focus.visible).toBe(true);
  const ring = focus.outlineWidth >= 2 && focus.outlineStyle === 'solid'
    ? { style: focus.outlineStyle, width: focus.outlineWidth, offset: focus.outlineOffset }
    : { style: focus.faceOutlineStyle, width: focus.faceOutlineWidth, offset: focus.faceOutlineOffset };
  expect(ring.style).toBe('solid');
  expect(ring.width).toBeGreaterThanOrEqual(2);
  expect(ring.offset).toBeLessThanOrEqual(0);
  if (visibleFace === 'square') {
    expect(metrics.faceWidth).toBe(32);
    expect(metrics.faceHeight).toBe(32);
  } else if (visibleFace === 'pill') {
    expect(metrics.faceHeight).toBe(32);
  }
}

test('cart keeps the current selected price and explains every amount without guessing the address', async ({ page }, testInfo) => {
  await page.clock.install({ time: new Date('2026-11-02T15:00:00.000Z') });
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    localStorage.setItem('zt_inst_hide', '1');
    localStorage.setItem('zt_cart', JSON.stringify([{
      key: 'pz-marg_1',
      id: 'pz-marg',
      oi: 1,
      name: 'Old product name',
      opt: 'Old option label',
      price: 690,
      sz: 35,
      qty: 1
    }]));
    localStorage.setItem('zt_cartpromo', 'SAVE100');
    localStorage.removeItem('zt_saved_address');
    localStorage.removeItem('zt_saved_addresses');
    sessionStorage.setItem('splashDone', '1');
  });

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    let body = { ok: true, items: [], orders: [], pending: [], customers: [], threads: [], messages: [], promos: [] };

    if (url.pathname === '/api/dmenu') {
      body = { items: [MENU_ITEM, ...RECOMMENDED_ITEMS], updatedAt: '2026-11-03T10:00:00.000Z' };
    } else if (url.pathname === '/api/delivery/info') {
      const isPreorderFixture = new Date().getTime() >= Date.parse('2026-11-02T20:30:00.000Z');
      body = {
        zones: [
          { fee: 200, min: 0, places: ['Янтарный'] },
          { fee: 250, min: 1000, places: ['Синявино'] }
        ],
        today: { isOpen: true, canAcceptAsap: !isPreorderFixture, open: 11, close: isPreorderFixture ? 20 : 22 },
        schedule: { open: 11, close: isPreorderFixture ? 20 : 22 },
        days: [
          { offset: 0, date: '2026-11-02', isOpen: true, open: 11, close: isPreorderFixture ? 20 : 22 },
          { offset: 1, date: '2026-11-03', isOpen: true, open: 11, close: 22 }
        ],
        busySlots: [],
        weekPromo: null,
        pizzaMonth: null
      };
    } else if (url.pathname === '/api/promo/info') {
      body = { ok: true, kind: 'fixed', value: 100, code: url.searchParams.get('code') };
    } else if (url.pathname === '/api/me/free-delivery') {
      body = { code: '' };
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body)
    });
  });

  await page.goto('/?brand=delivery');
  await expect(page.locator('#deliveryGrid [data-product-id="pz-marg"]')).toBeAttached();
  await expect.poll(() => page.evaluate(() => window.DMENU.some((item) => item.id === 'pz-marg'))).toBe(true);
  await page.evaluate(() => window.refreshDeliveryInfo());
  await page.evaluate(() => {
    document.getElementById('cartPanel').classList.add('open');
    window.renderCart();
  });
  await expect(page.locator('#checkoutGuestBar')).toBeAttached();
  await expect(page.locator('#checkoutGuestBar')).toBeHidden();
  await page.evaluate(() => window.setUser('checkout-clarity-token', {
    id: 'checkout-clarity-guest',
    name: 'Тестовый гость',
    phone: '+7 999 123-45-67',
    role: 'guest',
    verified: 1,
    stamps: 0,
    free: 0
  }));
  await expect(page.locator('#checkoutGuestBar')).toBeVisible();
  await expect(page.locator('#checkoutGuestName')).toHaveText('Тестовый гость');
  await expect(page.locator('#checkoutGuestPhone')).toHaveText('+7 999 123-45-67');

  await page.evaluate(() => document.getElementById('toasts')?.remove());
  const desktopViewport = page.viewportSize();
  await testInfo.attach('cart-overview-' + desktopViewport.width + 'px', {
    body: await page.screenshot({ fullPage: false }),
    contentType: 'image/png',
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#cartClose')).toBeVisible();
  await expect(page.locator('#cartClose .cart-continue-short')).toBeVisible();
  await expect(page.locator('#cartClose .cart-continue-full')).toBeHidden();
  const headerActionsOverflow = await page.locator('.cart-header-actions').evaluate((el) =>
    el.getBoundingClientRect().right > el.parentElement.getBoundingClientRect().right + 1
  );
  expect(headerActionsOverflow).toBe(false);
  await testInfo.attach('cart-overview-390px', {
    body: await page.screenshot({ fullPage: false }),
    contentType: 'image/png',
  });
  await page.setViewportSize({ width: 320, height: 740 });
  await testInfo.attach('cart-overview-320px', {
    body: await page.screenshot({ fullPage: false }),
    contentType: 'image/png',
  });
  await page.setViewportSize(desktopViewport);

  const recommendations = page.locator('#cartAddons');
  const recommendationsOrder = await page.locator('#cartItems').evaluate((items) => items.nextElementSibling?.id);
  expect(recommendationsOrder).toBe('cartAddons');
  await expect(recommendations.locator('.ca-title')).toHaveText('Рекомендуем к заказу');
  await expect(recommendations.locator('.ca-tabs-scroll')).toHaveAttribute('role', 'group');
  const allRecommendations = recommendations.locator('[data-atab="all"]');
  for (const viewport of [{ width: 320, height: 740 }, { width: 375, height: 812 }, { width: 390, height: 844 }, desktopViewport]) {
    await page.setViewportSize(viewport);
    const tabs = recommendations.locator('.addon-tab-btn');
    for (let index = 0; index < await tabs.count(); index += 1) {
      const tab = tabs.nth(index);
      await tab.scrollIntoViewIfNeeded();
      await expectCompact44pxHitTarget(tab, 'pill');
    }
    await recommendations.locator('.ca-tabs-scroll').evaluate((el) => { el.scrollLeft = 0; });
    await testInfo.attach('cart-recommendation-tabs-' + viewport.width + 'px', {
      body: await page.screenshot({ fullPage: false }),
      contentType: 'image/png'
    });
  }
  // Desktop regression: a vertical mouse wheel over the horizontal recommendations rail
  // must move the rail itself, not only the cart's outer scroll container.
  const cardsRail = recommendations.locator('.ca-cards-scroll');
  const initialRailMetrics = await cardsRail.evaluate((el) => ({
    clientWidth: el.clientWidth,
    scrollWidth: el.scrollWidth,
    scrollLeft: el.scrollLeft
  }));
  expect(initialRailMetrics.scrollWidth).toBeGreaterThan(initialRailMetrics.clientWidth);
  expect(initialRailMetrics.scrollLeft).toBe(0);
  const cardsRailBox = await cardsRail.boundingBox();
  await page.mouse.move(cardsRailBox.x + cardsRailBox.width / 2, cardsRailBox.y + cardsRailBox.height / 2);
  await page.mouse.wheel(0, 320);
  await expect.poll(() => cardsRail.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  await testInfo.attach('cart-recommendations-desktop-wheel', {
    body: await page.screenshot({ fullPage: false }),
    contentType: 'image/png'
  });
  await cardsRail.evaluate((el) => { el.scrollLeft = 0; });

  const sauceRecommendations = recommendations.locator('[data-atab="sauces"]');
  await expect(allRecommendations).toHaveAttribute('aria-pressed', 'true');
  await expect(sauceRecommendations).toHaveAttribute('aria-pressed', 'false');
  await sauceRecommendations.click();
  await expect(sauceRecommendations).toHaveAttribute('aria-pressed', 'true');
  await expect(recommendations.locator('.addon-pill-card')).toHaveCount(3);
  await expect(recommendations.locator('.ac-name')).toHaveText(['Соус сырный', 'Соус барбекю', 'Кетчуп']);
  await allRecommendations.click();
  await expect(allRecommendations).toHaveAttribute('aria-pressed', 'true');
  await expect(recommendations.locator('.addon-pill-card')).toHaveCount(6);
  await expect(recommendations.locator('.ac-name')).toHaveText([
    'Лимонад к заказу', 'Соус сырный', 'Морс клюквенный',
    'Вода без газа', 'Соус барбекю', 'Кетчуп'
  ]);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#cartClose')).toBeVisible();
  await expect(page.locator('#cartClose .cart-continue-short')).toBeVisible();
  await expect(page.locator('#cartClose .cart-continue-full')).toBeHidden();
  const recommendationsHeaderOverflow = await page.locator('.cart-header-actions').evaluate((el) =>
    el.getBoundingClientRect().right > el.parentElement.getBoundingClientRect().right + 1
  );
  expect(recommendationsHeaderOverflow).toBe(false);
  await recommendations.scrollIntoViewIfNeeded();
  const addButton = recommendations.locator('.ac-add-btn').first();
  await expect(addButton).toHaveAccessibleName('Добавить Лимонад к заказу в корзину');
  await expect(addButton.locator('.ac-add-label')).toHaveCount(0);
  const addIcon = addButton.locator('.ac-add-icon svg');
  await expect(addIcon).toBeVisible();
  await expect(addIcon.locator('path')).toHaveAttribute('stroke', 'currentColor');
  await expect(addButton).not.toHaveClass(/in-cart/);
  await expect(addButton).toHaveCSS('background-color', 'rgb(239, 230, 216)');
  await expect(addButton).toHaveCSS('border-color', 'rgb(201, 158, 110)');
  const addActionGeometry = await addButton.evaluate((button) => {
    const action = button.parentElement;
    const buttonRect = button.getBoundingClientRect();
    const actionRect = action.getBoundingClientRect();
    return {
      buttonWidth: Math.round(buttonRect.width), buttonHeight: Math.round(buttonRect.height),
      actionWidth: Math.round(actionRect.width), actionLeft: Math.round(actionRect.left),
      buttonLeft: Math.round(buttonRect.left)
    };
  });
  expect(addActionGeometry.buttonWidth).toBe(44);
  expect(addActionGeometry.buttonHeight).toBe(44);
  expect(addActionGeometry.actionWidth).toBe(44);
  expect(Math.abs(addActionGeometry.actionLeft - addActionGeometry.buttonLeft)).toBeLessThan(1);
  const recommendationTabsFit = await recommendations.locator('.cart-addons-wrap').evaluate((wrap) => {
    const head = wrap.querySelector('.cart-addons-head');
    const rail = wrap.querySelector('.ca-tabs-scroll');
    return wrap.scrollWidth <= wrap.clientWidth
      && head.scrollWidth <= head.clientWidth
      && rail.clientWidth > 0
      && rail.getBoundingClientRect().right <= head.getBoundingClientRect().right + 1;
  });
  expect(recommendationTabsFit).toBe(true);
  await expect(recommendations.locator('[data-atab="drinks"]')).toBeVisible();
  await testInfo.attach('cart-recommendations-before-add-390px', {
    body: await page.screenshot({ fullPage: false }),
    contentType: 'image/png',
  });
  await expect(recommendations.locator('.addon-pill-card').first()).not.toHaveClass(/in-cart/);
  await expect(page.locator('#cartItems .cartItem')).toHaveCount(1);

  // A recommendation button has fixed geometry before and after adding; qty never widens the menu cell.
  await addButton.click();
  const drinkCartRow = page.locator('#cartItems .cartItem').nth(1);
  await expect(drinkCartRow.locator('.ci-name')).toHaveText('Лимонад к заказу');
  await expect(drinkCartRow.locator('.ci-unit-price')).toHaveText('180 ₽ / шт.');
  await expect(drinkCartRow.locator('.qty span')).toHaveText('1');
  await expect(page.locator('#cartHeadCount')).toContainText('2 шт.');
  await expect(page.locator('#cartSubtotal')).toContainText('915 ₽');
  await expect(recommendations.locator('.addon-pill-card').first()).toHaveClass(/in-cart/);
  await expect(addButton).toHaveClass(/in-cart/);
  await expect(addButton).toHaveCSS('background-color', 'rgb(192, 59, 42)');
  const lemonRecommendation = recommendations.locator('.addon-pill-card').first();
  await expect(lemonRecommendation.locator('.ac-count')).toHaveText('1');
  await recommendations.locator('.addon-pill-card').first().scrollIntoViewIfNeeded();
  const addedCardGeometry = await recommendations.locator('.addon-pill-card').first().evaluate((card) => ({
    cardWidth: Math.round(card.getBoundingClientRect().width),
    actionWidth: Math.round(card.querySelector('.ac-act').getBoundingClientRect().width),
    buttonWidth: Math.round(card.querySelector('.ac-add-btn').getBoundingClientRect().width)
  }));
  expect(addedCardGeometry).toEqual({ cardWidth: 240, actionWidth: 44, buttonWidth: 44 });
  await testInfo.attach('cart-recommendations-after-add-390px', {
    body: await page.screenshot({ fullPage: false }),
    contentType: 'image/png',
  });

  // The same fixed-width add action adds another unit; quantity is reduced from the actual cart row.
  await addButton.click();
  await expect(lemonRecommendation.locator('.ac-count')).toHaveText('2');
  await expect(drinkCartRow.locator('.qty span')).toHaveText('2');
  await expect(page.locator('#cartSubtotal')).toContainText('1 095 ₽');
  await drinkCartRow.locator('[data-act="-"]').click();
  await expect(lemonRecommendation.locator('.ac-count')).toHaveText('1');
  await expect(drinkCartRow.locator('.qty span')).toHaveText('1');
  await expect(page.locator('#cartSubtotal')).toContainText('915 ₽');
  await drinkCartRow.locator('[data-act="-"]').click();
  await expect(page.locator('#cartItems .cartItem')).toHaveCount(1);
  await expect(recommendations.locator('.addon-pill-card').first()).not.toHaveClass(/in-cart/);
  await expect(recommendations.locator('.ac-add-btn').first()).not.toHaveClass(/in-cart/);
  await expect(recommendations.locator('.ac-add-btn').first()).toHaveCSS('background-color', 'rgb(239, 230, 216)');
  await expect(page.locator('#cartSubtotal')).toContainText('735 ₽');

  // A pizza topping is an embedded modifier of Margarita, never a second cart item/card.
  const margaritaRow = page.locator('#cartItems .cartItem[data-cart-idx="0"]');
  for (const viewport of [{ width: 320, height: 740 }, { width: 375, height: 812 }, { width: 390, height: 844 }, desktopViewport]) {
    await page.setViewportSize(viewport);
    const toggle = margaritaRow.locator('.ci-toggle-mods-btn');
    await toggle.scrollIntoViewIfNeeded();
    await expectCompact44pxHitTarget(toggle);
  }
  await margaritaRow.locator('.ci-toggle-mods-btn').click();
  const mushroomChip = margaritaRow.locator('.ci-mod-chip[data-mod-id="test-topping"]');
  await expect(mushroomChip).toBeVisible();
  for (const viewport of [{ width: 320, height: 740 }, { width: 375, height: 812 }, { width: 390, height: 844 }, desktopViewport]) {
    await page.setViewportSize(viewport);
    await mushroomChip.scrollIntoViewIfNeeded();
    await expectCompact44pxHitTarget(mushroomChip, 'pill');
  }
  await mushroomChip.click();
  await expect(page.locator('#cartItems .cartItem')).toHaveCount(1);
  await expect(margaritaRow.locator('.ci-mod-badge')).toContainText('Шампиньоны');
  await expect(margaritaRow.locator('.ci-unit-price')).toHaveText('825 ₽ / шт.');
  await expect(margaritaRow.locator('.ci-line-total')).toHaveText('825 ₽');
  await expect(margaritaRow.locator('.ci-mod-del')).toHaveCount(1);
  for (const viewport of [{ width: 320, height: 740 }, { width: 375, height: 812 }, { width: 390, height: 844 }, desktopViewport]) {
    await page.setViewportSize(viewport);
    const deleteModifier = margaritaRow.locator('.ci-mod-del');
    await deleteModifier.scrollIntoViewIfNeeded();
    await expectCompact44pxHitTarget(deleteModifier, 'square');
  }
  const modifierLivesInsidePizzaCard = await margaritaRow.locator('.ci-mods-list').evaluate((list) =>
    list.parentElement === list.closest('.cartItem')
  );
  expect(modifierLivesInsidePizzaCard).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#cartScrollBody').evaluate((el) => { el.scrollTop = 0; });
  await testInfo.attach('cart-margarita-with-topping-390px', {
    body: await page.screenshot({ fullPage: false }),
    contentType: 'image/png',
  });
  await margaritaRow.locator('.ci-mod-del').click();
  await expect(margaritaRow.locator('.ci-mod-badge')).toHaveCount(0);
  await expect(margaritaRow.locator('.ci-unit-price')).toHaveText('735 ₽ / шт.');

  await page.evaluate(() => { document.getElementById('cartScrollBody').scrollTop = 0; });
  await page.setViewportSize(desktopViewport);

  const row = page.locator('#cartItems .cartItem[data-cart-idx="0"]');
  await expect.poll(() => row.evaluate((el) => getComputedStyle(el).borderBottomStyle)).toBe('solid');
  await expect(row.locator('.ci-unit-price')).toHaveText('735 ₽ / шт.');
  await expect(row.locator('.ci-line-total')).toHaveText('735 ₽');
  await expect(row.locator('.ci-name')).toHaveText('Маргарита');
  await expect(row.locator('.ci-opt')).toHaveText('35 см, пышное');
  await expect(row.locator('.ci-price-update')).toHaveText('Цена обновлена по актуальному меню: 690 ₽ → 735 ₽');
  await expect(row.locator('.ci-price-update')).toHaveCSS('font-size', '10.5px');
  await expect(row.locator('[data-act="-"]')).toHaveAccessibleName('Уменьшить количество Маргарита');
  await expect(row.locator('[data-act="+"]')).toHaveAccessibleName('Увеличить количество Маргарита');

  await expect(page.locator('#checkoutPlace')).toHaveValue('');
  await expect(page.locator('#checkoutStreet')).toHaveValue('');
  await expect(page.locator('#checkoutHouse')).toHaveValue('');
  await expect(page.locator('#cartFee')).toContainText('Выберите населённый пункт');
  await expect(page.locator('#cartTotalLabel')).toHaveText('Сумма без доставки');

  const cartPanel = page.locator('#cartPanel');
  await page.locator('#cartClose').click();
  await expect(cartPanel).not.toHaveClass(/open/);

  await page.locator('#deliveryGrid [data-product-id="pz-marg"] .opts input[type="radio"]').nth(1).click();
  await page.locator('#deliveryGrid [data-product-id="pz-marg"] [data-add]').click();
  await page.locator('#cartFab').click();
  await expect(cartPanel).toHaveClass(/open/);
  await expect(row.locator('.qty span')).toHaveText('2');
  await expect(row.locator('.ci-unit-price')).toHaveText('735 ₽ / шт.');
  await expect(row.locator('.ci-line-total')).toHaveText('1 470 ₽');
  await expect(page.locator('#cartSubtotal')).toContainText('1 470 ₽');
  await expect(page.locator('#cartPromoDiscount')).toContainText('−100 ₽');
  await expect(page.locator('#cartPromoLine')).toContainText('SAVE100');

  await page.locator('#checkoutPlace').selectOption('Янтарный');
  await expect(page.locator('#cartFee')).toContainText('Янтарный');
  await expect(page.locator('#cartFee')).toContainText('200 ₽');
  await expect(page.locator('#cartTotalLabel')).toHaveText('Итого к оплате');
  await expect.poll(() => page.evaluate(() => window.totalsNow().total)).toBe(1570);
  const summaryFontSize = await page.locator('#cartFooterBar .csl-row').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(summaryFontSize).toBeLessThanOrEqual(12);

  await page.locator('.checkoutForm').scrollIntoViewIfNeeded();
  await page.evaluate(() => document.getElementById('toasts')?.remove());
  await testInfo.attach('cart-checkout-' + desktopViewport.width + 'px', {
    body: await page.screenshot({ fullPage: false }),
    contentType: 'image/png',
  });
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 740 }]) {
    await page.setViewportSize(viewport);
    await page.locator('.checkoutForm').scrollIntoViewIfNeeded();
    if (viewport.width === 390) {
      const footerHeight = await page.locator('#cartFooterBar').evaluate((el) => el.getBoundingClientRect().height);
      expect(footerHeight).toBeLessThan(200);
    }
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > window.innerWidth ||
      document.getElementById('cartScrollBody').scrollWidth > document.getElementById('cartScrollBody').clientWidth
    );
    expect(overflow).toBe(false);
    await testInfo.attach('cart-checkout-' + viewport.width + 'px', {
      body: await page.screenshot({ fullPage: false }),
      contentType: 'image/png',
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#checkoutPlace').scrollIntoViewIfNeeded();
  const addressBookButton = page.locator('#addrBookBtn');
  await expect(addressBookButton).toBeVisible();
  await page.evaluate(() => {
    const savedAddresses = [
      { id: 'saved-1', place: 'Янтарный', street: 'Советская', house: '70Г' },
      { id: 'saved-2', place: 'Янтарный', street: 'Балтийская', house: '1' }
    ];
    localStorage.setItem('zt_saved_addresses', JSON.stringify(savedAddresses));
    localStorage.setItem('zt_saved_address', JSON.stringify(savedAddresses[0]));
  });
  await addressBookButton.click();
  const addressSheet = page.locator('#addrBookSheet');
  await expect(addressSheet).toBeVisible();
  await expect(addressSheet).toHaveClass(/open/);
  await expect(addressSheet.locator('.abs-row')).toHaveCount(2);
  const addressSheetGeometry = await addressSheet.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const close = el.querySelector('.abs-close').getBoundingClientRect();
    const action = el.querySelector('.abs-ico').getBoundingClientRect();
    return {
      left: Math.round(rect.left), right: Math.round(rect.right), bottom: Math.round(rect.bottom),
      closeWidth: Math.round(close.width), actionWidth: Math.round(action.width), actionHeight: Math.round(action.height)
    };
  });
  expect(addressSheetGeometry.left).toBeGreaterThanOrEqual(0);
  expect(addressSheetGeometry.right).toBeLessThanOrEqual(390);
  expect(addressSheetGeometry.bottom).toBeLessThanOrEqual(844);
  expect(addressSheetGeometry.closeWidth).toBe(44);
  expect(addressSheetGeometry.actionWidth).toBe(44);
  expect(addressSheetGeometry.actionHeight).toBe(44);
  await testInfo.attach('cart-address-book-390px', {
    body: await page.screenshot({ fullPage: false }),
    contentType: 'image/png'
  });
  await addressSheet.locator('.abs-close').click();
  await expect(addressSheet).toBeHidden();
  await expect(page.locator('#checkoutPlace')).toHaveValue('Янтарный');
  await page.setViewportSize(desktopViewport);

  const checkoutSections = page.locator('.checkoutForm > .checkout-section');
  await expect(checkoutSections).toHaveCount(3);
  await expect(checkoutSections.nth(0).locator('h4')).toHaveText('Получение заказа');
  await expect(checkoutSections.nth(0).locator('.checkout-recipient-card')).toContainText('Данные получателя');
  await expect(checkoutSections.nth(0).locator('.checkout-recipient-card')).toContainText('Тестовый гость');
  await expect(checkoutSections.nth(0).locator('.checkout-recipient-card')).toContainText('+7 999 123-45-67');
  await expect(checkoutSections.nth(1).locator('h4')).toHaveText('Когда и как оплатить');
  await expect(checkoutSections.nth(2).locator('h4')).toHaveText('Проверка заказа');
  await expect(checkoutSections.nth(0).locator('#checkoutMethod')).toHaveCount(1);
  await expect(checkoutSections.nth(0).locator('#checkoutPlace, #checkoutStreet, #checkoutHouse')).toHaveCount(3);
  await expect(checkoutSections.nth(1).locator('#checkoutSlot, #checkoutPay')).toHaveCount(2);
  await expect(checkoutSections.nth(2).locator('#checkoutComment')).toHaveCount(1);
  await expect(checkoutSections.nth(2).locator('.cart-promo-section')).toHaveCount(1);
  await expect(page.locator('#cartItems').evaluate((el) => el.compareDocumentPosition(document.querySelector('.checkoutForm')) & Node.DOCUMENT_POSITION_FOLLOWING)).toBeTruthy();

  const timeMode = page.locator('#checkoutTimeModeSeg');
  await expect(timeMode).toHaveAttribute('role', 'group');
  await expect(timeMode).toHaveAttribute('aria-label', 'Когда получить заказ');
  const asapMode = timeMode.locator('[data-tmode="asap"]');
  const scheduledMode = timeMode.locator('[data-tmode="slot"]');
  await expect(asapMode).toHaveAttribute('aria-pressed', 'true');
  await expect(scheduledMode).toHaveAttribute('aria-pressed', 'false');
  await scheduledMode.click();
  await expect(scheduledMode).toHaveAttribute('aria-pressed', 'true');
  await expect(asapMode).toHaveAttribute('aria-pressed', 'false');
  await asapMode.click();
  await expect(asapMode).toHaveAttribute('aria-pressed', 'true');
  await expect(scheduledMode).toHaveAttribute('aria-pressed', 'false');

  const summaryOrder = await page.evaluate(() => {
    const ids = ['cartSubtotal', 'cartDiscount', 'cartPromoDiscount', 'cartFee'];
    return ids.map((id) => Array.from(document.querySelector('.cart-summary-lines').children)
      .findIndex((node) => node.id === id));
  });
  expect(summaryOrder).toEqual([...summaryOrder].sort((a, b) => a - b));
});


test('checkout time mode follows programmatic preorder slot selection', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-02T15:00:00.000Z') });
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    localStorage.setItem('zt_inst_hide', '1');
    localStorage.setItem('zt_cart', JSON.stringify([{
      key: 'pz-marg_1',
      id: 'pz-marg',
      oi: 1,
      name: 'Маргарита',
      opt: '35 см, пышное',
      price: 735,
      sz: 35,
      qty: 1
    }]));
    localStorage.removeItem('zt_cartpromo');
    localStorage.removeItem('zt_saved_address');
    localStorage.removeItem('zt_saved_addresses');
    sessionStorage.removeItem('zt_checkout_draft');
    sessionStorage.setItem('splashDone', '1');
  });

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    let body = { ok: true, items: [], orders: [], pending: [], customers: [], threads: [], messages: [], promos: [] };
    if (url.pathname === '/api/dmenu') {
      body = { items: [MENU_ITEM], updatedAt: '2026-11-03T10:00:00.000Z' };
    } else if (url.pathname === '/api/delivery/info') {
      const isPreorderFixture = new Date().getTime() >= Date.parse('2026-11-02T20:30:00.000Z');
      body = {
        zones: [{ fee: 200, min: 0, places: ['Янтарный'] }],
        today: { isOpen: true, canAcceptAsap: !isPreorderFixture, open: 11, close: isPreorderFixture ? 20 : 22 },
        schedule: { open: 11, close: isPreorderFixture ? 20 : 22 },
        days: [
          { offset: 0, date: '2026-11-02', isOpen: true, open: 11, close: isPreorderFixture ? 20 : 22 },
          { offset: 1, date: '2026-11-03', isOpen: true, open: 11, close: 22 }
        ],
        busySlots: [],
        weekPromo: null,
        pizzaMonth: null
      };
    } else if (url.pathname === '/api/me/free-delivery') {
      body = { code: '' };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });

  await page.goto('/?brand=delivery');
  await expect.poll(() => page.evaluate(() => Array.isArray(window.DMENU) && window.DMENU.some((item) => item.id === 'pz-marg'))).toBe(true);
  await page.evaluate(() => window.refreshDeliveryInfo());
  await page.evaluate(() => {
    document.getElementById('cartPanel').classList.add('open');
    window.renderCart();
  });

  const timeMode = page.locator('#checkoutTimeModeSeg');
  const asapMode = timeMode.locator('[data-tmode="asap"]');
  const scheduledMode = timeMode.locator('[data-tmode="slot"]');
  await expect(asapMode).toHaveAttribute('aria-pressed', 'true');
  await expect(scheduledMode).toHaveAttribute('aria-pressed', 'false');
  await scheduledMode.click();
  await expect(scheduledMode).toHaveAttribute('aria-pressed', 'true');
  await expect(asapMode).toHaveAttribute('aria-pressed', 'false');
  await asapMode.click();
  await expect(asapMode).toHaveAttribute('aria-pressed', 'true');
  await expect(scheduledMode).toHaveAttribute('aria-pressed', 'false');

  await page.clock.setFixedTime(new Date('2026-11-02T20:30:00.000Z'));
  await page.evaluate(() => window.refreshDeliveryInfo());
  const missingPreorderSlot = await page.evaluate(() => window.CheckoutValidation.resolveSlot());
  expect(missingPreorderSlot).toMatchObject({ ok: false, message: 'Выберите время доставки для предзаказа ⏰' });
  await expect(page.locator('#checkoutSlot')).toHaveValue('');
  await expect(scheduledMode).toHaveAttribute('aria-pressed', 'true');
  await expect(asapMode).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#checkoutSlot').locator('xpath=..')).toBeVisible();
});

test('checkout reuses the same idempotency key after a network failure and reload', async ({ page }) => {
  // Keep checkout inside opening hours so the test exercises ASAP retry, not pre-order slot validation.
  await page.clock.install({ time: new Date('2026-11-04T13:00:00.000Z') });
  const submittedIds = [];
  let firstAttempt = true;

  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    localStorage.setItem('zt_inst_hide', '1');
    localStorage.setItem('zt_user', 'checkout-idempotency-test-token');
    localStorage.setItem('zt_cart', JSON.stringify([{
      key: 'pz-marg_1',
      id: 'pz-marg',
      oi: 1,
      name: 'Маргарита',
      opt: '35 см, пышное',
      price: 735,
      sz: 35,
      qty: 1
    }]));
    sessionStorage.setItem('splashDone', '1');
  });

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    let body = { ok: true, items: [], orders: [], pending: [], customers: [], threads: [], messages: [], promos: [] };

    if (url.pathname === '/api/me') {
      body = {
        customer: {
          id: 'checkout-idempotency-guest',
          name: 'Checkout Guest',
          phone: '+7 999 123-45-67',
          role: 'guest',
          verified: 1,
          cups: 0,
          stamps: 0,
          free: 0,
          history: [],
          qr: 'checkout-idempotency-guest'
        }
      };
    } else if (url.pathname === '/api/dmenu') {
      body = { items: [MENU_ITEM], updatedAt: '2026-11-03T10:00:00.000Z' };
    } else if (url.pathname === '/api/delivery/info') {
      body = {
        zones: [{ fee: 200, min: 0, places: ['Янтарный'] }],
        today: { isOpen: true, canAcceptAsap: true, open: 11, close: 22 },
        schedule: { open: 11, close: 22 },
        days: [
          { offset: 0, date: '2026-11-04', isOpen: true, open: 11, close: 22 },
          { offset: 1, date: '2026-11-05', isOpen: true, open: 11, close: 22 }
        ],
        busySlots: [],
        weekPromo: null,
        pizzaMonth: null
      };
    } else if (url.pathname === '/api/me/free-delivery') {
      body = { code: null };
    } else if (url.pathname === '/api/promo/info') {
      body = { ok: true, kind: 'fixed', value: 0, code: url.searchParams.get('code') };
    } else if (url.pathname === '/api/orders/mine') {
      body = { orders: [] };
    } else if (url.pathname === '/api/orders' && request.method() === 'POST') {
      const payload = request.postDataJSON();
      submittedIds.push(payload.client_order_id);
      if (firstAttempt) {
        firstAttempt = false;
        await route.abort('failed');
        return;
      }
      body = {
        order: {
          id: 'idempotency-order-1',
          no: 901,
          status: 'new',
          total: 735,
          items: [{ id: 'pz-marg', name: 'Маргарита', qty: 1, price: 735 }]
        }
      };
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body)
    });
  });

  await page.goto('/?brand=delivery');
  await page.waitForFunction(() =>
    window.me && window.me.id === 'checkout-idempotency-guest' &&
    Array.isArray(window.DMENU) && window.DMENU.some(item => item.id === 'pz-marg')
  );
  await page.locator('#cartFab').click();
  await page.locator('#checkoutMethod').selectOption('pickup');
  await page.locator('#checkoutBtn').click();

  await expect.poll(() => submittedIds.length).toBe(1);
  await expect(page.locator('#checkoutBtn')).toBeEnabled();
  const firstId = submittedIds[0];
  expect(firstId).toMatch(/^ord_[A-Za-z0-9_-]+$/);
  await expect.poll(() => page.evaluate(() =>
    localStorage.getItem('zt_pending_order_id:checkout-idempotency-guest')
  )).toBe(firstId);

  await page.reload();
  await page.waitForFunction(() =>
    window.me && window.me.id === 'checkout-idempotency-guest' &&
    Array.isArray(window.DMENU) && window.DMENU.some(item => item.id === 'pz-marg')
  );
  await page.locator('#cartFab').click();
  await page.locator('#checkoutMethod').selectOption('pickup');
  await page.locator('#checkoutBtn').click();

  await expect.poll(() => submittedIds.length).toBe(2);
  expect(submittedIds[1]).toBe(firstId);
  await expect(page.locator('#orderTrackModal')).toHaveClass(/show/);
  await expect.poll(() => page.evaluate(() =>
    localStorage.getItem('zt_pending_order_id:checkout-idempotency-guest')
  )).toBeNull();
  await expect.poll(() => page.evaluate(() =>
    sessionStorage.getItem('zt_checkout_draft')
  )).toBeNull();

  await page.reload();
  await page.waitForFunction(() =>
    window.me && window.me.id === 'checkout-idempotency-guest' &&
    Array.isArray(window.DMENU) && window.DMENU.some(item => item.id === 'pz-marg')
  );
  await expect(page.locator('#checkoutMethod')).toHaveValue('delivery');
  await expect(page.locator('#checkoutPlace')).toHaveValue('');
});

test('successful preorder keeps an explicit empty time selection for the next order', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-02T20:30:00.000Z') });
  let submittedOrders = 0;
  const submittedSlots = [];

  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    localStorage.setItem('zt_inst_hide', '1');
    localStorage.setItem('zt_cart', JSON.stringify([{
      key: 'pz-marg_1',
      id: 'pz-marg',
      oi: 1,
      name: 'Маргарита',
      opt: '35 см, пышное',
      price: 735,
      sz: 35,
      qty: 1
    }]));
    localStorage.removeItem('zt_cartpromo');
    localStorage.setItem('zt_user', 'successful-preorder-test-token');
    sessionStorage.setItem('splashDone', '1');
    sessionStorage.removeItem('zt_checkout_draft');
  });

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    let body = { ok: true, items: [], orders: [], pending: [], customers: [], threads: [], messages: [], promos: [] };

    if (url.pathname === '/api/me') {
      body = {
        customer: {
          id: 'successful-preorder-test-guest',
          name: 'Preorder Test Guest',
          phone: '+7 999 123-45-67',
          role: 'guest',
          verified: 1,
          cups: 0,
          stamps: 0,
          free: 0,
          history: [],
          qr: 'successful-preorder-test-guest'
        }
      };
    } else if (url.pathname === '/api/dmenu') {
      body = { items: [MENU_ITEM], updatedAt: '2026-11-03T10:00:00.000Z' };
    } else if (url.pathname === '/api/delivery/info') {
      body = {
        zones: [{ fee: 200, min: 0, places: ['Янтарный'] }],
        today: { isOpen: true, canAcceptAsap: false, open: 11, close: 20 },
        schedule: { open: 11, close: 20 },
        days: [
          { offset: 0, date: '2026-11-02', isOpen: true, open: 11, close: 20 },
          { offset: 1, date: '2026-11-03', isOpen: true, open: 11, close: 22 }
        ],
        busySlots: [],
        weekPromo: null,
        pizzaMonth: null
      };
    } else if (url.pathname === '/api/me/free-delivery') {
      body = { code: '' };
    } else if (url.pathname === '/api/orders' && request.method() === 'POST') {
      submittedOrders += 1;
      submittedSlots.push(request.postDataJSON().slot);
      body = {
        order: {
          id: 'preorder-reset-order-1',
          no: 902,
          status: 'new',
          total: 735,
          slot: request.postDataJSON().slot,
          items: [{ id: 'pz-marg', name: 'Маргарита', qty: 1, price: 735 }]
        }
      };
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body)
    });
  });

  await page.goto('/?brand=delivery');
  await expect.poll(() => page.evaluate(() =>
    Array.isArray(window.DMENU) && window.DMENU.some((item) => item.id === 'pz-marg')
  )).toBe(true);
  await page.evaluate(() => window.refreshDeliveryInfo());
  await page.evaluate(() => {
    document.getElementById('cartPanel').classList.add('open');
    window.renderCart();
  });

  const slot = page.locator('#checkoutSlot');
  const slotLabel = slot.locator('xpath=..');
  const mode = page.locator('#checkoutTimeModeSeg');
  const asap = mode.locator('[data-tmode="asap"]');
  const scheduled = mode.locator('[data-tmode="slot"]');
  await expect(scheduled).toHaveAttribute('aria-pressed', 'true');
  await expect(asap).toHaveAttribute('aria-pressed', 'false');
  await expect(slotLabel).toBeVisible();
  await expect(slot).toHaveValue('');

  const availableSlot = await slot.locator('option:not([disabled])').evaluateAll((options) =>
    options.map((option) => option.value).find((value) => value && value !== 'asap')
  );
  expect(availableSlot).toBeTruthy();
  await slot.selectOption(availableSlot);

  await page.locator('#checkoutPlace').selectOption('Янтарный');
  await page.locator('#checkoutStreet').fill('Советская');
  await page.locator('#checkoutHouse').fill('1');
  await page.locator('#checkoutBtn').click();
  await expect.poll(() => submittedOrders).toBe(1);
  expect(submittedSlots).toEqual([availableSlot]);
  await expect(page.locator('#orderTrackModal')).toHaveClass(/show/);
  await page.evaluate(() => { window.__cartReferenceBeforeRepeat = window.cart; });

  await page.locator('#orderTrackModal [data-ot-repeat]').click();
  await expect(page.locator('#cartPanel')).toHaveClass(/open/);
  await expect.poll(() => page.evaluate(() => window.cart.reduce((sum, item) => sum + (Number(item.qty) || 1), 0))).toBe(1);
  await expect.poll(() => page.evaluate(() => window.cart === window.__cartReferenceBeforeRepeat)).toBe(true);
  // The FAB is intentionally hidden while the cart drawer is open; verify it returns after close.
  const cartFab = page.locator('#cartFab');
  await expect(cartFab).toBeHidden();
  await expect(slot).toHaveValue('');
  await expect(scheduled).toHaveAttribute('aria-pressed', 'true');
  await expect(asap).toHaveAttribute('aria-pressed', 'false');
  await expect(slotLabel).toBeVisible();

  await page.locator('#cartClose').click();
  await expect(page.locator('#cartPanel')).not.toHaveClass(/open/);
  await expect(cartFab).toBeVisible();
  await cartFab.click();
  await expect(page.locator('#cartPanel')).toHaveClass(/open/);

  await page.locator('#checkoutPlace').selectOption('Янтарный');
  await page.locator('#checkoutStreet').fill('Советская');
  await page.locator('#checkoutHouse').fill('1');
  await page.locator('#checkoutBtn').click();
  await expect.poll(() => submittedOrders).toBe(1);
  await expect(page.locator('#checkoutSlot')).toHaveClass(/field-error|need-slot/);
});


test('scheduled mode without a selected slot survives checkout draft restore', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-02T13:00:00.000Z') });
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    localStorage.setItem('zt_inst_hide', '1');
    localStorage.setItem('zt_cart', JSON.stringify([{
      key: 'pz-marg_1', id: 'pz-marg', oi: 1, name: 'Маргарита',
      opt: '35 см, пышное', price: 735, sz: 35, qty: 1
    }]));
    sessionStorage.setItem('splashDone', '1');
  });
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    let body = { ok: true, items: [], orders: [], pending: [], customers: [], threads: [], messages: [], promos: [] };
    if (url.pathname === '/api/dmenu') {
      body = { items: [MENU_ITEM], updatedAt: '2026-11-03T10:00:00.000Z' };
    } else if (url.pathname === '/api/delivery/info') {
      body = {
        zones: [{ fee: 200, min: 0, places: ['Янтарный'] }],
        today: { isOpen: true, canAcceptAsap: true, open: 11, close: 22 },
        schedule: { open: 11, close: 22 },
        days: [
          { offset: 0, date: '2026-11-02', isOpen: true, open: 11, close: 22 },
          { offset: 1, date: '2026-11-03', isOpen: true, open: 11, close: 22 }
        ],
        busySlots: [], weekPromo: null, pizzaMonth: null
      };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });

  await page.goto('/?brand=delivery');
  await expect.poll(() => page.evaluate(() => window.DMENU.some(item => item.id === 'pz-marg'))).toBe(true);
  await page.evaluate(() => window.refreshDeliveryInfo());
  await page.evaluate(() => {
    document.getElementById('cartPanel').classList.add('open');
    window.renderCart();
  });
  const asap = page.locator('#checkoutTimeModeSeg [data-tmode="asap"]');
  const scheduled = page.locator('#checkoutTimeModeSeg [data-tmode="slot"]');
  const slot = page.locator('#checkoutSlot');
  await expect(asap).toHaveAttribute('aria-pressed', 'true');
  await scheduled.click();
  await expect(scheduled).toHaveAttribute('aria-pressed', 'true');
  await expect(slot).toHaveValue('');
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('zt_checkout_draft') || '{}').timeMode)).toBe('slot');

  await page.reload();
  await expect.poll(() => page.evaluate(() => window.DMENU.some(item => item.id === 'pz-marg'))).toBe(true);
  await page.evaluate(() => window.refreshDeliveryInfo());
  await page.evaluate(() => {
    document.getElementById('cartPanel').classList.add('open');
    window.renderCart();
  });

  const restoredState = await page.evaluate(() => {
    const slot = document.getElementById('checkoutSlot');
    const draft = JSON.parse(sessionStorage.getItem('zt_checkout_draft') || '{}');
    return {
      draftMode: draft.timeMode,
      draftSlot: draft.slot,
      slotMode: slot.dataset.checkoutTimeMode || slot.__checkoutTimeMode || null,
      slotValue: slot.value,
      selectedMode: document.querySelector('#checkoutTimeModeSeg [data-tmode="slot"]')?.getAttribute('aria-pressed')
    };
  });
  expect(restoredState).toEqual({
    draftMode: 'slot',
    draftSlot: '',
    slotMode: 'slot',
    slotValue: '',
    selectedMode: 'true'
  });
  await expect(page.locator('#checkoutSlot').locator('xpath=..')).toBeVisible();
  const result = await page.evaluate(() => window.CheckoutValidation.resolveSlot());
  expect(result).toMatchObject({ ok: false });
  await expect(page.locator('#checkoutSlot')).toHaveValue('');
});

test('scheduled mode stays active until a slot is selected during service hours', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-02T15:00:00.000Z') });
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    localStorage.setItem('zt_inst_hide', '1');
    localStorage.setItem('zt_cart', JSON.stringify([{
      key: 'pz-marg_1',
      id: 'pz-marg',
      oi: 1,
      name: 'Маргарита',
      opt: '35 см, пышное',
      price: 735,
      sz: 35,
      qty: 1
    }]));
    sessionStorage.setItem('splashDone', '1');
  });

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    let body = { ok: true, items: [], orders: [], pending: [], customers: [], threads: [], messages: [], promos: [] };
    if (url.pathname === '/api/dmenu') {
      body = { items: [MENU_ITEM], updatedAt: '2026-11-03T10:00:00.000Z' };
    } else if (url.pathname === '/api/delivery/info') {
      body = {
        zones: [{ fee: 200, min: 0, places: ['Янтарный'] }],
        today: { isOpen: true, canAcceptAsap: true, open: 11, close: 22 },
        schedule: { open: 11, close: 22 },
        days: [
          { offset: 0, date: '2026-11-02', isOpen: true, open: 11, close: 22 },
          { offset: 1, date: '2026-11-03', isOpen: true, open: 11, close: 22 }
        ],
        busySlots: [],
        weekPromo: null,
        pizzaMonth: null
      };
    } else if (url.pathname === '/api/me/free-delivery') {
      body = { code: '' };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });

  await page.goto('/?brand=delivery');
  await expect.poll(() => page.evaluate(() => Array.isArray(window.DMENU) && window.DMENU.some((item) => item.id === 'pz-marg'))).toBe(true);
  await page.evaluate(() => window.refreshDeliveryInfo());
  await page.evaluate(() => {
    document.getElementById('cartPanel').classList.add('open');
    window.renderCart();
  });

  const mode = page.locator('#checkoutTimeModeSeg');
  const asap = mode.locator('[data-tmode="asap"]');
  const scheduled = mode.locator('[data-tmode="slot"]');
  const slot = page.locator('#checkoutSlot');
  const slotLabel = slot.locator('xpath=..');

  await expect(asap).toHaveAttribute('aria-pressed', 'true');
  await scheduled.click();
  await expect(scheduled).toHaveAttribute('aria-pressed', 'true');
  await expect(asap).toHaveAttribute('aria-pressed', 'false');
  await expect(slotLabel).toBeVisible();
  await expect(slot).toHaveValue('');

  const availableSlot = await slot.locator('option:not([disabled])').evaluateAll((options) =>
    options.map((option) => option.value).find((value) => value && value !== 'asap')
  );
  expect(availableSlot).toBeTruthy();
  await slot.selectOption(availableSlot);
  await expect(slot).toHaveValue(availableSlot);
  await expect(scheduled).toHaveAttribute('aria-pressed', 'true');

  await asap.click();
  await expect(asap).toHaveAttribute('aria-pressed', 'true');
  await expect(scheduled).toHaveAttribute('aria-pressed', 'false');
  await expect(slot).toHaveValue('asap');
  await expect(slotLabel).toBeHidden();
});


test('cart continue-shopping action keeps a 44px minimum hit target on narrow mobile screens', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
    localStorage.setItem('zt_inst_hide', '1');
    localStorage.setItem('zt_cart', JSON.stringify([{
      key: 'pz-marg_1', id: 'pz-marg', oi: 1, name: 'Маргарита',
      opt: '35 см, пышное', price: 735, sz: 35, qty: 1
    }]));
    sessionStorage.setItem('splashDone', '1');
  });
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    let body = { ok: true, items: [], orders: [], pending: [], customers: [], threads: [], messages: [], promos: [] };
    if (url.pathname === '/api/dmenu') body = { items: [MENU_ITEM], updatedAt: '2026-11-03T10:00:00.000Z' };
    else if (url.pathname === '/api/delivery/info') body = {
      zones: [{ fee: 200, min: 0, places: ['Янтарный'] }],
      today: { isOpen: true, canAcceptAsap: true, open: 11, close: 22 },
      schedule: { open: 11, close: 22 },
      days: [{ offset: 0, date: '2026-11-04', isOpen: true, open: 11, close: 22 }],
      busySlots: [], weekPromo: null, pizzaMonth: null
    };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });

  await page.goto('/?brand=delivery');
  await expect.poll(() => page.evaluate(() => Array.isArray(window.DMENU) && window.DMENU.some((item) => item.id === 'pz-marg'))).toBe(true);
  await page.locator('#cartFab').click();
  const continueButton = page.locator('#cartClose');
  await expect(continueButton).toBeVisible();
  const rect = await continueButton.evaluate((button) => {
    const box = button.getBoundingClientRect();
    return { width: Math.round(box.width), height: Math.round(box.height) };
  });
  expect(rect.height).toBeGreaterThanOrEqual(44);
});
