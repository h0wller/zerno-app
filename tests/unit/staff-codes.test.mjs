import test from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_CODE, CASHIER_CODE, DISPATCH_CODE } from '../../server/config.js';
import { safeEqual } from '../../server/utils/security.js';

test('staff codes come only from environment and fail closed when absent', () => {
  assert.equal(ADMIN_CODE, String(process.env.ADMIN_CODE || '').trim());
  assert.equal(CASHIER_CODE, String(process.env.CASHIER_CODE || '').trim());
  assert.equal(DISPATCH_CODE, String(process.env.DISPATCH_CODE || '').trim());

  for (const code of [ADMIN_CODE, CASHIER_CODE, DISPATCH_CODE]) {
    assert.ok(code === '' || /^[A-Za-z0-9_-]{16,64}$/.test(code));
  }
});

test('safeEqual compares configured passphrases without exposing them', () => {
  assert.equal(safeEqual('ci-admin-role-code-2026', 'ci-admin-role-code-2026'), true);
  assert.equal(safeEqual('ci-admin-role-code-2026', 'ci-cashier-role-code-2026'), false);
  assert.equal(safeEqual('', 'ci-admin-role-code-2026'), false);
});
