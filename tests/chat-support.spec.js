import { test, expect } from '@playwright/test';

async function skipSplash(page){
  const sp = page.locator('#brandSplash');
  if (await sp.count()) await sp.locator('[data-go="coffee"]').click();
}

/* ВАЖНО: эмулируем "вернувшегося" гостя, чтобы authModal не открывался автоматически */
async function prepare(page, url = '/') {
  await page.addInitScript(() => {
    localStorage.setItem('zt_onb', '1');
  });
  await page.goto(url);

  // кликаем по тому сплэшу, который реально видим: статичный (#brandSplashStatic) или старый динамический
  const coffeeBtn = page
    .locator('#brandSplashStatic [data-go="coffee"], #brandSplash [data-go="coffee"]')
    .first();
  if (await coffeeBtn.isVisible().catch(() => false)) {
    await coffeeBtn.click();
  }

  // дожидаемся, пока сплэш исчезнет и с body снимется visibility:hidden
  await page
    .waitForFunction(
      () =>
        !document.getElementById('brandSplashStatic') &&
        !document.getElementById('brandSplash') &&
        !document.documentElement.classList.contains('need-splash'),
      null,
      { timeout: 5000 }
    )
    .catch(() => {});
}

test('поддержка из бота: оверлей появляется и НЕ исчезает', async ({ page }) => {
  await prepare(page, '/?src=tg&tab=chat&support=choose');
  const ov = page.locator('#supportChooseOverlay');
  await expect(ov).toBeVisible({ timeout: 6000 });
  await page.waitForTimeout(2000);
  await expect(ov).toBeVisible();
});

test('выбор доставки открывает доставочную Нику', async ({ page }) => {
  await prepare(page, '/?src=tg&tab=chat&support=choose');
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
