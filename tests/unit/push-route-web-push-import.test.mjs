import { test } from 'node:test';
import assert from 'node:assert/strict';
import pushRouter from '../../server/routes/push.js';

test('push routes load web-push CommonJS exports', () => {
  assert.ok(pushRouter);
});
