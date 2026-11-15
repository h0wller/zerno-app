import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dbPath = path.join(os.tmpdir(), `zerno-session-ttl-${process.pid}-${Date.now()}.db`);
process.env.DB_PATH = dbPath;

const { db } = await import('../../server/db/connection.js');
const { initSchema } = await import('../../server/db/schema.js');
const { issueToken, USER_SESSION_TTL_MS } = await import('../../server/domain/helpers.js');

after(() => {
  db.close();
  for (const suffix of ['', '-wal', '-shm']) {
    try { fs.unlinkSync(dbPath + suffix); } catch {}
  }
});

test('migration adds expires_at and backfills legacy tokens from original ts', () => {
  db.exec(`
    CREATE TABLE tokens(token TEXT PRIMARY KEY, kind TEXT, ref TEXT, ts TEXT);
    CREATE TABLE customers(id TEXT PRIMARY KEY, name TEXT, phone TEXT);
    INSERT INTO customers(id,name,phone) VALUES('legacy-customer','Legacy','+79990000001');
    INSERT INTO customers(id,name,phone) VALUES('bad-date-customer','Bad Date','+79990000002');
  `);
  const issuedAt = Date.now() - 2 * 24 * 60 * 60 * 1000;
  db.prepare('INSERT INTO tokens(token,kind,ref,ts) VALUES(?,?,?,?)')
    .run('legacy-token', 'user', 'legacy-customer', new Date(issuedAt).toISOString());
  db.prepare('INSERT INTO tokens(token,kind,ref,ts) VALUES(?,?,?,?)')
    .run('malformed-legacy-token', 'user', 'bad-date-customer', 'not-a-date');

  initSchema();

  const row = db.prepare('SELECT expires_at FROM tokens WHERE token=?').get('legacy-token');
  assert.equal(row.expires_at, issuedAt + USER_SESSION_TTL_MS);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM tokens').get().n, 2);
  assert.equal(db.prepare('SELECT expires_at FROM tokens WHERE token=?').get('malformed-legacy-token').expires_at, 0);
});

test('migration is idempotent and preserves already assigned expiration', () => {
  initSchema();
  const before = db.prepare('SELECT expires_at FROM tokens WHERE token=?').get('legacy-token').expires_at;
  initSchema();
  const after = db.prepare('SELECT expires_at FROM tokens WHERE token=?').get('legacy-token').expires_at;
  assert.equal(after, before);
});

test('new tokens receive a fixed server-side expiry', () => {
  const before = Date.now();
  const token = issueToken('legacy-customer');
  const after = Date.now();
  const row = db.prepare('SELECT token, kind, ref, ts, expires_at FROM tokens WHERE token=?').get(token);
  assert.match(token, /^[0-9a-f-]{36}$/i);
  assert.equal(row.kind, 'user');
  assert.equal(row.ref, 'legacy-customer');
  assert.ok(row.expires_at >= before + USER_SESSION_TTL_MS);
  assert.ok(row.expires_at <= after + USER_SESSION_TTL_MS);
});

test('authUser accepts a valid mixed-case Bearer header and rejects non-Bearer headers', () => {
  const token = issueToken('legacy-customer');
  assert.equal(getBearerToken({ header: () => `bEaReR ${token}` }), token);
  assert.equal(authUser({ header: () => `bEaReR ${token}` }).id, 'legacy-customer');
  assert.equal(getBearerToken({ header: () => `Basic ${token}` }), '');
  assert.equal(authUser({ header: () => `Basic ${token}` }), null);
  assert.equal(authUser({ header: () => `Bearer ${'x'.repeat(129)}` }), null);
});

test('authUser rejects tokens at and after the exact expiry boundary', () => {
  const token = issueToken('legacy-customer');
  db.prepare('UPDATE tokens SET expires_at=? WHERE token=?').run(Date.now() + 60_000, token);
  assert.equal(authUser({ header: () => `Bearer ${token}` }).id, 'legacy-customer');

  db.prepare('UPDATE tokens SET expires_at=? WHERE token=?').run(Date.now(), token);
  assert.equal(authUser({ header: () => `Bearer ${token}` }), null);

  db.prepare('UPDATE tokens SET expires_at=? WHERE token=?').run(Date.now() - 1, token);
  assert.equal(authUser({ header: () => `Bearer ${token}` }), null);
});

test('revoked token stops authenticating immediately', () => {
  const token = issueToken('legacy-customer');
  const req = { header: () => `Bearer ${token}` };
  assert.equal(authUser(req).id, 'legacy-customer');
  db.prepare('DELETE FROM tokens WHERE token=?').run(token);
  assert.equal(authUser(req), null);
});

test('legacy session keeps its original issue time and is not extended on later migrations', () => {
  const initial = db.prepare('SELECT expires_at FROM tokens WHERE token=?').get('legacy-token').expires_at;
  db.prepare('UPDATE tokens SET expires_at=? WHERE token=?').run(initial - 1234, 'legacy-token');
  initSchema();
  assert.equal(db.prepare('SELECT expires_at FROM tokens WHERE token=?').get('legacy-token').expires_at, initial - 1234);
});
