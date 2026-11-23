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


test('preserves first matching menu item when menu contains duplicate ids', () => {
  const result = restoreOrderItems(
    [{ id: 'dish-1', opt: 'Small', price: 10 }],
    [
      { id: 'dish-1', opts: [{ l: 'Small', p: 10 }] },
      { id: 'dish-1', opts: [{ l: 'Large', p: 20 }] }
    ]
  );

  assert.equal(result[0].oi, 0);
  assert.equal(result[0].key, 'dish-1_0');
});

test('preserves legacy option-name and size/price fallback with serialized options', () => {
  const result = restoreOrderItems([
    { id: 'dish-1', opt: 'Large', sz: 30, price: 90, qty: 2 },
    { id: 'dish-2', opt: 'XL', sz: 40, price: 120, qty: 1 }
  ], [
    { id: 'dish-1', opts: JSON.stringify([{ l: 'Small', p: 50, sz: 20 }, { l: 'Large', p: 90, sz: 30 }]) },
    { id: 'dish-2', opts: JSON.stringify([{ l: 'Large', p: 90, sz: 30 }, { l: 'XL', p: 120, sz: 40 }]) }
  ]);

  assert.deepEqual(result.map(item => item.oi), [1, 1]);
  assert.deepEqual(result.map(item => item.key), ['dish-1_1', 'dish-2_1']);
});

test('treats malformed serialized options as empty and keeps legacy base item fallback', () => {
  const result = restoreOrderItems([
    { id: 'dish-1', opt: 'Unknown', price: 15, qty: 0 },
    { id: 'missing', name: 'Legacy', qty: 2 }
  ], [
    { id: 'dish-1', opts: '{not-json' }
  ]);

  assert.equal(result[0].oi, -1);
  assert.equal(result[0].key, 'dish-1');
  assert.equal(result[0].qty, 1);
  assert.equal(result[1].oi, -1);
  assert.equal(result[1].price, 0);
});
