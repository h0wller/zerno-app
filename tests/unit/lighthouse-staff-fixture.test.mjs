import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';

import { createLighthouseStaffFixture } from '../../scripts/lighthouse-staff-fixture.mjs';

test('Lighthouse fixture creates a server-verifiable admin session without exposing its token', async () => {
  const db = new Database(':memory:');
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zerno-lighthouse-staff-'));
  const tokenFile = path.join(tempDir, 'staff-token');
  const issuedAt = 1_800_000_000_000;
  try {
    db.exec(`
      CREATE TABLE customers(
        id TEXT PRIMARY KEY,
        name TEXT,
        phone TEXT UNIQUE,
        created_at TEXT,
        role TEXT,
        verified INTEGER
      );
      CREATE TABLE tokens(
        token TEXT PRIMARY KEY,
        kind TEXT,
        ref TEXT,
        ts TEXT,
        expires_at INTEGER
      );
    `);

    const fixture = await createLighthouseStaffFixture(db, tokenFile, { issuedAt });
    const storedToken = (await fs.readFile(tokenFile, 'utf8')).trim();
    const customer = db.prepare('SELECT id, role, verified FROM customers WHERE id=?')
      .get(fixture.customerId);
    const session = db.prepare('SELECT token, kind, ref, ts, expires_at FROM tokens WHERE token=?')
      .get(storedToken);

    assert.equal(customer.role, 'admin');
    assert.equal(customer.verified, 1);
    assert.equal(session.kind, 'user');
    assert.equal(session.ref, customer.id);
    assert.equal(session.ts, new Date(issuedAt).toISOString());
    assert.ok(session.expires_at > issuedAt);
    assert.match(storedToken, /^[0-9a-f-]{36}$/i);
    assert.equal(Object.hasOwn(fixture, 'token'), false);
  } finally {
    db.close();
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
