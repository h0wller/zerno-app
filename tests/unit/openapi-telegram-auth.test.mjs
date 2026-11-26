import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseDocument } from 'yaml';

const source = readFileSync(new URL('../../docs/openapi.yaml', import.meta.url), 'utf8');
const document = parseDocument(source, { uniqueKeys: true });

test('OpenAPI YAML has no syntax errors or duplicate mapping keys', () => {
  assert.deepEqual(document.errors, []);
  assert.deepEqual(document.warnings, []);
});

test('OpenAPI documents Telegram registration and pending-profile activation contracts', () => {
  const openapi = document.toJS();
  const registration = openapi.paths['/api/auth/request-reg-otp'].post;
  const registrationSchema = registration.requestBody.content['application/json'].schema;
  const registrationProperties = registrationSchema.properties;

  assert.ok(registrationProperties.pin);
  assert.ok(registrationProperties.consent);
  assert.ok(registrationProperties.returnTo);
  assert.ok(registration.responses['200'].content['application/json'].schema.properties.expiresAt);
  for (const status of ['400', '409', '429']) {
    assert.ok(registration.responses[status], 'request-reg-otp must document HTTP ' + status);
  }

  const activation = openapi.paths['/api/auth/tg-link/request'].post;
  assert.deepEqual(activation.security, [{ BearerAuth: [] }]);
  assert.ok(activation.requestBody.content['application/json'].schema.properties.returnTo);
  for (const status of ['200', '400', '401', '403', '409', '503']) {
    assert.ok(activation.responses[status], 'tg-link/request must document HTTP ' + status);
  }
});
