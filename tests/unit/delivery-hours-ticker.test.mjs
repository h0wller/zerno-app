import test from 'node:test';
import assert from 'node:assert/strict';
import { deliveryHoursTickerText } from '../../public/app/brands/registry.js';

test('summer ticker uses the summer schedule every day', () => {
  for (const date of [
    '2026-06-01T10:00:00.000Z',
    '2026-07-04T10:00:00.000Z',
    '2026-09-30T10:00:00.000Z',
  ]) {
    assert.equal(deliveryHoursTickerText(new Date(date)), 'Ежедневно 11:00–22:00');
  }
});

test('winter ticker uses the current Kaliningrad weekday schedule', () => {
  assert.equal(
    deliveryHoursTickerText(new Date('2026-11-02T10:00:00.000Z')),
    'Сегодня, понедельник: 11:00–21:00',
  );
  assert.equal(
    deliveryHoursTickerText(new Date('2026-11-06T10:00:00.000Z')),
    'Сегодня, пятница: 11:00–22:00',
  );
  assert.equal(
    deliveryHoursTickerText(new Date('2026-11-07T10:00:00.000Z')),
    'Сегодня, суббота: 11:00–22:00',
  );
});
