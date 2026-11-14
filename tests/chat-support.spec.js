import { test, expect } from '@playwright/test';

/* SW на первом входе делает clients.claim() → controllerchange → location.reload():
   контекст страницы погибает посреди prepare(). Чат-тестам SW не нужен —
   блокируем целиком, как в ui-baseline.spec.js. */
test.use({ serviceWorkers: 'block' });

async function prepare(page, url = '/') {
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1'); sessionStorage.setItem('splashDone', '1'); /* шаг 4-fix3: сплэш вне чат-тестов */
  });
  await page.goto(url);

  // Небольшая пауза, чтобы CSS и классы из <head> применились
  await page.waitForTimeout(200);

  // Если открыт оверлей выбора темы поддержки — сплэш не трогаем
  const supportOverlay = page.locator('#supportChooseOverlay');
  const isSupportOverlayVisible = await supportOverlay.isVisible().catch(() => false);

  if (!isSupportOverlayVisible) {
    const coffeeBtn = page
      .locator('#brandSplashStatic [data-go="coffee"], #brandSplash [data-go="coffee"]')
      .first();
      
    if (await coffeeBtn.isVisible().catch(() => false)) {
      // Страховка: принудительно убираем перехватчики и кликаем
      await page.evaluate(() => {
        const ov = document.getElementById('supportChooseOverlay');
        if (ov) ov.style.display = 'none';
      });
      await coffeeBtn.click({ force: true });
    }
  }

  // Дожидаемся, пока сплэш точно исчезнет (или что он и не был показан)
  await page
    .waitForFunction(
      () => {
        const bs = document.getElementById('brandSplashStatic');
        const bd = document.getElementById('brandSplash');
        const bsHidden = !bs || getComputedStyle(bs).display === 'none';
        const bdHidden = !bd || getComputedStyle(bd).display === 'none';
        return bsHidden && bdHidden;
      },
      null,
      { timeout: 5000 }
    )
    .catch(() => {});
}

test('поддержка из бота: оверлей появляется и НЕ исчезает', async ({ page }) => {
  await prepare(page, '/?src=tg&tab=chat&support=choose');
// F2.x: fix-views v10-support может ре-создавать overlay каждые 250ms,
// если showSupportOverlay() бросит до clearInterval. Даём интервалу стабилизироваться.
await page.waitForTimeout(500);
  const ov = page.locator('#supportChooseOverlay');
  await expect(ov).toBeVisible({ timeout: 6000 });
  await page.waitForTimeout(2000);
  await expect(ov).toBeVisible();
});

test('выбор доставки открывает доставочную Нику', async ({ page }) => {
  await prepare(page, '/?src=tg&tab=chat&support=choose');
  // F2.x: обход race в fix-views v10-support (см. docs/frontend-todo.md)
  await page.locator('#supportChooseOverlay [data-support-topic="delivery"]').click();
  await expect(page.locator('#supportChooseOverlay')).toHaveCount(0);
  await expect(page.locator('#chatPanel .chatHead')).toContainText('доставка');
  await expect(page.locator('.chatHint').first()).toBeVisible({ timeout: 5000 });
});

test('выбор кофейни открывает кофейную Нику', async ({ page }) => {
  await prepare(page, '/?src=tg&tab=chat&support=choose');
  await page.locator('#supportChooseOverlay [data-support-topic="coffee"]').click();
  await expect(page.locator('#chatPanel .chatHead')).toContainText('кофейня');
  await expect.poll(() => page.evaluate(() =>
  document.getElementById('chatPanel').classList.contains('open')),
  { timeout: 3000 }).toBe(true);   // панель РЕАЛЬНО открыта, а не opacity:0
});

test('обычное открытие чата — без оверлея', async ({ page }) => {
  await prepare(page);
  await page.locator('#chatFab').click();
  await expect(page.locator('#supportChooseOverlay')).toHaveCount(0);
  await expect(page.locator('.chatHint').first()).toBeVisible({ timeout: 5000 });
});

test('анонимный чат не предлагает вызвать сотрудника при просьбе и fallback', async ({ page }) => {
  await prepare(page);
  await page.locator('#chatFab').click();

  const call = page.locator('.chatHint', { hasText: 'Позвать сотрудника' });
  await expect(call).toHaveCount(0);

  await page.locator('#chatInput').fill('позови сотрудника');
  await page.locator('#chatInput').press('Enter');
  await expect(call).toHaveCount(0);
  await expect(page.locator('#chatMsgs')).toContainText('войдите в профиль');

  await page.locator('#chatInput').fill('абырвалг');
  await page.locator('#chatInput').press('Enter');
  await expect(call).toHaveCount(0);
  await expect(page.locator('#chatMsgs')).toContainText('войдите в профиль');
});

