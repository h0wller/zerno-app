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
      received_at TEXT NOT NULL,
      verification_state TEXT NOT NULL DEFAULT 'unverified'
    );
    CREATE TABLE fitness_rewards (
      id TEXT PRIMARY KEY,
      cid TEXT NOT NULL,
      activity_id TEXT NOT NULL UNIQUE,
      code TEXT NOT NULL UNIQUE,
      reward_type TEXT NOT NULL DEFAULT 'filter_coffee',
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
  return { distanceMeters, elapsedSeconds: 3_600, startedAt, pointCount: 120 };
}

function fingerprint(char) {
  return char.repeat(64);
}

function service(db, currentDate) {
  return createFitnessRewardService({
    database: db,
    clock: () => new Date(currentDate.value),
    makeId: (() => { let id = 0; return () => 'id-' + (++id); })(),
  });
}

function seedReward(db, {
  customerId = 'guest-1',
  activityId = 'seed-activity',
  code = 'RUN-SEED0001',
  issuedAt = '2026-11-14T10:00:00.000Z',
  expiresAt = '2026-11-16T10:00:00.000Z',
  status = 'active',
} = {}) {
  db.prepare(`
    INSERT INTO fitness_activities
      (id,cid,source,fingerprint,distance_meters,elapsed_seconds,started_at,received_at,verification_state)
    VALUES (?,?, 'gpx', ?, 5250, 3600, ?, ?, 'verified')
  `).run(activityId, customerId, fingerprint('f'), issuedAt, issuedAt);
  db.prepare(`
    INSERT INTO fitness_rewards
      (id,cid,activity_id,code,reward_type,status,issued_at,expires_at)
    VALUES (?,?,?,?,'filter_coffee',?,?,?)
  `).run('reward-' + activityId, customerId, activityId, code, status, issuedAt, expiresAt);
}

test('keeps a plausible GPX upload unverified and never issues a reward from it', () => {
  const db = fixture();
  const rewards = service(db, { value: '2026-11-14T10:00:00.000Z' });
  const result = rewards.submitActivity({
    customerId: 'guest-1',
    activity: activity(),
    fingerprint: fingerprint('a'),
  });

  assert.equal(result.ok, true);
  assert.equal(result.verificationState, 'unverified');
  assert.equal(result.reward, null);
  assert.equal(result.reason, 'verification_required');
  assert.equal(db.prepare('SELECT verification_state FROM fitness_activities').get().verification_state, 'unverified');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM fitness_rewards').get().n, 0);
  db.close();
});

test('rejects the same uploaded activity fingerprint globally, including across customers', () => {
  const db = fixture();
  const rewards = service(db, { value: '2026-11-14T10:00:00.000Z' });
  const first = rewards.submitActivity({ customerId: 'guest-1', activity: activity(), fingerprint: fingerprint('b') });
  const second = rewards.submitActivity({ customerId: 'guest-2', activity: activity(), fingerprint: fingerprint('b') });

  assert.equal(first.ok, true);
  assert.equal(first.reward, null);
  assert.deepEqual(second, { ok: false, reason: 'duplicate_activity' });
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM fitness_activities').get().n, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM fitness_rewards').get().n, 0);
  db.close();
});

test('re-upload by the same guest returns the original unverified submission without a reward', () => {
  const db = fixture();
  const rewards = service(db, { value: '2026-11-14T10:00:00.000Z' });
  const first = rewards.submitActivity({ customerId: 'guest-1', activity: activity(), fingerprint: fingerprint('9') });
  const retry = rewards.submitActivity({ customerId: 'guest-1', activity: activity(), fingerprint: fingerprint('9') });

  assert.equal(retry.ok, true);
  assert.equal(retry.duplicate, true);
  assert.equal(retry.verificationState, 'unverified');
  assert.equal(retry.reward, null);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM fitness_activities').get().n, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM fitness_rewards').get().n, 0);
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

test('does not accept submissions from unverified customers or staff accounts', () => {
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
  seedReward(db);
  const rewards = service(db, { value: '2026-11-14T11:00:00.000Z' });

  assert.deepEqual(rewards.redeemReward({ code: 'RUN-SEED0001', staffId: 'guest-2' }), {
    ok: false, reason: 'staff_required',
  });
  const redeemed = rewards.redeemReward({ code: 'RUN-SEED0001', staffId: 'cashier-1' });
  assert.equal(redeemed.ok, true);
  assert.equal(redeemed.reward.status, 'redeemed');
  assert.equal(rewards.redeemReward({ code: 'RUN-SEED0001', staffId: 'cashier-1' }).reason, 'already_redeemed');
  assert.equal(db.prepare('SELECT redeemed_by FROM fitness_rewards').get().redeemed_by, 'cashier-1');
  db.close();
});

test('marks expired rewards unusable rather than redeeming them', () => {
  const db = fixture();
  seedReward(db);
  const rewards = service(db, { value: '2026-11-17T10:00:00.000Z' });

  const result = rewards.redeemReward({ code: 'RUN-SEED0001', staffId: 'cashier-1' });
  assert.deepEqual(result, { ok: false, reason: 'reward_expired' });
  assert.equal(db.prepare('SELECT status FROM fitness_rewards').get().status, 'expired');
  db.close();
});

test('latest reward lookup expires old codes and returns no raw activity data', () => {
  const db = fixture();
  const current = { value: '2026-11-14T10:00:00.000Z' };
  seedReward(db);
  const rewards = service(db, current);
  assert.equal(rewards.getLatestReward('guest-1').code, 'RUN-SEED0001');

  current.value = '2026-11-17T10:00:00.000Z';
  const latest = rewards.getLatestReward('guest-1');
  assert.equal(latest.status, 'expired');
  assert.equal(db.prepare('SELECT status FROM fitness_rewards').get().status, 'expired');
  db.close();
});
