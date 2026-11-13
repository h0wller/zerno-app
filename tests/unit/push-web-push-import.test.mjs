import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sendPush } from '../../server/services/push.js';

test('push service loads web-push ESM exports', () => {
  assert.equal(typeof sendPush, 'function');
});