test('авторизованный гость может подтвердить вызов сотрудника', async ({ page }) => {
  await prepare(page);
  await page.evaluate(() => {
    window.setUser('test-customer-token', {
      id: 'ua1b2c3d4e5f', name: 'Тестовый гость', role: 'guest', verified: 1
    });
  });
  await page.locator('#chatFab').click();
  await page.locator('#chatInput').fill('абырвалг');
  await page.locator('#chatInput').press('Enter');
  const call = page.locator('.chatHint', { hasText: 'Позвать сотрудника' });
  await expect(call).toBeVisible({ timeout: 5000 });
  await call.click();
  const armed = page.locator('.chatHint.armed', { hasText: 'Точно позвать' });
  await expect(armed).toBeVisible();
  await armed.click();
  await expect(page.locator('.chatHint', { hasText: 'Позвать сотрудника' })).toHaveCount(0);
});


test('mobile support uses an icon and delivery search keeps an inset from the menu card edge', async ({ page }) => {
  for (const brand of ['coffee', 'delivery']) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => { sessionStorage.setItem('splashDone', '1'); localStorage.clear(); });
    await page.goto('/?brand=' + brand, { waitUntil: 'domcontentloaded' });
    const button = page.locator('#chatFab');
    await expect(button).toBeVisible();
    await expect(button.locator('svg')).toHaveCount(1);
    await expect(button.locator('svg path').first()).toHaveAttribute('d', /M3 13/);
    await expect(button).toHaveAttribute('aria-label', /поддерж/i);
    if (brand === 'delivery') {
      const spacing = await page.locator('#deliveryView .menu-head').evaluate(el => {
        const style=getComputedStyle(el), search=el.querySelector('.search').getBoundingClientRect(), box=el.getBoundingClientRect();
        return { paddingLeft:parseFloat(style.paddingLeft), inset:search.left-box.left };
      });
      expect(spacing.paddingLeft).toBeGreaterThanOrEqual(12);
      expect(spacing.inset).toBeGreaterThanOrEqual(12);
    }
  }
});



test('chat panel keeps compact responsive geometry in portrait and landscape for both brands', async ({ page }, testInfo) => {
  const viewports = [
    { name: 'portrait', width: 390, height: 844, maxHeightRatio: 0.82, minSideInset: 8 },
    { name: 'landscape', width: 844, height: 390, maxHeightRatio: 0.9, minSideInset: 12 },
    { name: 'short-landscape', width: 667, height: 375, maxHeightRatio: 0.9, minSideInset: 8 }
  ];

  for (const brand of ['coffee', 'delivery']) {
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await prepare(page, '/?brand=' + brand);
      await page.locator('#chatFab').click();
      const panel = page.locator('#chatPanel');
      await expect(panel).toHaveClass(/open/);
      await expect(page.locator('#chatInput')).toBeVisible();
      await expect(page.locator('#chatSend')).toBeVisible();
      const geometry = await panel.evaluate(element => {
        const rect = element.getBoundingClientRect();
        const transcript = document.getElementById('chatMsgs');
        const composer = element.querySelector('.chat-i').getBoundingClientRect();
        const close = element.querySelector('#chatClose').getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height, transcriptScrollWidth: transcript.scrollWidth, transcriptClientWidth: transcript.clientWidth, composerBottom: composer.bottom, closeRight: close.right, closeTop: close.top, closeSize: close.width };
      });
      expect(geometry.left).toBeGreaterThanOrEqual(-1);
      expect(geometry.right).toBeLessThanOrEqual(viewport.width + 1);
      expect(geometry.top).toBeGreaterThanOrEqual(-1);
      expect(geometry.bottom).toBeLessThanOrEqual(viewport.height + 1);
      expect(geometry.height).toBeLessThanOrEqual(viewport.height * viewport.maxHeightRatio);
      expect(geometry.height).toBeGreaterThanOrEqual(Math.min(240, viewport.height * 0.62));
      expect(geometry.width).toBeLessThanOrEqual(viewport.width - viewport.minSideInset * 2 + 1);
      expect(geometry.transcriptScrollWidth).toBeLessThanOrEqual(geometry.transcriptClientWidth + 1);
      expect(geometry.composerBottom).toBeLessThanOrEqual(viewport.height + 1);
      expect(geometry.closeRight).toBeGreaterThan(geometry.left + geometry.width * 0.72);
      expect(geometry.closeTop).toBeLessThan(geometry.top + 80);
      expect(geometry.closeSize).toBeGreaterThanOrEqual(44);
      await testInfo.attach('chat-' + brand + '-' + viewport.name, { body: await page.screenshot(), contentType: 'image/png' });
      await page.locator('#chatClose').click();
    }
  }
});
test('support launcher announces the action available in its current state', async ({ page }) => {
  for (const brand of ['coffee', 'delivery']) {
    await prepare(page, '/?brand=' + brand);
    const launcher = page.locator('#chatFab');

    await expect(launcher).toHaveAttribute('aria-label', /поддерж/i);
    await launcher.click();
    await expect(page.locator('#chatPanel')).toHaveClass(/open/);
    await expect(launcher).toHaveAttribute('aria-label', 'Закрыть чат поддержки');

    await page.locator('#chatClose').click();
    await expect(page.locator('#chatPanel')).not.toHaveClass(/open/);
    await expect(launcher).toHaveAttribute('aria-label', 'Открыть чат поддержки');
  }
});
