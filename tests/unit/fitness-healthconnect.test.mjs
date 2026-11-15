import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeHealthConnectWorkout } from '../../public/app/fitness-healthconnect.js';

const validWorkout = {
  id: 'health-connect-record-1',
  activityType: 'running',
  startedAt: '2026-11-14T08:00:00.000Z',
  endedAt: '2026-11-14T08:32:00.000Z',
  durationSeconds: 1920,
  distanceMeters: 5200,
  sourceName: 'Google Fit',
  sourcePackageName: 'com.google.android.apps.fitness',
  deviceName: 'Pixel Watch',
  deviceModel: 'Watch 3',
  sourceProductType: 'watch',
  recordingMethod: 'actively_recorded'
};

test('normalizes Health Connect running sessions as device-reported evidence', () => {
  const result = normalizeHealthConnectWorkout(validWorkout);

  assert.equal(result.id, 'health-connect-record-1');
  assert.equal(result.activityType, 'running');
  assert.equal(result.distanceMeters, 5200);
  assert.equal(result.durationSeconds, 1920);
  assert.equal(result.sourcePlatform, 'android_health_connect');
  assert.equal(result.sourcePackageName, 'com.google.android.apps.fitness');
  assert.equal(result.recordingMethod, 'actively_recorded');
  assert.equal(result.evidenceState, 'device_reported');
  assert.equal(result.verificationState, undefined);
});

test('rejects non-running and malformed Health Connect sessions', () => {
  assert.equal(normalizeHealthConnectWorkout({ ...validWorkout, activityType: 'walking' }), null);
  assert.equal(normalizeHealthConnectWorkout({ ...validWorkout, endedAt: 'invalid' }), null);
  assert.equal(normalizeHealthConnectWorkout({ ...validWorkout, durationSeconds: 0 }), null);
  assert.equal(normalizeHealthConnectWorkout({ ...validWorkout, durationSeconds: 0.1 }), null);
  assert.equal(normalizeHealthConnectWorkout({ ...validWorkout, durationSeconds: 14401 }), null);
  assert.equal(normalizeHealthConnectWorkout({ ...validWorkout, distanceMeters: -1 }), null);
  assert.equal(normalizeHealthConnectWorkout({ ...validWorkout, distanceMeters: 250001 }), null);
  assert.equal(normalizeHealthConnectWorkout({ ...validWorkout, sourcePackageName: '' }), null);
});

test('retains the recording-method signal without upgrading manual entries to verified', () => {
  const result = normalizeHealthConnectWorkout({
    ...validWorkout,
    recordingMethod: 'manual_entry'
  });

  assert.equal(result.recordingMethod, 'manual_entry');
  assert.equal(result.evidenceState, 'device_reported');
  assert.equal(result.verificationState, undefined);
});

test('normalizes unknown recording methods to a bounded unknown value', () => {
  const result = normalizeHealthConnectWorkout({
    ...validWorkout,
    recordingMethod: 'untrusted-provider-value'.repeat(10)
  });

  assert.equal(result.recordingMethod, 'unknown');
  assert.equal(result.evidenceState, 'device_reported');
});

test('normalizes blank source names to the source identifier', () => {
  const result = normalizeHealthConnectWorkout({ ...validWorkout, sourceName: '  ' });
  assert.equal(result.sourceName, 'com.google.android.apps.fitness');
});

test('rejects missing or oversized record and source identifiers', () => {
  assert.equal(normalizeHealthConnectWorkout({ ...validWorkout, id: ' ' }), null);
  assert.equal(normalizeHealthConnectWorkout({ ...validWorkout, id: 'x'.repeat(256) }), null);
  assert.equal(normalizeHealthConnectWorkout({
    ...validWorkout,
    sourcePackageName: 'x'.repeat(256)
  }), null);
});
