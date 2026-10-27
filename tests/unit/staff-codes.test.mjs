import test from 'node:test';
import assert from 'node:assert';
import { ADMIN_CODE, CASHIER_CODE, DISPATCH_CODE } from '../../server/config.js';
import { safeEqual } from '../../server/utils/security.js';

test('staff codes validation and safeEqual', () => {
  assert.strictEqual(safeEqual(ADMIN_CODE, ADMIN_CODE), true);
  assert.strictEqual(safeEqual(ADMIN_CODE, '0000'), false);
  assert.ok(String(ADMIN_CODE).length >= 4);
  assert.ok(String(CASHIER_CODE).length >= 4);
  assert.ok(String(DISPATCH_CODE).length >= 4);
});
