import assert from 'node:assert/strict';
import { buildCoffeeMonthStats, getCoffeeMonthPeriod } from '../server/domain/coffee-stats.js';

const period = getCoffeeMonthPeriod('2026-11');
assert.equal(period.start, '2026-10-31T22:00:00.000Z');
assert.equal(period.end, '2026-11-30T22:00:00.000Z');
assert.equal(period.daysInMonth, 30);
assert.equal(getCoffeeMonthPeriod('2026-13'), null);

const report = buildCoffeeMonthStats('2026-11', [
  { a: '🎁 Списан бесплатный кофе: Капучино (осталось 0)', ts: '2026-10-31T22:30:00.000Z' },
  { a: '🎁 Списан бесплатный кофе: Латте (осталось 0)', ts: '2026-11-01T10:00:00.000Z' },
  { a: 'Штамп 1 из 10', ts: '2026-11-01T11:00:00.000Z' },
  { a: '🎁 Списан бесплатный кофе: Капучино (осталось 0)', ts: '2026-11-30T21:59:00.000Z' },
  { a: '🎁 Списан бесплатный кофе: Эспрессо (осталось 0)', ts: '2026-11-30T22:00:00.000Z' },
]);
assert.equal(report.total, 3);
assert.equal(report.stamps, 1);
assert.deepEqual(report.items, [
  { name: 'Капучино', qty: 2 },
  { name: 'Латте', qty: 1 },
]);
assert.equal(report.days[0].redemptions, 2);
assert.equal(report.days[0].stamps, 1);
assert.equal(report.days[29].redemptions, 1);
assert.equal(report.days[29].byItem.Капучино, 1);
console.log('coffee monthly aggregation: ok');
