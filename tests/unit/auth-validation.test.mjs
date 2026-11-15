import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SetupPinSchema, LoginSchema } from '../../server/middleware/validate.js';

test('PIN setup accepts exactly four decimal digits', () => {
  assert.equal(SetupPinSchema.safeParse({ phone: '+7 900 000-00-01', pin: '1234' }).success, true);
  for (const pin of ['123', '12345', '12a4', '１２３４', '', ' 1234 ']) {
    assert.equal(SetupPinSchema.safeParse({ phone: '+7 900 000-00-01', pin }).success, false, pin);
  }
});

test('login rejects malformed PINs before reaching the route', () => {
  assert.equal(LoginSchema.safeParse({ phone: '+7 900 000-00-01', pin: '1234' }).success, true);
  assert.equal(LoginSchema.safeParse({ phone: '+7 900 000-00-01', pin: '12x4' }).success, false);
});
