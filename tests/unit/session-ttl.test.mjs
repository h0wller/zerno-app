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
  `);
  const issuedAt = Date.now() - 2 * 24 * 60 * 60 * 1000;
  db.prepare('INSERT INTO tokens(token,kind,ref,ts) VALUES(?,?,?,?)')
    .run('legacy-token', 'user', 'legacy-customer', new Date(issuedAt).toISOString());

  initSchema();

  const row = db.prepare('SELECT expires_at FROM tokens WHERE token=?').get('legacy-token');
  assert.equal(row.expires_at, issuedAt + USER_SESSION_TTL_MS);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM tokens').get().n, 1);
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
