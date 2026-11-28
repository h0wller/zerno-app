import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  compareRouteInventories,
  extractExpressRoutes,
  formatDiagnostic,
  parseOpenApiStrict,
  collectOpenApiOperations,
  checkAuditSentinels,
  checkOpenApiReferences,
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


test('route parity rejects extra OpenAPI operations and duplicate server registrations', () => {
  const extra = compareRouteInventories(
    [],
    [{ file: 'docs/openapi.yaml', method: 'POST', path: '/api/not-real' }],
  );
  assert.equal(extra.length, 1);
  assert.equal(extra[0].code, 'EXTRA_OPENAPI_OPERATION');
  assert.match(formatDiagnostic(extra[0]), /expected.*production Express route/i);
  assert.match(formatDiagnostic(extra[0]), /actual.*no production route/i);

  const duplicate = compareRouteInventories(
    [
      { file: 'server/routes/a.js', line: 10, method: 'GET', path: '/api/repeated' },
      { file: 'server/routes/a.js', line: 20, method: 'GET', path: '/api/repeated' },
    ],
    [{ method: 'GET', path: '/api/repeated', file: 'docs/openapi.yaml' }],
  );
  assert.ok(duplicate.some((item) => item.code === 'DUPLICATE_SERVER_ROUTE'));
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

test('audit sentinels accept resolved contracts and pin remaining F-003 baseline observations', () => {
  const openapi = minimalOpenApi({});
  openapi.components = {
    schemas: {
      Customer: { properties: { id: { type: 'string' } } },
      MenuItem: { properties: { id: { type: 'string' } } },
    },
  };
  const paths = openapi.paths;
  paths['/api/auth/register'] = {
    post: jsonBody({
      properties: {
        consent: {
          oneOf: [
            { type: 'integer', enum: [1] },
            { type: 'boolean', enum: [true] },
          ],
        },
      },
    }),
  };
  paths['/api/auth/request-reg-otp'] = {
    post: {
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  { type: 'object', required: ['ok', 'tgUrl', 'pollToken', 'expiresAt'], properties: { ok: { type: 'boolean' }, tgUrl: { type: 'string' }, pollToken: { type: 'string' }, expiresAt: { type: 'string' } } },
                  { type: 'object', required: ['ok', 'via'], properties: { ok: { type: 'boolean' }, via: { type: 'string', enum: ['sms'] } } },
                ],
              },
            },
          },
        },
        '503': {},
      },
    },
  };
  paths['/api/staff/scan'] = { post: jsonBody({ properties: { code: { minLength: 8, maxLength: 8, pattern: '^Z-[A-F0-9]{6}$' } } }) };
  paths['/api/orders/{id}/status'] = {
    post: { security: [{ BearerAuth: [] }], ...jsonBody({ properties: { status: { type: 'string', enum: ['new', 'accept', 'cook', 'way', 'done', 'cancel'] } } }) },
  };
  paths['/api/orders/{id}/delay'] = { post: jsonBody({ type: 'object', required: ['min'], properties: { min: { type: 'integer', minimum: 1, maximum: 180 } } }) };
  paths['/api/promo/info'] = {
    get: {
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  { type: 'object', required: ['ok', 'error'], properties: { ok: { type: 'boolean', enum: [false] }, error: { type: 'string' } } },
                  { type: 'object', required: ['ok', 'kind', 'value', 'code'], properties: { ok: { type: 'boolean', enum: [true] }, kind: { type: 'string' }, value: { type: 'number' }, code: { type: 'string' } } },
                ],
              },
            },
          },
        },
      },
    },
  };
  paths['/api/promos'] = {
    post: {
      security: [{ BearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['code'],
              properties: {
                code: { type: 'string' },
                kind: { type: 'string', default: 'stamp' },
                value: { type: 'number' },
                days: { type: 'number' },
                maxuses: { type: 'number' },
              },
            },
          },
        },
      },
    },
  };
  paths['/api/chat/botlog'] = {
    post: {
      description: 'При первом допустимом ответе бота создаёт метаданные треда автоматически',
      responses: { '200': {}, '400': {}, '401': {}, '403': {}, '429': {}, '503': {} },
    },
  };
  const pushSub = { type: 'object', required: ['endpoint'], properties: { endpoint: { type: 'string' } } };
  paths['/api/push/subscribe'] = { post: jsonBody({ properties: { sub: pushSub } }) };
  paths['/api/stats'] = { get: { security: [{ BearerAuth: [] }] } };

  const sources = {
    'server/domain/customers.js': "uid('u'); const qr = 'Z-' + crypto.randomBytes(3).toString('hex').toUpperCase()",
    'server.js': "uid('p')",
    'server/routes/auth.js': "req.body.consent !== 1 && req.body.consent !== true; via === 'sms'; res.json({ ok: true, via: 'sms' })",
    'server/routes/orders.js': "dispatchGuard; const ORDER_STATUS = { new: 1, accept: 1, cook: 1, way: 1, done: 1, cancel: 1 }; Number.isInteger(minutes) && minutes >= 1 && minutes <= 180",
    'server/routes/promos.js': "adminGuard; res.json({ ok: false, error: 'bad' }); promosRouter.post('/api/promos', handler); req.body.code",
    'server/routes/stats.js': 'adminGuard',
    'server/routes/chat.js': 'INSERT INTO chat_meta(key,closed,ctx) VALUES(?,0,?) ON CONFLICT(key) DO UPDATE SET ctx=excluded.ctx; botlog',
    'server/routes/push.js': 'if (!sub || !sub.endpoint)',
  };
  const result = checkAuditSentinels({ openapi, sources });
  assert.equal(result.findings.length, 12);
  assert.deepEqual(result.diagnostics, []);
  const invalidConsentOpenapi = structuredClone(openapi);
  invalidConsentOpenapi.paths['/api/auth/register'].post.requestBody.content['application/json'].schema.properties.consent = { type: 'integer', enum: [0, 1] };
  const invalidConsentResult = checkAuditSentinels({ openapi: invalidConsentOpenapi, sources });
  assert.ok(invalidConsentResult.diagnostics.some((item) => item.invariant === 'C-03'));

  const invalidOtpOpenapi = structuredClone(openapi);
  invalidOtpOpenapi.paths['/api/auth/request-reg-otp'].post.responses['200'].content['application/json'].schema.oneOf.pop();
  const invalidOtpResult = checkAuditSentinels({ openapi: invalidOtpOpenapi, sources });
  assert.ok(invalidOtpResult.diagnostics.some((item) => item.invariant === 'C-04'));
  const invalidEntityIdOpenapi = structuredClone(openapi);
  invalidEntityIdOpenapi.components.schemas.Customer.properties.id.type = 'integer';
  invalidEntityIdOpenapi.components.schemas.MenuItem.properties.id.type = 'integer';
  const invalidEntityIdResult = checkAuditSentinels({ openapi: invalidEntityIdOpenapi, sources });
  assert.ok(invalidEntityIdResult.diagnostics.some((item) => item.invariant === 'C-01'));
  assert.ok(invalidEntityIdResult.diagnostics.some((item) => item.invariant === 'C-02'));
  const invalidBotlogOpenapi = structuredClone(openapi);
  invalidBotlogOpenapi.paths['/api/chat/botlog'].post.responses['409'] = {};
  const invalidBotlogResult = checkAuditSentinels({ openapi: invalidBotlogOpenapi, sources });
  assert.ok(invalidBotlogResult.diagnostics.some((item) => item.invariant === 'C-15'));
  const invalidPushOpenapi = structuredClone(openapi);
  invalidPushOpenapi.paths['/api/push/subscribe'].post.requestBody.content['application/json'].schema.properties.sub.required = [];
  const invalidPushResult = checkAuditSentinels({ openapi: invalidPushOpenapi, sources });
  assert.ok(invalidPushResult.diagnostics.some((item) => item.invariant === 'C-14'));
  const invalidPromoCreateOpenapi = structuredClone(openapi);
  invalidPromoCreateOpenapi.paths['/api/promos'].post.requestBody.content['application/json'].schema.required = [];
  const invalidPromoCreateResult = checkAuditSentinels({ openapi: invalidPromoCreateOpenapi, sources });
  assert.ok(invalidPromoCreateResult.diagnostics.some((item) => item.invariant === 'C-12'));

  const invalidStatusOpenapi = structuredClone(openapi);
  invalidStatusOpenapi.paths['/api/orders/{id}/status'].post.requestBody.content['application/json'].schema.properties.status.enum = ['new', 'accept'];
  const invalidStatusResult = checkAuditSentinels({ openapi: invalidStatusOpenapi, sources });
  assert.ok(invalidStatusResult.diagnostics.some((item) => item.invariant === 'C-10'));
  const invalidPromoInfoOpenapi = structuredClone(openapi);
  invalidPromoInfoOpenapi.paths['/api/promo/info'].get.responses['404'] = {};
  const invalidPromoInfoResult = checkAuditSentinels({ openapi: invalidPromoInfoOpenapi, sources });
  assert.ok(invalidPromoInfoResult.diagnostics.some((item) => item.invariant === 'C-11'));
});

