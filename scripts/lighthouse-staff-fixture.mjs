import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import { USER_SESSION_TTL_MS } from '../server/utils/session-policy.js';

const CUSTOMER_ID = 'lcp-staff-admin';

export async function createLighthouseStaffFixture(db, tokenFile, { issuedAt = Date.now() } = {}) {
  const token = randomUUID();
  const timestamp = new Date(issuedAt).toISOString();

  db.prepare(`
    INSERT INTO customers (id, name, phone, created_at, role, verified)
    VALUES (?, ?, ?, ?, 'admin', 1)
  `).run(CUSTOMER_ID, 'Lighthouse Staff Fixture', '+7 900 000-00-00', timestamp);
  db.prepare(`
    INSERT INTO tokens (token, kind, ref, ts, expires_at)
    VALUES (?, 'user', ?, ?, ?)
  `).run(token, CUSTOMER_ID, timestamp, issuedAt + USER_SESSION_TTL_MS);

  await fs.writeFile(tokenFile, token + '\\n', { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  return { customerId: CUSTOMER_ID };
}
