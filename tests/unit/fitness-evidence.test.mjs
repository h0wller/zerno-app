import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { createFitnessEvidenceService } from '../../server/domain/fitness-evidence.js';

function fixture() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE customers(id TEXT PRIMARY KEY, role TEXT NOT NULL, verified INTEGER NOT NULL);
    CREATE TABLE fitness_device_evidence(
      id TEXT PRIMARY KEY,
      cid TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      source_platform TEXT NOT NULL,
      source_record_hash TEXT NOT NULL UNIQUE,
      started_at TEXT NOT NULL,
      ended_at TEXT NOT NULL,
      duration_seconds INTEGER NOT NULL,
      distance_meters INTEGER NOT NULL,
      source_name TEXT NOT NULL,
      source_package_name TEXT NOT NULL,
      device_name TEXT,
      device_model TEXT,
      source_product_type TEXT,
      recording_method TEXT NOT NULL DEFAULT 'unknown',
      verification_state TEXT NOT NULL DEFAULT 'unverified',
      received_at TEXT NOT NULL
    );
  `);
  db.prepare('INSERT INTO customers VALUES(?,?,?)').run('guest-1', 'guest', 1);
  db.prepare('INSERT INTO customers VALUES(?,?,?)').run('guest-2', 'guest', 1);
  db.prepare('INSERT INTO customers VALUES(?,?,?)').run('unverified', 'guest', 0);
  db.prepare('INSERT INTO customers VALUES(?,?,?)').run('staff', 'cashier', 1);
  return db;
}

function workout(overrides = {}) {
  return {
    id: 'record-1',
    activityType: 'running',
    startedAt: '2026-11-14T08:00:00.000Z',
    endedAt: '2026-11-14T08:32:00.000Z',
    durationSeconds: 1920,
    distanceMeters: 5200,
    sourcePlatform: 'android_health_connect',
    sourceName: 'Garmin Connect',
    sourcePackageName: 'com.garmin.android.apps.connectmobile',
    deviceName: 'Watch',
    deviceModel: 'Watch model',
    sourceProductType: 'watch',
    recordingMethod: 'actively_recorded',
    evidenceState: 'device_reported',
    ...overrides,
  };
}

function createService(db, now = '2026-11-14T10:00:00.000Z') {
  let id = 0;
  return createFitnessEvidenceService({
    database: db,
    clock: () => new Date(now),
    makeId: () => 'evidence-' + (++id),
  });
}

test('stores Health Connect summaries as unverified without issuing rewards', () => {
  const db = fixture();
  const service = createService(db);
  const result = service.submitDeviceEvidence({ customerId: 'guest-1', activity: workout() });

  assert.equal(result.ok, true);
  assert.equal(result.verificationState, 'unverified');
  assert.equal(result.evidenceState, 'device_reported');
  assert.equal(result.duplicate, false);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM fitness_device_evidence').get().n, 1);
  assert.equal(db.prepare('SELECT verification_state FROM fitness_device_evidence').get().verification_state, 'unverified');
  db.close();
});

test('accepts the common HealthKit source platform and normalizes it to unverified evidence', () => {
  const db = fixture();
  const service = createService(db);
  const result = service.submitDeviceEvidence({
    customerId: 'guest-1',
    activity: workout({ id: 'ios-record-1', sourcePlatform: 'apple_healthkit', sourcePackageName: 'com.apple.Health' }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.sourcePlatform, 'apple_healthkit');
  assert.equal(result.verificationState, 'unverified');
  db.close();
});

test('deduplicates provider records per customer and provider without returning a reward', () => {
  const db = fixture();
  const service = createService(db);
  const first = service.submitDeviceEvidence({ customerId: 'guest-1', activity: workout() });
  const retry = service.submitDeviceEvidence({ customerId: 'guest-1', activity: workout() });
  const otherGuest = service.submitDeviceEvidence({ customerId: 'guest-2', activity: workout() });

  assert.equal(first.ok, true);
  assert.equal(retry.duplicate, true);
  assert.equal(retry.id, first.id);
  assert.equal(otherGuest.ok, true);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM fitness_device_evidence').get().n, 2);
  db.close();
});

test('ignores client attempts to mark evidence verified or inject reward metadata', () => {
  const db = fixture();
  const service = createService(db);
  const result = service.submitDeviceEvidence({
    customerId: 'guest-1',
    activity: workout({ evidenceState: 'verified', verificationState: 'verified', rewardCode: 'RUN-FAKE1234' }),
    verified: true,
  });

  assert.equal(result.verificationState, 'unverified');
  assert.equal(result.reward, null);
  assert.equal(db.prepare('SELECT verification_state FROM fitness_device_evidence').get().verification_state, 'unverified');
  db.close();
});

test('rejects malformed, stale, future, unsupported and non-running summaries', () => {
  const db = fixture();
  const service = createService(db);
  const cases = [
    workout({ id: '' }),
    workout({ sourcePackageName: '' }),
    workout({ activityType: 'cycling' }),
    workout({ distanceMeters: -1 }),
    workout({ durationSeconds: 0 }),
    workout({ endedAt: '2026-11-14T07:00:00.000Z' }),
    workout({ startedAt: '2026-11-01T08:00:00.000Z' }),
    workout({ startedAt: '2026-11-15T08:00:00.000Z' }),
  ];

  for (const activity of cases) {
    assert.equal(service.submitDeviceEvidence({ customerId: 'guest-1', activity }).ok, false);
  }
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM fitness_device_evidence').get().n, 0);
  db.close();
});

test('requires a verified guest and never accepts staff or unverified profiles', () => {
  const db = fixture();
  const service = createService(db);
  for (const customerId of ['unverified', 'staff', 'missing']) {
    assert.deepEqual(service.submitDeviceEvidence({ customerId, activity: workout() }), {
      ok: false, reason: 'customer_not_eligible',
    });
  }
  db.close();
});
