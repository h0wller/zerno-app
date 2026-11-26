import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  compareRouteInventories,
  extractExpressRoutes,
  formatDiagnostic,
  parseOpenApiStrict,
  collectOpenApiOperations,
  checkAuditSentinels,
} from '../../scripts/api-contract-guard.mjs';

const minimalOpenApi = (paths) => ({ openapi: '3.0.3', paths });
const jsonBody = (schema) => ({
  requestBody: { content: { 'application/json': { schema } } },
});

test('extracts Express routes and normalizes :params to OpenAPI braces', () => {
  const routes = extractExpressRoutes({
    file: 'server/routes/orders.js',
    source: "router.get('/api/orders/:id', authGuard, handler);\nrouter.post('/api/orders', handler);",
  });
  assert.deepEqual(routes.map(({ method, path }) => [method, path]), [
    ['GET', '/api/orders/{id}'],
    ['POST', '/api/orders'],
  ]);
});

test('excludes test-only routes from production inventory', () => {
  const routes = extractExpressRoutes({
    file: 'server/routes/auth.js',
    source: "router.post('/__test/otp', handler);\nrouter.post('/api/auth/login', handler);",
  });
  assert.deepEqual(routes.map(({ method, path }) => [method, path]), [
    ['POST', '/api/auth/login'],
  ]);
});

test('reports dynamic API route registration instead of silently skipping it', () => {
  const routes = extractExpressRoutes({
    file: 'server/routes/dynamic.js',
    source: 'router.get(resolvePath(), handler);',
  });
  assert.equal(routes.length, 0);
  assert.match(formatDiagnostic(routes.diagnostics[0]), /server\/routes\/dynamic\.js/);
  assert.match(formatDiagnostic(routes.diagnostics[0]), /GET/);
  assert.match(formatDiagnostic(routes.diagnostics[0]), /dynamic|static/i);
});


test('resolves literal route constants without creating a second route registry', () => {
  const routes = extractExpressRoutes({
    file: 'server/routes/constants.js',
    source: "const endpoint = '/api/orders/:id'; router.get(endpoint, handler);",
  });
  assert.deepEqual(routes.map(({ method, path }) => [method, path]), [
    ['GET', '/api/orders/{id}'],
  ]);
});

test('strict YAML parsing rejects duplicate operation keys under one path', () => {
  assert.throws(
    () => parseOpenApiStrict('openapi: 3.0.3\\npaths:\\n  /api/x:\\n    get: {}\\n    get: {}\\n'),
    /duplicate|unique/i,
  );
});

test('route parity accepts matching methods and parameter names', () => {
  const diagnostics = compareRouteInventories(
    [{ file: 'server/routes/orders.js', line: 10, method: 'GET', path: '/api/orders/{id}' }],
    [{ method: 'GET', path: '/api/orders/{id}', file: 'docs/openapi.yaml' }],
  );
  assert.deepEqual(diagnostics, []);
});

test('route parity reports missing and extra operations with expected and actual values', () => {
  const diagnostics = compareRouteInventories(
    [
      { file: 'server/routes/orders.js', line: 10, method: 'GET', path: '/api/orders/{id}' },
      { file: 'server/routes/orders.js', line: 20, method: 'POST', path: '/api/orders' },
    ],
    [{ method: 'GET', path: '/api/orders/{id}', file: 'docs/openapi.yaml' }],
  );
  assert.equal(diagnostics.length, 1);
  const message = formatDiagnostic(diagnostics[0]);
  assert.match(message, /server\/routes\/orders\.js:20/);
  assert.match(message, /POST/);
  assert.match(message, /expected.*OpenAPI/i);
  assert.match(message, /actual.*missing/i);
});

test('strict YAML parsing rejects duplicate mapping keys', () => {
  assert.throws(
    () => parseOpenApiStrict('openapi: 3.0.3\npaths:\n  /api/x:\n    get: {}\n  /api/x:\n    post: {}\n', 'docs/openapi.yaml'),
    /duplicate|unique|docs\/openapi\.yaml/i,
  );
});

test('OpenAPI operation inventory contains one operation per method/path pair', () => {
  const openapi = minimalOpenApi({
    '/api/x': { get: {}, post: {} },
    '/api/y': { get: {} },
  });
  assert.deepEqual(
    collectOpenApiOperations(openapi).map(({ method, path }) => method + ' ' + path),
    ['GET /api/x', 'POST /api/x', 'GET /api/y'],
  );
});

test('audit sentinels describe known F-003 gaps without fixing them', () => {
  const openapi = {
    components: {
      schemas: {
        Customer: { properties: { id: { type: 'integer' } } },
        MenuItem: { properties: { id: { type: 'integer' } } },
      },
    },
    paths: {
      '/api/auth/register': { post: jsonBody({ properties: { consent: { type: 'integer', enum: [0, 1] } } }) },
      '/api/auth/request-reg-otp': {
        post: { responses: { '200': { content: { 'application/json': { schema: { required: ['tgUrl', 'pollToken'] } } } } } },
      },
      '/api/staff/scan': { post: jsonBody({ properties: { code: { minLength: 16, maxLength: 64 } } }) },
      '/api/orders/{id}/status': {
        post: { security: [{ BearerAuth: [] }], ...jsonBody({ properties: { status: { type: 'string' } } }) },
      },
      '/api/orders/{id}/delay': { post: jsonBody({ properties: { min: { minimum: 0 } } }) },
      '/api/promo/info': { get: { responses: { '404': {} } } },
      '/api/promos': { post: { security: [{ BearerAuth: [] }] } },
      '/api/chat/botlog': { post: { responses: { '409': {} } } },
      '/api/push/subscribe': {
        post: jsonBody({ properties: { sub: { type: 'object', properties: { endpoint: { type: 'string' } } } } }),
      },
      '/api/stats': { get: { security: [{ BearerAuth: [] }] } },
    },
  };
  const sources = {
    'server/domain/customers.js': "uid('u'); randomBytes(3).toString('hex').toUpperCase()",
    'server.js': "uid('p')",
    'server/routes/auth.js': "consent !== 1 && consent !== true; via === 'sms'; res.json({ ok: true, via: 'sms' })",
    'server/routes/orders.js': "dispatchGuard; const ORDER_STATUS = { new: 1, accept: 1, cook: 1, way: 1, done: 1, cancel: 1 }; Number.isInteger(minutes) && minutes >= 1 && minutes <= 180",
    'server/routes/promos.js': "adminGuard; res.json({ ok: false, error: 'bad' }); promosRouter.post('/api/promos', handler); req.body.code",
    'server/routes/stats.js': 'adminGuard',
    'server/routes/chat.js': 'INSERT INTO chat_meta; botlog',
    'server/routes/push.js': 'if (!sub || !sub.endpoint)',
  };
  const result = checkAuditSentinels({ openapi, sources });
  assert.equal(result.findings.length, 12);
  assert.deepEqual(result.diagnostics, []);
});

test('audit sentinel drift has a file, method, expected and actual diagnostic', () => {
  const result = checkAuditSentinels({
    openapi: { components: { schemas: { Customer: { properties: { id: { type: 'string' } } } }, paths: {} },
    sources: {},
  });
  const message = formatDiagnostic(result.diagnostics[0]);
  assert.match(message, /docs\/openapi\.yaml/);
  assert.match(message, /Customer\.id/);
  assert.match(message, /expected/i);
  assert.match(message, /actual/i);
});
