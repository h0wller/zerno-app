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

test('вызов сотрудника появляется по запросу/непонятному тексту, требует подтверждения (два тапа) и исчезает после отправки', async ({ page }) => {
  await prepare(page);
  await page.locator('#chatFab').click();

  // При обычном открытии чата кнопки «Позвать сотрудника» нет
  const call = page.locator('.chatHint', { hasText: 'Позвать сотрудника' });
  await expect(call).toHaveCount(0);

  // Пишем непонятный боту запрос — бот предлагает позвать сотрудника и показывает кнопку
  await page.locator('#chatInput').fill('абырвалг');
  await page.locator('#chatInput').press('Enter');
  await expect(call).toBeVisible({ timeout: 5000 });

  // 1-й тап — появляется предупреждение (.armed)
  await call.click();
  const armedBtn = page.locator('.chatHint.armed', { hasText: 'Точно позвать' });
  await expect(armedBtn).toBeVisible();

  // 2-й тап — подтверждаем вызов, кнопка исчезает до следующего раза
  await armedBtn.click();
  await expect(page.locator('.chatHint', { hasText: 'Позвать сотрудника' })).toHaveCount(0);
  await expect(page.locator('.chatHint.armed')).toHaveCount(0);
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


test('support launcher announces the action available in its current state', async ({ page }) => {
  for (const brand of ['coffee', 'delivery']) {
    await prepare(page, '/?brand=' + brand);
    const launcher = page.locator('#chatFab');

    await expect(launcher).toHaveAttribute('aria-label', 'Открыть чат поддержки');
    await launcher.click();
    await expect(page.locator('#chatPanel')).toHaveClass(/open/);
    await expect(launcher).toHaveAttribute('aria-label', 'Закрыть чат поддержки');

    await page.locator('#chatClose').click();
    await expect(page.locator('#chatPanel')).not.toHaveClass(/open/);
    await expect(launcher).toHaveAttribute('aria-label', 'Открыть чат поддержки');
  }
});
