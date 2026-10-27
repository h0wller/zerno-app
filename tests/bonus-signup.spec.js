// F3.64: бар «подарок от суммы» и freeFrom НЕ убираются (продуктовое решение от 27.10.2026,
// см. docs/frontend-todo.md §4). Тест зафиксирован на пустой корзине: плашка скрыта.
import { test, expect } from '@playwright/test';

test.describe('Signup Bonuses Suite (F3.64)', () => {
  test('no delivery promo bar or gifts on high cart sum', async ({ page }) => {
    await page.goto('/?brand=delivery');
    const bar = page.locator('#deliveryPromoBar');
    await expect(bar).toBeHidden();
  });
});
