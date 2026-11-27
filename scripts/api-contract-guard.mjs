import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'acorn';
import { parseDocument } from 'yaml';

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'options', 'head']);
const ROUTER_RECEIVER = /^(?:app|router|[A-Za-z_$][\w$]*Router)$/;

export function normalizeExpressPath(path) {
  return path.replace(/:([A-Za-z_$][\w$]*)/g, '{$1}');
}

function staticString(node, constants) {
  if (!node) return { value: null, dynamic: false };
  if (node.type === 'Literal' && typeof node.value === 'string') {
    return { value: node.value, dynamic: false };
  }
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return { value: node.quasis[0]?.value.cooked ?? '', dynamic: false };
  }
  if (node.type === 'Identifier' && constants.has(node.name)) {
    return { value: constants.get(node.name), dynamic: false };
  }
  return { value: null, dynamic: true };
}

function visit(node, callback) {
  if (!node || typeof node !== 'object') return;
  if (typeof node.type === 'string') callback(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'loc' || key === 'start' || key === 'end') continue;
    if (Array.isArray(value)) {
      for (const child of value) visit(child, callback);
    } else if (value && typeof value === 'object') {
      visit(value, callback);
    }
  }
}

export function extractExpressRoutes({ file, source }) {
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
  const constants = new Map();
  visit(ast, (node) => {
    if (node.type !== 'VariableDeclarator' || node.id?.type !== 'Identifier') return;
    const value = staticString(node.init, new Map());
    if (!value.dynamic && value.value !== null) constants.set(node.id.name, value.value);
  });

  const routes = [];
  const diagnostics = [];
  visit(ast, (node) => {
    if (node.type !== 'CallExpression' || node.callee?.type !== 'MemberExpression') return;
    const receiver = node.callee.object;
    const property = node.callee.computed ? node.callee.property?.value : node.callee.property?.name;
    if (receiver?.type !== 'Identifier' || !ROUTER_RECEIVER.test(receiver.name)) return;
    if (!HTTP_METHODS.has(property)) return;

    const firstArg = node.arguments[0];
    const resolved = staticString(firstArg, constants);
    if (!resolved.dynamic && resolved.value !== null) {
      const path = resolved.value;
      if (!path.startsWith('/api/') && !path.startsWith('/__test/')) return;
      if (path.startsWith('/__test/')) return;
      routes.push({
        file,
        line: node.loc.start.line,
        method: property.toUpperCase(),
        path: normalizeExpressPath(path),
      });
      return;
    }

    const snippet = firstArg ? source.slice(firstArg.start, firstArg.end) : '<missing path>';
    diagnostics.push({
      code: 'DYNAMIC_ROUTE_PATH',
      file,
      line: node.loc.start.line,
      method: property.toUpperCase(),
      path: snippet,
      expected: 'static /api/* or /__test/* route path',
      actual: 'path cannot be statically resolved',
    });
  });
  Object.defineProperty(routes, 'diagnostics', { value: diagnostics, enumerable: false });
  return routes;
}

export function parseOpenApiStrict(source, file = 'docs/openapi.yaml') {
  const document = parseDocument(source, {
    uniqueKeys: true,
    strict: true,
    prettyErrors: true,
  });
  if (document.errors.length || document.warnings.length) {
    const issues = [...document.errors, ...document.warnings]
      .map((issue) => issue.message)
      .join('; ');
    throw new Error(`[OPENAPI_YAML] ${file}: expected valid YAML with unique mapping keys; actual: ${issues}`);
  }
  const value = document.toJS();
  if (!value || typeof value !== 'object' || !value.paths || typeof value.paths !== 'object') {
    throw new Error(`[OPENAPI_STRUCTURE] ${file}: expected a document with a paths mapping; actual: missing paths mapping`);
  }
  return value;
}

export function collectOpenApiOperations(openapi) {
  const operations = [];
  for (const [path, pathItem] of Object.entries(openapi.paths || {})) {
    if (!path.startsWith('/api/')) continue;
    for (const [method, operation] of Object.entries(pathItem || {})) {
      if (!HTTP_METHODS.has(method)) continue;
      operations.push({
        file: 'docs/openapi.yaml',
        method: method.toUpperCase(),
        path,
        operation,
      });
    }
  }
  return operations;
}

