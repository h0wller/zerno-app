import { db } from '../server/db/connection.js';

const kinds = ['signup', 'qr', 'install'];
const customers = db.prepare('SELECT id FROM customers').all();

console.log(`Бэкфилл bonus_grants для ${customers.length} клиентов...`);

let count = 0;
const stmt = db.prepare('INSERT OR IGNORE INTO bonus_grants(cid, kind, ts) VALUES(?, ?, ?)');

for (const c of customers) {
  for (const kind of kinds) {
    const r = stmt.run(c.id, kind, new Date().toISOString());
    if (r.changes > 0) count++;
  }
}

console.log(`Добавлено ${count} записей.`);