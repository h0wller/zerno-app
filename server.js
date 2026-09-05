import express from 'express';
import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import webpush from 'web-push';
import { initializeApp, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
let fcmReady = false;

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
const mcols = db.prepare('PRAGMA table_info(chat_meta)').all().map(c => c.name);
if (mcols.length && !mcols.includes('staff_in')) db.exec('ALTER TABLE chat_meta ADD COLUMN staff_in INTEGER DEFAULT 0');
const tcols = db.prepare('PRAGMA table_info(customers)').all().map(c => c.name);
if (tcols.length && !tcols.includes('tg')) db.exec('ALTER TABLE customers ADD COLUMN tg TEXT');
if (tcols.length && !tcols.includes('pin')) db.exec("ALTER TABLE customers ADD COLUMN pin TEXT DEFAULT ''");
/* ── VAPID-ключи для пушей (создаются один раз) ── */
let vapidRow = db.prepare("SELECT value FROM meta WHERE key='vapid'").get();
if (!vapidRow) {
  const keys = webpush.generateVAPIDKeys();
  db.prepare("INSERT INTO meta(key,value) VALUES('vapid',?)").run(JSON.stringify(keys));
  vapidRow = { value: JSON.stringify(keys) };
}
const VAPID = JSON.parse(vapidRow.value);
webpush.setVapidDetails('mailto:hello@andcoffee.online', VAPID.publicKey, VAPID.privateKey);
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
async function tgSend(chatId, text) {
  if (!TG_TOKEN) return;
  try { await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }) }); } catch (e) {}
}
async function sendTg(cid, title, body) {
  const c = db.prepare('SELECT tg FROM customers WHERE id=?').get(cid);
  if (c && c.tg) await tgSend(c.tg, `${title}\n${body}`);
}
const SMS_API = process.env.SMSRU_API_ID || '';
async function sendSms(phone, text) {
  if (!SMS_API) { console.log('[DEV SMS]', phone, text); return; }
  try { await fetch(`https://sms.ru/sms/send?api_id=${SMS_API}&to=7${ph10(phone)}&text=${encodeURIComponent(text)}&json=1`); } catch (e) {}
}
/* ── FCM для нативного приложения ── */
if (process.env.FIREBASE_SA) {
  try { initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SA)) }); fcmReady = true; }
  catch (e) { console.log('FCM init error', e.message); }
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
const hashPin = p => crypto.createHash('sha256').update('pin:' + String(p)).digest('hex');
const otpStore = new Map(); // phone -> {code, expires}
const item = r => ({ id: r.id, cat: r.cat, e: r.e, name: r.name, desc: r.descr,
  comp: JSON.parse(r.comp || '[]'), vol: r.vol, price: r.price, tag: r.tag,
  coffee: r.coffee, on: r.is_on, img: r.img });
const cust = c => ({ id: c.id, name: c.name, phone: c.phone, stamps: c.stamps, free: c.free,
  cups: c.cups, qr: c.qr, role: c.role || 'guest',
  history: db.prepare('SELECT ts,a,by FROM history WHERE cid=? ORDER BY id DESC LIMIT 10').all(c.id) });
const addHist = (cid, a, by) => db.prepare('INSERT INTO history(cid,ts,a,by) VALUES(?,?,?,?)').run(cid, nowISO(), a, by);
const logEv = (w, a) => { const d = new Date(); const pad = n => String(n).padStart(2, '0');
  db.prepare('INSERT INTO events(t,w,a) VALUES(?,?,?)')
  .run(`${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`, w, a); };
