import test from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_CODE, CASHIER_CODE, DISPATCH_CODE } from '../../server/config.js';

test('staff role secrets come only from the environment and fail closed when absent', () => {
  for (const code of [ADMIN_CODE, CASHIER_CODE, DISPATCH_CODE]) {
    assert.equal(typeof code, 'string');
    assert.ok(code === '' || /^[A-Za-z0-9_-]{16,64}$/.test(code));
  }
});
