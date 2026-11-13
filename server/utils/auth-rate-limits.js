import crypto from 'node:crypto';
import { db } from '../db/connection.js';
import { ensureAuthSecuritySchema } from '../db/schema.js';

ensureAuthSecuritySchema();
import { ensureAuthSecuritySchema } from '../db/schema.js';

ensureAuthSecuritySchema();

const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const LOCK_BASE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

let statements;

function getStatements() {
  if (!statements) {
    statements = {
      getRateLimit: db.prepare(
        'SELECT fails, streak, locked_until, updated_at FROM auth_rate_limits WHERE key=?'
      ),
      upsertRateLimit: db.prepare(`
        INSERT INTO auth_rate_limits(key, fails, streak, locked_until, updated_at)
        VALUES(?, ?, ?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          fails=excluded.fails,
          streak=excluded.streak,
          locked_until=excluded.locked_until,
          updated_at=excluded.updated_at
      `),
      deleteRateLimit: db.prepare('DELETE FROM auth_rate_limits WHERE key=?'),
      getOtpSendLimit: db.prepare(
        'SELECT sent, last_sent, window_ends FROM auth_otp_send_limits WHERE flow=? AND phone_hash=?'
      ),
      upsertOtpSendLimit: db.prepare(`
        INSERT INTO auth_otp_send_limits(flow, phone_hash, sent, last_sent, window_ends)
        VALUES(?, ?, ?, ?, ?)
        ON CONFLICT(flow, phone_hash) DO UPDATE SET
          sent=excluded.sent,
          last_sent=excluded.last_sent,
          window_ends=excluded.window_ends
      `)
    };
  }
  return statements;
}

function digest(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function rateLimitKeys(req, tag = 'staff', subject = '') {
  const ip = String(req?.ip || req?.socket?.remoteAddress || 'local');
  const keys = [digest(`auth-lock:v1:ip-subject:${tag}:${ip}:${subject || '-'}`)];
  if (subject) keys.push(digest(`auth-lock:v1:subject:${tag}:${subject}`));
  return keys;
}

function phoneHash(phone) {
  return digest('auth-otp-send:v1:' + String(phone));
}

/**
 * Returns the longest active lock across the request IP/subject pair and the
 * subject itself. Subject values are hashed before they are stored.
 */
export function lockedSeconds(req, tag = 'staff', subject = '') {
  const now = Date.now();
  let remaining = 0;
  for (const key of rateLimitKeys(req, tag, subject)) {
    const row = getStatements().getRateLimit.get(key);
    if (row?.locked_until > now) {
      remaining = Math.max(remaining, Math.ceil((row.locked_until - now) / 1000));
    }
  }
  return remaining;
}

/**
 * Registers a failed action atomically for both the IP/subject pair and the
 * subject across IPs. The fifth failure locks for one minute; repeated lock
 * cycles exponentially increase the duration up to 64 minutes.
 */
export function registerFail(req, tag = 'staff', subject = '') {
  const now = Date.now();
  const keys = rateLimitKeys(req, tag, subject);
  const update = db.transaction(() => {
    for (const key of keys) {
      const previous = getStatements().getRateLimit.get(key);
      if (previous?.locked_until > now) continue;

      const withinWindow = previous && now - previous.updated_at <= FAILURE_WINDOW_MS;
      let fails = withinWindow ? previous.fails : 0;
      let streak = previous?.streak || 0;
      let lockedUntil = 0;

      fails += 1;
      if (fails >= 5) {
        streak += 1;
        lockedUntil = now + LOCK_BASE_MS * Math.pow(2, Math.min(streak - 1, 6));
        fails = 0;
      }

      getStatements().upsertRateLimit.run(key, fails, streak, lockedUntil, now);
    }
    db.prepare('DELETE FROM auth_rate_limits WHERE updated_at < ?').run(now - 7 * DAY_MS);
  });
  update();
}

/** Clears failure counters after successful authentication/verification. */
export function clearLock(req, tag = 'staff', subject = '') {
  const keys = rateLimitKeys(req, tag, subject);
  const clear = db.transaction(() => {
    for (const key of keys) getStatements().deleteRateLimit.run(key);
  });
  clear();
}

/** Returns the hashed IP/subject pair key for backwards-compatible callers. */
export const lockKey = (req, tag = 'staff', subject = '') => rateLimitKeys(req, tag, subject)[0];

/** Test and migration compatibility facade; persistent records remain in SQLite. */
export const pinLocks = {
  clear() {
    db.prepare('DELETE FROM auth_rate_limits').run();
  },
  get(key) {
    return getStatements().getRateLimit.get(String(key));
  },
  set(key, value) {
    getStatements().upsertRateLimit.run(
      String(key),
      Number(value?.fails) || 0,
      Number(value?.streak) || 0,
      Number(value?.lockedUntil) || 0,
      Date.now()
    );
    return this;
  },
  delete(key) {
    return getStatements().deleteRateLimit.run(String(key)).changes > 0;
  }
};

/** Returns the persisted OTP-send state for a flow/phone pair. */
export function getOtpSendState(flow, phone) {
  const row = getStatements().getOtpSendLimit.get(String(flow), phoneHash(phone));
  if (!row) return null;
  return {
    sent: row.sent,
    lastSent: row.last_sent,
    windowEnds: row.window_ends
  };
}

/** Records a successfully accepted OTP send, preserving the 24-hour cap. */
export function recordOtpSend(flow, phone, now = Date.now()) {
  const current = getOtpSendState(flow, phone);
  const sent = current && now < current.windowEnds ? current.sent + 1 : 1;
  const windowEnds = current && now < current.windowEnds
    ? current.windowEnds
    : now + DAY_MS;
  getStatements().upsertOtpSendLimit.run(String(flow), phoneHash(phone), sent, now, windowEnds);
  db.prepare('DELETE FROM auth_otp_send_limits WHERE window_ends < ?').run(now - 7 * DAY_MS);
  return { sent, lastSent: now, windowEnds };
}

export function clearAuthRateLimits() {
  db.prepare('DELETE FROM auth_rate_limits').run();
  db.prepare('DELETE FROM auth_otp_send_limits').run();
}
