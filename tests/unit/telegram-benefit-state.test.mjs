import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const dbPath = path.join(os.tmpdir(), `zerno-tg-benefits-${process.pid}-${randomUUID()}.db`);
process.env.DB_PATH = dbPath;
process.env.NODE_ENV = 'test';

const { db } = await import('../../server/db/connection.js');
const { initSchema } = await import('../../server/db/schema.js');
const { findFreeDeliveryCode } = await import('../../server/domain/bonuses.js');
const { formatTelegramBenefitsMessage } = await import('../../server/domain/telegram-benefits-message.js');

initSchema();

function createCustomer() {
  const id = randomUUID();
  db.prepare('INSERT INTO customers(id,name,phone,verified,role,cups,stamps,free) VALUES(?,?,?,?,?,?,?,?)')
    .run(id, 'Benefit Test', '+79990000001', 1, 'guest', 0, 4, 0);
  return id;
}

function createFreeDeliveryPromo(owner, { active = 1, expires = new Date(Date.now() + 86400000).toISOString(), uses = 0 } = {}) {
  db.prepare(
    'INSERT INTO promos(id,code,kind,value,active,expires,maxuses,uses,created,scope,owner) VALUES(?,?,?,?,?,?,?,?,?,?,?)'
  ).run(randomUUID(), 'B' + randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase(), 'freeship', 0, active, expires, 1, uses, new Date().toISOString(), 'delivery', owner);
}

test('Telegram delivery copy follows the active personal code returned by the bonus domain', () => {
  const customerId = createCustomer();
  createFreeDeliveryPromo(customerId);

  const code = findFreeDeliveryCode(customerId);
  assert.ok(code);

  const message = formatTelegramBenefitsMessage({
    customer: { stamps: 4, free: 0 },
    freeDeliveryCode: code,
  });
  assert.match(message, /Персональная бесплатная первая доставка доступна/);
});

test('Telegram delivery copy does not advertise inactive, expired, or used personal codes', () => {
  for (const state of [
    { active: 0 },
    { expires: new Date(Date.now() - 86400000).toISOString() },
    { uses: 1 },
  ]) {
    const customerId = createCustomer();
    createFreeDeliveryPromo(customerId, state);
    const code = findFreeDeliveryCode(customerId);
    assert.equal(code, null);

    const message = formatTelegramBenefitsMessage({
      customer: { stamps: 0, free: 0 },
      freeDeliveryCode: code,
    });
    assert.match(message, /Бесплатная доставка не подтверждена/);
    assert.doesNotMatch(message, /Персональная бесплатная первая доставка доступна/);
  }
});

test('test database is removed', () => {
  db.close();
  for (const suffix of ['', '-wal', '-shm']) {
    try { fs.rmSync(dbPath + suffix, { force: true }); } catch {}
  }
  assert.equal(fs.existsSync(dbPath), false);
});