test('audit sentinel drift reports file, method/path, expected and actual values', () => {
  const result = checkAuditSentinels({
    openapi: { components: { schemas: { Customer: { properties: { id: { type: 'integer' } } } } }, paths: {} },
    sources: {},
  });
  const customerSchemaDrift = result.diagnostics.find((item) => item.file === 'docs/openapi.yaml' && item.path === 'Customer.id');
  const message = formatDiagnostic(customerSchemaDrift);
  assert.match(message, /docs\/openapi\.yaml/);
  assert.match(message, /Customer\.id/);
  assert.match(message, /expected/i);
  assert.match(message, /actual/i);
});

test('C-09 rejects missing required min and incorrect delay bounds', () => {
  const openapi = minimalOpenApi({
    '/api/orders/{id}/delay': {
      post: jsonBody({
        type: 'object',
        properties: { min: { type: 'integer', minimum: 1, maximum: 180 } },
      }),
    },
  });
  const result = checkAuditSentinels({
    openapi,
    sources: { 'server/routes/orders.js': 'Number.isInteger(minutes) && minutes >= 1 && minutes <= 180' },
  });
  const drift = result.diagnostics.find((item) => item.invariant === 'C-09' && item.file === 'docs/openapi.yaml');
  assert.ok(drift, 'missing required:min must be reported as C-09 drift');
  assert.match(drift.expected, /required/);
  assert.doesNotMatch(drift.actual, /required/);

  openapi.paths['/api/orders/{id}/delay'].post.requestBody.content['application/json'].schema.required = ['min'];
  openapi.paths['/api/orders/{id}/delay'].post.requestBody.content['application/json'].schema.properties.min = {
    type: 'integer', minimum: 1, maximum: 181,
  };
  const invalidMax = checkAuditSentinels({
    openapi,
    sources: { 'server/routes/orders.js': 'Number.isInteger(minutes) && minutes >= 1 && minutes <= 180' },
  });
  assert.ok(invalidMax.diagnostics.some((item) => item.invariant === 'C-09' && item.file === 'docs/openapi.yaml'));
});

test('OpenAPI local reference integrity accepts existing JSON pointers', () => {
  const openapi = {
    paths: {
      '/api/example': {
        get: {
          responses: {
            '200': { $ref: '#/components/responses/Ok' },
          },
        },
      },
    },
    components: {
      responses: { Ok: { description: 'OK' } },
    },
  };
  assert.deepEqual(checkOpenApiReferences(openapi), []);
});

test('OpenAPI local reference integrity reports unresolved JSON pointers', () => {
  const openapi = {
    paths: {
      '/api/example': {
        post: {
          requestBody: { $ref: '#/components/requestBodies/Missing' },
          responses: {
            '200': { $ref: '#/components/responses/Absent' },
          },
        },
      },
    },
    components: { responses: {} },
  };
  const diagnostics = checkOpenApiReferences(openapi);
  assert.equal(diagnostics.length, 2);
  assert.ok(diagnostics.every((item) => item.code === 'UNRESOLVED_OPENAPI_REF'));
  assert.match(formatDiagnostic(diagnostics[0]), /components\/requestBodies\/Missing/);
  assert.match(formatDiagnostic(diagnostics[1]), /components\/responses\/Absent/);
});
