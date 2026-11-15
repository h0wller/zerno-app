import { test } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { createFitnessAttestationService } from '../../server/domain/fitness-attestation.js';

function fixture() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE customers(id TEXT PRIMARY KEY, role TEXT NOT NULL, verified INTEGER NOT NULL);
    CREATE TABLE fitness_attest_challenges(
      id TEXT PRIMARY KEY,
      cid TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      purpose TEXT NOT NULL CHECK(purpose IN ('attestation','assertion')),
      challenge_hash TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      consumed_at INTEGER
    );
  `);
  db.prepare('INSERT INTO customers VALUES(?,?,?)').run('guest-1', 'guest', 1);
  db.prepare('INSERT INTO customers VALUES(?,?,?)').run('guest-2', 'guest', 1);
  db.prepare('INSERT INTO customers VALUES(?,?,?)').run('unverified', 'guest', 0);
  db.prepare('INSERT INTO customers VALUES(?,?,?)').run('staff', 'cashier', 1);
  return db;
}

function setup(db, time = 1_800_000_000_000) {
  let id = 0;
  let challenge = 0;
  return {
    service: createFitnessAttestationService({
      database: db,
      clock: () => time,
      makeId: () => 'challenge-' + (++id),
      makeChallenge: () => Buffer.alloc(32, ++challenge).toString('base64url'),
    }),
    setTime(value) { time = value; },
  };
}

test('issues a short-lived challenge bound to an eligible guest and purpose', () => {
  const db = fixture();
  const { service } = setup(db);
  const result = service.issueChallenge({ customerId: 'guest-1', purpose: 'attestation' });

  assert.equal(result.ok, true);
  assert.equal(result.purpose, 'attestation');
  assert.equal(result.challenge.length, 43);
  assert.equal(Date.parse(result.expiresAt), 1_800_000_300_000);
  assert.equal(db.prepare('SELECT challenge_hash FROM fitness_attest_challenges').get().challenge_hash.length, 64);
  assert.notEqual(db.prepare('SELECT challenge_hash FROM fitness_attest_challenges').get().challenge_hash, result.challenge);
  db.close();
});

test('rejects challenges for unverified guests, staff and invalid purposes', () => {
  const db = fixture();
  const { service } = setup(db);

  assert.deepEqual(service.issueChallenge({ customerId: 'unverified', purpose: 'assertion' }), {
    ok: false, reason: 'customer_not_eligible',
  });
  assert.deepEqual(service.issueChallenge({ customerId: 'staff', purpose: 'assertion' }), {
    ok: false, reason: 'customer_not_eligible',
  });
  assert.deepEqual(service.issueChallenge({ customerId: 'guest-1', purpose: 'workout' }), {
    ok: false, reason: 'invalid_input',
  });
  db.close();
});

test('consumes a matching challenge exactly once and binds it to owner and purpose', () => {
  const db = fixture();
  const { service } = setup(db);
  const issued = service.issueChallenge({ customerId: 'guest-1', purpose: 'assertion' });

  assert.deepEqual(service.consumeChallenge({
    customerId: 'guest-2', challengeId: issued.challengeId, challenge: issued.challenge, purpose: 'assertion',
  }), { ok: false, reason: 'challenge_not_found' });
  assert.deepEqual(service.consumeChallenge({
    customerId: 'guest-1', challengeId: issued.challengeId, challenge: issued.challenge, purpose: 'attestation',
  }), { ok: false, reason: 'challenge_not_found' });
  assert.deepEqual(service.consumeChallenge({
    customerId: 'guest-1', challengeId: issued.challengeId, challenge: 'A'.repeat(43), purpose: 'assertion',
  }), { ok: false, reason: 'challenge_mismatch' });
  assert.deepEqual(service.consumeChallenge({
    customerId: 'guest-1', challengeId: issued.challengeId, challenge: issued.challenge, purpose: 'assertion',
  }), { ok: true, customerId: 'guest-1', purpose: 'assertion' });
  assert.deepEqual(service.consumeChallenge({
    customerId: 'guest-1', challengeId: issued.challengeId, challenge: issued.challenge, purpose: 'assertion',
  }), { ok: false, reason: 'challenge_already_consumed' });
  db.close();
});

test('expires challenges and limits issuance to ten per guest per minute', () => {
  const db = fixture();
  const clock = setup(db);
  for (let i = 0; i < 10; i++) {
    assert.equal(clock.service.issueChallenge({ customerId: 'guest-1', purpose: 'assertion' }).ok, true);
  }
  assert.deepEqual(clock.service.issueChallenge({ customerId: 'guest-1', purpose: 'assertion' }), {
    ok: false, reason: 'rate_limited',
  });
  clock.setTime(1_800_000_301_000);
  const expired = clock.service.issueChallenge({ customerId: 'guest-1', purpose: 'assertion' });
  assert.equal(expired.ok, true);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM fitness_attest_challenges').get().count, 1);
  db.close();
});


test('rate limit cannot be bypassed by consuming challenges before the next issuance', () => {
  const db = fixture();
  const clock = setup(db);
  const issued = [];
  for (let i = 0; i < 10; i++) {
    issued.push(clock.service.issueChallenge({ customerId: 'guest-1', purpose: 'assertion' }));
  }
  for (const challenge of issued) {
    assert.equal(clock.service.consumeChallenge({
      customerId: 'guest-1',
      challengeId: challenge.challengeId,
      challenge: challenge.challenge,
      purpose: 'assertion',
    }).ok, true);
  }
  assert.deepEqual(
    clock.service.issueChallenge({ customerId: 'guest-1', purpose: 'attestation' }),
    { ok: false, reason: 'rate_limited' },
  );
  clock.setTime(1_800_000_030_000);
  assert.deepEqual(
    clock.service.issueChallenge({ customerId: 'guest-1', purpose: 'attestation' }),
    { ok: false, reason: 'rate_limited' },
  );
  clock.setTime(1_800_000_061_001);
  assert.equal(
    clock.service.issueChallenge({ customerId: 'guest-1', purpose: 'attestation' }).ok,
    true,
  );
  db.close();
});