const getMeta = () => db.prepare("SELECT value FROM meta WHERE key='updatedAt'").get()?.value || nowISO();
const touch = () => db.prepare("INSERT INTO meta(key,value) VALUES('updatedAt',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(nowISO());
const issueToken = ref => { const t = crypto.randomUUID();
  db.prepare('INSERT INTO tokens(token,kind,ref,ts) VALUES(?,?,?,?)').run(t, 'user', ref, nowISO()); return t; };

/* ── защита кодов от брутфорса ── */
const pinLocks = new Map();
const lockKey = (req, tag = 'staff') => (req.headers['x-forwarded-for'] || req.ip || 'local') + ':' + tag;
function lockedSeconds(req, tag = 'staff') { const e = pinLocks.get(lockKey(req, tag));
return e && e.lockedUntil > Date.now() ? Math.ceil((e.lockedUntil - Date.now()) / 1000) : 0; }
function registerFail(req, tag = 'staff') { const k = lockKey(req, tag);
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
  if (ten) sendPush(cid, '🎁 Бесплатный кофе ждёт вас!', 'Вы собрали 10 штампов. Заходите — кофе за наш счёт.');
  else if (f.stamps === 9) sendPush(cid, '☕ Осталась одна чашка!', 'У вас 9 из 10 штампов. Следующий кофе — бесплатно 😉');
  return { customer: cust(f), ten, msg: ten ? '10-й штамп! Начислен бесплатный кофе' : `+1 штамп → ${f.stamps} из 10` }; }
function redeem(cid, by) { const c = db.prepare('SELECT * FROM customers WHERE id=?').get(cid);
  if (!c || c.free < 1) return null;
  db.prepare('UPDATE customers SET free=? WHERE id=?').run(c.free - 1, cid);
  addHist(cid, `🎁 Списан бесплатный кофе (осталось ${c.free - 1})`, by);
  logEv(c.name, 'Списан бесплатный кофе');
  return { customer: cust(db.prepare('SELECT * FROM customers WHERE id=?').get(cid)) }; }
function createCustomer(name, phone, pin) { const p = fmtPhone(phone);
if (String(name).trim().length < 2) return { err: 'Введите имя', code: 400 };
if (ph10(p).length < 10) return { err: 'Введите номер полностью', code: 400 };
if (pin !== undefined && !/^\d{4}$/.test(String(pin))) return { err: 'PIN — ровно 4 цифры', code: 400 };
if (db.prepare('SELECT 1 FROM customers WHERE phone=?').get(p)) return { err: 'exists', code: 409 };
const id = uid('u'), qr = 'Z-' + crypto.randomBytes(3).toString('hex').toUpperCase();
db.prepare('INSERT INTO customers (id,name,phone,stamps,free,cups,qr,created_at,role,pin) VALUES (?,?,?,?,?,?,?,?,?,?)')
.run(id, name.trim(), p, 0, 0, 0, qr, nowISO(), 'guest', pin ? hashPin(pin) : '');
addHist(id, 'Профиль создан', 'Приложение');
return { customer: cust(db.prepare('SELECT * FROM customers WHERE id=?').get(id)) }; }

const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https: blob:; connect-src 'self'; manifest-src 'self'; worker-src 'self'");
  next();
});
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
app.post('/api/auth/request-reg-otp', (req, res) => {
  const p = fmtPhone(req.body.phone || '');
  const via = req.body.via === 'tg' ? 'tg' : 'sms';
  if (ph10(p).length < 10) return res.status(400).json({ error: 'Введите номер полностью' });
  if (db.prepare('SELECT 1 FROM customers WHERE phone=?').get(p)) return res.status(409).json({ error: 'Номер уже зарегистрирован — войдите' });
  const wait = lockedSeconds(req, 'reg');
  if (wait > 0) return res.status(429).json({ error: `Слишком часто. Пауза ${wait} сек.` });
  if (via === 'tg') {
    const token = crypto.randomBytes(6).toString('hex');
    otpStore.set('regtg:' + token, { phone: p, expires: Date.now() + 10 * 60 * 1000 });
    otpStore.set('reg:' + p, { code: null, confirmed: false, expires: Date.now() + 10 * 60 * 1000 });
    return res.json({ ok: true, tgUrl: `https://t.me/and_coffee_bot?start=reg_${token}` });
  }
  const st = otpStore.get('reg:' + p);
  if (st && Date.now() - (st.lastSent || 0) < 60000) return res.status(429).json({ error: 'Код уже отправлен — повтор через минуту' });
  if (st && st.sent >= 5) return res.status(429).json({ error: 'Слишком много отправок — попробуйте позже' });
  const code = String(Math.floor(1000 + Math.random() * 9000));
  otpStore.set('reg:' + p, { code, expires: Date.now() + 5 * 60 * 1000, sent: (st ? st.sent : 0) + 1, lastSent: Date.now() });
  sendSms(p, `…и кофе 🌊 Код регистрации: ${code}`);
  res.json({ ok: true });
});
app.get('/api/auth/check-reg', (req, res) => {
  const p = fmtPhone(req.query.phone || '');
  const st = otpStore.get('reg:' + p);
  res.json({ confirmed: !!(st && st.confirmed && Date.now() < st.expires) });
});
/* ── аккаунты ── */
app.post('/api/auth/register', (req, res) => {
const p = fmtPhone(req.body.phone || '');
const code = String(req.body.code || '').trim();
const st = otpStore.get('reg:' + p);
const okTg = !!(st && st.confirmed && Date.now() < st.expires);
const okSms = !!(st && st.code && code && st.code === code && Date.now() < st.expires);
if (!okTg && !okSms && SMS_API) return res.status(403).json({ error: 'Подтвердите номер через Telegram или кодом из SMS' });
if (okSms) pinLocks.delete(lockKey(req, 'reg'));
const tgChat = okTg ? (st.tgChat || null) : null;
if (okTg || okSms) otpStore.delete('reg:' + p);
const r = createCustomer(req.body.name || '', req.body.phone || '', req.body.pin || '');
if (r.err) return res.status(r.code).json({ error: r.err });
if (tgChat) { db.prepare('UPDATE customers SET tg=? WHERE id=?').run(tgChat, r.customer.id);
  addHist(r.customer.id, 'Telegram привязан при регистрации', 'Система'); }
res.json({ token: issueToken(r.customer.id), customer: cust(db.prepare('SELECT * FROM customers WHERE id=?').get(r.customer.id)) });
});

