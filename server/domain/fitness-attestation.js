import crypto from 'node:crypto';
import { db as defaultDb } from '../db/connection.js';

const PURPOSES = new Set(['attestation', 'assertion']);
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const WINDOW_MS = 60 * 1000;
const MAX_CHALLENGES_PER_WINDOW = 10;

export function createFitnessAttestationService({
  database = defaultDb,
  clock = () => Date.now(),
  makeId = () => crypto.randomUUID(),
  makeChallenge = () => crypto.randomBytes(32).toString('base64url'),
} = {}) {
  function issueChallenge({ customerId, purpose, keyId, requestHash }) {
    const cid = String(customerId || '').trim();
    const normalizedKeyId = keyId == null ? null : String(keyId).trim();
    const normalizedRequestHash = requestHash == null ? null : String(requestHash).trim();
    if (!cid || !PURPOSES.has(purpose)) return { ok: false, reason: 'invalid_input' };
    if (purpose === 'attestation' && (normalizedKeyId || normalizedRequestHash)) {
      return { ok: false, reason: 'invalid_binding' };
    }
    if (purpose === 'assertion') {
      if (!normalizedKeyId || !/^[A-Za-z0-9_-]{1,128}$/.test(normalizedKeyId)) {
        return { ok: false, reason: 'invalid_key_id' };
      }
      if (!normalizedRequestHash || !/^[a-f0-9]{64}$/.test(normalizedRequestHash)) {
        return { ok: false, reason: 'invalid_request_hash' };
      }
    }
    const now = Number(clock());
    if (!Number.isSafeInteger(now) || now <= 0) throw new TypeError('Attestation clock must return a positive integer timestamp');

    return database.transaction(() => {
      // Keep consumed/expired rows for the full rate-limit window. Deleting them before
      // counting would let a client evade the limit by consuming challenges immediately.
      database.prepare('DELETE FROM fitness_attest_challenges WHERE created_at <= ?')
        .run(now - WINDOW_MS);
      const customer = database.prepare("SELECT id, role, verified FROM customers WHERE id=?").get(cid);
      if (!customer || customer.role !== 'guest' || customer.verified !== 1) {
        return { ok: false, reason: 'customer_not_eligible' };
      }
      const recent = database.prepare(
        'SELECT COUNT(*) AS count FROM fitness_attest_challenges WHERE cid=? AND created_at>?'
      ).get(cid, now - WINDOW_MS);
      if (recent.count >= MAX_CHALLENGES_PER_WINDOW) return { ok: false, reason: 'rate_limited' };

      const challengeId = makeId();
      const challenge = makeChallenge();
      if (!/^[A-Za-z0-9_-]{43}$/.test(challenge)) throw new TypeError('Challenge generator must return 32-byte base64url data');
      const expiresAt = now + CHALLENGE_TTL_MS;
      const challengeHash = crypto.createHash('sha256').update(challenge).digest('hex');
      database.prepare(`
        INSERT INTO fitness_attest_challenges(
          id,cid,purpose,challenge_hash,key_id,request_hash,created_at,expires_at
        ) VALUES(?,?,?,?,?,?,?,?)
      `).run(challengeId, cid, purpose, challengeHash, normalizedKeyId, normalizedRequestHash, now, expiresAt);
      return { ok: true, challengeId, challenge, purpose, expiresAt: new Date(expiresAt).toISOString() };
    }).immediate();
  }

  function consumeChallenge({ customerId, challengeId, challenge, purpose }) {
    const cid = String(customerId || '').trim();
    const id = String(challengeId || '').trim();
    if (!cid || !id || !PURPOSES.has(purpose) || typeof challenge !== 'string') {
      return { ok: false, reason: 'invalid_input' };
    }
    const now = Number(clock());
    const digest = crypto.createHash('sha256').update(challenge).digest('hex');
    return database.transaction(() => {
      const row = database.prepare(`
        SELECT id, challenge_hash, key_id, request_hash, expires_at, consumed_at
        FROM fitness_attest_challenges WHERE id=? AND cid=? AND purpose=?
      `).get(id, cid, purpose);
      if (!row) return { ok: false, reason: 'challenge_not_found' };
      if (row.consumed_at != null) return { ok: false, reason: 'challenge_already_consumed' };
      if (row.expires_at <= now) return { ok: false, reason: 'challenge_expired' };
      const expected = Buffer.from(row.challenge_hash, 'hex');
      const actual = Buffer.from(digest, 'hex');
      if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
        return { ok: false, reason: 'challenge_mismatch' };
      }
      database.prepare('UPDATE fitness_attest_challenges SET consumed_at=? WHERE id=? AND consumed_at IS NULL').run(now, id);
      return {
        ok: true,
        customerId: cid,
        purpose,
        keyId: row.key_id,
        requestHash: row.request_hash,
      };
    }).immediate();
  }

  return { issueChallenge, consumeChallenge };
}

export const fitnessAttestationService = createFitnessAttestationService();
