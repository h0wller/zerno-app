#!/usr/bin/env node
/**
 * Read-only inspection of a customer's welcome-bonus state.
 * Usage: node scripts/diagnose-guest.mjs <customer-id-or-phone-suffix>
 */
import { db } from '../server/db/connection.js';

const needle = String(process.argv[2] || '').trim();
if (!needle) {
  console.error('Usage: node scripts/diagnose-guest.mjs <customer-id-or-phone-suffix>');
  process.exit(2);
}

const digits = needle.replace(/\D/g, '');
const customer = db.prepare(`
  SELECT id, name, phone, role, verified, src, cups, stamps, free, welcome,
         notify_tg, notify_web, CASE WHEN tg IS NOT NULL AND tg <> '' THEN 1 ELSE 0 END AS has_telegram
  FROM customers
  WHERE id = ?
     OR (? <> '' AND replace(replace(replace(replace(phone, '+', ''), ' ', ''), '-', ''), '(', '') LIKE '%' || ?)
  LIMIT 2
`).all(needle, digits.length >= 4 ? digits : '', digits.length >= 4 ? digits : '');

if (customer.length === 0) {
  console.log(JSON.stringify({ found: false, searchedBy: digits.length >= 4 ? 'id-or-phone-suffix' : 'id' }, null, 2));
  process.exit(1);
}
if (customer.length > 1) {
  console.log(JSON.stringify({ found: false, ambiguous: true, matches: customer.map(c => ({ id: c.id, name: c.name })) }, null, 2));
  process.exit(2);
}

const c = customer[0];
const grants = db.prepare('SELECT kind, ts FROM bonus_grants WHERE cid=? ORDER BY ts').all(c.id);
const history = db.prepare(`
  SELECT ts, a, by FROM history
  WHERE cid=? AND (a LIKE '%Бонус%' OR a LIKE '%верифицирован%' OR a LIKE '%активирован%' OR a LIKE '%Профиль создан%')
  ORDER BY id DESC LIMIT 30
`).all(c.id);
const promos = db.prepare(`
  SELECT kind, value, active, expires, maxuses, uses, scope,
         CASE WHEN owner=? THEN 1 ELSE 0 END AS owned
  FROM promos WHERE owner=? OR id IN (SELECT promo FROM promo_use WHERE cid=?)
  ORDER BY created DESC LIMIT 30
`).all(c.id, c.id, c.id);
const backfill = db.prepare("SELECT value FROM meta WHERE key='bonus_grants_backfilled'").get();
const configRow = db.prepare("SELECT value FROM meta WHERE key='bonus_cfg'").get();

console.log(JSON.stringify({
  found: true,
  customer: {
    ...c,
    phone: c.phone ? String(c.phone).replace(/\d(?=\d{2})/g, '•') : null
  },
  bonusGrants: grants,
  relevantHistory: history,
  relatedPromos: promos,
  migrations: { bonusGrantsBackfilled: backfill?.value || null },
  bonusConfig: configRow?.value ? JSON.parse(configRow.value) : null
}, null, 2));
