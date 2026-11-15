import { db as defaultDb } from '../db/connection.js';

/**
 * Attach a Telegram user ID to exactly one customer.
 * Existing links are never silently overwritten. The transaction and unique index
 * prevent two profiles from claiming the same Telegram ID on normal installations.
 * @returns {{ok: true} | {ok: false, reason: string}}
 */
export function linkTelegram(database, customerId, telegramId) {
  const db = database || defaultDb;
  const cid = String(customerId || '').trim();
  const tg = String(telegramId || '').trim();
  if (!cid || !tg) return { ok: false, reason: 'invalid_input' };

  const run = db.transaction(() => {
    const customer = db.prepare('SELECT id, tg FROM customers WHERE id=?').get(cid);
    if (!customer) return { ok: false, reason: 'customer_not_found' };

    const owners = db.prepare('SELECT id FROM customers WHERE tg=?').all(tg);
    if (owners.length > 1) return { ok: false, reason: 'duplicate_legacy_link' };
    if (owners.some(owner => owner.id !== cid)) return { ok: false, reason: 'telegram_in_use' };
    if (customer.tg && String(customer.tg) !== tg) return { ok: false, reason: 'customer_already_linked' };

    if (customer.tg === tg) return { ok: true };
    try {
      db.prepare('UPDATE customers SET tg=? WHERE id=?').run(tg, cid);
    } catch (error) {
      if (error && (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.code === 'SQLITE_CONSTRAINT')) {
        return { ok: false, reason: 'telegram_in_use' };
      }
      throw error;
    }
    return { ok: true };
  });
  return run.immediate();
}

export function findUniqueTelegramCustomer(database, telegramId) {
  const db = database || defaultDb;
  const tg = String(telegramId || '').trim();
  if (!tg) return { ok: true, customer: null };
  const rows = db.prepare('SELECT * FROM customers WHERE tg=? LIMIT 2').all(tg);
  if (rows.length > 1) return { ok: false, customer: null, reason: 'duplicate_legacy_link' };
  return { ok: true, customer: rows[0] || null };
}
