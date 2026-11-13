import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zerno-vapid-'));
process.env.DB_PATH = path.join(tempDir, 'vapid.db');

const [{ initSchema }, { initVapid, getVapidPublicKey }, { db }] = await Promise.all([
  import('../../server/db/schema.js'),
  import('../../server/db/seed.js'),
  import('../../server/db/connection.js')
]);

after(() => {
  db.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('VAPID initialization loads web-push ESM exports and persists generated keys', () => {
  initSchema();

  initVapid();
  const publicKey = getVapidPublicKey();

  assert.equal(typeof publicKey, 'string');
  assert.match(publicKey, /^[A-Za-z0-9_-]+$/);

  initVapid();
  assert.equal(getVapidPublicKey(), publicKey);
});
