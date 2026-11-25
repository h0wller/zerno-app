import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCoffeeMonthStats,
  getCoffeeMonthPeriod,
} from '../../server/domain/coffee-stats.js';

test('calendar month boundaries use Kaliningrad local midnight', () => {
  const period = getCoffeeMonthPeriod('2026-11');

  assert.deepEqual(
    { start: period.start, end: period.end, daysInMonth: period.daysInMonth },
    {
      start: '2026-10-31T22:00:00.000Z',
      end: '2026-11-30T22:00:00.000Z',
      daysInMonth: 30,
    }
  );
});

test('coffee redemptions and loyalty punches are grouped by local calendar day', () => {
  const report = buildCoffeeMonthStats('2026-11', [
    {
      a: '🎁 Списан бесплатный кофе: Капучино (осталось 0)',
      by: 'Кассир',
      ts: '2026-10-31T22:30:00.000Z',
    },
    {
      a: '🎁 Списан бесплатный кофе: Латте (осталось 0)',
      by: 'Кассир',
      ts: '2026-11-01T10:00:00.000Z',
    },
    {
      a: 'Штамп 1 из 10',
      by: 'Кассир',
      ts: '2026-11-01T11:00:00.000Z',
    },
    {
      a: '🎁 Списан бесплатный кофе: Капучино (осталось 0)',
      by: 'Кассир',
      ts: '2026-11-30T21:59:00.000Z',
    },
    {
    },
    {
      a: '🎁 Списан бесплатный кофе: Эспрессо (осталось 0)',
      by: 'Кассир',
      ts: '2026-11-30T22:00:00.000Z',
    },
  ]);

  assert.equal(report.total, 3);
  assert.equal(report.stamps, 1);
  assert.deepEqual(report.items, [
    { name: 'Капучино', qty: 2 },
    { name: 'Латте', qty: 1 },
  ]);

  assert.deepEqual(report.days[0], {
    date: '2026-11-01',
    label: '01.11',
    weekday: 6,
    redemptions: 2,
    stamps: 1,
    byItem: { Капучино: 1, Латте: 1 },
    items: [
      { name: 'Капучино', qty: 1 },
      { name: 'Латте', qty: 1 },
    ],
  });
  assert.equal(report.days[1].redemptions, 0);
  assert.equal(report.days[1].stamps, 0);
  assert.equal(report.days[29].redemptions, 1);
  assert.equal(report.days[29].byItem.Капучино, 1);
});

test('month validation rejects invalid calendar values', () => {
  assert.equal(getCoffeeMonthPeriod(''), null);
  assert.equal(getCoffeeMonthPeriod('2026-13'), null);
  assert.equal(getCoffeeMonthPeriod('2026-2'), null);
  assert.equal(getCoffeeMonthPeriod('not-a-month'), null);
});

test('only cashier punch operations count as coffee sales indicators', () => {
  const report = buildCoffeeMonthStats('2026-11', [
    { a: 'Штамп 2 из 10', by: 'Кассир', ts: '2026-11-03T09:00:00.000Z' },
    { a: 'Начислено 10 шт. → 0/10', by: 'Промокод', ts: '2026-11-03T10:00:00.000Z' },
    { a: 'Начислено 2 шт. → 2/10', by: 'Кассир', ts: '2026-11-03T11:00:00.000Z' },
  ]);
  assert.equal(report.stamps, 2);
  assert.equal(report.days[2].stamps, 2);
});
