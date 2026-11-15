import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeHealthKitWorkout } from '../../public/app/fitness-healthkit.js';
import { normalizeHealthConnectWorkout } from '../../public/app/fitness-healthconnect.js';

const commonWorkout = {
  id: 'provider-record-1',
  activityType: 'running',
  startedAt: '2026-11-14T08:00:00.000Z',
  endedAt: '2026-11-14T08:32:00.000Z',
  durationSeconds: 1920,
  distanceMeters: 5200,
  sourceName: 'Health provider',
  deviceName: 'Watch',
  deviceModel: 'Watch model',
  sourceProductType: 'watch'
};

test('HealthKit and Health Connect expose the same provider-neutral required fields', () => {
  const ios = normalizeHealthKitWorkout({
    ...commonWorkout,
    sourceBundleIdentifier: 'com.example.health'
  });
  const android = normalizeHealthConnectWorkout({
    ...commonWorkout,
    sourcePackageName: 'com.example.health',
    recordingMethod: 'actively_recorded'
  });

  const iosKeys = Object.keys(ios).filter(key => key !== 'sourcePlatform').sort();
  const androidKeys = Object.keys(android)
    .filter(key => key !== 'sourcePlatform' && key !== 'recordingMethod')
    .sort();

  assert.deepEqual(iosKeys, androidKeys);
  for (const key of iosKeys) {
    assert.deepEqual(ios[key], android[key], `shared field ${key} must have the same normalized value`);
  }
  assert.equal(ios.sourcePlatform, 'apple_healthkit');
  assert.equal(android.sourcePlatform, 'android_health_connect');
  assert.equal(android.recordingMethod, 'actively_recorded');
  assert.equal(ios.evidenceState, 'device_reported');
  assert.equal(android.evidenceState, 'device_reported');
});
