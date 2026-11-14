import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';

async function reservePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

const port = await reservePort();
const base = 'http://127.0.0.1:' + port;
const root = path.resolve(import.meta.dirname, '../..');
const dbPath = path.join(os.tmpdir(), 'zerno-fitness-' + randomUUID() + '.db');
const webhookSecret = 'fitness-test-secret-2026';
const customerToken = 'fitness-customer-token';
const cashierToken = 'fitness-cashier-token';
let child;
let db;
let serverOutput = '';

async function waitForServer() {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error('Fitness test server exited (' + child.exitCode + '):\n' + serverOutput);
    }
    try {
      const response = await fetch(base + '/api/health');
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error('Timed out waiting for fitness test server:\n' + serverOutput);
}

async function request(route, { method = 'GET', token, body, headers = {}, redirect = 'follow' } = {}) {
  const response = await fetch(base + route, {
    method,
    redirect,
    headers: {
      ...(token ? { authorization: 'Bearer ' + token } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = {};
  try { json = await response.json(); } catch {}
  return { status: response.status, json, headers: response.headers };
}

function seedReward(code = 'RUN-TEST123456') {
  const now = '2026-11-14T10:00:00.000Z';
  db.prepare('INSERT INTO customers(id,name,role,verified) VALUES(?,?,?,?)')
    .run('fitness-guest', 'Fitness Guest', 'guest', 1);
  db.prepare('INSERT INTO customers(id,name,role,verified) VALUES(?,?,?,?)')
    .run('fitness-cashier', 'Fitness Cashier', 'cashier', 1);
  db.prepare('INSERT INTO customers(id,name,role,verified) VALUES(?,?,?,?)')
    .run('fitness-admin', 'Fitness Admin', 'admin', 1);
  db.prepare('INSERT INTO tokens(token,kind,ref,ts) VALUES(?,?,?,?)')
    .run(customerToken, 'user', 'fitness-guest', now);
  db.prepare('INSERT INTO tokens(token,kind,ref,ts) VALUES(?,?,?,?)')
    .run(cashierToken, 'user', 'fitness-cashier', now);
  db.prepare(`INSERT INTO fitness_activities(
    id,cid,source,fingerprint,distance_meters,elapsed_seconds,started_at,received_at
  ) VALUES(?,?,?,?,?,?,?,?)`).run(
    'fitness-activity', 'fitness-guest', 'gpx', 'a'.repeat(64),
    5_200, 3_600, now, now,
  );
  db.prepare(`INSERT INTO fitness_rewards(
    id,cid,activity_id,code,status,issued_at,expires_at
  ) VALUES(?,?,?,?,?,?,?)`).run(
    'fitness-reward', 'fitness-guest', 'fitness-activity', code, 'active',
    now, '2026-11-16T10:00:00.000Z',
  );
  return code;
}

before(async () => {
  child = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      DB_PATH: dbPath,
      PORT: String(port),
      TELEGRAM_BOT_TOKEN: '',
      TEST_TOKEN: '',
      TG_WEBHOOK_SECRET: webhookSecret,
      FITNESS_REWARDS_ENABLED: 'false',
      STRAVA_ENABLED: 'true',
      STRAVA_CLIENT_ID: '12345',
      STRAVA_CLIENT_SECRET: 'strava-integration-test-client-secret',
      STRAVA_REDIRECT_URI: 'https://zerno.example/api/fitness/strava/callback',
      STRAVA_TOKEN_ENCRYPTION_KEY: 'a'.repeat(64),
      STRAVA_WEBHOOK_VERIFY_TOKEN: 'strava-integration-verify-token',
      STRAVA_WEBHOOK_PATH_SECRET: 'p'.repeat(48),
      STRAVA_WEBHOOK_SUBSCRIPTION_ID: '6789',
      WEBAPP_URL: 'https://zerno.example',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', chunk => { serverOutput += chunk.toString(); });
  child.stderr.on('data', chunk => { serverOutput += chunk.toString(); });
  await waitForServer();
  db = new Database(dbPath);
});

beforeEach(() => {
  db.exec('DELETE FROM strava_oauth_states; DELETE FROM strava_connections; DELETE FROM fitness_rewards; DELETE FROM fitness_activities; DELETE FROM tokens; DELETE FROM history; DELETE FROM events; DELETE FROM customers;');
});

after(async () => {
  if (db) db.close();
  if (child && child.exitCode === null) {
    child.kill('SIGTERM');
    await Promise.race([
      once(child, 'exit'),
      new Promise(resolve => setTimeout(resolve, 4_000)),
    ]);
  }
  for (const suffix of ['', '-wal', '-shm']) {
    try { fs.unlinkSync(dbPath + suffix); } catch {}
  }
});

test('staff redemption rejects anonymous and guest sessions', async () => {
  const code = seedReward();
  const anonymous = await request('/api/staff/fitness-rewards/' + code + '/redeem', { method: 'POST' });
  const guest = await request('/api/staff/fitness-rewards/' + code + '/redeem', {
    method: 'POST', token: customerToken,
  });

  assert.equal(anonymous.status, 401);
  assert.equal(guest.status, 403);
  assert.equal(db.prepare('SELECT status FROM fitness_rewards WHERE code=?').get(code).status, 'active');
});

test('cashier can redeem a fitness reward once and the action is recorded in history', async () => {
  const code = seedReward();
  const first = await request('/api/staff/fitness-rewards/' + code + '/redeem', {
    method: 'POST', token: cashierToken,
  });
  const retry = await request('/api/staff/fitness-rewards/' + code + '/redeem', {
    method: 'POST', token: cashierToken,
  });

  assert.equal(first.status, 200, JSON.stringify(first.json));
  assert.equal(first.json.reward.status, 'redeemed');
  assert.equal(retry.status, 409);
  assert.equal(retry.json.code, 'already_redeemed');
  assert.equal(db.prepare('SELECT status FROM fitness_rewards WHERE code=?').get(code).status, 'redeemed');
  assert.equal(
    db.prepare("SELECT COUNT(*) AS n FROM history WHERE cid='fitness-guest' AND a LIKE ?")
      .get('%' + code + '%').n,
    1,
  );
});


test('Strava profile endpoints require a user session and require versioned explicit consent', async () => {
  const anonymousStatus = await request('/api/fitness/strava/status');
  const anonymousActivities = await request('/api/fitness/strava/activities');
  assert.equal(anonymousStatus.status, 401);
  assert.equal(anonymousActivities.status, 401);

  seedReward();
  const consent = await request('/api/fitness/strava/consent', { token: customerToken });
  assert.equal(consent.status, 200);
  assert.match(consent.headers.get('cache-control') || '', /no-store/);
  assert.equal(consent.json.notice.version, '2026-11-14-v1');
  assert.equal(consent.json.notice.data.length >= 2, true);
  assert.equal(consent.json.enabled, true);

  const missingConsent = await request('/api/fitness/strava/connect', {
    method: 'POST', token: customerToken, body: {},
  });
  assert.equal(missingConsent.status, 400);
  assert.equal(missingConsent.json.error, 'explicit_strava_consent_required');

  const connect = await request('/api/fitness/strava/connect', {
    method: 'POST',
    token: customerToken,
    body: { consent: true, consentVersion: '2026-11-14-v1' },
  });
  assert.equal(connect.status, 200, JSON.stringify(connect.json));
  assert.match(connect.headers.get('cache-control') || '', /no-store/);
  assert.equal(connect.json.scope, 'activity:read');
  const state = new URL(connect.json.authorizationUrl).searchParams.get('state');
  const setCookie = connect.headers.get('set-cookie') || '';
  assert.match(setCookie, /__Secure-zerno_strava_state=/);
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /Secure/);
  assert.match(setCookie, /SameSite=Lax/);
  assert.match(setCookie, /Path=\/api\/fitness\/strava\/callback/);

  const forwarded = await request(
    '/api/fitness/strava/callback?state=' + encodeURIComponent(state) + '&error=access_denied',
    { redirect: 'manual' },
  );
  assert.equal(forwarded.status, 400);
  assert.match(forwarded.headers.get('cache-control') || '', /no-store/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM strava_oauth_states').get().n, 1);

  const cookiePair = setCookie.split(';', 1)[0];
  const denied = await request(
    '/api/fitness/strava/callback?state=' + encodeURIComponent(state) + '&error=access_denied',
    { headers: { cookie: cookiePair }, redirect: 'manual' },
  );
  assert.equal(denied.status, 303);
  assert.equal(denied.headers.get('location'), 'https://zerno.example/?strava=denied');
  assert.match(denied.headers.get('set-cookie') || '', /Max-Age=0/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM strava_oauth_states').get().n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM strava_connections').get().n, 0);
});

test('Telegram webhook cannot process uploads when the fitness feature flag is disabled', async () => {
  seedReward();
  const before = db.prepare('SELECT COUNT(*) AS n FROM fitness_activities').get().n;
  const response = await request('/api/tg/webhook', {
    method: 'POST',
    headers: { 'x-telegram-bot-api-secret-token': webhookSecret },
    body: {
      update_id: 987654,
      message: {
        message_id: 1,
        chat: { id: 12345 },
        from: { id: 12345 },
        document: { file_id: 'not-downloaded', file_name: 'run.gpx', file_size: 100 },
      },
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.json.ok, true);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM fitness_activities').get().n, before);
});
