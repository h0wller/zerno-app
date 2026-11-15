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
      key_id TEXT,
      request_hash TEXT,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      consumed_at INTEGER
    );
    CREATE TABLE fitness_attest_keys(
      key_id TEXT PRIMARY KEY,
      cid TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      platform TEXT NOT NULL CHECK(platform='apple_app_attest'),
      public_key_der BLOB NOT NULL,
      app_id TEXT NOT NULL,
      environment TEXT NOT NULL CHECK(environment IN ('development','production')),
      validation_category INTEGER NOT NULL,
      bundle_version TEXT NOT NULL,
      sign_count INTEGER NOT NULL DEFAULT 0 CHECK(sign_count >= 0),
      created_at INTEGER NOT NULL,
      last_used_at INTEGER,
      revoked_at INTEGER
    );
  `);
  db.prepare('INSERT INTO customers VALUES(?,?,?)').run('guest-1', 'guest', 1);
  db.prepare('INSERT INTO customers VALUES(?,?,?)').run('guest-2', 'guest', 1);
  db.prepare('INSERT INTO customers VALUES(?,?,?)').run('unverified', 'guest', 0);
  db.prepare('INSERT INTO customers VALUES(?,?,?)').run('staff', 'cashier', 1);
  db.prepare(`
    INSERT INTO fitness_attest_keys(
      key_id,cid,platform,public_key_der,app_id,environment,validation_category,bundle_version,created_at
    ) VALUES(?,?,?,?,?,?,?,?,?)
  `).run('app-attest-key-id', 'guest-1', 'apple_app_attest', Buffer.from([1]), 'TEAMID.online.andcoffee.app', 'development', 4, '1', 1_800_000_000_000);
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

  assert.deepEqual(service.issueChallenge({ customerId: 'unverified', purpose: 'attestation' }), {
    ok: false, reason: 'customer_not_eligible',
  });
  assert.deepEqual(service.issueChallenge({ customerId: 'staff', purpose: 'attestation' }), {
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
  const issued = service.issueChallenge({ customerId: 'guest-1', purpose: 'attestation' });

  assert.deepEqual(service.consumeChallenge({
    customerId: 'guest-2', challengeId: issued.challengeId, challenge: issued.challenge, purpose: 'assertion',
  }), { ok: false, reason: 'challenge_not_found' });
  assert.deepEqual(service.consumeChallenge({
    customerId: 'guest-1', challengeId: issued.challengeId, challenge: issued.challenge, purpose: 'assertion',
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
    assert.equal(clock.service.issueChallenge({ customerId: 'guest-1', purpose: 'attestation' }).ok, true);
  }
  assert.deepEqual(clock.service.issueChallenge({ customerId: 'guest-1', purpose: 'attestation' }), {
    ok: false, reason: 'rate_limited',
  });
  clock.setTime(1_800_000_301_000);
  const expired = clock.service.issueChallenge({ customerId: 'guest-1', purpose: 'attestation' });
  assert.equal(expired.ok, true);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM fitness_attest_challenges').get().count, 1);
  db.close();
});


test('rate limit cannot be bypassed by consuming challenges before the next issuance', () => {
  const db = fixture();
  const clock = setup(db);
  const issued = [];
  for (let i = 0; i < 10; i++) {
    issued.push(clock.service.issueChallenge({ customerId: 'guest-1', purpose: 'attestation' }));
  }
  for (const challenge of issued) {
    assert.equal(clock.service.consumeChallenge({
      customerId: 'guest-1',
      challengeId: challenge.challengeId,
      challenge: challenge.challenge,
      purpose: 'attestation',
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


test('binds assertion challenges to an enrolled key id and canonical request hash', () => {
  const db = fixture();
  const { service } = setup(db);
  const requestHash = 'a'.repeat(64);

  assert.deepEqual(service.issueChallenge({
    customerId: 'guest-1',
    purpose: 'assertion',
  }), { ok: false, reason: 'invalid_key_id' });

  assert.deepEqual(service.issueChallenge({
    customerId: 'guest-1',
    purpose: 'assertion',
    keyId: 'key-1',
  }), { ok: false, reason: 'invalid_request_hash' });


  assert.deepEqual(service.issueChallenge({
    customerId: 'guest-1',
    purpose: 'assertion',
    keyId: 'unregistered-key',
    requestHash,
  }), { ok: false, reason: 'key_not_registered' });

  const issued = service.issueChallenge({
    customerId: 'guest-1',
    purpose: 'assertion',
    keyId: 'app-attest-key-id',
    requestHash,
  });
  assert.equal(issued.ok, true);

  const row = db.prepare('SELECT key_id, request_hash FROM fitness_attest_challenges WHERE id=?')
    .get(issued.challengeId);
  assert.equal(row.key_id, 'app-attest-key-id');
  assert.equal(row.request_hash, requestHash);

  assert.deepEqual(service.consumeChallenge({
    customerId: 'guest-1',
    challengeId: issued.challengeId,
    challenge: issued.challenge,
    purpose: 'assertion',
  }), {
    ok: true,
    customerId: 'guest-1',
    purpose: 'assertion',
    keyId: 'app-attest-key-id',
    requestHash,
  });
  db.close();
});

test('does not allow key or request bindings on an attestation challenge', () => {
  const db = fixture();
  const { service } = setup(db);
  assert.deepEqual(service.issueChallenge({
    customerId: 'guest-1',
    purpose: 'attestation',
    keyId: 'some-key',
    requestHash: 'a'.repeat(64),
  }), { ok: false, reason: 'invalid_binding' });
  db.close();
});


test('HTTP route passes assertion bindings to the service and rejects unregistered keys', async () => {
  const { createFitnessAttestationRouter } = await import('../../server/routes/fitness-attestation.js');
  const db = fixture();
  const { service } = setup(db);
  const router = createFitnessAttestationRouter({ service });
  const layer = router.stack.find(entry => entry.route?.path === '/api/fitness/attestation/challenges');
  assert.ok(layer, 'challenge route should be registered');
  const handler = layer.route.stack.at(-1).handle;

  function response() {
    return {
      statusCode: 200,
      body: null,
      headers: {},
      setHeader(name, value) { this.headers[name] = value; },
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
    };
  }

  const invalid = response();
  handler({
    user: { id: 'guest-1', role: 'guest', verified: 1 },
    body: { purpose: 'assertion' },
  }, invalid, error => { throw error; });
  assert.equal(invalid.statusCode, 400);
  assert.deepEqual(invalid.body, { error: 'invalid_key_id' });

  const unknownKey = response();
  handler({
    user: { id: 'guest-1', role: 'guest', verified: 1 },
    body: { purpose: 'assertion', keyId: 'unknown', requestHash: 'b'.repeat(64) },
  }, unknownKey, error => { throw error; });
  assert.equal(unknownKey.statusCode, 403);
  assert.deepEqual(unknownKey.body, { error: 'key_not_registered' });

  const registeredKey = response();
  handler({
    user: { id: 'guest-1', role: 'guest', verified: 1 },
    body: { purpose: 'assertion', keyId: 'app-attest-key-id', requestHash: 'c'.repeat(64) },
  }, registeredKey, error => { throw error; });
  assert.equal(registeredKey.statusCode, 201);
  assert.equal(registeredKey.body.purpose, 'assertion');
  assert.equal(registeredKey.body.keyId, undefined);
  assert.equal(registeredKey.body.requestHash, undefined);
  const stored = db.prepare('SELECT key_id, request_hash FROM fitness_attest_challenges WHERE id=?')
    .get(registeredKey.body.challengeId);
  assert.equal(stored.key_id, 'app-attest-key-id');
  assert.equal(stored.request_hash, 'c'.repeat(64));
  db.close();
});

test('adds key and request binding columns to a legacy challenge table without deleting rows', () => {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE customers(id TEXT PRIMARY KEY, role TEXT NOT NULL, verified INTEGER NOT NULL);
    CREATE TABLE fitness_attest_challenges(
      id TEXT PRIMARY KEY,
      cid TEXT NOT NULL,
      purpose TEXT NOT NULL,
      challenge_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      consumed_at INTEGER
    );
    INSERT INTO fitness_attest_challenges
      (id,cid,purpose,challenge_hash,created_at,expires_at)
    VALUES('legacy-1','guest-1','attestation','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',100,200);
  `);
  let columns = db.prepare('PRAGMA table_info(fitness_attest_challenges)').all().map(column => column.name);
  assert.equal(columns.includes('key_id'), false);
  assert.equal(columns.includes('request_hash'), false);

  // Apply the same additive migration logic used by initSchema().
  if (!columns.includes('key_id')) db.exec('ALTER TABLE fitness_attest_challenges ADD COLUMN key_id TEXT');
  if (!columns.includes('request_hash')) db.exec('ALTER TABLE fitness_attest_challenges ADD COLUMN request_hash TEXT');

  columns = db.prepare('PRAGMA table_info(fitness_attest_challenges)').all().map(column => column.name);
  assert.equal(columns.includes('key_id'), true);
  assert.equal(columns.includes('request_hash'), true);
  assert.equal(db.prepare('SELECT id, key_id, request_hash FROM fitness_attest_challenges').get().id, 'legacy-1');
  db.close();
});
