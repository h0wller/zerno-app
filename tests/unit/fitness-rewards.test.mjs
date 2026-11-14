import { test } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { createFitnessRewardService } from '../../server/domain/fitness-rewards.js';

function fixture() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE customers (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL DEFAULT 'guest',
      verified INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE fitness_activities (
      id TEXT PRIMARY KEY,
      cid TEXT NOT NULL,
      source TEXT NOT NULL,
      fingerprint TEXT NOT NULL UNIQUE,
      distance_meters INTEGER NOT NULL,
      elapsed_seconds INTEGER NOT NULL,
      started_at TEXT NOT NULL,
      received_at TEXT NOT NULL
    );
    CREATE TABLE fitness_rewards (
      id TEXT PRIMARY KEY,
      cid TEXT NOT NULL,
      activity_id TEXT NOT NULL UNIQUE,
      code TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL,
      issued_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      redeemed_at TEXT,
      redeemed_by TEXT
    );
  `);
  db.prepare('INSERT INTO customers(id,role,verified) VALUES(?,?,?)').run('guest-1', 'guest', 1);
  db.prepare('INSERT INTO customers(id,role,verified) VALUES(?,?,?)').run('guest-2', 'guest', 1);
  db.prepare('INSERT INTO customers(id,role,verified) VALUES(?,?,?)').run('unverified', 'guest', 0);
  db.prepare('INSERT INTO customers(id,role,verified) VALUES(?,?,?)').run('cashier-1', 'cashier', 1);
  return db;
}

function activity(distanceMeters = 5_250, startedAt = '2026-11-14T08:00:00.000Z') {
  return {
    distanceMeters,
    elapsedSeconds: 3_600,
    startedAt,
    pointCount: 120,
  };
}

function fingerprint(char) {
  return char.repeat(64);
}

function service(db, currentDate) {
  let codeNumber = 0;
  return createFitnessRewardService({
    database: db,
    clock: () => new Date(currentDate.value),
    makeCode: () => 'RUN-TEST' + String(++codeNumber).padStart(4, '0'),
  });
}

test('issues one 48-hour reward for a qualifying run and persists no raw GPS points', () => {
  const db = fixture();
  const rewards = service(db, { value: '2026-11-14T10:00:00.000Z' });
  const result = rewards.submitActivity({
    customerId: 'guest-1',
    activity: activity(),
    fingerprint: fingerprint('a'),
  });

  assert.equal(result.ok, true);
  assert.equal(result.reward.code, 'RUN-TEST0001');
  assert.equal(result.reward.status, 'active');
  assert.equal(Date.parse(result.reward.expiresAt) - Date.parse(result.reward.issuedAt), 48 * 60 * 60 * 1000);
  const row = db.prepare('SELECT * FROM fitness_activities').get();
  assert.equal(row.distance_meters, 5_250);
  assert.equal(Object.hasOwn(row, 'gpx'), false);
  assert.equal(Object.hasOwn(row, 'route'), false);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM fitness_rewards').get().n, 1);
  db.close();
});

test('rejects the same uploaded activity fingerprint globally, including across customers', () => {
  const db = fixture();
  const rewards = service(db, { value: '2026-11-14T10:00:00.000Z' });
  const first = rewards.submitActivity({ customerId: 'guest-1', activity: activity(), fingerprint: fingerprint('b') });
  const second = rewards.submitActivity({ customerId: 'guest-2', activity: activity(), fingerprint: fingerprint('b') });

  assert.equal(first.ok, true);
  assert.deepEqual(second, { ok: false, reason: 'duplicate_activity' });
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM fitness_activities').get().n, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM fitness_rewards').get().n, 1);
  db.close();
});

test('records an eligible later run but enforces one reward in every rolling seven-day window', () => {
  const db = fixture();
  const current = { value: '2026-11-14T10:00:00.000Z' };
  const rewards = service(db, current);
  const first = rewards.submitActivity({ customerId: 'guest-1', activity: activity(), fingerprint: fingerprint('c') });
  current.value = '2026-11-18T10:00:00.000Z';
  const second = rewards.submitActivity({ customerId: 'guest-1', activity: activity(6_000, '2026-11-18T08:00:00.000Z'), fingerprint: fingerprint('d') });

  assert.equal(first.reward !== null, true);
  assert.equal(second.ok, true);
  assert.equal(second.reward, null);
  assert.equal(second.reason, 'weekly_reward_limit');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM fitness_activities').get().n, 2);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM fitness_rewards').get().n, 1);
  db.close();
});

test('allows a new reward after the prior seven-day limit window has elapsed', () => {
  const db = fixture();
  const current = { value: '2026-11-01T10:00:00.000Z' };
  const rewards = service(db, current);
  rewards.submitActivity({ customerId: 'guest-1', activity: activity(5_250, '2026-11-01T08:00:00.000Z'), fingerprint: fingerprint('e') });
  current.value = '2026-11-09T10:00:00.000Z';
  const result = rewards.submitActivity({ customerId: 'guest-1', activity: activity(5_250, '2026-11-09T08:00:00.000Z'), fingerprint: fingerprint('f') });

  assert.equal(result.reward.code, 'RUN-TEST0002');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM fitness_rewards').get().n, 2);
  db.close();
});

test('rejects stale and future GPX activities', () => {
  const db = fixture();
  const rewards = service(db, { value: '2026-11-14T10:00:00.000Z' });
  const stale = rewards.submitActivity({
    customerId: 'guest-1',
    activity: activity(5_250, '2026-11-06T08:00:00.000Z'),
    fingerprint: fingerprint('7'),
  });
  const future = rewards.submitActivity({
    customerId: 'guest-1',
    activity: activity(5_250, '2026-11-15T08:00:00.000Z'),
    fingerprint: fingerprint('8'),
  });

  assert.deepEqual(stale, { ok: false, reason: 'implausible_activity' });
  assert.deepEqual(future, { ok: false, reason: 'implausible_activity' });
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM fitness_activities').get().n, 0);
  db.close();
});

test('does not issue rewards to unverified customers or staff accounts', () => {
  const db = fixture();
  const rewards = service(db, { value: '2026-11-14T10:00:00.000Z' });
  const unverified = rewards.submitActivity({ customerId: 'unverified', activity: activity(), fingerprint: fingerprint('1') });
  const staff = rewards.submitActivity({ customerId: 'cashier-1', activity: activity(), fingerprint: fingerprint('2') });

  assert.deepEqual(unverified, { ok: false, reason: 'customer_not_eligible' });
  assert.deepEqual(staff, { ok: false, reason: 'customer_not_eligible' });
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM fitness_activities').get().n, 0);
  db.close();
});

test('rejects too-short or implausible activities without consuming the fingerprint', () => {
  const db = fixture();
  const rewards = service(db, { value: '2026-11-14T10:00:00.000Z' });
  const short = rewards.submitActivity({ customerId: 'guest-1', activity: activity(4_999), fingerprint: fingerprint('3') });
  const invalid = rewards.submitActivity({
    customerId: 'guest-1',
    activity: { ...activity(), elapsedSeconds: 10 },
    fingerprint: fingerprint('4'),
  });

  assert.deepEqual(short, { ok: false, reason: 'distance_below_threshold' });
  assert.deepEqual(invalid, { ok: false, reason: 'implausible_activity' });
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM fitness_activities').get().n, 0);
  db.close();
});

test('redeems a reward exactly once and only for cashier or admin accounts', () => {
  const db = fixture();
  db.prepare('INSERT INTO customers(id,role,verified) VALUES(?,?,?)').run('admin-1', 'admin', 1);
  const rewards = service(db, { value: '2026-11-14T10:00:00.000Z' });
  const issued = rewards.submitActivity({ customerId: 'guest-1', activity: activity(), fingerprint: fingerprint('5') });

  assert.deepEqual(rewards.redeemReward({ code: issued.reward.code, staffId: 'guest-2' }), {
    ok: false, reason: 'staff_required',
  });
  const redeemed = rewards.redeemReward({ code: issued.reward.code, staffId: 'cashier-1' });
  assert.equal(redeemed.ok, true);
  assert.equal(redeemed.reward.status, 'redeemed');
  assert.equal(rewards.redeemReward({ code: issued.reward.code, staffId: 'cashier-1' }).reason, 'already_redeemed');
  assert.equal(db.prepare('SELECT redeemed_by FROM fitness_rewards').get().redeemed_by, 'cashier-1');
  db.close();
});

test('marks expired rewards unusable rather than redeeming them', () => {
  const db = fixture();
  const current = { value: '2026-11-14T10:00:00.000Z' };
  const rewards = service(db, current);
  const issued = rewards.submitActivity({ customerId: 'guest-1', activity: activity(), fingerprint: fingerprint('6') });
  current.value = '2026-11-17T10:00:00.000Z';

  const result = rewards.redeemReward({ code: issued.reward.code, staffId: 'cashier-1' });
  assert.deepEqual(result, { ok: false, reason: 'reward_expired' });
  assert.equal(db.prepare('SELECT status FROM fitness_rewards').get().status, 'expired');
  db.close();
});
