import crypto from 'node:crypto';
import { db as defaultDb } from '../db/connection.js';

const REWARD_TTL_MS = 48 * 60 * 60 * 1000;

function iso(value) {
  return value.toISOString();
}

function rewardView(row) {
  return {
    id: row.id,
    code: row.code,
    rewardType: row.reward_type,
    status: row.status,
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
    redeemedAt: row.redeemed_at || null,
  };
}

function validActivity(activity, now) {
  if (!activity || typeof activity !== 'object') return false;
  const distance = Number(activity.distanceMeters);
  const elapsed = Number(activity.elapsedSeconds);
  const points = Number(activity.pointCount);
  const startedAt = Date.parse(activity.startedAt);
  if (!Number.isFinite(distance) || !Number.isFinite(elapsed) ||
      !Number.isFinite(points) || !Number.isFinite(startedAt)) return false;
  if (startedAt > now.getTime() + 5 * 60 * 1000 ||
      startedAt < now.getTime() - 7 * 24 * 60 * 60 * 1000) return false;
  if (distance <= 0 || !Number.isInteger(elapsed) || elapsed < 300 ||
      elapsed > 14_400 || !Number.isInteger(points) || points < 10 || points > 20_000) return false;
  const averageSpeed = distance / elapsed;
  return averageSpeed >= 0.3 && averageSpeed <= 8;
}

export function createFitnessRewardService({
  database = defaultDb,
  clock = () => new Date(),
  makeId = () => crypto.randomUUID(),
} = {}) {
  function submitActivity({ customerId, activity, fingerprint }) {
    const cid = String(customerId || '').trim();
    const digest = String(fingerprint || '').toLowerCase();
    if (!cid || !/^[a-f0-9]{64}$/.test(digest)) {
      return { ok: false, reason: 'invalid_input' };
    }
    const now = clock();
    if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
      throw new TypeError('Fitness reward clock must return a valid Date');
    }
    if (!validActivity(activity, now)) {
      return { ok: false, reason: 'implausible_activity' };
    }
    if (Number(activity.distanceMeters) < 5_000) {
      return { ok: false, reason: 'distance_below_threshold' };
    }
    const receivedAt = iso(now);
    const startedAt = iso(new Date(Date.parse(activity.startedAt)));

    return database.transaction(() => {
      const customer = database.prepare(
        'SELECT id, role, verified FROM customers WHERE id=?'
      ).get(cid);
      if (!customer || customer.role !== 'guest' || customer.verified !== 1) {
        return { ok: false, reason: 'customer_not_eligible' };
      }

      const existing = database.prepare(`
        SELECT a.id, a.cid, a.distance_meters, a.elapsed_seconds,
          a.verification_state, r.id AS reward_id, r.code, r.reward_type,
          r.status, r.issued_at, r.expires_at, r.redeemed_at
        FROM fitness_activities a
        LEFT JOIN fitness_rewards r ON r.activity_id=a.id
        WHERE a.fingerprint=?
      `).get(digest);

      if (existing) {
        if (existing.cid !== cid) return { ok: false, reason: 'duplicate_activity' };
        const reward = existing.reward_id ? {
          id: existing.reward_id,
          code: existing.code,
          rewardType: existing.reward_type,
          status: existing.status,
          issuedAt: existing.issued_at,
          expiresAt: existing.expires_at,
          redeemedAt: existing.redeemed_at || null,
        } : null;
        return {
          ok: true,
          duplicate: true,
          reason: reward ? 'duplicate_activity' : 'verification_required',
          verificationState: existing.verification_state,
          activity: {
            id: existing.id,
            distanceMeters: existing.distance_meters,
            elapsedSeconds: existing.elapsed_seconds,
          },
          reward,
        };
      }

      const activityId = makeId();
      database.prepare(`
        INSERT INTO fitness_activities (
          id, cid, source, fingerprint, distance_meters,
          elapsed_seconds, started_at, received_at, verification_state
        ) VALUES (?, ?, 'gpx', ?, ?, ?, ?, ?, 'unverified')
      `).run(
        activityId,
        cid,
        digest,
        Math.round(Number(activity.distanceMeters)),
        Math.round(Number(activity.elapsedSeconds)),
        startedAt,
        receivedAt,
      );

      // File plausibility and deduplication are not proof of origin.
      // GPX submissions remain unverified and cannot enter reward issuance.
      return {
        ok: true,
        reason: 'verification_required',
        verificationState: 'unverified',
        activity: {
          id: activityId,
          distanceMeters: Math.round(Number(activity.distanceMeters)),
          elapsedSeconds: Math.round(Number(activity.elapsedSeconds)),
        },
        reward: null,
      };
    }).immediate();
  }

  function redeemReward({ code, staffId }) {
    const normalizedCode = String(code || '').trim().toUpperCase();
    const operatorId = String(staffId || '').trim();
    if (!/^RUN-[A-Z0-9]{8,16}$/.test(normalizedCode) || !operatorId) {
      return { ok: false, reason: 'invalid_input' };
    }
    const now = clock();
    if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
      throw new TypeError('Fitness reward clock must return a valid Date');
    }
    const nowIso = iso(now);

    return database.transaction(() => {
      const staff = database.prepare('SELECT role FROM customers WHERE id=?').get(operatorId);
      if (!staff || !['cashier', 'admin'].includes(staff.role)) {
        return { ok: false, reason: 'staff_required' };
      }

      const row = database.prepare('SELECT * FROM fitness_rewards WHERE code=?').get(normalizedCode);
      if (!row) return { ok: false, reason: 'reward_not_found' };
      if (row.status === 'redeemed') return { ok: false, reason: 'already_redeemed' };
      if (row.status === 'expired' || row.expires_at <= nowIso) {
        database.prepare("UPDATE fitness_rewards SET status='expired' WHERE id=? AND status='active'").run(row.id);
        return { ok: false, reason: 'reward_expired' };
      }
      if (row.status !== 'active') return { ok: false, reason: 'reward_not_redeemable' };

      database.prepare(`
        UPDATE fitness_rewards
        SET status='redeemed', redeemed_at=?, redeemed_by=?
        WHERE id=? AND status='active'
      `).run(nowIso, operatorId, row.id);

      const updated = database.prepare('SELECT * FROM fitness_rewards WHERE id=?').get(row.id);
      return { ok: true, reward: rewardView(updated) };
    }).immediate();
  }

  function getLatestReward(customerId) {
    const cid = String(customerId || '').trim();
    if (!cid) return null;
    const now = clock();
    if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
      throw new TypeError('Fitness reward clock must return a valid Date');
    }
    return database.transaction(() => {
      const row = database.prepare(`
        SELECT * FROM fitness_rewards
        WHERE cid=?
        ORDER BY issued_at DESC LIMIT 1
      `).get(cid);
      if (!row) return null;
      if (row.status === 'active' && row.expires_at <= iso(now)) {
        database.prepare("UPDATE fitness_rewards SET status='expired' WHERE id=? AND status='active'").run(row.id);
        row.status = 'expired';
      }
      return rewardView(row);
    }).immediate();
  }

  return { submitActivity, redeemReward, getLatestReward };
}

export const fitnessRewardService = createFitnessRewardService();
