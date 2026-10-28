import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isCancelledStatus, summarizeOrderRows } from '../../server/domain/order-stats.js';

const order = (overrides = {}) => ({
  status: 'done', method: 'delivery', is_preorder: 0, total: 1000,
  items: JSON.stringify([{ name: 'Пицца', qty: 1 }]),
  ...overrides,
});

test('cancelled orders remain in cancellation counts but do not affect revenue, order count, average or top items', () => {
  const result = summarizeOrderRows([
    order({ total: 1200, items: JSON.stringify([{ name: 'Маргарита', qty: 2 }]) }),
    order({ status: 'cancel', total: 9000, items: JSON.stringify([{ name: 'Отменённая позиция', qty: 99 }]) }),
  ]);

  assert.equal(result.orders, 1);
  assert.equal(result.revenue, 1200);
  assert.equal(result.avg, 1200);
  assert.equal(result.cancelled, 1);
  assert.deepEqual(result.top, [{ name: 'Маргарита', qty: 2 }]);
  assert.equal(result.byStatus.cancel, 1);
});

test('cancellation status matching is case/whitespace tolerant and supports normalized spellings', () => {
  for (const status of ['cancel', ' CANCEL ', 'cancelled', 'canceled']) {
    assert.equal(isCancelledStatus(status), true, status);
  }
  assert.equal(isCancelledStatus('done'), false);
});

test('summary returns the full ranking so guest and staff positions can be merged before top-five slicing', () => {
  const rows = Array.from({ length: 7 }, (_, index) => order({
    items: JSON.stringify([{ name: 'Позиция ' + index, qty: 7 - index }]),
  }));
  const result = summarizeOrderRows(rows);
  assert.equal(result.top.length, 7);
  assert.equal(result.top[0].name, 'Позиция 0');
  assert.equal(result.top.at(-1).name, 'Позиция 6');
});
