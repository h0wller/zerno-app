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
  comp TEXT, vol TEXT, price TEXT, tag TEXT, coffee INTEGER, is_on INTEGER DEFAULT 1, img TEXT);
CREATE TABLE IF NOT EXISTS tokens(
  token TEXT PRIMARY KEY, kind TEXT, ref TEXT, ts TEXT);
CREATE TABLE IF NOT EXISTS events(
  id INTEGER PRIMARY KEY AUTOINCREMENT, t TEXT, w TEXT, a TEXT);
CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT);
`);
/* миграции */
const ccols = db.prepare('PRAGMA table_info(customers)').all().map(c => c.name);
if (ccols.length && !ccols.includes('role')) db.exec(`ALTER TABLE customers ADD COLUMN role TEXT DEFAULT 'guest'`);
const MENU_V = '4';
if (db.prepare("SELECT value FROM meta WHERE key='menu_v'").get()?.value !== MENU_V) {
  db.exec('DELETE FROM menu');
  const seed = [
    ['esp','coffee','⚡','Эспрессо','40 мл чистой честности. Без молока и компромиссов',['эспрессо'],'40 мл','200','',1],
    ['amer','coffee','☕','Американо','Для тех, кто любит «просто кофе». Держит до вечера',['эспрессо','вода'],'200 мл','240','',1],
    ['batch','coffee','🫖','Батч брю','Заварили с любовью. Кислит, сладит, живёт',['фильтр-кофе'],'200/300 мл','220/260','',1],
    ['flat','coffee','☕','Флэт уайт','Двойной эспрессо в бархатной накидке',['двойной эспрессо','молоко'],'180 мл','280','',1],
    ['cap','coffee','☕','Капучино','Классика, за которой возвращаются. Пенка — хоть рисуй',['эспрессо','молоко'],'200/300 мл','250/340','Хит',1],
    ['lat','coffee','🥛','Латте','Мягкий и тёплый, как объятие. Только вкуснее',['эспрессо','молоко'],'300/400 мл','310/360','',1],
    ['raf','coffee','🍦','Раф','Сливочный, сладкий, затягивает. Мы никому не расскажем',['эспрессо','сливки','ванильный сахар'],'300/400 мл','360/400','',1],
    ['matcha','drinks','🍵','Матча','Зелёный, полезный, фотогеничный. Энергия без кофе',['маття','молоко'],'300/400 мл','290/360','',0],
    ['cocoa','drinks','🍫','Какао','Из детства, с маршмеллоу и без сожалений',['какао','молоко','маршмеллоу'],'300/400 мл','290/370','',0],
    ['tea','drinks','🫖','Чай','Семь характеров: от ассама до каркаде. Выбирай настроение',['ассам','эрл грей','сенча','молочный улун','горные травы','ройбуш с малиной','каркаде с цукатами'],'400 мл','210','',0],
    ['monblan','seasonal','🏔','Монблан','Такой красивый, что улетает сразу в соцсети',['каштан','сливки','эспрессо'],'—','400','New',0],
    ['lemonade','seasonal','🍋','Кофейный лимонад','Сложный, как твой выбор',['эспрессо','лимон','сироп'],'—','400','',0],
    ['diet','seasonal','🍨','Я не на диете','Когда решил позволить себе все и даже больше!',['эспрессо','сливки','сироп'],'—','400','',0],
    ['mtonic','seasonal','🌴','Тропическая матча-тоник','Сделали вкусно для тех, кто любит матчу',['матча','тоник','тропический сироп'],'—','420','New',0],
    ['panini-ham','food','🥪','Панини ветчина','Горячий, хрустящий, сытный. Как надо',['ветчина','сыр','соус'],'—','320','',0],
    ['panini-pep','food','🥪','Панини пепперони','Горячий, хрустящий, сытный. Как надо',['пепперони','сыр','томаты'],'—','320','',0],
    ['panini-tuna','food','🥪','Панини тунец','Горячий, хрустящий, сытный. Как надо',['тунец','сыр','овощи'],'—','350','',0],
    ['granola','food','🥣','Гранола','Миска утра: гранола, йогурт, ягоды. Даже если уже вечер',['гранола','йогурт','ягоды'],'—','360','',0],
    ['syrniki','food','🥞','Сырники','Как у бабушки, только со сметаной и нашим вайбом',['творог','сметана','ягоды'],'—','350','',0],
    ['carrot','desserts','🥕','Морковный торт','Орех хрустит, крем тает. Овощ, а праздник',['морковь','крем-чиз','грецкий орех'],'—','360','Хит',0],
    ['moti','desserts','🍡','Моти','4 вкуса: клубника-пломбир, финик-дорблю, манго-пломбир, вишня-латте',['клубника-пломбир','финик-дорблю','манго-пломбир','вишня-латте'],'—','275','',0],
    ['pie','desserts','🥧','Пирог','Вишнёвый или грушевый — что сегодня решил духовой шкаф',['вишня/груша','песочное тесто'],'—','300','',0],
    ['shu','desserts','🧁','Шу','Хрустящее снаружи, кремовое внутри. Тает быстрее, чем кажется',['шу','крем'],'—','250','',0],
    ['eclair','desserts','🍫','Эклер','Классика, которой не нужно представляться',['шу','шоколад','крем'],'—','230','',0],
    ['bars','desserts','⚡','Батончики','Kick и R.A.W. Life — когда нужна энергия прямо сейчас',['Kick','R.A.W. Life'],'—','300','',0],
    ['drip','shop','☕','Дрип','Кофе в кармане. Завари где угодно',['Tasty Coffee'],'1 шт','150','',0],
    ['candy','shop','🍬','Леденцы','Scandic: арктическая мята, пряное яблоко и другие',['Scandic'],'1 шт','150','',0],
  ];
  const ins = db.prepare('INSERT INTO menu VALUES(?,?,?,?,?,?,?,?,?,?,?,?)');
  for (const p of seed) ins.run(p[0],p[1],p[2],p[3],p[4],JSON.stringify(p[5]),p[6],p[7],p[8],p[9],1,null);
  db.prepare("INSERT INTO meta(key,value) VALUES('menu_v',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(MENU_V);
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

/* ── защита кодов от брутфорса ── */
const pinLocks = new Map();
const lockKey = req => (req.headers['x-forwarded-for'] || req.ip || 'local') + ':staff';
function lockedSeconds(req) { const e = pinLocks.get(lockKey(req));
  return e && e.lockedUntil > Date.now() ? Math.ceil((e.lockedUntil - Date.now()) / 1000) : 0; }
function registerFail(req) { const k = lockKey(req);
  const e = pinLocks.get(k) || { fails: 0, streak: 0, lockedUntil: 0 };
  e.fails++;
  if (e.fails >= 5) { e.streak++; e.lockedUntil = Date.now() + 60000 * Math.pow(2, Math.min(e.streak - 1, 6)); e.fails = 0; }
  pinLocks.set(k, e); }
function safeEqual(a, b) { const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest(); return crypto.timingSafeEqual(ha, hb); }

/* ── guards по ролям ── */
function authUser(req) { const t = (req.header('Authorization') || '').replace('Bearer ', '');
  const row = db.prepare("SELECT * FROM tokens WHERE token=? AND kind='user'").get(t);
  return row ? db.prepare('SELECT * FROM customers WHERE id=?').get(row.ref) : null; }
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
function grant(cid, by) { const c = db.prepare('SELECT * FROM customers WHERE id=?').get(cid);
  if (!c) return null;
  c.stamps++; c.cups++;
  db.prepare('UPDATE customers SET stamps=?,cups=? WHERE id=?').run(c.stamps, c.cups, cid);
  addHist(cid, `Штамп ${c.stamps} из 10`, by);
  let ten = false;
  if (c.stamps >= 10) { c.stamps = 0; c.free++; ten = true;
    db.prepare('UPDATE customers SET stamps=?,free=? WHERE id=?').run(0, c.free, cid);
    addHist(cid, '🎉 10-й кофе — подарок начислен', 'Система'); }
  logEv(c.name, ten ? '10-й кофе — подарок начислен' : `+1 штамп → ${c.stamps} из 10`);
  const f = db.prepare('SELECT * FROM customers WHERE id=?').get(cid);
  return { customer: cust(f), ten, msg: ten ? '10-й штамп! Начислен бесплатный кофе' : `+1 штамп → ${f.stamps} из 10` }; }
function redeem(cid, by) { const c = db.prepare('SELECT * FROM customers WHERE id=?').get(cid);
  if (!c || c.free < 1) return null;
  db.prepare('UPDATE customers SET free=? WHERE id=?').run(c.free - 1, cid);
  addHist(cid, `🎁 Списан бесплатный кофе (осталось ${c.free - 1})`, by);
  logEv(c.name, 'Списан бесплатный кофе');
  return { customer: cust(db.prepare('SELECT * FROM customers WHERE id=?').get(cid)) }; }
function createCustomer(name, phone) { const p = fmtPhone(phone);
  if (String(name).trim().length < 2) return { err: 'Введите имя', code: 400 };
  if (ph10(p).length < 10) return { err: 'Введите номер полностью', code: 400 };
  if (db.prepare('SELECT 1 FROM customers WHERE phone=?').get(p)) return { err: 'exists', code: 409 };
  const id = uid('u'), qr = 'Z-' + crypto.randomBytes(3).toString('hex').toUpperCase();
  db.prepare('INSERT INTO customers (id,name,phone,stamps,free,cups,qr,created_at,role) VALUES (?,?,?,?,?,?,?,?,?)').run(id, name.trim(), p, 0, 0, 0, qr, nowISO(), 'guest');
  addHist(id, 'Профиль создан', 'Приложение');
  return { customer: cust(db.prepare('SELECT * FROM customers WHERE id=?').get(id)) }; }

const app = express();
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Staff');
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
    p.vol || '', String(p.price ?? '0'), p.tag || '', p.coffee ? 1 : 0, p.on ? 1 : 0, p.img || null);
  touch(); res.json({ ok: true, id: p.id });
});
app.put('/api/menu/:id', adminGuard, (req, res) => {
  const p = req.body;
  db.prepare('UPDATE menu SET cat=?,e=?,name=?,descr=?,comp=?,vol=?,price=?,tag=?,coffee=?,is_on=?,img=? WHERE id=?').run(
    p.cat, p.e || '☕', p.name || 'Без названия', p.desc || '', JSON.stringify(p.comp || []),
    p.vol || '', String(p.price ?? '0'), p.tag || '', p.coffee ? 1 : 0, p.on ? 1 : 0, p.img || null, req.params.id);
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
app.post('/api/auth/activate', userGuard, (req, res) => {
  const wait = lockedSeconds(req);
  if (wait > 0) return res.status(429).json({ error: `Слишком много попыток. Пауза ${wait} сек.` });
  const code = String(req.body.code || '').trim();
  let role = null;
  if (safeEqual(code, ADMIN_CODE)) role = 'admin';
  else if (safeEqual(code, CASHIER_CODE)) role = 'cashier';
  if (!role) { registerFail(req); return res.status(403).json({ error: 'Неверный код доступа' }); }
  pinLocks.delete(lockKey(req));
  db.prepare('UPDATE customers SET role=? WHERE id=?').run(role, req.user.id);
  addHist(req.user.id, role === 'admin' ? '🔓 Выдан доступ администратора' : '🧾 Выдан доступ кассира', 'Система');
  logEv(req.user.name, role === 'admin' ? 'активирован админ' : 'активирован кассир');
  res.json({ customer: cust(db.prepare('SELECT * FROM customers WHERE id=?').get(req.user.id)) });
});
app.post('/api/auth/deactivate', userGuard, (req, res) => {
  if (req.user.role === 'admin') {
    const n = db.prepare("SELECT COUNT(*) as c FROM customers WHERE role='admin'").get().c;
    if (n <= 1) return res.status(403).json({ error: 'Нельзя отключить последнего администратора' });
  }
  db.prepare("UPDATE customers SET role='guest' WHERE id=?").run(req.user.id);
  addHist(req.user.id, 'Права сотрудника отключены', 'Система');
  res.json({ customer: cust(db.prepare('SELECT * FROM customers WHERE id=?').get(req.user.id)) });
});
app.post('/api/exit', userGuard, (req, res) => {
  const t = (req.header('Authorization') || '').replace('Bearer ', '');
  db.prepare('DELETE FROM tokens WHERE token=?').run(t); res.json({ ok: true });
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

/* ── кассир ── */
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