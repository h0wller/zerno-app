import crypto from 'node:crypto';
import { db as defaultDb } from '../db/connection.js';

const PLATFORMS = new Set(['apple_healthkit', 'android_health_connect']);
const RECORDING_METHODS = new Set([
  'actively_recorded', 'automatically_recorded', 'manual_entry', 'unknown',
]);
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_SUBMISSIONS_PER_DAY = 30;

function boundedText(value, max, { required = false } = {}) {
  if (typeof value !== 'string') return required ? null : '';
  const normalized = value.trim();
  if (required && !normalized) return null;
  if (normalized.length > max) return null;
  return normalized;
}

function normalizeActivity(activity, now) {
  if (!activity || typeof activity !== 'object' || Array.isArray(activity)) return null;
  const id = boundedText(activity.id, 255, { required: true });
  const sourcePlatform = boundedText(activity.sourcePlatform, 40, { required: true });
  const sourceName = boundedText(activity.sourceName, 120, { required: true });
  const sourcePackageName = boundedText(activity.sourcePackageName, 255, { required: true });
  const deviceName = boundedText(activity.deviceName, 120);
  const deviceModel = boundedText(activity.deviceModel, 120);
  const sourceProductType = boundedText(activity.sourceProductType, 120);
  const activityType = boundedText(activity.activityType, 32, { required: true });
  const startedMs = Date.parse(activity.startedAt);
  const endedMs = Date.parse(activity.endedAt);
  const durationSeconds = Number(activity.durationSeconds);
  const distanceMeters = Number(activity.distanceMeters);

  if (!id || !sourceName || !sourcePackageName || !activityType ||
      !PLATFORMS.has(sourcePlatform) || activityType !== 'running') return null;
  if (![startedMs, endedMs, durationSeconds, distanceMeters].every(Number.isFinite)) return null;
  if (!Number.isInteger(durationSeconds) || durationSeconds < 60 || durationSeconds > 14_400) return null;
  if (!Number.isInteger(distanceMeters) || distanceMeters < 500 || distanceMeters > 250_000) return null;
  if (endedMs <= startedMs || Math.abs((endedMs - startedMs) / 1000 - durationSeconds) > 300) return null;
  if (startedMs > now.getTime() + 5 * 60 * 1000 || startedMs < now.getTime() - 7 * DAY_MS) return null;
  const speed = distanceMeters / durationSeconds;
  if (speed < 0.3 || speed > 8) return null;

  const recordingMethod = RECORDING_METHODS.has(activity.recordingMethod)
    ? activity.recordingMethod : 'unknown';

  return {
    id,
    sourcePlatform,
    sourceName,
    sourcePackageName,
    deviceName,
    deviceModel,
    sourceProductType,
    recordingMethod,
    startedAt: new Date(startedMs).toISOString(),
    endedAt: new Date(endedMs).toISOString(),
    durationSeconds,
    distanceMeters,
  };
}

export function createFitnessEvidenceService({
  database = defaultDb,
  clock = () => new Date(),
  makeId = () => crypto.randomUUID(),
} = {}) {
  function submitDeviceEvidence({ customerId, activity }) {
    const cid = boundedText(String(customerId || ''), 128, { required: true });
    if (!cid) return { ok: false, reason: 'invalid_input' };
    const now = clock();
    if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
      throw new TypeError('Fitness evidence clock must return a valid Date');
    }
    const normalized = normalizeActivity(activity, now);
    if (!normalized) return { ok: false, reason: 'invalid_activity' };

    const sourceRecordHash = crypto.createHash('sha256')
      .update(cid).update('\0')
      .update(normalized.sourcePlatform).update('\0')
      .update(normalized.sourcePackageName).update('\0')
      .update(normalized.id)
      .digest('hex');
    const receivedAt = now.toISOString();

    return database.transaction(() => {
      const customer = database.prepare(
        'SELECT id, role, verified FROM customers WHERE id=?'
      ).get(cid);
      if (!customer || customer.role !== 'guest' || customer.verified !== 1) {
        return { ok: false, reason: 'customer_not_eligible' };
      }

      const existing = database.prepare(
        'SELECT id, verification_state FROM fitness_device_evidence WHERE source_record_hash=?'
      ).get(sourceRecordHash);
      if (existing) {
        return {
          ok: true,
          duplicate: true,
          id: existing.id,
          sourcePlatform: normalized.sourcePlatform,
          evidenceState: 'device_reported',
          verificationState: existing.verification_state,
          reward: null,
        };
      }

      const recent = database.prepare(
        "SELECT COUNT(*) AS count FROM fitness_device_evidence WHERE cid=? AND received_at>=?"
      ).get(cid, new Date(now.getTime() - DAY_MS).toISOString());
      if (recent.count >= MAX_SUBMISSIONS_PER_DAY) {
        return { ok: false, reason: 'rate_limited' };
      }

      const id = makeId();
      database.prepare(`
        INSERT INTO fitness_device_evidence (
          id, cid, source_platform, source_record_hash,
          started_at, ended_at, duration_seconds, distance_meters,
          source_name, source_package_name, device_name, device_model,
          source_product_type, recording_method, verification_state, received_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unverified', ?)
      `).run(
        id, cid, normalized.sourcePlatform, sourceRecordHash,
        normalized.startedAt, normalized.endedAt, normalized.durationSeconds,
        normalized.distanceMeters, normalized.sourceName, normalized.sourcePackageName,
        normalized.deviceName || null, normalized.deviceModel || null,
        normalized.sourceProductType || null, normalized.recordingMethod, receivedAt,
      );

      // Client-provided HealthKit/Health Connect summaries are not signed provenance.
      // They remain unverified and cannot reach the reward issuer.
      return {
        ok: true,
        duplicate: false,
        id,
        sourcePlatform: normalized.sourcePlatform,
        evidenceState: 'device_reported',
        verificationState: 'unverified',
        reward: null,
      };
    }).immediate();
  }

  return { submitDeviceEvidence };
}

export const fitnessEvidenceService = createFitnessEvidenceService();
