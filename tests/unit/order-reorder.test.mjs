import { test } from 'node:test';
import assert from 'node:assert/strict';
import { restoreOrderItems } from '../../public/app/core/order-reorder.js';

test('reconstructs selected menu option and keeps paid modifiers when repeating an order', () => {
  const items = restoreOrderItems([{
    id: 'pizza-1',
    name: 'Пицца',
    opt: '35 см, тонкое',
    sz: 35,
    price: 970,
    qty: 2,
    modifiers: [{ id: 'cheese', name: 'Доп. сыр', price: 100 }]
  }], [{
    id: 'pizza-1',
    opts: [
      { l: '25 см, пышное', p: 515, sz: 25 },
      { l: '35 см, тонкое', p: 970, sz: 35 }
    ]
  }]);

  assert.deepEqual(items, [{
    key: 'pizza-1_1',
    id: 'pizza-1',
    oi: 1,
    name: 'Пицца',
    opt: '35 см, тонкое',
    price: 970,
    sz: 35,
    qty: 2,
    modifiers: [{ id: 'cheese', name: 'Доп. сыр', price: 100 }]
  }]);
});

test('uses the persisted option index and keeps unmodified items as base products', () => {
  const items = restoreOrderItems([
    { id: 'pizza-1', oi: 0, opt: '25 см, пышное', price: 515, qty: 1 },
    { id: 'cola', opt: null, price: 120, qty: 1 }
  ], [{
    id: 'pizza-1',
    opts: [{ l: '25 см, пышное', p: 515, sz: 25 }]
  }]);

  assert.equal(items[0].oi, 0);
  assert.equal(items[0].key, 'pizza-1_0');
  assert.equal(items[1].oi, -1);
  assert.equal(items[1].key, 'cola');
  assert.deepEqual(items[1].modifiers, []);
});
