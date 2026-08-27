import express from 'express';
import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const PIN = process.env.STAFF_PIN || '1234';
const PUBLIC_DIR = process.env.PUBLIC_DIR || path.join(__dirname, 'public');
const db = new Database(process.env.DB_PATH || path.join(__dirname, 'zerno.db'));
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS customers(id TEXT PRIMARY KEY, name TEXT, phone TEXT UNIQUE,
 stamps INTEGER DEFAULT 0, free INTEGER DEFAULT 0, cups INTEGER DEFAULT 0,
 qr TEXT UNIQUE, created_at TEXT);
CREATE TABLE IF NOT EXISTS history(id INTEGER PRIMARY KEY AUTOINCREMENT, cid TEXT, ts TEXT, a TEXT, by TEXT);
CREATE TABLE IF NOT EXISTS menu(id TEXT PRIMARY KEY, cat TEXT, e TEXT, name TEXT, desc TEXT,
 comp TEXT, vol TEXT, price INTEGER, tag TEXT, coffee INTEGER, "on" INTEGER, img TEXT);
CREATE TABLE IF NOT EXISTS tokens(token TEXT PRIMARY KEY, kind TEXT, ref TEXT, ts TEXT);
CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY AUTOINCREMENT, t TEXT, w TEXT, a TEXT);
CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT);`);

/* ── утилиты ── */
const ph10 = v => { let d = String(v || '').replace(/\D/g, '');
  if (d.startsWith('8')) d = '7' + d.slice(1);
  if (d.startsWith('7')) d = d.slice(1); return d.slice(0, 10); };
const fmtPhone = v => { const d = ph10(v); if (!d) return '';
  let r = '+7'; if (d.length > 0) r += ' ' + d.slice(0, 3); if (d.length > 3) r += ' ' + d.slice(3, 6);
  if (d.length > 6) r += '-' + d.slice(6, 8); if (d.length > 8) r += '-' + d.slice(8, 10); return r; };
const nowISO = () => new Date().toISOString();
const uid = p => p + crypto.randomBytes(5).toString('hex');
const item = r => ({ id: r.id, cat: r.cat, e: r.e, name: r.name, desc: r.desc,
  comp: JSON.parse(r.comp || '[]'), vol: r.vol, price: r.price, tag: r.tag,
  coffee: r.coffee, on: r.on, img: r.img });
const cust = c => ({ id: c.id, name: c.name, phone: c.phone, stamps: c.stamps, free: c.free,
  cups: c.cups, qr: c.qr, history: db.prepare('SELECT ts,a,by FROM history WHERE cid=? ORDER BY id DESC LIMIT 10').all(c.id) });
const addHist = (cid, a, by) => db.prepare('INSERT INTO history(cid,ts,a,by) VALUES(?,?,?,?)').run(cid, nowISO(), a, by);
const logEv = (w, a) => db.prepare('INSERT INTO events(t,w,a) VALUES(?,?,?)')
  .run(new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }), w, a);
const getMeta = () => db.prepare('SELECT value FROM meta WHERE key=\'updatedAt\'').get()?.value || nowISO();
const touch = () => db.prepare('INSERT INTO meta(key,value) VALUES(\'updatedAt\',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(nowISO());
const issueToken = (kind, ref) => { const t = crypto.randomUUID();
  db.prepare('INSERT INTO tokens(token,kind,ref,ts) VALUES(?,?,?,?)').run(t, kind, ref, nowISO()); return t; };

/* ── сид данных ── */
if (!db.prepare('SELECT 1 FROM menu LIMIT 1').get()) {
  const seed = [
    { id: 'c1', cat: 'coffee', e: '☕', name: 'Капучино', desc: 'Эспрессо, молоко и плотная пенка', comp: ['эспрессо','молоко','молочная пенка'], vol: '300 мл', price: 210, tag: 'Хит', coffee: 1 },
    { id: 'c2', cat: 'coffee', e: '🥛', name: 'Латте', desc: 'Мягкий, много молока', comp: ['эспрессо','молоко'], vol: '400 мл', price: 230, tag: '', coffee: 1 },
    { id: 'c3', cat: 'coffee', e: '☕', name: 'Флэт уайт', desc: 'Двойной эспрессо, шёлковое молоко', comp: ['двойной эспрессо','молоко'], vol: '200 мл', price: 240, tag: '', coffee: 1 },
    { id: 'c4', cat: 'coffee', e: '⚡', name: 'Эспрессо', desc: 'Смесь дня, тёмная обжарка', comp: ['арабика','робуста'], vol: '40 мл', price: 120, tag: '', coffee: 1 },
    { id: 'c5', cat: 'coffee', e: '🍦', name: 'Раф ванильный', desc: 'Сливочный, на сливках', comp: ['эспрессо','сливки','ванильный сахар'], vol: '300 мл', price: 280, tag: 'New', coffee: 1 },
    { id: 'c6', cat: 'coffee', e: '🫘', name: 'Американо', desc: 'Классика без сахара', comp: ['эспрессо','вода'], vol: '250 мл', price: 150, tag: '', coffee: 1 },
    { id: 'd1', cat: 'drinks', e: '🍵', name: 'Матча латте', desc: 'Японский чай на молоке', comp: ['матча','молоко','сироп топинамбура'], vol: '350 мл', price: 290, tag: 'New', coffee: 0 },
    { id: 'd2', cat: 'drinks', e: '🍫', name: 'Какао', desc: 'С домашним маршмеллоу', comp: ['какао','молоко','маршмеллоу'], vol: '300 мл', price: 250, tag: '', coffee: 0 },
    { id: 'd3', cat: 'drinks', e: '🫖', name: 'Облепиховый чай', desc: 'С мёдом и имбирём', comp: ['облепиха','чёрный чай','мёд','имбирь'], vol: '500 мл', price: 220, tag: '', coffee: 0 },
    { id: 'd4', cat: 'drinks', e: '🍒', name: 'Вишнёвый лимонад', desc: 'Газированный, освежающий', comp: ['вишня','содовая','лайм'], vol: '400 мл', price: 190, tag: '', coffee: 0 },
    { id: 'f1', cat: 'food', e: '🥐', name: 'Круассан с лососем', desc: 'Творожный сыр, каперсы', comp: ['круассан','лосось','творожный сыр','каперсы'], vol: '180 г', price: 320, tag: 'Хит', coffee: 0 },
    { id: 'f2', cat: 'food', e: '🥧', name: 'Киш с курицей', desc: 'Открытый пирог, жюльен', comp: ['тесто','курица','сливки','сыр'], vol: '220 г', price: 280, tag: '', coffee: 0 },
    { id: 'f3', cat: 'food', e: '🥗', name: 'Фалафель-боул', desc: 'Хумус, овощи, пита', comp: ['фалафель','хумус','овощи','пита'], vol: '300 г', price: 340, tag: 'Vegan', coffee: 0 },
    { id: 'f4', cat: 'food', e: '🍜', name: 'Том ям', desc: 'С креветками и рисом', comp: ['бульон','креветки','кокосовое молоко','рис'], vol: '350 г', price: 390, tag: '', coffee: 0 },
    { id: 's1', cat: 'desserts', e: '🍰', name: 'Сан-Себастьян', desc: 'Обожжённый баскский чизкейк', comp: ['крем-чиз','сливки','яйцо'], vol: '130 г', price: 290, tag: 'Хит', coffee: 0 },
    { id: 's2', cat: 'desserts', e: '🥕', name: 'Морковный торт', desc: 'С крем-чизом и орехом', comp: ['морковь','крем-чиз','грецкий орех'], vol: '140 г', price: 260, tag: '', coffee: 0 },
    { id: 's3', cat: 'desserts', e: '🍪', name: 'Макарон фисташка', desc: 'Миндальная мука, ганаш', comp: ['миндальная мука','фисташка','ганаш'], vol: '2 шт', price: 150, tag: '', coffee: 0 },
    { id: 's4', cat: 'desserts', e: '🥞', name: 'Сырники', desc: 'Со сметаной и ягодами', comp: ['творог','сметана','ягоды'], vol: '180 г', price: 240, tag: '', coffee: 0 },
  ];
  const ins = db.prepare('INSERT INTO menu VALUES(?,?,?,?,?,?,?,?,?,?,?,?)');
  for (const p of seed) ins.run(p.id, p.cat, p.e, p.name, p.desc, JSON.stringify(p.comp), p.vol, p.price, p.tag, p.coffee, 1, null);
  touch();
}
if (!db.prepare('SELECT 1 FROM customers LIMIT 1').get()) {
  const ins = db.prepare('INSERT INTO customers VALUES(?,?,?,?,?,?,?,?)');
  ins.run('u1', 'Анна Ким', '+7 912 480-88-12', 7, 0, 23, 'Z-K4F7A2', nowISO());
  ins.run('u2', 'Дмитрий Соколов', '+7 903 214-77-45', 9, 1, 64, 'Z-M9B3X1', nowISO());
  ins.run('u3', 'Мария Лебедева', '+7 926 118-30-09', 3, 0, 11, 'Z-P2T8Q6', nowISO());
  addHist('u1', 'Штамп 7 из 10', 'Кассир');
  addHist('u2', '🎉 10-й кофе — подарок начислен', 'Система');
  addHist('u3', 'Штамп 3 из 10', 'Кассир');
}

/* ── auth ── */
function authUser(req) {
  const t = (req.header('Authorization') || '').replace('Bearer ', '');
  const row = db.prepare('SELECT * FROM tokens WHERE token=? AND kind=\'user\'').get(t);
  return row ? db.prepare('SELECT * FROM customers WHERE id=?').get(row.ref) : null;
}
function authStaff(req) {
  const t = req.header('X-Staff');
  return !!t && !!db.prepare('SELECT 1 FROM tokens WHERE token=? AND kind=\'staff\'').get(t);
}
const staffGuard = (req, res, next) => authStaff(req) ? next() : res.status(401).json({ error: 'Нужен вход стаффа' });
const userGuard = (req, res, next) => { req.user = authUser(req); req.user ? next() : res.status(401).json({ error: 'Нужен вход по номеру' }); };

/* ── лояльность (серверная логика) ── */
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
function createCustomer(name, phone, by) {
  const p = fmtPhone(phone);
  if (name.trim().length < 2) return { err: 'Введите имя', code: 400 };
  if (ph10(p).length < 10) return { err: 'Введите номер полностью', code: 400 };
  if (db.prepare('SELECT 1 FROM customers WHERE phone=?').get(p)) return { err: 'exists', code: 409 };
  const id = uid('u'), qr = 'Z-' + crypto.randomBytes(3).toString('hex').toUpperCase();
  db.prepare('INSERT INTO customers VALUES(?,?,?,?,?,?,?,?)').run(id, name.trim(), p, 0, 0, 0, qr, nowISO());
  addHist(id, 'Профиль создан', by);
  if (by === 'Кассир') logEv(name.trim(), 'Создан профиль');
  return { customer: cust(db.prepare('SELECT * FROM customers WHERE id=?').get(id)) };
}

const app = express();
app.use(express.json({ limit: '10mb' }));

/* ── меню ── */
app.get('/api/menu', (req, res) => res.json({
  items: db.prepare('SELECT * FROM menu WHERE "on"=1').all().map(item), updatedAt: getMeta() }));
app.get('/api/menu/all', staffGuard, (req, res) => res.json({
  items: db.prepare('SELECT * FROM menu').all().map(item), updatedAt: getMeta() }));
app.post('/api/menu', staffGuard, (req, res) => {
  const p = req.body; p.id = p.id || uid('p');
  db.prepare('INSERT INTO menu VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(
    p.id, p.cat, p.e || '☕', p.name || 'Без названия', p.desc || '', JSON.stringify(p.comp || []),
    p.vol || '', Math.max(0, +p.price || 0), p.tag || '', p.coffee ? 1 : 0, p.on ? 1 : 0, p.img || null);
  touch(); res.json({ ok: true, id: p.id });
});
app.put('/api/menu/:id', staffGuard, (req, res) => {
  const p = req.body;
  db.prepare('UPDATE menu SET cat=?,e=?,name=?,desc=?,comp=?,vol=?,price=?,tag=?,coffee=?,"on"=?,img=? WHERE id=?').run(
  p.cat, p.e || '☕', p.name || 'Без названия', p.desc || '', JSON.stringify(p.comp || []),
  p.vol || '', Math.max(0, +p.price || 0), p.tag || '', p.coffee ? 1 : 0, p.on ? 1 : 0, p.img || null, req.params.id);
  touch(); res.json({ ok: true });
});
app.delete('/api/menu/:id', staffGuard, (req, res) => {
  db.prepare('DELETE FROM menu WHERE id=?').run(req.params.id); touch(); res.json({ ok: true });
});

/* ── аккаунты ── */
app.post('/api/auth/register', (req, res) => {
  const r = createCustomer(req.body.name || '', req.body.phone || '', 'Приложение');
  if (r.err) return res.status(r.code).json({ error: r.err });
  const token = issueToken('user', r.customer.id);
  res.json({ token, customer: r.customer });
});
app.post('/api/auth/login', (req, res) => {
  const p = fmtPhone(req.body.phone || '');
  const c = db.prepare('SELECT * FROM customers WHERE phone=?').get(p);
  if (!c) return res.status(404).json({ error: 'Профиль не найден — создайте новый' });
  addHist(c.id, 'Вход по номеру', 'Приложение');
  res.json({ token: issueToken('user', c.id), customer: cust(c) });
});
app.post('/api/auth/staff', (req, res) => {
  if (req.body.pin !== PIN) return res.status(403).json({ error: 'Неверный PIN' });
  res.json({ token: issueToken('staff', 'staff') });
});
app.post('/api/exit', (req, res) => {
  const t = (req.header('Authorization') || '').replace('Bearer ', '');
  db.prepare('DELETE FROM tokens WHERE token=?').run(t); res.json({ ok: true });
});
app.get('/api/me', userGuard, (req, res) => res.json({ customer: cust(req.user) }));
app.put('/api/me', userGuard, (req, res) => {
  const name = String(req.body.name || '').trim() || 'Гость';
  db.prepare('UPDATE customers SET name=? WHERE id=?').run(name, req.user.id);
  res.json({ customer: cust(db.prepare('SELECT * FROM customers WHERE id=?').get(req.user.id)) });
});
app.post('/api/stamp', userGuard, (req, res) => {
  const r = grant(req.user.id, 'Демо-покупка');
  r ? res.json(r) : res.status(404).json({ error: 'Гость не найден' });
});
app.post('/api/redeem', userGuard, (req, res) => {
  const r = redeem(req.user.id, 'Гость');
  r ? res.json(r) : res.status(400).json({ error: 'Нет доступных подарков' });
});

/* ── кассир / стафф ── */
app.get('/api/staff/customers', staffGuard, (req, res) => {
  const q = String(req.query.search || ''); const d = ph10(q); const t = q.trim().toLowerCase();
  const rows = db.prepare('SELECT * FROM customers ORDER BY created_at DESC LIMIT 50').all()
    .filter(c => (d.length >= 3 && ph10(c.phone).includes(d)) || (t && c.name.toLowerCase().includes(t)))
    .slice(0, 5);
  res.json({ customers: rows.map(cust) });
});
app.post('/api/staff/customers', staffGuard, (req, res) => {
  const r = createCustomer(req.body.name || '', req.body.phone || '', 'Кассир');
  r.err ? res.status(r.code).json({ error: r.err }) : res.json(r);
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

/* ── статика (фронтенд) ── */
app.use(express.static(PUBLIC_DIR));

app.listen(PORT, () => console.log(`☕ ЗЕРНО API: http://localhost:${PORT} · PIN стаффа: ${PIN === '1234' ? '1234 (смените через STAFF_PIN!)' : '***'}`));