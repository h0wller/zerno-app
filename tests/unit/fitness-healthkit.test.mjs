import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeHealthKitWorkout } from '../../public/app/fitness-healthkit.js';

const validWorkout = {
  id: 'workout-1', activityType: 'running',
  startedAt: '2026-11-14T08:00:00.000Z', endedAt: '2026-11-14T08:32:00.000Z',
  durationSeconds: 1920, distanceMeters: 5200, sourceName: 'Apple Watch',
  sourceBundleIdentifier: 'com.apple.health', deviceName: 'Apple Watch',
  deviceModel: 'Watch', sourceProductType: 'Watch'
};

test('normalizes HealthKit run as device-reported, not server-verified', () => {
  const result = normalizeHealthKitWorkout(validWorkout);
  assert.equal(result.activityType, 'running');
  assert.equal(result.distanceMeters, 5200);
  assert.equal(result.sourcePlatform, 'apple_healthkit');
  assert.equal(result.sourcePackageName, 'com.apple.health');
  assert.equal(result.evidenceState, 'device_reported');
});
test('rejects non-running activity types', () => {
  assert.equal(normalizeHealthKitWorkout({ ...validWorkout, activityType: 'walking' }), null);
});
test('rejects malformed dates, duration, distance and missing source provenance', () => {
  assert.equal(normalizeHealthKitWorkout({ ...validWorkout, endedAt: 'invalid' }), null);
  assert.equal(normalizeHealthKitWorkout({ ...validWorkout, durationSeconds: 0 }), null);
  assert.equal(normalizeHealthKitWorkout({ ...validWorkout, distanceMeters: -1 }), null);
  assert.equal(normalizeHealthKitWorkout({ ...validWorkout, sourceBundleIdentifier: '' }), null);
});
