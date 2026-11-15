import { Capacitor, registerPlugin } from '@capacitor/core';

const nativeHealthKit = registerPlugin('ZernoHealthKit');

export function normalizeHealthKitWorkout(workout) {
  if (!workout || typeof workout !== 'object' || workout.activityType !== 'running') return null;

  const id = String(workout.id || '').trim();
  const startedAt = Date.parse(workout.startedAt);
  const endedAt = Date.parse(workout.endedAt);
  const durationSeconds = Number(workout.durationSeconds);
  const distanceMeters = Number(workout.distanceMeters);
  const sourcePackageName = String(workout.sourceBundleIdentifier || '').trim();

  if (!id || id.length > 255 || !sourcePackageName || sourcePackageName.length > 255) return null;
  if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt) || endedAt <= startedAt) return null;
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 14400) return null;
  if (Math.round(durationSeconds) < 1) return null;
  if (!Number.isFinite(distanceMeters) || distanceMeters < 0 || distanceMeters > 250000) return null;

  return {
    id,
    activityType: 'running',
    startedAt: new Date(startedAt).toISOString(),
    endedAt: new Date(endedAt).toISOString(),
    durationSeconds: Math.round(durationSeconds),
    distanceMeters: Math.round(distanceMeters),
    sourcePlatform: 'apple_healthkit',
    sourceName: String(workout.sourceName || sourcePackageName).slice(0, 120),
    sourcePackageName,
    deviceName: String(workout.deviceName || '').slice(0, 120),
    deviceModel: String(workout.deviceModel || '').slice(0, 120),
    sourceProductType: String(workout.sourceProductType || '').slice(0, 120),
    evidenceState: 'device_reported'
  };
}

function requireNativeIOS() {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') {
    throw new Error('Apple Health is available only in the installed iOS app.');
  }
}

export const ZernoHealthKit = Object.freeze({
  async isAvailable() { requireNativeIOS(); return nativeHealthKit.isAvailable(); },
  async requestAuthorization() { requireNativeIOS(); return nativeHealthKit.requestAuthorization(); },
  async getRecentRunningWorkouts(options = {}) {
    requireNativeIOS();
    const result = await nativeHealthKit.getRecentRunningWorkouts(options);
    return (Array.isArray(result.workouts) ? result.workouts : [])
      .map(normalizeHealthKitWorkout).filter(Boolean);
  }
});

if (typeof window !== 'undefined') window.ZernoHealthKit = ZernoHealthKit;
