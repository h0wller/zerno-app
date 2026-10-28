import { test } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { linkTelegram, findUniqueTelegramCustomer } from '../../server/domain/telegram-link.js';

function fixture() {
  const db = new Database(':memory:');
  db.exec('CREATE TABLE customers (id TEXT PRIMARY KEY, tg TEXT)');
  db.prepare('INSERT INTO customers(id, tg) VALUES (?, ?)').run('a', null);
  db.prepare('INSERT INTO customers(id, tg) VALUES (?, ?)').run('b', null);
  db.exec("CREATE UNIQUE INDEX idx_customers_tg_unique ON customers(tg) WHERE tg IS NOT NULL AND TRIM(tg) <> ''");
  return db;
}

test('Telegram ID can be linked once and repeating the same link is idempotent', () => {
  const db = fixture();
  assert.deepEqual(linkTelegram(db, 'a', '123'), { ok: true });
  assert.deepEqual(linkTelegram(db, 'a', '123'), { ok: true });
  assert.equal(db.prepare('SELECT tg FROM customers WHERE id=?').get('a').tg, '123');
  db.close();
});

test('a Telegram ID cannot be linked to a second customer', () => {
  const db = fixture();
  assert.deepEqual(linkTelegram(db, 'a', '123'), { ok: true });
  assert.deepEqual(linkTelegram(db, 'b', '123'), { ok: false, reason: 'telegram_in_use' });
  assert.equal(db.prepare('SELECT tg FROM customers WHERE id=?').get('b').tg, null);
  db.close();
});

test('an existing customer Telegram link cannot be silently replaced', () => {
  const db = fixture();
  assert.deepEqual(linkTelegram(db, 'a', '123'), { ok: true });
  assert.deepEqual(linkTelegram(db, 'a', '456'), { ok: false, reason: 'customer_already_linked' });
  assert.equal(db.prepare('SELECT tg FROM customers WHERE id=?').get('a').tg, '123');
  db.close();
});

test('duplicate legacy IDs are detected rather than choosing an arbitrary profile', () => {
  const db = new Database(':memory:');
  db.exec('CREATE TABLE customers (id TEXT PRIMARY KEY, tg TEXT)');
  db.prepare('INSERT INTO customers(id, tg) VALUES (?, ?)').run('a', '123');
  db.prepare('INSERT INTO customers(id, tg) VALUES (?, ?)').run('b', '123');
  assert.deepEqual(findUniqueTelegramCustomer(db, '123'), { ok: false, customer: null, reason: 'duplicate_legacy_link' });
  assert.deepEqual(linkTelegram(db, 'a', '123'), { ok: false, reason: 'duplicate_legacy_link' });
  db.close();
});
