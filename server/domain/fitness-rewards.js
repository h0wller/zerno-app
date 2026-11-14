import crypto from 'node:crypto';
import { db as defaultDb } from '../db/connection.js';

const REWARD_DISTANCE_METERS = 5_000;
const REWARD_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const REWARD_TTL_MS = 48 * 60 * 60 * 1000;

function iso(value) {
  return value.toISOString();
}

function rewardView(row) {
  return {
    id: row.id,
    code: row.code,
    status: row.status,
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
    redeemedAt: row.redeemed_at || null,
  };
}

function validActivity(activity) {
  if (!activity || typeof activity !== 'object') return false;
  const distance = Number(activity.distanceMeters);
  const elapsed = Number(activity.elapsedSeconds);
  const points = Number(activity.pointCount);
  const startedAt = Date.parse(activity.startedAt);
  if (!Number.isFinite(distance) || !Number.isFinite(elapsed) ||
      !Number.isFinite(points) || !Number.isFinite(startedAt)) return false;
  if (distance <= 0 || !Number.isInteger(elapsed) || elapsed < 300 ||
      elapsed > 14_400 || !Number.isInteger(points) || points < 10 || points > 20_000) return false;
  const averageSpeed = distance / elapsed;
  return averageSpeed >= 0.3 && averageSpeed <= 8;
}

export function createFitnessRewardService({
  database = defaultDb,
  clock = () => new Date(),
  makeId = () => crypto.randomUUID(),
  makeCode = () => 'RUN-' + crypto.randomBytes(5).toString('hex').toUpperCase(),
} = {}) {
  function submitActivity({ customerId, activity, fingerprint }) {
    const cid = String(customerId || '').trim();
    const digest = String(fingerprint || '').toLowerCase();
    if (!cid || !/^[a-f0-9]{64}$/.test(digest)) {
      return { ok: false, reason: 'invalid_input' };
    }
    if (!validActivity(activity)) {
      return { ok: false, reason: 'implausible_activity' };
    }
    if (Number(activity.distanceMeters) < REWARD_DISTANCE_METERS) {
      return { ok: false, reason: 'distance_below_threshold' };
    }

    const now = clock();
    if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
      throw new TypeError('Fitness reward clock must return a valid Date');
    }
    const receivedAt = iso(now);
    const startedAt = iso(new Date(Date.parse(activity.startedAt)));
    const cooldownStartsAt = iso(new Date(now.getTime() - REWARD_COOLDOWN_MS));

    return database.transaction(() => {
      const customer = database.prepare(
        'SELECT id, role, verified FROM customers WHERE id=?'
      ).get(cid);
      if (!customer || customer.role !== 'guest' || customer.verified !== 1) {
        return { ok: false, reason: 'customer_not_eligible' };
      }

      const existing = database.prepare(
        'SELECT id FROM fitness_activities WHERE fingerprint=?'
      ).get(digest);
      if (existing) return { ok: false, reason: 'duplicate_activity' };

      const activityId = makeId();
      database.prepare(`
        INSERT INTO fitness_activities (
          id, cid, source, fingerprint, distance_meters,
          elapsed_seconds, started_at, received_at
        ) VALUES (?, ?, 'gpx', ?, ?, ?, ?, ?)
      `).run(
        activityId,
        cid,
        digest,
        Math.round(Number(activity.distanceMeters)),
        Math.round(Number(activity.elapsedSeconds)),
        startedAt,
        receivedAt,
      );

      const recentReward = database.prepare(`
        SELECT id FROM fitness_rewards
        WHERE cid=? AND issued_at > ?
        ORDER BY issued_at DESC LIMIT 1
      `).get(cid, cooldownStartsAt);

      if (recentReward) {
        return {
          ok: true,
          reward: null,
          reason: 'weekly_reward_limit',
          activity: {
            id: activityId,
            distanceMeters: Math.round(Number(activity.distanceMeters)),
            elapsedSeconds: Math.round(Number(activity.elapsedSeconds)),
          },
        };
      }

      let code = '';
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const candidate = String(makeCode()).trim().toUpperCase();
        if (!/^RUN-[A-Z0-9]{8,16}$/.test(candidate)) {
          throw new Error('Fitness reward code generator returned an invalid code');
        }
        if (!database.prepare('SELECT 1 FROM fitness_rewards WHERE code=?').get(candidate)) {
          code = candidate;
          break;
        }
      }
      if (!code) throw new Error('Unable to generate a unique fitness reward code');

      const rewardId = makeId();
      const expiresAt = iso(new Date(now.getTime() + REWARD_TTL_MS));
      database.prepare(`
        INSERT INTO fitness_rewards (
          id, cid, activity_id, code, status, issued_at, expires_at
        ) VALUES (?, ?, ?, ?, 'active', ?, ?)
      `).run(rewardId, cid, activityId, code, receivedAt, expiresAt);

      return {
        ok: true,
        reason: null,
        activity: {
          id: activityId,
          distanceMeters: Math.round(Number(activity.distanceMeters)),
          elapsedSeconds: Math.round(Number(activity.elapsedSeconds)),
        },
        reward: {
          id: rewardId,
          code,
          status: 'active',
          issuedAt: receivedAt,
          expiresAt,
        },
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

  return { submitActivity, redeemReward };
}

export const fitnessRewardService = createFitnessRewardService();
