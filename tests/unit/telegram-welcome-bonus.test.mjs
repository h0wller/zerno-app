import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Isolated SQLite database: never open the developer or production database.
const dbPath = path.join(os.tmpdir(), `zerno-tg-bonus-${process.pid}-${Date.now()}.db`);
process.env.DB_PATH = dbPath;
process.env.NODE_ENV = 'test';

const { db } = await import('../../server/db/connection.js');
const { initSchema } = await import('../../server/db/schema.js');
const { grantBonusDetailed, setBonusConfig } = await import('../../server/domain/bonuses.js');
const { formatWelcomeBonusMessage } = await import('../../server/domain/welcome-bonus-message.js');

initSchema();
let seq = 0;

function makeCustomer(over = {}) {
  const id = `tg-bonus-${++seq}`;
  db.prepare(
    'INSERT INTO customers(id,name,phone,verified,role,cups,stamps,free) VALUES(?,?,?,?,?,?,?,?)'
  ).run(
    id,
    'Telegram Test',
    `+7999111${String(seq).padStart(4, '0')}`,
    over.verified ?? 1,
    over.role || 'guest',
    over.cups || 0,
    over.stamps || 0,
    over.free || 0
  );
  return id;
}

function configureWelcome(overrides = {}) {
  setBonusConfig({
    days: 30,
    kinds: {
      signup: { coffee: 10, freeFirstDelivery: 1, ...(overrides.signup || {}) },
      qr: { coffee: 10, freeFirstDelivery: 1, ...(overrides.qr || {}) },
      install: { coffee: 0, delivery: 0, freeFirstDelivery: 0 },
    },
  });
}

test('grantBonusDetailed reports only a bonus that was actually committed', () => {
  configureWelcome();
  const id = makeCustomer();
  const result = grantBonusDetailed(id, 'signup');

  assert.equal(result.status, 'granted');
  assert.equal(result.bonus.kind, 'signup');
  assert.equal(result.bonus.coffee, 10);
  assert.match(result.bonus.freeCode, /^B[0-9A-F]{8}$/);
  assert.match(result.bonus.message, /первая доставка бесплатно/);
});

test('grantBonusDetailed distinguishes a previously granted welcome bonus', () => {
  configureWelcome();
  const id = makeCustomer();
  assert.equal(grantBonusDetailed(id, 'signup').status, 'granted');

  const repeated = grantBonusDetailed(id, 'signup');
  assert.equal(repeated.status, 'already_granted');
  assert.equal(repeated.bonus, undefined);
});

test('grantBonusDetailed reports disabled configuration without recording a grant', () => {
  configureWelcome({ signup: { coffee: 0, delivery: 0, freeFirstDelivery: 0 } });
  const id = makeCustomer();

  const result = grantBonusDetailed(id, 'signup');
  assert.equal(result.status, 'disabled');
  assert.equal(
    db.prepare('SELECT COUNT(*) AS n FROM bonus_grants WHERE cid=?').get(id).n,
    0
  );
});

test('grantBonusDetailed reports an ineligible used profile without promising a bonus', () => {
  configureWelcome();
  const id = makeCustomer({ stamps: 2 });

  const result = grantBonusDetailed(id, 'signup');
  assert.equal(result.status, 'ineligible');
  assert.equal(
    db.prepare('SELECT COUNT(*) AS n FROM bonus_grants WHERE cid=?').get(id).n,
    0
  );
});

test('grantBonusDetailed reports unverified profiles as ineligible', () => {
  configureWelcome();
  const id = makeCustomer({ verified: 0 });

  assert.equal(grantBonusDetailed(id, 'signup').status, 'ineligible');
});

test('welcome Telegram copy lists only the committed grant details', () => {
  const result = {
    status: 'granted',
    bonus: { message: '10 штампов в кофейне; первая доставка бесплатно' },
  };
  const message = formatWelcomeBonusMessage(result);
  assert.match(message, /10 штампов в кофейне/);
  assert.match(message, /первая доставка бесплатно/);
});

test('welcome Telegram copy does not promise a disabled or ineligible bonus', () => {
  for (const status of ['disabled', 'ineligible']) {
    const message = formatWelcomeBonusMessage({ status });
    assert.doesNotMatch(message, /бонусы активированы|бесплатная первая доставка|приветственный напиток/i);
    assert.match(message, /не начислен/i);
  }
});

test('welcome Telegram copy distinguishes already granted from unknown outcome', () => {
  const repeated = formatWelcomeBonusMessage({ status: 'already_granted' });
  const unknown = formatWelcomeBonusMessage({ status: 'unknown' });
  assert.match(repeated, /уже начислял/i);
  assert.match(unknown, /не удалось подтвердить/i);
});

test('test database is removed', () => {
  db.close();
  for (const suffix of ['', '-wal', '-shm']) {
    try { fs.rmSync(dbPath + suffix, { force: true }); } catch {}
  }
  assert.equal(fs.existsSync(dbPath), false);
});
