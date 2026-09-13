import { db } from './connection.js';

export function initSchema() {
  db.exec(`
CREATE TABLE IF NOT EXISTS customers(
  id TEXT PRIMARY KEY, name TEXT, phone TEXT UNIQUE,
  stamps INTEGER DEFAULT 0, free INTEGER DEFAULT 0, cups INTEGER DEFAULT 0,
  qr TEXT UNIQUE, created_at TEXT, role TEXT DEFAULT 'guest');
CREATE TABLE IF NOT EXISTS history(
  id INTEGER PRIMARY KEY AUTOINCREMENT, cid TEXT, ts TEXT, a TEXT, by TEXT);
CREATE TABLE IF NOT EXISTS menu(
  id TEXT PRIMARY KEY, cat TEXT, e TEXT, name TEXT, descr TEXT,
  comp TEXT, vol TEXT, price TEXT, tag TEXT, coffee INTEGER, is_on INTEGER DEFAULT 1, img TEXT);
CREATE TABLE IF NOT EXISTS tokens(
  token TEXT PRIMARY KEY, kind TEXT, ref TEXT, ts TEXT);
CREATE TABLE IF NOT EXISTS events(
  id INTEGER PRIMARY KEY AUTOINCREMENT, t TEXT, w TEXT, a TEXT);
CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS promos(
  id TEXT PRIMARY KEY, code TEXT UNIQUE, kind TEXT, value INTEGER DEFAULT 1,
  active INTEGER DEFAULT 1, expires TEXT, maxuses INTEGER DEFAULT 0, uses INTEGER DEFAULT 0, created TEXT);
CREATE TABLE IF NOT EXISTS promo_use(
  id INTEGER PRIMARY KEY AUTOINCREMENT, promo TEXT, cid TEXT, ts TEXT);
CREATE TABLE IF NOT EXISTS subs(
  id INTEGER PRIMARY KEY AUTOINCREMENT, cid TEXT, sub TEXT UNIQUE, created TEXT);
CREATE TABLE IF NOT EXISTS chat(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT, who TEXT, text TEXT, ts TEXT,
  human INTEGER DEFAULT 0, read_g INTEGER DEFAULT 0, read_s INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS chat_meta(
  key TEXT PRIMARY KEY, closed INTEGER DEFAULT 0, staff_in INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS fcm(
  id INTEGER PRIMARY KEY AUTOINCREMENT, cid TEXT, token TEXT UNIQUE, created TEXT);
  `);

  /* миграции */
  const ccols = db.prepare('PRAGMA table_info(customers)').all().map(c => c.name);
  if (ccols.length && !ccols.includes('role')) db.exec(`ALTER TABLE customers ADD COLUMN role TEXT DEFAULT 'guest'`);

  const mcols = db.prepare('PRAGMA table_info(chat_meta)').all().map(c => c.name);
  if (mcols.length && !mcols.includes('staff_in')) db.exec('ALTER TABLE chat_meta ADD COLUMN staff_in INTEGER DEFAULT 0');
  if (mcols.length && !mcols.includes('ctx')) db.exec(`ALTER TABLE chat_meta ADD COLUMN ctx TEXT DEFAULT 'coffee'`);

  const tcols = db.prepare('PRAGMA table_info(customers)').all().map(c => c.name);
  if (tcols.length && !tcols.includes('tg')) db.exec('ALTER TABLE customers ADD COLUMN tg TEXT');
  if (tcols.length && !tcols.includes('pin')) db.exec("ALTER TABLE customers ADD COLUMN pin TEXT DEFAULT ''");
  if (tcols.length && !tcols.includes('verified')) db.exec('ALTER TABLE customers ADD COLUMN verified INTEGER DEFAULT 0');
  if (tcols.length && !tcols.includes('welcome')) db.exec('ALTER TABLE customers ADD COLUMN welcome INTEGER DEFAULT 0');
  if (tcols.length && !tcols.includes('actcode')) db.exec('ALTER TABLE customers ADD COLUMN actcode TEXT');

  if (!db.prepare("SELECT 1 FROM meta WHERE key='verified_migrated'").get()) {
    db.exec('UPDATE customers SET verified=1'); // старые профили — честные
    db.prepare("INSERT INTO meta(key,value) VALUES('verified_migrated','1')").run();
  }

  /* ── доставка: колонки и таблицы ── */
  const menuCols = db.prepare('PRAGMA table_info(menu)').all().map(c => c.name);
  if (menuCols.length && !menuCols.includes('section')) db.exec(`ALTER TABLE menu ADD COLUMN section TEXT DEFAULT 'coffee'`);
  if (menuCols.length && !menuCols.includes('opts')) db.exec(`ALTER TABLE menu ADD COLUMN opts TEXT DEFAULT '[]'`);

  const prCols = db.prepare('PRAGMA table_info(promos)').all().map(c => c.name);
  if (prCols.length && !prCols.includes('scope')) db.exec(`ALTER TABLE promos ADD COLUMN scope TEXT DEFAULT 'coffee'`);

  db.exec(`CREATE TABLE IF NOT EXISTS orders(
    id TEXT PRIMARY KEY, no INTEGER, cid TEXT, name TEXT, phone TEXT,
    method TEXT, place TEXT, addr TEXT, slot TEXT, pay TEXT, comment TEXT,
    items TEXT, total INTEGER, discount INTEGER, fee INTEGER, gifts TEXT,
    status TEXT DEFAULT 'new', created TEXT, updated TEXT)`);

  const ocols = db.prepare('PRAGMA table_info(orders)').all().map(c => c.name);
  if (ocols.length && !ocols.includes('promo')) db.exec(`ALTER TABLE orders ADD COLUMN promo TEXT DEFAULT ''`);
  if (ocols.length && !ocols.includes('promodiscount')) db.exec(`ALTER TABLE orders ADD COLUMN promodiscount INTEGER DEFAULT 0`);
  if (ocols.length && !ocols.includes('eta')) db.exec(`ALTER TABLE orders ADD COLUMN eta TEXT DEFAULT ''`);

  const ncols = db.prepare('PRAGMA table_info(customers)').all().map(c => c.name);
  if (ncols.length && !ncols.includes('notify_tg')) db.exec(`ALTER TABLE customers ADD COLUMN notify_tg INTEGER DEFAULT 1`);
  if (ncols.length && !ncols.includes('notify_web')) db.exec(`ALTER TABLE customers ADD COLUMN notify_web INTEGER DEFAULT 1`);
  if (ncols.length && !ncols.includes('consent')) db.exec(`ALTER TABLE customers ADD COLUMN consent TEXT DEFAULT ''`);
}