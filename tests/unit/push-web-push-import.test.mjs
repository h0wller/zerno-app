import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sendPush } from '../../server/services/push.js';

test('push service loads web-push CommonJS exports', () => {
  assert.equal(typeof sendPush, 'function');
});