function operationKey(operation) {
  return `${operation.method.toUpperCase()} ${operation.path}`;
}

export function compareRouteInventories(serverRoutes, openApiOperations) {
  const diagnostics = [];
  const serverByKey = new Map();
  const specByKey = new Map();

  for (const route of serverRoutes) {
    const key = operationKey(route);
    const list = serverByKey.get(key) || [];
    list.push(route);
    serverByKey.set(key, list);
  }
  for (const operation of openApiOperations) {
    const key = operationKey(operation);
    const list = specByKey.get(key) || [];
    list.push(operation);
    specByKey.set(key, list);
  }

  for (const [key, routes] of serverByKey) {
    if (routes.length > 1) {
      for (const route of routes) diagnostics.push({
        code: 'DUPLICATE_SERVER_ROUTE',
        file: route.file,
        line: route.line,
        method: route.method,
        path: route.path,
        expected: 'one Express registration for this method/path',
        actual: `${routes.length} registrations for ${key}`,
      });
    }
    if (!specByKey.has(key)) {
      const route = routes[0];
      diagnostics.push({
        code: 'MISSING_OPENAPI_OPERATION',
        file: route.file,
        line: route.line,
        method: route.method,
        path: route.path,
        expected: `OpenAPI operation ${key}`,
        actual: 'missing from docs/openapi.yaml',
      });
    }
  }

  for (const [key, operations] of specByKey) {
    if (operations.length > 1) {
      for (const operation of operations) diagnostics.push({
        code: 'DUPLICATE_OPENAPI_OPERATION',
        file: operation.file,
        method: operation.method,
        path: operation.path,
        expected: 'one OpenAPI operation for this method/path',
        actual: `${operations.length} operations for ${key}`,
      });
    }
    if (!serverByKey.has(key)) {
      const operation = operations[0];
      diagnostics.push({
        code: 'EXTRA_OPENAPI_OPERATION',
        file: operation.file,
        method: operation.method,
        path: operation.path,
        expected: `matching production Express route for ${key}`,
        actual: 'no production route registration found',
      });
    }
  }
  return diagnostics;
}

function addSentinel(diagnostics, id, file, method, path, expected, actual) {
  if (JSON.stringify(expected) === JSON.stringify(actual)) return;
  diagnostics.push({
    code: 'AUDIT_SENTINEL_DRIFT',
    invariant: id,
    file,
    method,
    path,
    expected: JSON.stringify(expected),
    actual: JSON.stringify(actual),
  });
}

// These are audit-baseline sentinels, not a second route registry. They pin the
// exact F-003 observations until a dedicated implementation PR intentionally
// resolves a finding and updates/removes its sentinel.
export const AUDIT_SENTINELS = [
  { id: 'C-01', title: 'Customer.id is integer in the audited OpenAPI baseline', file: 'docs/openapi.yaml', method: 'RESPONSE', path: 'components.schemas.Customer.properties.id.type' },
  { id: 'C-02', title: 'MenuItem.id is integer in the audited OpenAPI baseline', file: 'docs/openapi.yaml', method: 'RESPONSE', path: 'components.schemas.MenuItem.properties.id.type' },
  { id: 'C-03', title: 'Registration consent is integer enum [0,1]', file: 'docs/openapi.yaml', method: 'POST', path: '/api/auth/register' },
  { id: 'C-04', title: 'Registration response documents Telegram fields while SMS has a separate server branch', file: 'docs/openapi.yaml', method: 'POST', path: '/api/auth/request-reg-otp' },
  { id: 'C-08', title: 'Staff QR schema matches generated Z- plus six uppercase hex characters', file: 'docs/openapi.yaml', method: 'POST', path: '/api/staff/scan' },
  { id: 'C-10', title: 'Order status schema has no enum in the audited baseline', file: 'docs/openapi.yaml', method: 'POST', path: '/api/orders/{id}/status' },
  { id: 'C-09', title: 'Order delay schema minimum remains zero and maximum is absent', file: 'docs/openapi.yaml', method: 'POST', path: '/api/orders/{id}/delay' },
  { id: 'C-11', title: 'Promo info documents 404 although handler returns 200 false payload', file: 'docs/openapi.yaml', method: 'GET', path: '/api/promo/info' },
  { id: 'C-12', title: 'Promo creation has no requestBody in the audited baseline', file: 'docs/openapi.yaml', method: 'POST', path: '/api/promos' },
  { id: 'C-15', title: 'Chat botlog documents 409 in the audited baseline', file: 'docs/openapi.yaml', method: 'POST', path: '/api/chat/botlog' },
  { id: 'C-14', title: 'Push subscription endpoint is not required in the audited baseline', file: 'docs/openapi.yaml', method: 'POST', path: '/api/push/subscribe' },
  { id: 'C-17', title: 'Role guards remain explicitly represented by BearerAuth on guarded operations', file: 'docs/openapi.yaml', method: 'MULTIPLE', path: '/api/promos, /api/stats, /api/orders/{id}/status' },
];

