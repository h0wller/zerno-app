import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateVAPIDKeys, sendNotification, setVapidDetails } from 'web-push';

test('web-push v4 exposes the named ESM exports used by the server', () => {
  assert.equal(typeof generateVAPIDKeys, 'function');
  assert.equal(typeof setVapidDetails, 'function');
  assert.equal(typeof sendNotification, 'function');
});
