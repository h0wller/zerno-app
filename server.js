import express from 'express';
import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const ADMIN_CODE = process.env.ADMIN_CODE || '1234';
const CASHIER_CODE = process.env.CASHIER_CODE || '2468';
const PUBLIC_DIR = process.env.PUBLIC_DIR || path.join(__dirname, 'public');

const db = new Database(process.env.DB_PATH || path.join(__dirname, 'zerno.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS customers(
  id TEXT PRIMARY KEY, name TEXT, phone TEXT UNIQUE,
  stamps INTEGER DEFAULT 0, free INTEGER DEFAULT 0, cups INTEGER DEFAULT 0,
  qr TEXT UNIQUE, created_at TEXT, role TEXT DEFAULT 'guest');
CREATE TABLE IF NOT EXISTS history(
  id INTEGER PRIMARY KEY AUTOINCREMENT, cid TEXT, ts TEXT, a TEXT, by TEXT);
CREATE TABLE IF NOT EXISTS menu(
  id TEXT PRIMARY KEY, cat TEXT, e TEXT, name TEXT, descr TEXT,
  comp TEXT, vol TEXT, price INTEGER, tag TEXT, coffee INTEGER,
  is_on INTEGER DEFAULT 1, img TEXT);
CREATE TABLE IF NOT EXISTS tokens(
  token TEXT PRIMARY KEY, kind TEXT, ref TEXT, ts TEXT);
CREATE TABLE IF NOT EXISTS events(
  id INTEGER PRIMARY KEY AUTOINCREMENT, t TEXT, w TEXT, a TEXT);
CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT);
`);
/* миграция: добавляем role, если база старая */
const ccols = db.prepare('PRAGMA table_info(customers)').all().map(c => c.name);
if (ccols.length && !ccols.includes('role')) {
  db.exec(`ALTER TABLE customers ADD COLUMN role TEXT DEFAULT 'guest'`);
}

/* ── утилиты ── */
const ph10 = v => { let d = String(v || '').replace(/\D/g, '');
  if (d.startsWith('8')) d = '7' + d.slice(1);
  if (d.startsWith('7')) d = d.slice(1); return d.slice(0, 10); };
const fmtPhone = v => { const d = ph10(v); if (!d) return '';
  let r = '+7'; if (d.length > 0) r += ' ' + d.slice(0, 3); if (d.length > 3) r += ' ' + d.slice(3, 6);
  if (d.length > 6) r += '-' + d.slice(6, 8); if (d.length > 8) r += '-' + d.slice(8, 10); return r; };
const nowISO = () => new Date().toISOString();
const uid = p => p + crypto.randomBytes(5).toString('hex');
const item = r => ({ id: r.id, cat: r.cat, e: r.e, name: r.name, desc: r.descr,
  comp: JSON.parse(r.comp || '[]'), vol: r.vol, price: r.price, tag: r.tag,
  coffee: r.coffee, on: r.is_on, img: r.img });
const cust = c => ({ id: c.id, name: c.name, phone: c.phone, stamps: c.stamps, free: c.free,
  cups: c.cups, qr: c.qr, role: c.role || 'guest',
  history: db.prepare('SELECT ts,a,by FROM history WHERE cid=? ORDER BY id DESC LIMIT 10').all(c.id) });
const addHist = (cid, a, by) => db.prepare('INSERT INTO history(cid,ts,a,by) VALUES(?,?,?,?)').run(cid, nowISO(), a, by);
const logEv = (w, a) => db.prepare('INSERT INTO events(t,w,a) VALUES(?,?,?)')
  .run(new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }), w, a);
const getMeta = () => db.prepare("SELECT value FROM meta WHERE key='updatedAt'").get()?.value || nowISO();
const touch = () => db.prepare("INSERT INTO meta(key,value) VALUES('updatedAt',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(nowISO());
const issueToken = ref => { const t = crypto.randomUUID();
  db.prepare('INSERT INTO tokens(token,kind,ref,ts) VALUES(?,?,?,?)').run(t, 'user', ref, nowISO()); return t; };

/* ── сид ── */
if (!db.prepare('SELECT 1 FROM menu LIMIT 1').get()) {
  const seed = [
    ['c1','coffee','☕','Капучино','Эспрессо, молоко и плотная пенка',['эспрессо','молоко','молочная пенка'],'300 мл',210,'Хит',1],
    ['c2','coffee','🥛','Латте','Мягкий, много молока',['эспрессо','молоко'],'400 мл',230,'',1],
    ['c3','coffee','☕','Флэт уайт','Двойной эспрессо, шёлковое молоко',['двойной эспрессо','молоко'],'200 мл',240,'',1],
    ['c4','coffee','⚡','Эспрессо','Смесь дня, тёмная обжарка',['арабика','робуста'],'40 мл',120,'',1],
    ['c5','coffee','🍦','Раф ванильный','Сливочный, на сливках',['эспрессо','сливки','ванильный сахар'],'300 мл',280,'New',1],
    ['c6','coffee','🫘','Американо','Классика без сахара',['эспрессо','вода'],'250 мл',150,'',1],
    ['d1','drinks','🍵','Матча латте','Японский чай на молоке',['матча','молоко','сироп топинамбура'],'350 мл',290,'New',0],
    ['d2','drinks','🍫','Какао','С домашним маршмеллоу',['какао','молоко','маршмеллоу'],'300 мл',250,'',0],
    ['d3','drinks','🫖','Облепиховый чай','С мёдом и имбирём',['облепиха','чёрный чай','мёд','имбирь'],'500 мл',220,'',0],
    ['d4','drinks','🍒','Вишнёвый лимонад','Газированный, освежающий',['вишня','содовая','лайм'],'400 мл',190,'',0],
    ['f1','food','🥐','Круассан с лососем','Творожный сыр, каперсы',['круассан','лосось','творожный сыр','каперсы'],'180 г',320,'Хит',0],
    ['f2','food','🥧','Киш с курицей','Открытый пирог, жюльен',['тесто','курица','сливки','сыр'],'220 г',280,'',0],
    ['f3','food','🥗','Фалафель-боул','Хумус, овощи, пита',['фалафель','хумус','овощи','пита'],'300 г',340,'Vegan',0],
    ['f4','food','🍜','Том ям','С креветками и рисом',['бульон','креветки','кокосовое молоко','рис'],'350 г',390,'',0],
    ['s1','desserts','🍰','Сан-Себастьян','Обожжённый баскский чизкейк',['крем-чиз','сливки','яйцо'],'130 г',290,'Хит',0],
    ['s2','desserts','🥕','Морковный торт','С крем-чизом и орехом',['морковь','крем-чиз','грецкий орех'],'140 г',260,'',0],
    ['s3','desserts','🍪','Макарон фисташка','Миндальная мука, ганаш',['миндальная мука','фисташка','ганаш'],'2 шт',150,'',0],
    ['s4','desserts','🥞','Сырники','Со сметаной и ягодами',['творог','сметана','ягоды'],'180 г',240,'',0],
  ];
  const ins = db.prepare('INSERT INTO menu VALUES(?,?,?,?,?,?,?,?,?,?,?,?)');
  for (const p of seed) ins.run(p[0], p[1], p[2], p[3], p[4], JSON.stringify(p[5]), p[6], p[7], p[8], p[9], 1, null);
  touch();
}
if (!db.prepare('SELECT 1 FROM customers LIMIT 1').get()) {
  db.prepare('INSERT INTO customers VALUES(?,?,?,?,?,?,?,?,?)').run('u1','Анна Ким','+7 912 480-88-12',7,0,23,'Z-K4F7A2',nowISO(),'admin');
  db.prepare('INSERT INTO customers VALUES(?,?,?,?,?,?,?,?,?)').run('u2','Дмитрий Соколов','+7 903 214-77-45',9,1,64,'Z-M9B3X1',nowISO(),'cashier');
  db.prepare('INSERT INTO customers VALUES(?,?,?,?,?,?,?,?,?)').run('u3','Мария Лебедева','+7 926 118-30-09',3,0,11,'Z-P2T8Q6',nowISO(),'guest');
  addHist('u1','Штамп 7 из 10','Кассир'); addHist('u2','🎉 10-й кофе — подарок начислен','Система'); addHist('u3','Штамп 3 из 10','Кассир');
}

/* ── guards по ролям ── */
function authUser(req) {
  const t = (req.header('Authorization') || '').replace('Bearer ', '');
  const row = db.prepare("SELECT * FROM tokens WHERE token=? AND kind='user'").get(t);
  return row ? db.prepare('SELECT * FROM customers WHERE id=?').get(row.ref) : null;
}
const userGuard = (req, res, next) => { req.user = authUser(req);
  req.user ? next() : res.status(401).json({ error: 'Нужен вход по номеру' }); };
const staffGuard = (req, res, next) => { req.user = authUser(req);
  if (!req.user) return res.status(401).json({ error: 'Нужен вход по номеру' });
  if (req.user.role !== 'cashier' && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Недостаточно прав: нужна роль кассира' });
  next(); };
const adminGuard = (req, res, next) => { req.user = authUser(req);
  if (!req.user) return res.status(401).json({ error: 'Нужен вход по номеру' });
  if (req.user.role !== 'admin')
    return res.status(403).json({ error: 'Недостаточно прав: нужна роль администратора' });
  next(); };

/* ── лояльность ── */
function grant(cid, by) {
  const c = db.prepare('SELECT * FROM customers WHERE id=?').get(cid);
  if (!c) return null;
  c.stamps++; c.cups++;
  db.prepare('UPDATE customers SET stamps=?,cups=? WHERE id=?').run(c.stamps, c.cups, cid);
  addHist(cid, `Штамп ${c.stamps} из 10`, by);
  let ten = false;
  if (c.stamps >= 10) {
    c.stamps = 0; c.free++; ten = true;
    db.prepare('UPDATE customers SET stamps=?,free=? WHERE id=?').run(0, c.free, cid);
    addHist(cid, '🎉 10-й кофе — подарок начислен', 'Система');
  }
  logEv(c.name, ten ? '10-й кофе — подарок начислен' : `+1 штамп → ${c.stamps} из 10`);
  const fresh = db.prepare('SELECT * FROM customers WHERE id=?').get(cid);
  return { customer: cust(fresh), ten, msg: ten ? '10-й штамп! Начислен бесплатный кофе' : `+1 штамп → ${fresh.stamps} из 10` };
}
function redeem(cid, by) {
  const c = db.prepare('SELECT * FROM customers WHERE id=?').get(cid);
  if (!c || c.free < 1) return null;
  db.prepare('UPDATE customers SET free=? WHERE id=?').run(c.free - 1, cid);
  addHist(cid, `🎁 Списан бесплатный кофе (осталось ${c.free - 1})`, by);
  logEv(c.name, 'Списан бесплатный кофе');
  return { customer: cust(db.prepare('SELECT * FROM customers WHERE id=?').get(cid)) };
}
function createCustomer(name, phone) {
  const p = fmtPhone(phone);
  if (String(name).trim().length < 2) return { err: 'Введите имя', code: 400 };
  if (ph10(p).length < 10) return { err: 'Введите номер полностью', code: 400 };
  if (db.prepare('SELECT 1 FROM customers WHERE phone=?').get(p)) return { err: 'exists', code: 409 };
  const id = uid('u'), qr = 'Z-' + crypto.randomBytes(3).toString('hex').toUpperCase();
  db.prepare('INSERT INTO customers VALUES(?,?,?,?,?,?,?,?,?)').run(id, name.trim(), p, 0, 0, 0, qr, nowISO(), 'guest');
  addHist(id, 'Профиль создан', 'Приложение');
  return { customer: cust(db.prepare('SELECT * FROM customers WHERE id=?').get(id)) };
}

const app = express();
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: '10mb' }));

/* ── меню ─ */
app.get('/api/health', (req, res) => res.json({ ok: true }));
app.get('/api/menu', (req, res) => res.json({
  items: db.prepare('SELECT * FROM menu WHERE is_on=1').all().map(item), updatedAt: getMeta() }));
app.get('/api/menu/all', adminGuard, (req, res) => res.json({
  items: db.prepare('SELECT * FROM menu').all().map(item), updatedAt: getMeta() }));
app.post('/api/menu', adminGuard, (req, res) => {
  const p = req.body; p.id = p.id || uid('p');
  db.prepare('INSERT INTO menu VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(
    p.id, p.cat, p.e || '☕', p.name || 'Без названия', p.desc || '', JSON.stringify(p.comp || []),
    p.vol || '', Math.max(0, +p.price || 0), p.tag || '', p.coffee ? 1 : 0, p.on ? 1 : 0, p.img || null);
  touch(); res.json({ ok: true, id: p.id });
});
app.put('/api/menu/:id', adminGuard, (req, res) => {
  const p = req.body;
  db.prepare('UPDATE menu SET cat=?,e=?,name=?,descr=?,comp=?,vol=?,price=?,tag=?,coffee=?,is_on=?,img=? WHERE id=?').run(
    p.cat, p.e || '☕', p.name || 'Без названия', p.desc || '', JSON.stringify(p.comp || []),
    p.vol || '', Math.max(0, +p.price || 0), p.tag || '', p.coffee ? 1 : 0, p.on ? 1 : 0, p.img || null, req.params.id);
  touch(); res.json({ ok: true });
});
app.delete('/api/menu/:id', adminGuard, (req, res) => {
  db.prepare('DELETE FROM menu WHERE id=?').run(req.params.id); touch(); res.json({ ok: true });
});

/* ── аккаунты ── */
app.post('/api/auth/register', (req, res) => {
  const r = createCustomer(req.body.name || '', req.body.phone || '');
  if (r.err) return res.status(r.code).json({ error: r.err });
  res.json({ token: issueToken(r.customer.id), customer: r.customer });
});
app.post('/api/auth/login', (req, res) => {
  const p = fmtPhone(req.body.phone || '');
  const c = db.prepare('SELECT * FROM customers WHERE phone=?').get(p);
  if (!c) return res.status(404).json({ error: 'Профиль не найден — создайте новый' });
  addHist(c.id, 'Вход по номеру', 'Приложение');
  res.json({ token: issueToken(c.id), customer: cust(c) });
});
app.post('/api/exit', userGuard, (req, res) => {
  const t = (req.header('Authorization') || '').replace('Bearer ', '');
  db.prepare('DELETE FROM tokens WHERE token=?').run(t); res.json({ ok: true });
});
/* активация роли кодом */
app.post('/api/auth/activate', userGuard, (req, res) => {
  const code = String(req.body.code || '').trim();
  let role = null;
  if (code === ADMIN_CODE) role = 'admin';
  else if (code === CASHIER_CODE) role = 'cashier';
  if (!role) return res.status(403).json({ error: 'Неверный код доступа' });
  db.prepare('UPDATE customers SET role=? WHERE id=?').run(role, req.user.id);
  addHist(req.user.id, role === 'admin' ? '🔓 Выдан доступ администратора' : '🧾 Выдан доступ кассира', 'Система');
  logEv(req.user.name, role === 'admin' ? 'активирован админ' : 'активирован кассир');
  res.json({ customer: cust(db.prepare('SELECT * FROM customers WHERE id=?').get(req.user.id)) });
});
app.get('/api/me', userGuard, (req, res) => res.json({ customer: cust(req.user) }));
app.put('/api/me', userGuard, (req, res) => {
  const name = String(req.body.name || '').trim() || 'Гость';
  db.prepare('UPDATE customers SET name=? WHERE id=?').run(name, req.user.id);
  res.json({ customer: cust(db.prepare('SELECT * FROM customers WHERE id=?').get(req.user.id)) });
});
app.post('/api/redeem', userGuard, (req, res) => {
  const r = redeem(req.user.id, 'Гость');
  r ? res.json(r) : res.status(400).json({ error: 'Нет доступных подарков' });
});

/* ── кассир (роль cashier/admin) ── */
app.get('/api/staff/customers', staffGuard, (req, res) => {
  const q = String(req.query.search || ''); const d = ph10(q); const t = q.trim().toLowerCase();
  const rows = db.prepare('SELECT * FROM customers ORDER BY created_at DESC LIMIT 50').all()
    .filter(c => (d.length >= 3 && ph10(c.phone).includes(d)) || (t && c.name.toLowerCase().includes(t)))
    .slice(0, 5);
  res.json({ customers: rows.map(cust) });
});
app.post('/api/staff/customers', staffGuard, (req, res) => {
  const r = createCustomer(req.body.name || '', req.body.phone || '');
  if (r.err) return res.status(r.code).json({ error: r.err });
  addHist(r.customer.id, 'Профиль создан', 'Кассир'); logEv(r.customer.name, 'Создан профиль');
  res.json(r);
});
app.post('/api/staff/stamp', staffGuard, (req, res) => {
  const r = grant(req.body.id, 'Кассир');
  r ? res.json(r) : res.status(404).json({ error: 'Гость не найден' });
});
app.post('/api/staff/redeem', staffGuard, (req, res) => {
  const r = redeem(req.body.id, 'Кассир');
  r ? res.json(r) : res.status(400).json({ error: 'Нет доступных подарков' });
});
app.post('/api/staff/scan', staffGuard, (req, res) => {
  const c = db.prepare('SELECT * FROM customers WHERE qr=?').get(String(req.body.code || '').trim());
  c ? res.json({ customer: cust(c) }) : res.status(404).json({ error: 'QR не найден' });
});
let demoIdx = 0;
app.get('/api/staff/demo', staffGuard, (req, res) => {
  const rows = db.prepare('SELECT * FROM customers ORDER BY created_at').all();
  if (!rows.length) return res.status(404).json({ error: 'Нет гостей' });
  res.json({ customer: cust(rows[demoIdx++ % rows.length]) });
});
app.get('/api/staff/log', staffGuard, (req, res) =>
  res.json({ log: db.prepare('SELECT t,w,a FROM events ORDER BY id DESC LIMIT 20').all() }));

/* ── статика ── */
app.use(express.static(PUBLIC_DIR));

app.listen(PORT, () => console.log(`☕ ЗЕРНО API запущен на порту ${PORT}`));