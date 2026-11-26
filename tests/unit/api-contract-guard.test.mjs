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
const jsonBody = (schema) => ({ requestBody: { content: { 'application/json': { schema } } } });

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
  assert.deepEqual(routes.map(({ method, path }) => [method, path]), [['POST', '/api/auth/login']]);
});

test('reports unresolved route paths rather than silently skipping them', () => {
  const routes = extractExpressRoutes({
    file: 'server/routes/dynamic.js',
    source: 'router.get(resolvePath(), handler);',
  });
  assert.equal(routes.length, 0);
  const message = formatDiagnostic(routes.diagnostics[0]);
  assert.match(message, /server\/routes\/dynamic\.js/);
  assert.match(message, /GET/);
  assert.match(message, /dynamic|static/i);
});

test('resolves literal route constants', () => {
  const routes = extractExpressRoutes({
    file: 'server/routes/constants.js',
    source: "const endpoint = '/api/orders/:id'; router.get(endpoint, handler);",
  });
  assert.deepEqual(routes.map(({ method, path }) => [method, path]), [['GET', '/api/orders/{id}']]);
});

test('route parity accepts matching methods and parameter names', () => {
  assert.deepEqual(
    compareRouteInventories(
      [{ file: 'server/routes/orders.js', line: 10, method: 'GET', path: '/api/orders/{id}' }],
      [{ method: 'GET', path: '/api/orders/{id}', file: 'docs/openapi.yaml' }],
    ),
    [],
  );
});

test('route parity reports missing operations with actionable diagnostics', () => {
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

test('strict YAML parsing rejects duplicate path keys and duplicate operation keys', () => {
  const duplicatePath = 'openapi: 3.0.3\npaths:\n  /api/x:\n    get: {}\n  /api/x:\n    post: {}\n';
  const duplicateMethod = 'openapi: 3.0.3\npaths:\n  /api/x:\n    get: {}\n    get: {}\n';
  assert.throws(() => parseOpenApiStrict(duplicatePath), /duplicate|unique/i);
  assert.throws(() => parseOpenApiStrict(duplicateMethod), /duplicate|unique/i);
});

test('OpenAPI operation inventory includes each declared HTTP method/path pair', () => {
  const openapi = minimalOpenApi({
    '/api/x': { get: {}, post: {} },
    '/api/y': { get: {} },
  });
  assert.deepEqual(
    collectOpenApiOperations(openapi).map(({ method, path }) => method + ' ' + path),
    ['GET /api/x', 'POST /api/x', 'GET /api/y'],
  );
});

test('audit sentinels pin known F-003 baseline observations without fixing them', () => {
  const openapi = minimalOpenApi({});
  openapi.components = {
    schemas: {
      Customer: { properties: { id: { type: 'integer' } } },
      MenuItem: { properties: { id: { type: 'integer' } } },
    },
  };
  const paths = openapi.paths;
  paths['/api/auth/register'] = { post: jsonBody({ properties: { consent: { type: 'integer', enum: [0, 1] } } }) };
  paths['/api/auth/request-reg-otp'] = {
    post: { responses: { '200': { content: { 'application/json': { schema: { required: ['tgUrl', 'pollToken'] } } } } } },
  };
  paths['/api/staff/scan'] = { post: jsonBody({ properties: { code: { minLength: 16, maxLength: 64 } } }) };
  paths['/api/orders/{id}/status'] = {
    post: { security: [{ BearerAuth: [] }], ...jsonBody({ properties: { status: { type: 'string' } } }) },
  };
  paths['/api/orders/{id}/delay'] = { post: jsonBody({ properties: { min: { minimum: 0 } } }) };
  paths['/api/promo/info'] = { get: { responses: { '404': {} } } };
  paths['/api/promos'] = { post: { security: [{ BearerAuth: [] }] } };
  paths['/api/chat/botlog'] = { post: { responses: { '409': {} } } };
  const pushSub = { type: 'object', properties: { endpoint: { type: 'string' } } };
  paths['/api/push/subscribe'] = { post: jsonBody({ properties: { sub: pushSub } }) };
  paths['/api/stats'] = { get: { security: [{ BearerAuth: [] }] } };

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

test('audit sentinel drift reports file, method/path, expected and actual values', () => {
  const result = checkAuditSentinels({
    openapi: { components: { schemas: { Customer: { properties: { id: { type: 'string' } } } } }, paths: {} },
    sources: {},
  });
  const message = formatDiagnostic(result.diagnostics[0]);
  assert.match(message, /docs\/openapi\.yaml/);
  assert.match(message, /Customer\.id/);
  assert.match(message, /expected/i);
  assert.match(message, /actual/i);
});
