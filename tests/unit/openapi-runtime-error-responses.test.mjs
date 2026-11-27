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
