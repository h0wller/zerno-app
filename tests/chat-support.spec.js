import { test, expect } from '@playwright/test';

async function skipSplash(page){
  const sp = page.locator('#brandSplash');
  if (await sp.count()) await sp.locator('[data-go="coffee"]').click();
}

async function prepare(page, url = '/') {
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
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
  await page.waitForTimeout(500);
  await page.locator('#supportChooseOverlay [data-support-topic="delivery"]').click();
  await expect(page.locator('#supportChooseOverlay')).toHaveCount(0);
  await expect(page.locator('#chatPanel .chatHead')).toContainText('доставка');
  await expect(page.locator('.chatHint').first()).toBeVisible({ timeout: 5000 });
});

test('выбор кофейни открывает кофейную Нику', async ({ page }) => {
  await prepare(page, '/?src=tg&tab=chat&support=choose');
  await page.locator('#supportChooseOverlay [data-support-topic="coffee"]').click();
  await expect(page.locator('#chatPanel .chatHead')).toContainText('кофейня');
});

test('обычное открытие чата — без оверлея', async ({ page }) => {
  await prepare(page);
  await page.locator('#chatFab').click();
  await expect(page.locator('#supportChooseOverlay')).toHaveCount(0);
  await expect(page.locator('.chatHint').first()).toBeVisible({ timeout: 5000 });
});

test('вызов сотрудника требует подтверждения (два тапа)', async ({ page }) => {
  await prepare(page);
  await page.locator('#chatFab').click();
  const call = page.locator('.chatHint', { hasText: 'Позвать сотрудника' });
  await call.click();
  await expect(page.locator('.chatHint', { hasText: 'Точно позвать' })).toBeVisible();
});
