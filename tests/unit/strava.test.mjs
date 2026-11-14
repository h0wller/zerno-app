import { test } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { createStravaService } from '../../server/services/strava.js';

const FIXED_NOW = Date.parse('2026-11-14T10:00:00.000Z');
const KEY = 'a'.repeat(64);

function fixture({ fetchImpl, env = {} } = {}) {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE customers (id TEXT PRIMARY KEY);
    CREATE TABLE strava_connections (
      cid TEXT PRIMARY KEY,
      athlete_id TEXT NOT NULL UNIQUE,
      access_token_enc TEXT NOT NULL,
      refresh_token_enc TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      scopes TEXT NOT NULL,
      connected_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE strava_oauth_states (
      state_hash TEXT PRIMARY KEY,
      cid TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
  `);
  db.prepare('INSERT INTO customers(id) VALUES (?)').run('guest-1');
  db.prepare('INSERT INTO customers(id) VALUES (?)').run('guest-2');
  const settings = {
    STRAVA_ENABLED: 'true',
    STRAVA_CLIENT_ID: '12345',
    STRAVA_CLIENT_SECRET: 'test-client-secret',
    STRAVA_REDIRECT_URI: 'https://zerno.example/api/fitness/strava/callback',
    STRAVA_TOKEN_ENCRYPTION_KEY: KEY,
    STRAVA_WEBHOOK_VERIFY_TOKEN: 'verify-token-for-tests',
    STRAVA_WEBHOOK_PATH_SECRET: 'p'.repeat(48),
    STRAVA_WEBHOOK_SUBSCRIPTION_ID: '6789',
    WEBAPP_URL: 'https://zerno.example',
    ...env,
  };
  const calls = [];
  const service = createStravaService({
    database: db,
    env: settings,
    clock: () => new Date(FIXED_NOW),
    fetchImpl: async (url, options = {}) => {
      calls.push({ url: String(url), options });
      return fetchImpl ? fetchImpl(url, options) : new Response('{}', { status: 200 });
    },
  });
  return { db, service, calls, env: settings };
}

function okJson(value) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function tokenResponse({ athleteId = 456, access = 'access-secret', refresh = 'refresh-secret' } = {}) {
  return okJson({
    access_token: access,
    refresh_token: refresh,
    expires_at: Math.floor(FIXED_NOW / 1000) + 7200,
    scope: 'read,activity:read',
    athlete: { id: athleteId },
  });
}

test('requires an explicit enabled flag and complete server-side Strava configuration', () => {
  const disabled = fixture({ env: { STRAVA_ENABLED: 'false' } });
  const incomplete = fixture({ env: { STRAVA_TOKEN_ENCRYPTION_KEY: '' } });

  assert.deepEqual(disabled.service.getConfigurationStatus(), {
    enabled: false, configured: true, ready: false,
  });
  assert.equal(incomplete.service.getConfigurationStatus().ready, false);
  assert.equal(disabled.calls.length, 0);
  disabled.db.close();
  incomplete.db.close();
});

test('creates a one-use OAuth state hash and requests only activity:read', () => {
  const { db, service } = fixture();
  const authorization = service.createAuthorizationUrl('guest-1');
  const url = new URL(authorization.url);
  const stored = db.prepare('SELECT * FROM strava_oauth_states').get();

  assert.equal(url.origin, 'https://www.strava.com');
  assert.equal(url.pathname, '/oauth/authorize');
  assert.equal(url.searchParams.get('scope'), 'activity:read');
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('client_id'), '12345');
  assert.ok(url.searchParams.get('state'));
  assert.notEqual(stored.state_hash, url.searchParams.get('state'));
  assert.equal(stored.cid, 'guest-1');

  assert.equal(service.consumeOAuthState(url.searchParams.get('state')), 'guest-1');
  assert.throws(
    () => service.consumeOAuthState(url.searchParams.get('state')),
    /invalid/i,
  );
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM strava_oauth_states').get().n, 0);
  db.close();
});

test('exchanges OAuth code, encrypts tokens at rest and rejects insufficient scopes', async () => {
  const { db, service, calls } = fixture({ fetchImpl: async () => tokenResponse() });
  const authorization = new URL(service.createAuthorizationUrl('guest-1').url);
  const connected = await service.completeAuthorization({
    state: authorization.searchParams.get('state'),
    code: 'one-time-code',
    grantedScope: 'read,activity:read',
  });
  const row = db.prepare('SELECT * FROM strava_connections').get();

  assert.deepEqual(connected, { connected: true });
  assert.equal(row.athlete_id, '456');
  assert.notEqual(row.access_token_enc, 'access-secret');
  assert.notEqual(row.refresh_token_enc, 'refresh-secret');
  assert.match(row.access_token_enc, /^v1\./);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /oauth\/token$/);
  assert.match(String(calls[0].options.body), /authorization_code/);

  const denied = await service.createAuthorizationUrl('guest-2');
  await assert.rejects(
    service.completeAuthorization({
      state: new URL(denied.url).searchParams.get('state'),
      code: 'another-code',
      grantedScope: 'read',
    }),
    /scope/i,
  );
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM strava_connections').get().n, 1);

  const extraScope = new URL(service.createAuthorizationUrl('guest-2').url);
  await assert.rejects(service.completeAuthorization({
    state: extraScope.searchParams.get('state'),
    code: 'too-broad',
    grantedScope: 'read,activity:read,activity:write',
  }), error => error && error.code === 'strava_required_scope_missing');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM strava_connections').get().n, 1);
  db.close();
});

test('revokes a provider token when the OAuth response has an invalid athlete identity', async () => {
  const { db, service, calls } = fixture({
    fetchImpl: async (url) => {
      if (String(url) === 'https://www.strava.com/oauth/token') {
        return okJson({
          access_token: 'unclaimed-access',
          refresh_token: 'unclaimed-refresh',
          expires_at: Math.floor(FIXED_NOW / 1000) + 7200,
          scope: 'read,activity:read',
          athlete: { id: -1 },
        });
      }
      return new Response('', { status: 200 });
    },
  });
  const state = new URL(service.createAuthorizationUrl('guest-1').url).searchParams.get('state');

  await assert.rejects(
    service.completeAuthorization({ state, code: 'malformed-athlete', grantedScope: 'activity:read' }),
    error => error && error.code === 'strava_token_exchange_failed',
  );

  assert.equal(calls.at(-1).url, 'https://www.strava.com/oauth/revoke');
  assert.match(String(calls.at(-1).options.body), /unclaimed-refresh/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM strava_connections').get().n, 0);
  db.close();
});

test('does not allow one Strava athlete account to be linked to two Zerno profiles', async () => {
  const { db, service } = fixture({ fetchImpl: async () => tokenResponse({ athleteId: 777 }) });
  const first = new URL(service.createAuthorizationUrl('guest-1').url);
  await service.completeAuthorization({
    state: first.searchParams.get('state'), code: 'code-1', grantedScope: 'activity:read',
  });
  const second = new URL(service.createAuthorizationUrl('guest-2').url);

  await assert.rejects(
    service.completeAuthorization({
      state: second.searchParams.get('state'), code: 'code-2', grantedScope: 'activity:read',
    }),
    error => error && error.code === 'strava_athlete_already_linked',
  );
  assert.equal(db.prepare('SELECT cid FROM strava_connections').get().cid, 'guest-1');
  db.close();
});

test('returns only the authenticated athlete activity fields and does not persist activity data', async () => {
  const activity = {
    id: 9001, name: 'Morning run', type: 'Run', sport_type: 'Run',
    distance: 5200, moving_time: 1800, elapsed_time: 1900,
    start_date: '2026-11-14T08:00:00Z', average_speed: 2.88,
    map: { summary_polyline: 'private-route-data' }, total_elevation_gain: 42,
  };
  const { db, service } = fixture({
    fetchImpl: async (url) => String(url).includes('/oauth/token')
      ? tokenResponse()
      : okJson([activity]),
  });
  const state = new URL(service.createAuthorizationUrl('guest-1').url).searchParams.get('state');
  await service.completeAuthorization({ state, code: 'code', grantedScope: 'activity:read' });

  const result = await service.listActivities('guest-1', { page: 1, perPage: 10 });
  assert.deepEqual(result.activities[0], {
    id: '9001', name: 'Morning run', type: 'Run', sportType: 'Run',
    distanceMeters: 5200, movingTimeSeconds: 1800, elapsedTimeSeconds: 1900,
    startedAt: '2026-11-14T08:00:00Z', averageSpeedMetersPerSecond: 2.88,
  });
  assert.equal(JSON.stringify(result).includes('private-route-data'), false);
  assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%activit%'").get(), undefined);
  db.close();
});

test('refreshes expiring tokens and persists the rotated refresh token', async () => {
  const responses = [];
  const { db, service } = fixture({
    fetchImpl: async (url) => {
      if (String(url).includes('/oauth/token')) {
        const body = String(responses.shift());
        if (body === 'refresh') return okJson({
          access_token: 'rotated-access',
          refresh_token: 'rotated-refresh',
          expires_at: Math.floor(FIXED_NOW / 1000) + 7200,
          scope: 'read,activity:read',
        });
        return tokenResponse();
      }
      return okJson([]);
    },
  });
  const state = new URL(service.createAuthorizationUrl('guest-1').url).searchParams.get('state');
  await service.completeAuthorization({ state, code: 'initial', grantedScope: 'activity:read' });
  db.prepare('UPDATE strava_connections SET expires_at=? WHERE cid=?')
    .run(Math.floor(FIXED_NOW / 1000) + 120, 'guest-1');
  responses.push('refresh');

  await service.listActivities('guest-1');
  const storedRefresh = db.prepare('SELECT refresh_token_enc FROM strava_connections WHERE cid=?')
    .get('guest-1').refresh_token_enc;
  assert.notEqual(storedRefresh, 'rotated-refresh');
  db.close();
});


test('deduplicates simultaneous refreshes for one profile while serving both activity reads', async () => {
  let refreshRequests = 0;
  let activityRequests = 0;
  const { db, service } = fixture({
    fetchImpl: async (url, options = {}) => {
      if (String(url) === 'https://www.strava.com/oauth/token') {
        const grant = options.body.get('grant_type');
        if (grant === 'authorization_code') return tokenResponse();
        refreshRequests += 1;
        await new Promise(resolve => setTimeout(resolve, 10));
        return okJson({
          access_token: 'concurrent-access',
          refresh_token: 'concurrent-refresh',
          expires_at: Math.floor(FIXED_NOW / 1000) + 7200,
          scope: 'read,activity:read',
        });
      }
      activityRequests += 1;
      return okJson([]);
    },
  });
  const state = new URL(service.createAuthorizationUrl('guest-1').url).searchParams.get('state');
  await service.completeAuthorization({ state, code: 'initial', grantedScope: 'activity:read' });
  db.prepare('UPDATE strava_connections SET expires_at=? WHERE cid=?')
    .run(Math.floor(FIXED_NOW / 1000) + 120, 'guest-1');

  const [first, second] = await Promise.all([
    service.listActivities('guest-1'),
    service.listActivities('guest-1'),
  ]);

  assert.deepEqual(first.activities, []);
  assert.deepEqual(second.activities, []);
  assert.equal(refreshRequests, 1);
  assert.equal(activityRequests, 2);
  assert.notEqual(
    db.prepare('SELECT refresh_token_enc FROM strava_connections WHERE cid=?').get('guest-1').refresh_token_enc,
    'concurrent-refresh',
  );
  db.close();
});

test('disconnect removes the local link and revokes the provider refresh token', async () => {
  const { db, service, calls } = fixture({
    fetchImpl: async (url) => String(url).includes('/oauth/token')
      ? tokenResponse()
      : new Response('', { status: 200 }),
  });
  const state = new URL(service.createAuthorizationUrl('guest-1').url).searchParams.get('state');
  await service.completeAuthorization({ state, code: 'code', grantedScope: 'activity:read' });

  const result = await service.disconnect('guest-1');
  assert.deepEqual(result, { disconnected: true, revoked: true });
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM strava_connections').get().n, 0);
  assert.equal(calls.at(-1).url, 'https://www.strava.com/oauth/revoke');
  assert.match(calls.at(-1).options.headers.authorization, /^Basic /);
  assert.match(String(calls.at(-1).options.body), /refresh-secret/);
  db.close();
});

test('deauthorization webhook only deletes a linked athlete for the configured subscription', async () => {
  const { db, service } = fixture({
    fetchImpl: async () => tokenResponse(),
  });
  const state = new URL(service.createAuthorizationUrl('guest-1').url).searchParams.get('state');
  await service.completeAuthorization({ state, code: 'code', grantedScope: 'activity:read' });

  const ignored = service.handleWebhook({
    subscription_id: 9999, object_type: 'athlete', object_id: 456,
    aspect_type: 'update', updates: { authorized: 'false' },
  });
  const removed = service.handleWebhook({
    subscription_id: 6789, object_type: 'athlete', object_id: 456,
    aspect_type: 'update', updates: { authorized: 'false' },
  });

  assert.equal(ignored, false);
  assert.equal(removed, true);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM strava_connections').get().n, 0);
  assert.equal(service.verifyWebhookToken('verify-token-for-tests'), true);
  assert.equal(service.verifyWebhookToken('wrong-token'), false);
  db.close();
});
