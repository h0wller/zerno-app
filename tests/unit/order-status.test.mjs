import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canTransitionOrderStatus } from '../../server/domain/order-status.js';

test('active order transitions match the dispatcher actions', () => {
  assert.equal(canTransitionOrderStatus('new', 'accept', 'delivery'), true);
  assert.equal(canTransitionOrderStatus('new', 'done', 'delivery'), true);
  assert.equal(canTransitionOrderStatus('accept', 'cook', 'delivery'), true);
  assert.equal(canTransitionOrderStatus('cook', 'way', 'delivery'), true);
  assert.equal(canTransitionOrderStatus('cook', 'done', 'pickup'), true);
  assert.equal(canTransitionOrderStatus('way', 'done', 'delivery'), true);
  assert.equal(canTransitionOrderStatus('accept', 'cancel', 'delivery'), true);
});

test('done and cancelled orders are terminal', () => {
  for (const current of ['done', 'cancel']) {
    for (const next of ['new', 'accept', 'cook', 'way', 'done', 'cancel']) {
      assert.equal(canTransitionOrderStatus(current, next, 'delivery'), false, current + ' -> ' + next);
    }
  }
});

test('invalid and duplicate transitions are rejected', () => {
  assert.equal(canTransitionOrderStatus('new', 'way', 'delivery'), false);
  assert.equal(canTransitionOrderStatus('accept', 'accept', 'delivery'), false);
  assert.equal(canTransitionOrderStatus('unknown', 'done', 'delivery'), false);
  assert.equal(canTransitionOrderStatus('cook', 'way', 'pickup'), false);
});
