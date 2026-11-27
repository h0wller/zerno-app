import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseDocument } from 'yaml';

const source = readFileSync(new URL('../../docs/openapi.yaml', import.meta.url), 'utf8');
const document = parseDocument(source, { uniqueKeys: true });
const openapi = document.toJS();

function responseCodes(method, path) {
  const operation = openapi.paths?.[path]?.[method];
  assert.ok(operation, `OpenAPI operation ${method.toUpperCase()} ${path} must exist`);
  return Object.keys(operation.responses || {});
}

test('OpenAPI documents runtime error responses for auth, promo, push and staff operations', () => {
  const expected = [
    ['post', '/api/auth/register', ['400', '403', '409', '429']],
    ['post', '/api/auth/tg-link', ['400', '401', '409']],
    ['post', '/api/auth/login', ['400', '403', '404', '409', '429', '503']],
    ['post', '/api/auth/activate', ['200', '400', '401', '403', '409', '429']],
    ['post', '/api/promo/redeem', ['200', '400', '401', '403', '404', '409', '410']],
    ['post', '/api/push/send', ['200', '400', '401', '403']],
    ['get', '/api/staff/customers', ['200', '401', '403']],
    ['post', '/api/staff/customers', ['200', '400', '401', '403', '409']],
  ];

  for (const [method, path, requiredCodes] of expected) {
    const actual = responseCodes(method, path);
    for (const code of requiredCodes) {
      assert.ok(actual.includes(code), `${method.toUpperCase()} ${path} must document HTTP ${code}`);
    }
  }
});

test('OpenAPI documents remaining authentication and role-guard error responses', () => {
  const expected = [
    ['post', '/api/staff/activate-guest', ['401']],
    ['get', '/api/staff/pending', ['401']],
    ['get', '/api/admin/bonuses', ['401']],
    ['put', '/api/admin/bonuses', ['401']],
    ['post', '/api/auth/deactivate', ['401']],
    ['post', '/api/exit', ['401']],
    ['put', '/api/me/notify', ['401']],
    ['get', '/api/chat/list', ['401']],
    ['get', '/api/chat/dialog', ['401']],
    ['post', '/api/chat/reply', ['401']],
    ['post', '/api/chat/close', ['401']],
    ['post', '/api/chat/open', ['401']],
    ['put', '/api/admin/weekpromo', ['401', '403']],
    ['post', '/api/orders/{id}/status', ['401']],
    ['post', '/api/orders/{id}/delay', ['401']],
    ['post', '/api/orders/delay-all', ['401']],
    ['get', '/api/me/free-delivery', ['401']],
    ['get', '/api/promos', ['401', '403']],
    ['post', '/api/promos/{id}/toggle', ['401', '403']],
    ['delete', '/api/promos/{id}', ['401', '403']],
    ['post', '/api/push/test', ['401']],
    ['post', '/api/push/fcm', ['401']],
    ['post', '/api/staff/stamp', ['401', '403']],
    ['post', '/api/staff/redeem', ['401', '403']],
    ['get', '/api/staff/log', ['401', '403']],
    ['get', '/api/stats', ['401', '403']],
    ['get', '/api/stats/orders', ['401', '403']],
  ];

  for (const [method, path, requiredCodes] of expected) {
    const actual = responseCodes(method, path);
    for (const code of requiredCodes) {
      assert.ok(actual.includes(code), `${method.toUpperCase()} ${path} must document HTTP ${code}`);
    }
  }
});
