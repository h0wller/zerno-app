import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isWeekdayLunchDiscountActive, validateDeliverySlot } from '../../server/domain/delivery-hours.js';
import { calculateOrderDiscounts } from '../../server/domain/order-discounts.js';

test('обеденная акция действует по будням с 11:00 включительно до 15:00 исключительно', () => {
  assert.equal(isWeekdayLunchDiscountActive({ dayOfWeek: 1, hour: 10, minute: 59 }), false);
  assert.equal(isWeekdayLunchDiscountActive({ dayOfWeek: 1, hour: 11, minute: 0 }), true);
  assert.equal(isWeekdayLunchDiscountActive({ dayOfWeek: 5, hour: 14, minute: 59 }), true);
  assert.equal(isWeekdayLunchDiscountActive({ dayOfWeek: 5, hour: 15, minute: 0 }), false);
  assert.equal(isWeekdayLunchDiscountActive({ dayOfWeek: 6, hour: 12, minute: 0 }), false);
  assert.equal(isWeekdayLunchDiscountActive({ dayOfWeek: 0, hour: 12, minute: 0 }), false);
});

test('проверка предзаказа использует время выбранного слота', () => {
  const beforeLunch = validateDeliverySlot('02.11 | 12:00–12:30', new Date('2026-11-02T08:00:00.000Z'));
  const afterLunch = validateDeliverySlot('02.11 | 16:00–16:30', new Date('2026-11-02T08:00:00.000Z'));
  assert.equal(beforeLunch.valid, true);
  assert.equal(isWeekdayLunchDiscountActive(beforeLunch), true);
  assert.equal(afterLunch.valid, true);
  assert.equal(isWeekdayLunchDiscountActive(afterLunch), false);
});

test('в обеденное окно скидка для своих складывается с 20% от исходной суммы', () => {
  const result = calculateOrderDiscounts({
    subtotal: 1000,
    method: 'delivery',
    byStaff: true,
    lunchPromo: true,
  });
  assert.equal(result.discount, 300);
  assert.equal(result.label, '20% дневная акция + 10% для своих');
});

test('в обеденное окно скидка самовывоза не применяется дополнительно', () => {
  const result = calculateOrderDiscounts({
    subtotal: 1000,
    method: 'pickup',
    byStaff: false,
    lunchPromo: true,
  });
  assert.equal(result.discount, 200);
  assert.equal(result.label, '20% дневная акция');
});

test('вне обеденного окна сохраняется прежний максимум скидки самовывоза и скидки для своих', () => {
  assert.equal(calculateOrderDiscounts({
    subtotal: 1000, method: 'pickup', byStaff: true, lunchPromo: false,
  }).discount, 100);
  assert.equal(calculateOrderDiscounts({
    subtotal: 1000, method: 'delivery', byStaff: true, lunchPromo: false,
  }).discount, 100);
  assert.equal(calculateOrderDiscounts({
    subtotal: 1000, method: 'delivery', byStaff: false, lunchPromo: false,
  }).discount, 0);
});