export function checkAuditSentinels({ openapi, sources }) {
  const diagnostics = [];
  const findings = AUDIT_SENTINELS.map((item) => ({ ...item, status: 'known-f003-baseline' }));
  const schema = (name) => openapi.components?.schemas?.[name]?.properties?.id?.type;
  if (!(sources['server/domain/customers.js'] || '').includes("uid('u')")) {
    addSentinel(diagnostics, 'C-01', 'server/domain/customers.js', 'RESPONSE', 'Customer.id', "uid('u') prefixed string ID", 'audited ID generator not found');
  }
  if (!(sources['server.js'] || '').includes("uid('p')")) {
    addSentinel(diagnostics, 'C-02', 'server.js', 'RESPONSE', 'MenuItem.id', "uid('p') prefixed string ID", 'audited menu ID generator not found');
  }
  addSentinel(diagnostics, 'C-01', 'docs/openapi.yaml', 'RESPONSE', 'Customer.id', 'integer', schema('Customer'));
  addSentinel(diagnostics, 'C-02', 'docs/openapi.yaml', 'RESPONSE', 'MenuItem.id', 'integer', schema('MenuItem'));

  const register = openapi.paths?.['/api/auth/register']?.post?.requestBody?.content?.['application/json']?.schema?.properties?.consent;
  addSentinel(diagnostics, 'C-03', 'docs/openapi.yaml', 'POST', '/api/auth/register', { type: 'integer', enum: [0, 1] }, register);
  const authSource = sources['server/routes/auth.js'] || '';
  if (!authSource.includes('req.body.consent !== 1 && req.body.consent !== true')) {
    addSentinel(diagnostics, 'C-03', 'server/routes/auth.js', 'POST', '/api/auth/register', 'handler accepts only 1 or true', 'audited consent predicate not found');
  }

  const regResponse = openapi.paths?.['/api/auth/request-reg-otp']?.post?.responses?.['200']?.content?.['application/json']?.schema;
  addSentinel(diagnostics, 'C-04', 'docs/openapi.yaml', 'POST', '/api/auth/request-reg-otp', true, Boolean(regResponse?.required?.includes('tgUrl') && regResponse?.required?.includes('pollToken')));
  if (!/via\s*===\s*['"]sms['"]/.test(authSource) || !/via:\s*['"]sms['"]/.test(authSource)) {
    addSentinel(diagnostics, 'C-04', 'server/routes/auth.js', 'POST', '/api/auth/request-reg-otp', 'SMS branch returns via=sms', 'audited SMS response branch not found');
  }

  const qrSchema = openapi.paths?.['/api/staff/scan']?.post?.requestBody?.content?.['application/json']?.schema?.properties?.code;
  addSentinel(diagnostics, 'C-08', 'docs/openapi.yaml', 'POST', '/api/staff/scan', { minLength: 8, maxLength: 8, pattern: '^Z-[A-F0-9]{6}$' }, { minLength: qrSchema?.minLength, maxLength: qrSchema?.maxLength, pattern: qrSchema?.pattern });
  if (!/'Z-'\\s*\\+\\s*crypto\\.randomBytes\\(3\\)\\.toString\\(['"]hex['"]\\)\\.toUpperCase\\(\\)/s.test(sources['server/domain/customers.js'] || '')) {
    addSentinel(diagnostics, 'C-08', 'server/domain/customers.js', 'POST', '/api/staff/scan', 'QR generated as Z- plus 3 random bytes in uppercase hex', 'audited QR generator not found');
  }

  const statusSchema = openapi.paths?.['/api/orders/{id}/status']?.post?.requestBody?.content?.['application/json']?.schema?.properties?.status;
  addSentinel(diagnostics, 'C-10', 'docs/openapi.yaml', 'POST', '/api/orders/{id}/status', { type: 'string', enum: undefined }, { type: statusSchema?.type, enum: statusSchema?.enum });
  const orderSource = sources['server/routes/orders.js'] || '';
  const expectedStatuses = ['new', 'accept', 'cook', 'way', 'done', 'cancel'];
  const missingStatuses = expectedStatuses.filter((status) => !orderSource.includes(status + ':'));
  addSentinel(diagnostics, 'C-10', 'server/routes/orders.js', 'POST', '/api/orders/{id}/status', [], missingStatuses);
  if (!/Number\.isInteger\(minutes\)\s*&&\s*minutes\s*>=\s*1\s*&&\s*minutes\s*<=\s*180/.test(orderSource)) {
    addSentinel(diagnostics, 'C-09', 'server/routes/orders.js', 'POST', '/api/orders/{id}/delay', 'delay range 1..180', 'audited delay bounds not found');
  }
  const delaySchema = openapi.paths?.['/api/orders/{id}/delay']?.post?.requestBody?.content?.['application/json']?.schema?.properties?.min;
  addSentinel(diagnostics, 'C-09', 'docs/openapi.yaml', 'POST', '/api/orders/{id}/delay', { minimum: 0, maximum: undefined }, { minimum: delaySchema?.minimum, maximum: delaySchema?.maximum });

  const promoSource = sources['server/routes/promos.js'] || '';
  if (!/res\.json\(\{\s*ok:\s*false,\s*error:/.test(promoSource)) {
    addSentinel(diagnostics, 'C-11', 'server/routes/promos.js', 'GET', '/api/promo/info', 'invalid/missing code returns HTTP 200 {ok:false,error}', 'audited response branch not found');
  }
  addSentinel(diagnostics, 'C-11', 'docs/openapi.yaml', 'GET', '/api/promo/info', true, Boolean(openapi.paths?.['/api/promo/info']?.get?.responses?.['404']));

  if (!/promosRouter\.post\(['"]\/api\/promos['"]/.test(promoSource) || !/req\.body\.code/.test(promoSource)) {
    addSentinel(diagnostics, 'C-12', 'server/routes/promos.js', 'POST', '/api/promos', 'handler reads request body code', 'audited promo creation handler not found');
  }
  addSentinel(diagnostics, 'C-12', 'docs/openapi.yaml', 'POST', '/api/promos', undefined, openapi.paths?.['/api/promos']?.post?.requestBody);

  const chatSource = sources['server/routes/chat.js'] || '';
  if (!/INSERT INTO chat_meta/.test(chatSource)) {
    addSentinel(diagnostics, 'C-15', 'server/routes/chat.js', 'POST', '/api/chat/botlog', 'botlog upserts chat metadata', 'audited chat_meta insert not found');
  }
  addSentinel(diagnostics, 'C-15', 'docs/openapi.yaml', 'POST', '/api/chat/botlog', true, Boolean(openapi.paths?.['/api/chat/botlog']?.post?.responses?.['409']));

  const pushSchema = openapi.paths?.['/api/push/subscribe']?.post?.requestBody?.content?.['application/json']?.schema?.properties?.sub;
  addSentinel(diagnostics, 'C-14', 'docs/openapi.yaml', 'POST', '/api/push/subscribe', false, Boolean(pushSchema?.required?.includes('endpoint')));
  if (!/!sub\s*\|\|\s*!sub\.endpoint/.test(sources['server/routes/push.js'] || '')) {
    addSentinel(diagnostics, 'C-14', 'server/routes/push.js', 'POST', '/api/push/subscribe', 'handler requires sub.endpoint', 'audited endpoint validation not found');
  }

  const guarded = [
    ['/api/promos', 'post'],
    ['/api/stats', 'get'],
    ['/api/orders/{id}/status', 'post'],
  ];
  const missingGuards = [
    ['server/routes/promos.js', 'adminGuard'],
    ['server/routes/stats.js', 'adminGuard'],
    ['server/routes/orders.js', 'dispatchGuard'],
  ].filter(([file, guard]) => !(sources[file] || '').includes(guard)).map(([file, guard]) => file + ' missing ' + guard);
  addSentinel(diagnostics, 'C-17', 'server/routes/*.js', 'GUARD', 'adminGuard/dispatchGuard', [], missingGuards);
  const missingSecurity = guarded.filter(([path, method]) => {
    const security = openapi.paths?.[path]?.[method]?.security;
    return !Array.isArray(security) || !security.some((entry) => Object.hasOwn(entry, 'BearerAuth'));
  });
  addSentinel(diagnostics, 'C-17', 'docs/openapi.yaml', 'MULTIPLE', '/api/promos, /api/stats, /api/orders/{id}/status', [], missingSecurity.map(([path, method]) => `${method.toUpperCase()} ${path}`));

  return { findings, diagnostics };
}

export function formatDiagnostic(diagnostic) {
  const location = `${diagnostic.file || '<unknown>'}${diagnostic.line ? `:${diagnostic.line}` : ''}`;
  return `[${diagnostic.code}] ${location} ${diagnostic.method || ''} ${diagnostic.path || ''} — expected: ${diagnostic.expected}; actual: ${diagnostic.actual}`;
}

export function runApiContractAudit(root = process.cwd()) {
  const files = [
    'server.js',
    'server/domain/customers.js',
    ...readdirSync(join(root, 'server/routes'))
      .filter((name) => name.endsWith('.js'))
      .sort()
      .map((name) => join('server/routes', name)),
  ];
  const sources = {};
  const serverRoutes = [];
  const diagnostics = [];

  for (const relativePath of files) {
    const source = readFileSync(join(root, relativePath), 'utf8');
    sources[relativePath.replaceAll('\\', '/')] = source;
    const routes = extractExpressRoutes({ file: relativePath.replaceAll('\\', '/'), source });
    serverRoutes.push(...routes);
    diagnostics.push(...routes.diagnostics);
  }

  const openApiSource = readFileSync(join(root, 'docs/openapi.yaml'), 'utf8');
  let openapi;
  try {
    openapi = parseOpenApiStrict(openApiSource);
  } catch (error) {
    diagnostics.push({
      code: 'OPENAPI_PARSE_ERROR',
      file: 'docs/openapi.yaml',
      method: 'YAML',
      path: 'paths',
      expected: 'valid YAML with unique keys',
      actual: error.message,
    });
    return { serverRoutes, openApiOperations: [], diagnostics, sentinelFindings: [] };
  }

  const openApiOperations = collectOpenApiOperations(openapi);
  diagnostics.push(...compareRouteInventories(serverRoutes, openApiOperations));
  const sentinels = checkAuditSentinels({ openapi, sources });
  diagnostics.push(...sentinels.diagnostics);
  return { serverRoutes, openApiOperations, diagnostics, sentinelFindings: sentinels.findings };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const result = runApiContractAudit();
  console.log(`API contract guard: ${result.serverRoutes.length} production routes, ${result.openApiOperations.length} OpenAPI operations, ${result.sentinelFindings.length} F-003 sentinels.`);
  if (result.diagnostics.length) {
    for (const diagnostic of result.diagnostics) console.error(formatDiagnostic(diagnostic));
    process.exitCode = 1;
  } else {
    console.log('API route inventory and audited baseline sentinels are consistent.');
  }
}
