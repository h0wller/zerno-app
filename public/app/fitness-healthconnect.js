import { Capacitor, registerPlugin } from '@capacitor/core';

const nativeHealthConnect = registerPlugin('ZernoHealthConnect');

export function normalizeHealthConnectWorkout(workout) {
  if (!workout || typeof workout !== 'object' || workout.activityType !== 'running') return null;

  const id = String(workout.id || '').trim();
  const startedAt = Date.parse(workout.startedAt);
  const endedAt = Date.parse(workout.endedAt);
  const durationSeconds = Number(workout.durationSeconds);
  const distanceMeters = Number(workout.distanceMeters);
  const sourcePackageName = String(workout.sourcePackageName || '').trim();

  if (!id || id.length > 255 || !sourcePackageName || sourcePackageName.length > 255) return null;
  if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt) || endedAt <= startedAt) return null;
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 14400) return null;
  if (!Number.isFinite(distanceMeters) || distanceMeters < 0 || distanceMeters > 250000) return null;

  return {
    id,
    activityType: 'running',
    startedAt: new Date(startedAt).toISOString(),
    endedAt: new Date(endedAt).toISOString(),
    durationSeconds: Math.round(durationSeconds),
    distanceMeters: Math.round(distanceMeters),
    sourcePlatform: 'android_health_connect',
    sourceName: String(workout.sourceName || sourcePackageName).slice(0, 120),
    sourcePackageName,
    deviceName: String(workout.deviceName || '').slice(0, 120),
    deviceModel: String(workout.deviceModel || '').slice(0, 120),
    sourceProductType: String(workout.sourceProductType || '').slice(0, 120),
    recordingMethod: String(workout.recordingMethod || 'unknown').slice(0, 40),
    evidenceState: 'device_reported'
  };
}

function requireNativeAndroid() {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    throw new Error('Health Connect доступен только в установленном Android-приложении Zerno.');
  }
}

export const ZernoHealthConnect = Object.freeze({
  async isAvailable() {
    requireNativeAndroid();
    return nativeHealthConnect.isAvailable();
  },
  async requestAuthorization() {
    requireNativeAndroid();
    return nativeHealthConnect.requestAuthorization();
  },
  async getRecentRunningWorkouts(options = {}) {
    requireNativeAndroid();
    const result = await nativeHealthConnect.getRecentRunningWorkouts(options);
    return (Array.isArray(result.workouts) ? result.workouts : [])
      .map(normalizeHealthConnectWorkout)
      .filter(Boolean);
  }
});

if (typeof window !== 'undefined') window.ZernoHealthConnect = ZernoHealthConnect;