app.post('/api/auth/login', (req, res) => {
const p = fmtPhone(req.body.phone || '');
const pin = String(req.body.pin || '').trim();
const otp = String(req.body.otp || '').trim();
const c = db.prepare('SELECT * FROM customers WHERE phone=?').get(p);
if (!c) return res.status(404).json({ error: 'Профиль не найден — создайте новый' });
const wait = lockedSeconds(req, 'login');
if (wait > 0) return res.status(429).json({ error: `Слишком много попыток. Пауза ${wait} сек.` });
if (otp) {
 const st = otpStore.get(p);
 if (!st || Date.now() > st.expires) return res.status(403).json({ error: 'Код просрочен — запросите новый' });
 if (st.code !== otp) { registerFail(req, 'login'); return res.status(403).json({ error: 'Неверный код' }); }
 otpStore.delete(p); pinLocks.delete(lockKey(req, 'login'));
 addHist(c.id, 'Вход по коду из Telegram', 'Приложение');
 return res.json({ token: issueToken(c.id), customer: cust(c), needPin: !c.pin });
}
if (!c.pin) {
 if (!pin) return res.status(409).json({ error: 'PIN ещё не задан — придумайте его', setup: true });
 if (!/^\d{4}$/.test(pin)) return res.status(400).json({ error: 'PIN — ровно 4 цифры' });
 db.prepare('UPDATE customers SET pin=? WHERE id=?').run(hashPin(pin), c.id);
 addHist(c.id, 'Задан PIN (первый вход)', 'Приложение');
 return res.json({ token: issueToken(c.id), customer: cust(db.prepare('SELECT * FROM customers WHERE id=?').get(c.id)) });
}
if (!pin) return res.status(400).json({ error: 'Введите PIN' });
if (hashPin(pin) !== c.pin) { registerFail(req, 'login'); return res.status(403).json({ error: 'Неверный PIN' }); }
pinLocks.delete(lockKey(req, 'login'));
addHist(c.id, 'Вход по PIN', 'Приложение');
res.json({ token: issueToken(c.id), customer: cust(c) });
});
app.post('/api/auth/setup-pin', (req, res) => {
const p = fmtPhone(req.body.phone || '');
const pin = String(req.body.pin || '').trim();
if (!/^\d{4}$/.test(pin)) return res.status(400).json({ error: 'PIN — ровно 4 цифры' });
const c = db.prepare('SELECT * FROM customers WHERE phone=?').get(p);
if (!c) return res.status(404).json({ error: 'Профиль не найден' });
if (c.pin) return res.status(403).json({ error: 'PIN уже задан — входите с ним' });
db.prepare('UPDATE customers SET pin=? WHERE id=?').run(hashPin(pin), c.id);
addHist(c.id, 'Задан PIN (первый вход)', 'Приложение');
res.json({ token: issueToken(c.id), customer: cust(db.prepare('SELECT * FROM customers WHERE id=?').get(c.id)) });
});
app.post('/api/auth/set-pin', userGuard, (req, res) => {
const pin = String(req.body.pin || '').trim();
if (!/^\d{4}$/.test(pin)) return res.status(400).json({ error: 'PIN — ровно 4 цифры' });
db.prepare('UPDATE customers SET pin=? WHERE id=?').run(hashPin(pin), req.user.id);
addHist(req.user.id, 'Задан новый PIN', 'Приложение');
res.json({ customer: cust(db.prepare('SELECT * FROM customers WHERE id=?').get(req.user.id)) });
});
app.post('/api/auth/request-otp', (req, res) => {
const p = fmtPhone(req.body.phone || '');
const c = db.prepare('SELECT * FROM customers WHERE phone=?').get(p);
if (!c) return res.status(404).json({ error: 'Профиль не найден' });
if (!c.tg) return res.status(400).json({ error: 'Telegram не привязан — войдите по PIN' });
const wait = lockedSeconds(req, 'login');
if (wait > 0) return res.status(429).json({ error: `Слишком часто. Пауза ${wait} сек.` });
const code = String(Math.floor(1000 + Math.random() * 9000));
otpStore.set(p, { code, expires: Date.now() + 5 * 60 * 1000 });
tgSend(c.tg, `🔑 Код для входа в приложение: ${code}\nДействует 5 минут. Никому не сообщайте!`);
res.json({ ok: true });
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
/* ── промокоды ── */
app.post('/api/promo/redeem', userGuard, (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase();
  if (!code) return res.status(400).json({ error: 'Введите промокод' });
  const p = db.prepare('SELECT * FROM promos WHERE code=?').get(code);
  if (!p || !p.active) return res.status(404).json({ error: 'Такого промокода нет' });
  if (p.expires && new Date(p.expires) < new Date()) return res.status(410).json({ error: 'Промокод истёк' });
  if (p.maxuses > 0 && p.uses >= p.maxuses) return res.status(410).json({ error: 'Промокод закончился' });
  if (db.prepare('SELECT 1 FROM promo_use WHERE promo=? AND cid=?').get(p.id, req.user.id))
    return res.status(409).json({ error: 'Вы уже использовали этот промокод' });
  db.prepare('INSERT INTO promo_use(promo,cid,ts) VALUES(?,?,?)').run(p.id, req.user.id, nowISO());
  db.prepare('UPDATE promos SET uses=uses+1 WHERE id=?').run(p.id);
  if (p.kind === 'stamp') { for (let i = 0; i < (p.value || 1); i++) grant(req.user.id, 'Промокод ' + p.code); }
  else { db.prepare('UPDATE customers SET free=free+? WHERE id=?').run(p.value || 1, req.user.id);
    addHist(req.user.id, `🎁 Промокод ${p.code}: +${p.value || 1} бесплатный кофе`, 'Система'); }
  logEv(req.user.name, `промокод ${p.code}`);
  res.json({ customer: cust(db.prepare('SELECT * FROM customers WHERE id=?').get(req.user.id)),
    msg: p.kind === 'stamp' ? `Промокод дал +${p.value || 1} штамп(а)` : 'Промокод дал бесплатный кофе' });
});
app.get('/api/promos', adminGuard, (req, res) =>
  res.json({ promos: db.prepare('SELECT * FROM promos ORDER BY created DESC').all() }));
app.post('/api/promos', adminGuard, (req, res) => {
  const b = req.body;
  const code = String(b.code || '').trim().toUpperCase().replace(/\s+/g, '');
  if (code.length < 3) return res.status(400).json({ error: 'Код слишком короткий' });
  if (db.prepare('SELECT 1 FROM promos WHERE code=?').get(code)) return res.status(409).json({ error: 'Такой код уже есть' });
  const expires = b.days ? new Date(Date.now() + b.days * 86400000).toISOString() : null;
  db.prepare('INSERT INTO promos(id,code,kind,value,active,expires,maxuses,uses,created) VALUES(?,?,?,?,1,?,?,0,?)')
    .run(uid('pr'), code, b.kind || 'stamp', Math.max(1, +(b.value || 1)), expires, +(b.maxuses || 0), nowISO());
  res.json({ ok: true });
});
app.post('/api/promos/:id/toggle', adminGuard, (req, res) => {
  db.prepare('UPDATE promos SET active=1-active WHERE id=?').run(req.params.id); res.json({ ok: true });
});
app.delete('/api/promos/:id', adminGuard, (req, res) => {
  db.prepare('DELETE FROM promos WHERE id=?').run(req.params.id); res.json({ ok: true });
});
/* ── дашборд владельца ── */
app.get('/api/stats', adminGuard, (req, res) => {
  const dayStart = new Date(); dayStart.setHours(0,0,0,0);
  const ds = dayStart.toISOString();
  const weekAgo = new Date(Date.now()-7*86400000).toISOString();
  const monthAgo = new Date(Date.now()-30*86400000).toISOString();
  const total = db.prepare('SELECT COUNT(*) c FROM customers').get().c;
  const newWeek = db.prepare('SELECT COUNT(*) c FROM customers WHERE created_at>?').get(weekAgo).c;
  const newMonth = db.prepare('SELECT COUNT(*) c FROM customers WHERE created_at>?').get(monthAgo).c;
  const stampsToday = db.prepare("SELECT COUNT(*) c FROM history WHERE a LIKE 'Штамп%' AND ts>?").get(ds).c;
  const stampsWeek = db.prepare("SELECT COUNT(*) c FROM history WHERE a LIKE 'Штамп%' AND ts>?").get(weekAgo).c;
  const stampsMonth = db.prepare("SELECT COUNT(*) c FROM history WHERE a LIKE 'Штамп%' AND ts>?").get(monthAgo).c;
  const redeemed = db.prepare("SELECT COUNT(*) c FROM history WHERE a LIKE '🎁 Списан%' AND ts>?").get(monthAgo).c;
  const returning = db.prepare('SELECT COUNT(*) c FROM customers WHERE cups>=2').get().c;
  const avgCups = Math.round((db.prepare('SELECT AVG(cups) a FROM customers').get().a||0)*10)/10;
  const promoUses = db.prepare('SELECT COUNT(*) c FROM promo_use').get().c;
  const days = [];
  for (let i=13;i>=0;i--) {
    const d = new Date(Date.now()-i*86400000);
    const start = new Date(d.getFullYear(),d.getMonth(),d.getDate()).toISOString();
    const end = new Date(d.getFullYear(),d.getMonth(),d.getDate()+1).toISOString();
    days.push({ label: d.getDate()+'.'+(d.getMonth()+1),
      c: db.prepare("SELECT COUNT(*) c FROM history WHERE a LIKE 'Штамп%' AND ts>=? AND ts<?").get(start,end).c });
  }
  res.json({ total,newWeek,newMonth,stampsToday,stampsWeek,stampsMonth,redeemed,returning,avgCups,promoUses,days });
});
/* ── пуш-уведомления ── */
app.get('/api/vapid', (req, res) => res.json({ publicKey: VAPID.publicKey }));
app.post('/api/push/subscribe', userGuard, (req, res) => {
  const sub = req.body.sub;
  if (!sub || !sub.endpoint) return res.status(400).json({ error: 'bad sub' });
  const s = JSON.stringify(sub);
  const existed = db.prepare('SELECT 1 FROM subs WHERE cid=? AND sub=?').get(req.user.id, s);
  db.prepare('INSERT OR IGNORE INTO subs(cid,sub,created) VALUES(?,?,?)').run(req.user.id, s, nowISO());
  if (!existed) sendPush(req.user.id, '🔔 Уведомления подключены', 'Теперь сообщим о штампах и бесплатном кофе!');
  res.json({ ok: true });
});
async function sendFcm(cid, title, body) {
  try {
    if (!fcmReady) return;
    const messaging = getMessaging();
    const rows = db.prepare('SELECT token FROM fcm WHERE cid=?').all(cid);
    for (const r of rows) {
      try { await messaging.send({ token: r.token, notification: { title, body } }); }
      catch (e) { if (String(e.code || '').includes('registration-token')) db.prepare('DELETE FROM fcm WHERE token=?').run(r.token); }
    }
  } catch (e) { console.log('FCM send error', e.message); }
}
async function sendPush(cid, title, body) {
  sendFcm(cid, title, body).catch(() => {});
  sendTg(cid, title, body).catch(() => {});
  const rows = db.prepare('SELECT sub FROM subs WHERE cid=?').all(cid);
  for (const r of rows) {
    try { await webpush.sendNotification(JSON.parse(r.sub), JSON.stringify({ title, body })); }
    catch (e) { if (e.statusCode === 404 || e.statusCode === 410) db.prepare('DELETE FROM subs WHERE sub=?').run(r.sub); }
  }
}
app.post('/api/push/fcm', userGuard, (req, res) => {
  const token = String(req.body.token || '');
  if (!token) return res.status(400).json({ error: 'bad token' });
  db.prepare('INSERT OR IGNORE INTO fcm(cid,token,created) VALUES(?,?,?)').run(req.user.id, token, nowISO());
  res.json({ ok: true });
});
app.get('/api/push/subs', adminGuard, (req, res) => {
  const subs = db.prepare(`SELECT s.created, s.cid, c.name, c.phone FROM subs s LEFT JOIN customers c ON c.id=s.cid ORDER BY s.id DESC`).all();
  const tg = db.prepare(`SELECT created_at AS created, id AS cid, name, phone FROM customers WHERE tg IS NOT NULL AND tg != '' ORDER BY created_at DESC`).all();
  res.json({ subs, tg });
});
app.post('/api/push/send', adminGuard, async (req, res) => {
  const body = req.body.body || '';
  const cids = db.prepare("SELECT cid FROM subs UNION SELECT id FROM customers WHERE tg IS NOT NULL AND tg != ''").all();
  for (const c of cids) await sendPush(c.cid, '…и кофе 🌊', body);
  logEv(req.user.name, `пуш всем (${cids.length})`);
  res.json({ ok: true, sent: cids.length });
});
/* ── чат гость ↔ стафф ── */
app.post('/api/chat/send', (req, res) => {
  const key = String(req.body.key || '').slice(0, 64);
  const text = String(req.body.text || '').slice(0, 2000);
  if (!key || !text) return res.status(400).json({ error: 'bad request' });
  const isUser = !!db.prepare('SELECT 1 FROM customers WHERE id=?').get(key);
const human = req.body.human && isUser ? 1 : 0;
db.prepare('INSERT INTO chat(key,who,text,ts,human,read_s) VALUES(?,?,?,?,?,0)')
.run(key, 'guest', text, nowISO(), human);
db.prepare('INSERT INTO chat_meta(key,closed) VALUES(?,0) ON CONFLICT(key) DO UPDATE SET closed=0').run(key);
if (human) {
    const staff = db.prepare("SELECT id FROM customers WHERE role IN ('cashier','admin')").all();
    for (const s of staff) sendPush(s.id, '💬 Новый вопрос гостя', text.slice(0, 80));
  }
  res.json({ ok: true });
});
app.post('/api/chat/botlog', (req, res) => {
  const key = String(req.body.key || '').slice(0, 64);
  const text = String(req.body.text || '').slice(0, 2000);
  if (!key || !text) return res.status(400).json({ error: 'bad request' });
  db.prepare('INSERT INTO chat(key,who,text,ts,read_s) VALUES(?,?,?,?,0)').run(key, 'bot', text, nowISO());
  res.json({ ok: true });
});
app.get('/api/chat/thread', (req, res) => {
  const key = String(req.query.key || '').slice(0, 64);
  const after = +(req.query.after || 0);
  res.json({ msgs: db.prepare('SELECT id,who,text,ts FROM chat WHERE key=? AND id>? ORDER BY id').all(key, after) });
});
app.get('/api/chat/list', staffGuard, (req, res) => {
  const showClosed = req.query.closed === '1';
  const rows = db.prepare(`SELECT c.key, MAX(c.id) mid,
    SUM(CASE WHEN c.who='guest' AND c.read_s=0 THEN 1 ELSE 0 END) unread,
    IFNULL(m.closed,0) closed, IFNULL(m.staff_in,0) staff_in,
    (SELECT g.human FROM chat g WHERE g.key=c.key AND g.who='guest' ORDER BY g.id DESC LIMIT 1) human
    FROM chat c LEFT JOIN chat_meta m ON m.key=c.key
    GROUP BY c.key ORDER BY mid DESC LIMIT 50`).all();
  res.json({ threads: rows.filter(r => showClosed ? r.closed : (!r.closed && (r.human || r.staff_in))).map(r => {
    const c = db.prepare('SELECT name FROM customers WHERE id=?').get(r.key);
    return { key: r.key, name: c ? c.name : 'Гость', unread: r.unread, human: r.human };
  }) });
});
app.get('/api/chat/dialog', staffGuard, (req, res) => {
  const key = String(req.query.key || '').slice(0, 64);
  db.prepare("UPDATE chat SET read_s=1 WHERE key=? AND who='guest'").run(key);
  const meta = db.prepare('SELECT staff_in FROM chat_meta WHERE key=?').get(key);
if (!meta || !meta.staff_in) {
  db.prepare('INSERT INTO chat_meta(key,closed,staff_in) VALUES(?,0,1) ON CONFLICT(key) DO UPDATE SET staff_in=1').run(key);
  db.prepare('INSERT INTO chat(key,who,text,ts,read_g) VALUES(?,?,?,?,0)').run(key, 'system', '👋 Сотрудник подключился к чату — бот Ника отдыхает', nowISO());
} 
  res.json({ msgs: db.prepare('SELECT id,who,text,ts FROM chat WHERE key=? ORDER BY id').all(key) });
});
app.post('/api/chat/reply', staffGuard, (req, res) => {
  const key = String(req.body.key || '').slice(0, 64);
  const text = String(req.body.text || '').slice(0, 2000);
  if (!key || !text) return res.status(400).json({ error: 'bad request' });
  db.prepare('INSERT INTO chat(key,who,text,ts,read_g) VALUES(?,?,?,?,0)').run(key, 'staff', text, nowISO());
  if (!key.startsWith('anon-')) sendPush(key, '💬 Вам ответили из «…и кофе»', text.slice(0, 80));
  res.json({ ok: true });
});
app.post('/api/chat/close', staffGuard, (req, res) => {
  const key = String(req.body.key || '').slice(0, 64);
  db.prepare('INSERT INTO chat_meta(key,closed,staff_in) VALUES(?,1,0) ON CONFLICT(key) DO UPDATE SET closed=1, staff_in=0').run(key);
  db.prepare('INSERT INTO chat(key,who,text,ts,read_g) VALUES(?,?,?,?,0)').run(key, 'system', '✅ Чат закрыт. Бот Ника снова на связи.', nowISO());
  res.json({ ok: true });
});
app.post('/api/chat/open', staffGuard, (req, res) => {
  db.prepare('INSERT INTO chat_meta(key,closed) VALUES(?,0) ON CONFLICT(key) DO UPDATE SET closed=0').run(String(req.body.key || '').slice(0, 64));
  res.json({ ok: true });
});
app.post('/api/push/unsubscribe', userGuard, (req, res) => {
  db.prepare('DELETE FROM subs WHERE cid=?').run(req.user.id);
  res.json({ ok: true });
});
app.post('/api/push/del', adminGuard, (req, res) => {
  db.prepare('DELETE FROM subs WHERE cid=?').run(String(req.body.cid || ''));
  res.json({ ok: true });
});
/* ── telegram-бот ── */
app.post('/api/tg/webhook', (req, res) => {
  const u = req.body; res.json({ ok: true });
  if (!u || !u.message) return;
  const chatId = String(u.message.chat.id);
  const text = String(u.message.text || '').trim();
  if (text.startsWith('/start reg_')) {
  const token = text.slice(11).trim();
  const st = otpStore.get('regtg:' + token);
  if (!st || Date.now() > st.expires) { tgSend(chatId, 'Ссылка для подтверждения устарела 😔 Нажми «Подтвердить в Telegram» в приложении ещё раз.'); return; }
  otpStore.set('regchat:' + chatId, { token, phone: st.phone, expires: Date.now() + 10 * 60 * 1000 });
  fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text: `Подтверждаю номер ${fmtPhone(st.phone)} — нажмите кнопку ниже 👇`, reply_markup: { keyboard: [[{ text: '📱 Поделиться номером', request_contact: true }]], resize_keyboard: true } }) }).catch(() => {});
  return;
}
  if (text === '/start') {
    tgSend(chatId, 'Привет! Я бот кофейни «…и кофе» 🌊\n\nПривяжите профиль — и штампы, подарки и акции будут приходить прямо сюда.\n\nНажмите кнопку «Поделиться номером» 👇');
    fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text: '📱', reply_markup: { keyboard: [[{ text: '📱 Поделиться номером', request_contact: true }]], resize_keyboard: true } }) }).catch(() => {});
    return;
  }
  if (u.message.contact) {
  const pend = otpStore.get('regchat:' + chatId);
  if (pend && Date.now() < pend.expires) {
    if (fmtPhone(u.message.contact.phone_number) === fmtPhone(pend.phone)) {
      otpStore.set('reg:' + fmtPhone(pend.phone), { code: null, confirmed: true, tgChat: chatId, expires: Date.now() + 10 * 60 * 1000 });
      otpStore.delete('regchat:' + chatId); otpStore.delete('regtg:' + pend.token);
      tgSend(chatId, '✅ Номер подтверждён! Вернитесь в приложение и завершите регистрацию.');
    } else {
      tgSend(chatId, 'Номер не совпадает с указанным в приложении 😕 Нажмите кнопку ещё раз.');
    }
    return;
  }
}
  const phone = u.message.contact ? u.message.contact.phone_number : text;
  const c = db.prepare('SELECT * FROM customers WHERE phone=?').get(fmtPhone(phone));
  if (c) {
    db.prepare('UPDATE customers SET tg=? WHERE id=?').run(chatId, c.id);
    tgSend(chatId, `✅ Готово, ${c.name}! Профиль привязан.\nТеперь о штампах и бесплатном кофе я напишу сюда ☕`);
  } else if (u.message.contact) {
    tgSend(chatId, 'Профиль с таким номером не найден 😔 Создайте его в приложении и нажмите «Поделиться номером» ещё раз.');
  } else {
    tgSend(chatId, 'Я бот кофейни «…и кофе» 🌊 Нажмите /start, чтобы привязать профиль и получать бонусы.');
  }
});
/* ── статика ── */
app.use(express.static(PUBLIC_DIR));
app.listen(PORT, () => console.log(`☕ ЗЕРНО API запущен на порту ${PORT}`));