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
const DISPATCH_CODE = process.env.DISPATCH_CODE || '5719';
const PUBLIC_DIR = process.env.PUBLIC_DIR || path.join(__dirname, 'public');
const WEBAPP_URL = (process.env.WEBAPP_URL || process.env.PUBLIC_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? 'https://' + process.env.RAILWAY_PUBLIC_DOMAIN : '')).replace(/\/+$/, '');

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
  const ins = db.prepare('INSERT INTO menu(id,cat,e,name,descr,comp,vol,price,tag,coffee,is_on,img) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)');
  for (const p of seed) ins.run(p[0],p[1],p[2],p[3],p[4],JSON.stringify(p[5]),p[6],p[7],p[8],p[9],1,null);
  db.prepare("INSERT INTO meta(key,value) VALUES('menu_v',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(MENU_V);
}
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

  const DMENU_V = '1';
if (db.prepare("SELECT value FROM meta WHERE key='dmenu_v'").get()?.value !== DMENU_V) {
  db.exec(`DELETE FROM menu WHERE section='delivery'`);
  const P = (a,b,c,d) => JSON.stringify([
    {l:'25 см, пышное', w:a[0]+' г', p:a[1], sz:25},
    {l:'35 см, пышное', w:b[0]+' г', p:b[1], sz:35},
    {l:'25 см, тонкое', w:c[0]+' г', p:c[1], sz:25},
    {l:'35 см, тонкое', w:d[0]+' г', p:d[1], sz:35}]);
  const dz = [
   ['pz-marg','Маргарита','Красный соус, моцарелла',['красный соус','моцарелла'],[415,535],[750,735],[335,435],[550,635]],
   ['pz-hamgr','Ветчина и грибы','Белый соус, моцарелла, шампиньоны, ветчина, чеддер',['белый соус','моцарелла','шампиньоны','ветчина','чеддер'],[545,745],[990,1095],[465,645],[790,995]],
   ['pz-veg','Овощная','Песто, баклажаны, цукини, перец, помидоры черри, брокколи, руккола',['песто','баклажаны','цукини','перец','черри','брокколи','руккола'],[485,635],[870,935],[405,535],[670,835]],
   ['pz-cheese','Сырная','Белый соус, моцарелла, чеддер, камамбер',['белый соус','моцарелла','чеддер','камамбер'],[500,845],[850,1145],[420,745],[650,1045]],
   ['pz-hamsal','Ветчина-салями','Красный соус, моцарелла, салями, ветчина, перец, руккола',['красный соус','моцарелла','салями','ветчина','перец','руккола'],[470,790],[860,1090],[390,690],[660,990]],
   ['pz-bacon','С беконом','Белый соус, моцарелла, шампиньоны, бекон, маринованный огурец, красный лук',['белый соус','моцарелла','шампиньоны','бекон','огурец','лук'],[510,740],[930,1140],[430,640],[730,1040]],
   ['pz-tuna','С тунцом','Белый соус, моцарелла, тунец, болгарский перец, чеддер',['белый соус','моцарелла','тунец','перец','чеддер'],[470,760],[880,1130],[390,660],[660,1030]],
   ['pz-chickgr','С курицей и грибами','Белый соус, моцарелла, маринованная курица, шампиньоны, руккола',['белый соус','моцарелла','курица','шампиньоны','руккола'],[540,740],[980,1040],[435,640],[780,940]],
   ['pz-farsh','С фаршем','Белый соус, моцарелла, помидоры, фарш говяжий, огурец, красный лук, чеддер',['белый соус','моцарелла','помидоры','фарш','огурец','лук','чеддер'],[545,840],[1000,1240],[465,740],[800,1140]],
   ['pz-pep','Пепперони','Красный соус, моцарелла, пепперони, халапеньо, руккола',['красный соус','моцарелла','пепперони','халапеньо','руккола'],[470,790],[840,1090],[390,690],[640,990]],
   ['pz-mush','Грибная','Белый соус, моцарелла, шампиньоны, руккола',['белый соус','моцарелла','шампиньоны','руккола'],[515,770],[930,1070],[435,670],[730,970]],
   ['pz-chickpine','С курицей и ананасами','Белый соус, моцарелла, маринованная курица, ананас, руккола',['белый соус','моцарелла','курица','ананас','руккола'],[540,750],[980,1060],[460,650],[780,960]],
  ];
  const insD = db.prepare(`INSERT INTO menu(id,section,cat,e,name,descr,comp,vol,price,tag,coffee,is_on,img,opts) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (const z of dz) insD.run(z[0],'delivery','pizza','🍕',z[1],z[2],JSON.stringify(z[3]),'25/35 см','0','',0,1,null,P(z[4],z[5],z[6],z[7]));
  const simple = [
   ['rl-hos-og','Хосомаки с огурцом','rolls','🍣',['рис','нори','огурец','микрозелень'],'150 г','220'],
   ['rl-hos-ls','Хосомаки с лососем','rolls','🍣',['рис','нори','лосось','микрозелень'],'150 г','370'],
   ['rl-hos-tn','Хосомаки с тунцом','rolls','🍣',['рис','нори','тунец','огурец','микрозелень'],'160 г','370'],
   ['rl-hos-kr','Хосомаки с креветкой','rolls','🍣',['рис','нори','креветка','кимчи','микрозелень'],'150 г','370'],
   ['rl-phil-og','Филадельфия с огурцом','rolls','🍣',['рис','нори','сливочный сыр','огурец','лосось','микрозелень'],'250 г','650'],
   ['rl-phil-sliv','Филадельфия сливочная','rolls','🍣',['рис','нори','сливочный сыр','лосось','микрозелень'],'250 г','650'],
   ['rl-calif','Калифорния с креветкой','rolls','🍣',['рис','нори','сливочный сыр','огурец','креветка','кимчи','суари'],'250 г','620'],
   ['rl-phil-tn','Филадельфия с тунцом','rolls','🍣',['рис','нори','сливочный сыр','огурец','тунец','кунжутный соус'],'260 г','660'],
   ['rl-smoke-ch','С копчёной курицей','rolls','🍣',['рис','нори','сливочный сыр','курица в/к','огурец','перец','кунжут'],'240 г','530'],
   ['rl-bonito','Бонито','rolls','🍣',['рис','нори','тунец','огурец','стружка тунца'],'210 г','760'],
   ['rl-tartar-ls','Тар-тар с лососем','rolls','🍣',['рис','нори','сливочный сыр','омлет','огурец','лосось','кимчи'],'250 г','590'],
   ['rl-tartar-kr','Тар-тар с креветкой','rolls','🍣',['рис','нори','сливочный сыр','омлет','огурец','креветка','кимчи'],'250 г','580'],
   ['rl-tartar-tn','Тар-тар с тунцом','rolls','🍣',['рис','нори','сливочный сыр','омлет','огурец','тунец','кимчи'],'260 г','610'],
   ['rl-marioka-kr','Мариока с креветкой','rolls','🔥',['рис','нори','сливочный сыр','креветка','унаги','кунжут'],'260 г','570'],
   ['rl-marioka-ls','Мариока с лососем','rolls','🔥',['рис','нори','сливочный сыр','лосось','унаги','кунжут'],'260 г','590'],
   ['rl-kioto-kr','Киото с креветкой','rolls','🔥',['рис','нори','сливочный сыр','креветка','соус запекания','унаги','кунжут'],'290 г','570'],
   ['rl-kioto-ls','Киото с лососем','rolls','🔥',['рис','нори','сливочный сыр','лосось','соус запекания','унаги','кунжут'],'290 г','570'],
   ['rl-bake-ch','Запечённая с копчёной курицей','rolls','🔥',['рис','нори','сливочный сыр','курица','унаги','огурец'],'300 г','650'],
   ['rl-bake-phil','Запечённая Филадельфия','rolls','🔥',['рис','нори','сливочный сыр','огурец','лосось','соус запекания','унаги','кунжут'],'280 г','710'],
   ['rl-bake-calif','Запечённая Калифорния','rolls','🔥',['рис','нори','сливочный сыр','огурец','креветка','соус запекания','унаги','кунжут'],'310 г','670'],
   ['set-tartar','Сет Тар-тар','sets','🍱',['тар-тар лосось','тар-тар креветка','тар-тар тунец'],'750 г','1570'],
   ['set-phil','Сет Филадельфия','sets','🍱',['филадельфия сливочная','с огурцом','запечённая'],'750 г','1740'],
   ['set-bake','Сет запечённый','sets','🍱',['филадельфия с курицей','калифорния запечённая','мариока лосось','киото креветка'],'1000 г','1860'],
   ['set-combo','Сет комбинированный','sets','🍱',['мариока креветка','киото лосось','калифорния креветка','филадельфия сливочная'],'1000 г','2000'],
   ['sc-red','Соус красный','sauces','🥫',['томат','специи'],'40 г','80'],
   ['sc-rose','Соус розовый','sauces','🥫',['томат','сливки'],'40 г','80'],
   ['sc-garlic','Соус чесночный','sauces','🥫',['чеснок','сливки'],'40 г','80'],
   ['sc-white','Соус белый','sauces','🥫',['сливки','специи'],'40 г','80'],
  ];
  for (const s of simple) insD.run(s[0],'delivery',s[2],s[3],s[1],'',JSON.stringify(s[4]),s[5],s[6],'',0,1,null,'[]');
  db.prepare("INSERT INTO meta(key,value) VALUES('dmenu_v',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(DMENU_V);
}
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
const TG_CHANNEL = process.env.TG_CHANNEL_ID || '';
const appKb = () => ({ inline_keyboard: [
  [{ text: '🍕 Меню и заказ', web_app: { url: WEBAPP_URL + '/?src=tg&brand=delivery' } }],
  [{ text: '📦 Мои заказы', web_app: { url: WEBAPP_URL + '/?src=tg&tab=orders' } }, { text: '☕ Штампы', web_app: { url: WEBAPP_URL + '/?src=tg&tab=bonus' } }],
[{ text: '💬 Поддержка', web_app: { url: WEBAPP_URL + '/?src=tg&tab=chat&support=choose' } }]
]});
const TG_BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'and_coffee_bot';
const TG_WEBHOOK_SECRET = process.env.TG_WEBHOOK_SECRET || '';
const PUBLIC_URL = process.env.PUBLIC_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? 'https://' + process.env.RAILWAY_PUBLIC_DOMAIN : '');
const APP_URL = PUBLIC_URL || 'https://app.andcoffee.online';

async function tgSend(chatId, text, markup) {
  if (!TG_TOKEN) return;
  const body = { chat_id: chatId, text };
  if (markup) body.reply_markup = markup;
  try {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (e) {}
}

async function sendTg(cid, title, body, markup) {
  const c = db.prepare('SELECT tg FROM customers WHERE id=?').get(cid);
  if (c && c.tg) await tgSend(c.tg, `${title}\n${body}`, markup);
}

async function sendPush(cid, title, body, markup) {
  const c = db.prepare('SELECT tg, notify_tg, notify_web FROM customers WHERE id=?').get(cid);
  const wantTg = !c || c.notify_tg !== 0;
  const wantWeb = !c || c.notify_web !== 0;
  
  if (wantTg) sendTg(cid, title, body, markup).catch(() => {});
  
  if (wantWeb) {
    sendFcm(cid, title, body).catch(() => {});
    const rows = db.prepare('SELECT sub FROM subs WHERE cid=?').all(cid);
    for (const r of rows) {
      try { 
        await webpush.sendNotification(JSON.parse(r.sub), JSON.stringify({ title, body })); 
      } catch (e) { 
        if (e.statusCode === 404 || e.statusCode === 410) db.prepare('DELETE FROM subs WHERE sub=?').run(r.sub); 
      }
    }
  }
  return { ok: true };
}
async function tgEnsureWebhook() {
  if (!TG_TOKEN || !PUBLIC_URL) { console.log('[tg] webhook пропущен: нет TOKEN или PUBLIC_URL'); return; }
  const want = PUBLIC_URL + '/api/tg/webhook';
  try {
    const info = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/getWebhookInfo`).then(r => r.json());
    if (info.ok && info.result && info.result.url === want) { console.log('[tg] webhook уже наш:', want); return; }
    const body = { url: want, allowed_updates: ['message'] };
    if (TG_WEBHOOK_SECRET) body.secret_token = TG_WEBHOOK_SECRET;
    const set = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/setWebhook`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
    console.log('[tg] setWebhook:', set.ok ? 'ok → ' + want : set.description);
  } catch (e) { console.log('[tg] webhook ensure error:', e.message); }
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
coffee: r.coffee, on: r.is_on, img: r.img, section: r.section || 'coffee', opts: JSON.parse(r.opts || '[]') });
const cust = c => ({ 
  id: c.id, name: c.name, phone: c.phone, stamps: c.stamps, free: c.free,
  cups: c.cups, qr: c.qr, role: c.role || 'guest', 
  verified: c.verified ? 1 : 0, welcome: c.welcome ? 1 : 0,
  tg: c.tg ? 1 : 0, 
  notify_tg: c.notify_tg !== 0 ? 1 : 0, 
  notify_web: c.notify_web !== 0 ? 1 : 0,
  history: db.prepare('SELECT ts,a,by FROM history WHERE cid=? ORDER BY id DESC LIMIT 10').all(c.id) 
});
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
const chatGuard = (req, res, next) => { req.user = authUser(req);
  if (!req.user) return res.status(401).json({ error: 'Нужен вход по номеру' });
  if (!['cashier','admin','dispatch'].includes(req.user.role))
    return res.status(403).json({ error: 'Недостаточно прав' });
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
  if (ten) sendPush(cid, '🎁 Бесплатный кофе ждёт вас!', 'Вы собрали 10 штампов. Заходите — кофе за наш счёт.', { text: '☕ Мой профиль', url: APP_URL });
  else if (f.stamps === 9) sendPush(cid, '☕ Осталась одна чашка!', 'У вас 9 из 10 штампов. Следующий кофе — бесплатно 😉', { text: '☕ Мой профиль', url: APP_URL });
  return { customer: cust(f), ten, msg: ten ? '10-й штамп! Начислен бесплатный кофе' : `+1 штамп → ${f.stamps} из 10` }; }
function redeem(cid, by, item) {
  const c = db.prepare('SELECT * FROM customers WHERE id=?').get(cid);
  if (!c || c.free < 1) return null;
  db.prepare('UPDATE customers SET free=? WHERE id=?').run(c.free - 1, cid);
  addHist(cid, `🎁 Списан бесплатный кофе: ${item || 'классика'} (осталось ${c.free - 1})`, by);
  logEv(c.name, 'списан бесплатный кофе: ' + (item || 'классика'));
  return { customer: cust(db.prepare('SELECT * FROM customers WHERE id=?').get(cid)) };
}
function grantWelcome(cid, by) {
  const c = db.prepare('SELECT * FROM customers WHERE id=?').get(cid);
  if (!c || c.welcome) return null;
  db.prepare('UPDATE customers SET welcome=1, verified=1 WHERE id=?').run(cid);
  addHist(cid, '🎁 Приветственный бонус: +1 штамп', 'Система');
  return grant(cid, by || 'Система');
}
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
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()');
res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://telegram.org; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https: blob:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; frame-ancestors https://web.telegram.org https://webk.telegram.org https://weba.telegram.org https://*.telegram.org https://telegram.org");
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
app.post('/api/clientlog', (req, res) => {
  console.log('[client]', (req.body && req.body.kind) || '?', (req.body && req.body.msg) || '');
  res.json({ ok: true });
});
app.get('/api/config', (req, res) => res.json({ tgUsername: TG_BOT_USERNAME }));
app.get('/api/menu', (req, res) => res.json({
  items: db.prepare("SELECT * FROM menu WHERE is_on=1 AND section='coffee'").all().map(item), updatedAt: getMeta() }));
app.get('/api/menu/all', adminGuard, (req, res) => res.json({
  items: db.prepare('SELECT * FROM menu').all().map(item), updatedAt: getMeta() }));
  app.get('/api/dmenu', (req, res) => res.json({
  items: db.prepare("SELECT * FROM menu WHERE is_on=1 AND section='delivery'").all().map(item) }));
app.post('/api/menu', adminGuard, (req, res) => {
  const p = req.body; p.id = p.id || uid('p');
  db.prepare('INSERT INTO menu(id,cat,e,name,descr,comp,vol,price,tag,coffee,is_on,img,section,opts) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
    p.id, p.cat, p.e || '☕', p.name || 'Без названия', p.desc || '', JSON.stringify(p.comp || []),
    p.vol || '', String(p.price ?? '0'), p.tag || '', p.coffee ? 1 : 0, p.on ? 1 : 0, p.img || null,
    p.section || 'coffee', JSON.stringify(p.opts || []));
  touch(); res.json({ ok: true, id: p.id });
});
app.put('/api/menu/:id', adminGuard, (req, res) => {
  const p = req.body;
  db.prepare('UPDATE menu SET cat=?,e=?,name=?,descr=?,comp=?,vol=?,price=?,tag=?,coffee=?,is_on=?,img=?,section=?,opts=? WHERE id=?').run(
    p.cat, p.e || '☕', p.name || 'Без названия', p.desc || '', JSON.stringify(p.comp || []),
    p.vol || '', String(p.price ?? '0'), p.tag || '', p.coffee ? 1 : 0, p.on ? 1 : 0, p.img || null,
    p.section || 'coffee', JSON.stringify(p.opts || []), req.params.id);
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
    return res.json({ ok: true, tgUrl: `https://t.me/${TG_BOT_USERNAME}?start=reg_${token}` });
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
if (okSms) pinLocks.delete(lockKey(req, 'reg'));
const tgChat = okTg ? (st.tgChat || null) : null;
if (okTg || okSms) otpStore.delete('reg:' + p);
const ex = db.prepare('SELECT * FROM customers WHERE phone=?').get(p);
if (ex) {
  const age = Date.now() - new Date(ex.created_at).getTime();
  if (!ex.verified && age > 7 * 86400000) { // сквот протух
    db.prepare('DELETE FROM tokens WHERE ref=?').run(ex.id);
    db.prepare('DELETE FROM customers WHERE id=?').run(ex.id);
    if (!req.body.consent) return res.status(400).json({ error: 'Нужно согласие с политикой конфиденциальности' });
db.prepare('UPDATE customers SET consent=? WHERE id=?').run(nowISO() + ' v1', r.customer.id || ex.id);
  } else if (okTg && !ex.verified) { // владелец с TG возвращает номер
    db.prepare('DELETE FROM tokens WHERE ref=?').run(ex.id);
    db.prepare('UPDATE customers SET name=?, tg=?, verified=1 WHERE id=?')
      .run(String(req.body.name || '').trim() || ex.name, tgChat, ex.id);
    addHist(ex.id, 'Профиль подтверждён через Telegram', 'Система');
    grantWelcome(ex.id, 'Telegram');
    return res.json({ token: issueToken(ex.id), customer: cust(db.prepare('SELECT * FROM customers WHERE id=?').get(ex.id)) });
  } else return res.status(409).json({ error: 'exists' });
}
const r = createCustomer(req.body.name || '', req.body.phone || '', req.body.pin || '');
if (r.err) return res.status(r.code).json({ error: r.err });
if (okTg || okSms) {
  if (tgChat) db.prepare('UPDATE customers SET tg=? WHERE id=?').run(tgChat, r.customer.id);
  db.prepare('UPDATE customers SET verified=1 WHERE id=?').run(r.customer.id);
  if (okTg) grantWelcome(r.customer.id, 'Telegram'); // бонус ТОЛЬКО за «поделиться номером»
  addHist(r.customer.id, okTg ? 'Telegram привязан при регистрации' : 'Подтверждение по SMS', 'Система');
  if (!req.body.consent) return res.status(400).json({ error: 'Нужно согласие с политикой конфиденциальности' });
db.prepare('UPDATE customers SET consent=? WHERE id=?').run(nowISO() + ' v1', r.customer.id || ex.id);
} else {
  let ac; do { ac = String(Math.floor(1000 + Math.random() * 9000)); }
  while (db.prepare('SELECT 1 FROM customers WHERE actcode=? AND verified=0').get(ac));
  db.prepare('UPDATE customers SET actcode=? WHERE id=?').run(ac, r.customer.id);
  const staff = db.prepare("SELECT id FROM customers WHERE role IN ('cashier','admin')").all();
  for (const s of staff) sendPush(s.id, '🆕 Новый гость ждёт активации', `${r.customer.name}, ${r.customer.phone} — код ${ac}`);
  logEv(r.customer.name, 'регистрация без TG, ждёт код кассира');
}
res.json({ token: issueToken(r.customer.id), customer: cust(db.prepare('SELECT * FROM customers WHERE id=?').get(r.customer.id)) });
});
app.post('/api/auth/activate-guest', userGuard, (req, res) => {
  const code = String(req.body.code || '').trim();
  if (!/^\d{4}$/.test(code)) return res.status(400).json({ error: 'Код — 4 цифры' });
  const c = db.prepare('SELECT * FROM customers WHERE id=?').get(req.user.id);
  if (c.verified) return res.status(409).json({ error: 'Профиль уже активирован' });
  if (!c.actcode || c.actcode !== code) { registerFail(req, 'act'); return res.status(403).json({ error: 'Неверный код активации' }); }
  db.prepare('UPDATE customers SET verified=1, actcode=NULL WHERE id=?').run(c.id);
  addHist(c.id, '✅ Профиль активирован на кассе', 'Кассир');
  res.json({ customer: cust(db.prepare('SELECT * FROM customers WHERE id=?').get(c.id)) });
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
  else if (safeEqual(code, DISPATCH_CODE)) role = 'dispatch';
  if (!role) { registerFail(req); return res.status(403).json({ error: 'Неверный код доступа' }); }
  pinLocks.delete(lockKey(req));
  db.prepare('UPDATE customers SET role=? WHERE id=?').run(role, req.user.id);
  addHist(req.user.id, role === 'admin' ? '🔓 Выдан доступ администратора' : '🧾 Выдан доступ кассира', 'Система');
  logEv(req.user.name, role === 'admin' ? 'активирован админ' : 'активирован кассир');
  res.json({ customer: cust(db.prepare('SELECT * FROM customers WHERE id=?').get(req.user.id)) });
});
const pendingGuard = (req, res, next) => { req.user = authUser(req);
  if (!req.user) return res.status(401).json({ error: 'Нужен вход по номеру' });
  if (!['cashier','admin','dispatch'].includes(req.user.role)) return res.status(403).json({ error: 'Недостаточно прав' });
  next(); };
app.post('/api/staff/activate-guest', pendingGuard, (req, res) => {
  const c = db.prepare('SELECT * FROM customers WHERE id=?').get(String(req.body.id || ''));
  if (!c) return res.status(404).json({ error: 'Гость не найден' });
  if (c.verified) return res.status(409).json({ error: 'Уже активирован' });
  db.prepare('UPDATE customers SET verified=1, actcode=NULL WHERE id=?').run(c.id);
  addHist(c.id, '✅ Профиль активирован сотрудником', 'Сотрудник');
  logEv(req.user.name, `активировал гостя ${c.name}`);
  res.json({ ok: true });
});
app.get('/api/staff/pending', pendingGuard, (req, res) => {
  res.json({ pending: db.prepare('SELECT id,name,phone,actcode,created_at FROM customers WHERE verified=0 AND actcode IS NOT NULL ORDER BY created_at DESC LIMIT 20').all() });
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
app.put('/api/me/notify', userGuard, (req, res) => {
  db.prepare('UPDATE customers SET notify_tg=?, notify_web=? WHERE id=?')
    .run(req.body.tg ? 1 : 0, req.body.web ? 1 : 0, req.user.id);
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
  db.prepare('UPDATE customers SET verified=1 WHERE id=?').run(r.customer.id);
  addHist(r.customer.id, 'Профиль создан', 'Кассир'); logEv(r.customer.name, 'Создан профиль');
  res.json(r);
});
app.post('/api/staff/stamp', staffGuard, (req, res) => {
  const r = grant(req.body.id, 'Кассир');
  r ? res.json(r) : res.status(404).json({ error: 'Гость не найден' });
});
app.post('/api/staff/redeem', staffGuard, (req, res) => {
  const r = redeem(req.body.id, 'Кассир', String(req.body.item || '').slice(0, 40));
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
  if (!req.user.verified) return res.status(403).json({ error: 'Промокоды открываются после активации профиля на кассе или в Telegram' });
  const p = db.prepare('SELECT * FROM promos WHERE code=?').get(code);
  if (!p || !p.active) return res.status(404).json({ error: 'Такого промокода нет' });
    if ((p.scope || 'coffee') === 'delivery') return res.status(400).json({ error: 'Этот промокод работает только в корзине доставки' });
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
app.get('/api/promo/info', (req, res) => {
  const code = String(req.query.code || '').trim().toUpperCase();
  if (!code) return res.json({ ok: false, error: 'Введите код' });
  const p = db.prepare('SELECT * FROM promos WHERE code=?').get(code);
  if (!p || !p.active || (p.scope || 'coffee') !== 'delivery') return res.json({ ok: false, error: 'Такого кода для доставки нет' });
  if (p.expires && new Date(p.expires) < new Date()) return res.json({ ok: false, error: 'Код истёк' });
  if (p.maxuses > 0 && p.uses >= p.maxuses) return res.json({ ok: false, error: 'Код уже использован' });
  res.json({ ok: true, kind: p.kind, value: p.value, code: p.code });
});
app.get('/api/promos', adminGuard, (req, res) =>
  res.json({ promos: db.prepare('SELECT * FROM promos ORDER BY created DESC').all() }));
app.post('/api/promos', adminGuard, (req, res) => {
  const b = req.body;
  const code = String(b.code || '').trim().toUpperCase().replace(/\s+/g, '');
  if (code.length < 3) return res.status(400).json({ error: 'Код слишком короткий' });
  if (db.prepare('SELECT 1 FROM promos WHERE code=?').get(code)) return res.status(409).json({ error: 'Такой код уже есть' });
  const expires = b.days ? new Date(Date.now() + b.days * 86400000).toISOString() : null;
  const scope = (b.kind === 'percent' || b.kind === 'money') ? 'delivery' : 'coffee';
  db.prepare('INSERT INTO promos(id,code,kind,value,active,expires,maxuses,uses,created,scope) VALUES(?,?,?,?,1,?,?,0,?,?)')
    .run(uid('pr'), code, b.kind || 'stamp', Math.max(1, +(b.value || 1)), expires, +(b.maxuses || 0), nowISO(), scope);
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
app.post('/api/push/test', userGuard, async (req, res) => {
  const s = await sendPush(req.user.id, '🔔 Тестовый пуш', 'Если ты это видишь — пуши на этом устройстве работают');
  res.json(s);
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
  let ok = 0, fail = 0; const errs = [];
  for (const c of cids) {
    const rows = db.prepare('SELECT sub FROM subs WHERE cid=?').all(c.cid);
    for (const r of rows) {
      try { await webpush.sendNotification(JSON.parse(r.sub), JSON.stringify({ title: '…и кофе 🌊', body })); ok++; }
      catch (e) { fail++; errs.push(e.statusCode || e.message);
        if (e.statusCode === 404 || e.statusCode === 410) db.prepare('DELETE FROM subs WHERE sub=?').run(r.sub); }
    }
  }
  logEv(req.user.name, `пуш всем (${cids.length})`);
  res.json({ ok: true, sent: cids.length, delivered: ok, failed: fail, errors: errs.slice(0, 5) });
});


/* ── чат гость ↔ стафф ── */
app.post('/api/chat/send', (req, res) => {
  const key = String(req.body.key || '').slice(0, 64);
  const text = String(req.body.text || '').slice(0, 2000);
  const ctx = req.body.ctx === 'delivery' ? 'delivery' : 'coffee';
  if (!key || !text) return res.status(400).json({ error: 'bad request' });
  const base = key.replace(/:[cd]$/, '');
  const isUser = !!db.prepare('SELECT 1 FROM customers WHERE id=?').get(base);
  const human = req.body.human && isUser ? 1 : 0;
  db.prepare('INSERT INTO chat(key,who,text,ts,human,read_s) VALUES(?,?,?,?,?,0)').run(key, 'guest', text, nowISO(), human);
  db.prepare("INSERT INTO chat_meta(key,closed,ctx) VALUES(?,0,?) ON CONFLICT(key) DO UPDATE SET closed=0, ctx=excluded.ctx").run(key, ctx);
  if (human) {
    const roles = ctx === 'delivery' ? "('dispatch','admin')" : "('cashier','admin')";
    const staff = db.prepare(`SELECT id FROM customers WHERE role IN ${roles}`).all();
    for (const s of staff) sendPush(s.id, ctx === 'delivery' ? '💬 Вопрос по доставке' : '💬 Вопрос по кофейне', text.slice(0, 80));
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
app.get('/api/chat/list', chatGuard, (req, res) => {
  const showClosed = req.query.closed === '1';
  const role = req.user.role;
  const rows = db.prepare(`SELECT c.key, MAX(c.id) mid,
    SUM(CASE WHEN c.who='guest' AND c.read_s=0 THEN 1 ELSE 0 END) unread,
    IFNULL(m.closed,0) closed, IFNULL(m.staff_in,0) staff_in, IFNULL(m.ctx,'coffee') ctx,
    (SELECT g.human FROM chat g WHERE g.key=c.key AND g.who='guest' ORDER BY g.id DESC LIMIT 1) human
    FROM chat c LEFT JOIN chat_meta m ON m.key=c.key
    GROUP BY c.key ORDER BY mid DESC LIMIT 50`).all();
  res.json({ threads: rows
    .filter(r => role === 'dispatch' ? r.ctx === 'delivery' : role === 'cashier' ? r.ctx === 'coffee' : true)
    .filter(r => showClosed ? r.closed : (!r.closed && (r.human || r.staff_in)))
    .map(r => {
            const c = db.prepare('SELECT name FROM customers WHERE id=?').get(r.key.replace(/:[cd]$/, ''));
      return { key: r.key, name: c ? c.name : 'Гость', unread: r.unread, human: r.human, ctx: r.ctx };
    }) });
});
app.get('/api/chat/dialog', chatGuard, (req, res) => {
  const key = String(req.query.key || '').slice(0, 64);
    const mctx = (db.prepare('SELECT ctx FROM chat_meta WHERE key=?').get(key) || {}).ctx || 'coffee';
  if ((req.user.role === 'dispatch' && mctx !== 'delivery') || (req.user.role === 'cashier' && mctx !== 'coffee'))
    return res.status(403).json({ error: 'Этот чат ведёт другое заведение' });
  db.prepare("UPDATE chat SET read_s=1 WHERE key=? AND who='guest'").run(key);
  const meta = db.prepare('SELECT staff_in FROM chat_meta WHERE key=?').get(key);
if (!meta || !meta.staff_in) {
  db.prepare('INSERT INTO chat_meta(key,closed,staff_in) VALUES(?,0,1) ON CONFLICT(key) DO UPDATE SET staff_in=1').run(key);
  db.prepare('INSERT INTO chat(key,who,text,ts,read_g) VALUES(?,?,?,?,0)').run(key, 'system', '👋 Сотрудник подключился к чату — бот Ника отдыхает', nowISO());
} 
  res.json({ msgs: db.prepare('SELECT id,who,text,ts FROM chat WHERE key=? ORDER BY id').all(key) });
});
app.post('/api/chat/reply', chatGuard, (req, res) => {
  const key = String(req.body.key || '').slice(0, 64);
  const text = String(req.body.text || '').slice(0, 2000);
  const mctx = (db.prepare('SELECT ctx FROM chat_meta WHERE key=?').get(key) || {}).ctx || 'coffee';
  if ((req.user.role === 'dispatch' && mctx !== 'delivery') || (req.user.role === 'cashier' && mctx !== 'coffee'))
    return res.status(403).json({ error: 'Этот чат ведёт другое заведение' });
  if (!key || !text) return res.status(400).json({ error: 'bad request' });
  db.prepare('INSERT INTO chat(key,who,text,ts,read_g) VALUES(?,?,?,?,0)').run(key, 'staff', text, nowISO());
  if (!key.startsWith('anon-')) sendPush(key.replace(/:[cd]$/, ''), '💬 Вам ответили из «…и кофе»', text.slice(0, 80));
    res.json({ ok: true });
});
app.post('/api/chat/close', chatGuard, (req, res) => {
  const key = String(req.body.key || '').slice(0, 64);
    const mctx = (db.prepare('SELECT ctx FROM chat_meta WHERE key=?').get(key) || {}).ctx || 'coffee';
  if ((req.user.role === 'dispatch' && mctx !== 'delivery') || (req.user.role === 'cashier' && mctx !== 'coffee'))
    return res.status(403).json({ error: 'Этот чат ведёт другое заведение' });
  db.prepare('INSERT INTO chat_meta(key,closed,staff_in) VALUES(?,1,0) ON CONFLICT(key) DO UPDATE SET closed=1, staff_in=0').run(key);
  db.prepare('INSERT INTO chat(key,who,text,ts,read_g) VALUES(?,?,?,?,0)').run(key, 'system', '✅ Чат закрыт. Бот Ника снова на связи.', nowISO());
  res.json({ ok: true });
});
app.post('/api/chat/open', chatGuard, (req, res) => {
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
app.post('/api/tg/webhook', async (req, res) => {
    if (TG_WEBHOOK_SECRET && req.header('x-telegram-bot-api-secret-token') !== TG_WEBHOOK_SECRET) return res.status(403).json({ error: 'bad secret' });
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
  (async () => {
    await tgSend(chatId, '☕ Привет! Я бот «…и кофе» и доставки «Пятница».\n\nШтампы, бонусы, статусы заказов и акции — всё здесь. Меню открывается прямо в Telegram.');
    await tgSend(chatId, 'Выберите, что нужно 👇', appKb());
    try { await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text: '📱', reply_markup: { keyboard: [[{ text: '📱 Поделиться номером', request_contact: true }]], resize_keyboard: true } }) }); } catch (e) {}
  })();
  return;
}
if (text === '/menu') { tgSend(chatId, '🍕 Открываю меню доставки…', appKb()); return; }
if (text === '/orders') {
  const c = db.prepare('SELECT * FROM customers WHERE tg=?').get(chatId);
  if (!c) { tgSend(chatId, 'Сначала привяжите профиль — нажмите «Поделиться номером» 👇', appKb()); return; }
  const rows = db.prepare('SELECT no,status,total FROM orders WHERE cid=? ORDER BY no DESC LIMIT 3').all(c.id);
  const txt = rows.length ? rows.map(o => `#${o.no} · ${ORDER_STATUS[o.status] || o.status} · ${o.total} ₽`).join('\n') : 'Заказов пока нет — самое время выбрать пиццу 🍕';
  tgSend(chatId, `📦 Последние заказы:\n${txt}`, appKb());
  return;
}
if (text === '/help') { tgSend(chatId, 'Команды:\n/menu — меню и заказ\n/orders — мои заказы\n/start — привязать профиль\n\nИли напишите вопрос словами — отвечу я или сотрудник.', appKb()); return; }
  if (u.message.contact) {
  const pend = otpStore.get('regchat:' + chatId);
  if (pend && Date.now() < pend.expires) {
    if (fmtPhone(u.message.contact.phone_number) === fmtPhone(pend.phone)) {
      otpStore.set('reg:' + fmtPhone(pend.phone), { code: null, confirmed: true, tgChat: chatId, expires: Date.now() + 10 * 60 * 1000 });
      otpStore.delete('regchat:' + chatId); otpStore.delete('regtg:' + pend.token);
      tgSend(chatId, '✅ Номер подтверждён! Вернитесь в приложение и завершите регистрацию — +1 штамп уже ваш 🎁');
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
  if (!c.welcome) {
    grantWelcome(c.id, 'Telegram');
    const linked = `✅ Готово, ${c.name}! Профиль привязан.\n🎁 Приветственный бонус начислен: +1 штамп!\n\nТеперь сюда будут приходить:`;
    await tgSend(chatId, linked);
    fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, { method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: 'Выберите, что интересно:',
        reply_markup: { inline_keyboard: [
          [{ text: '☕ Кофейня — штампы и бонусы', url: APP_URL }],
          [{ text: '🍕 Доставка — заказать пиццу', url: APP_URL + '?brand=delivery' }]
        ]} }) }).catch(() => {});
  } else {
    tgSend(chatId, `✅ Готово, ${c.name}! Профиль привязан.\nТеперь штампы, статусы заказов и акции — сюда ☕🍕`);
  }
} else if (u.message.contact) {
  tgSend(chatId, 'Профиль с таким номером не найден 😔 Создайте его в приложении и нажмите «Поделиться номером» ещё раз.');
} else {
    tgSend(chatId, '☕🍕 Я бот «…и кофе» + «Пятница». Нажмите /start, чтобы привязать профиль и получать бонусы и статусы заказов.');
}
});
/* ── статика ── */
/* ── доставка: настройки, акции, заказы ── */
const DELIVERY = {
  hours: [11, 22], eta: 45, slotStep: 30, slotDays: 2,
  pickupAddr: 'пгт Янтарный, ул. Советская, 38А', pickupDiscount: 0.10,
  zones: [
    { fee: 200, places: ['Янтарный','Покровское','Синявино'] },
    { fee: 500, places: ['Кленовое','Охотное','Русское','Поваровка','Морозовка','Янтаровка','Красноторовка','Ягодное'] },
    { fee: 1100, places: ['Донское','Прислово'] },
  ],
};
const weekPromo = () => { const w = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='week_promo'").get()?.value || 'null');
  if (!w || !w.text) return null; if (w.until && new Date(w.until) < new Date()) return null; return w; };
const pizzaMonth = () => { const m = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='pizza_month'").get()?.value || 'null');
  return (m && m.on && m.name) ? m : null; };
app.get('/api/delivery/info', (req, res) => res.json({ ...DELIVERY, weekPromo: weekPromo(), pizzaMonth: pizzaMonth() }));
app.put('/api/admin/weekpromo', adminGuard, (req, res) => {
  const b = req.body || {};
  if ('text' in b) {
    db.prepare("INSERT INTO meta(key,value) VALUES('week_promo',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
      .run(JSON.stringify({ text: b.text || '', threshold: +b.threshold || 0, gift: b.gift || '', until: b.until || null }));
    if (b.push && b.text) {
      const cids = db.prepare("SELECT cid FROM subs UNION SELECT id FROM customers WHERE tg IS NOT NULL AND tg != ''").all();
      for (const c of cids) sendPush(c.cid, '🍕 Пятничный подарок', b.text);
      logEv(req.user.name, 'пуш: пятничный подарок');
    }
  }
  if ('pmName' in b || 'pmOn' in b) {
    db.prepare("INSERT INTO meta(key,value) VALUES('pizza_month',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
      .run(JSON.stringify({ name: b.pmName || '', on: !!b.pmOn }));
  }
        if (TG_CHANNEL) tgSend(TG_CHANNEL, `🍕 Пятничный подарок\n${b.text}`);
  res.json({ ok: true });
});
const dispatchGuard = (req, res, next) => { req.user = authUser(req);
  if (!req.user) return res.status(401).json({ error: 'Нужен вход по номеру' });
  if (!['cashier','admin','dispatch'].includes(req.user.role)) return res.status(403).json({ error: 'Недостаточно прав' });
  next(); };
const ORDER_STATUS = { new: '🆕 Заказ принят', accept: '✅ Подтверждён, готовим', cook: '👨🍳 Готовится', way: '🛵 Курьер выехал', done: '🏁 Выполнен', cancel: '❌ Отменён' };
function orderNotifyStaff(o) {
  const lines = o.items.map(i => `${i.qty}× ${i.name}${i.opt ? ' (' + i.opt + ')' : ''} — ${i.qty * i.price} ₽`);
  const gifts = o.gifts.map(g => `🎁 ${g.name} ×${g.qty}`);
  const txt = `${o.name} ${o.phone}\n${o.method === 'pickup' ? '🛍 Самовывоз, Советская 38А' : '🚗 ' + o.place + ', ' + o.addr}\n⏰ ${o.slot === 'asap' ? 'как можно скорее' : o.slot} · 💳 ${o.pay === 'cash' ? 'наличные' : 'карта при получении'}\n${lines.concat(gifts).join('\n')}\nИтого: ${o.total} ₽ (скидка ${o.discount} ₽, доставка ${o.fee} ₽)${o.comment ? '\n💬 ' + o.comment : ''}`;
  const staff = db.prepare("SELECT id FROM customers WHERE role IN ('cashier','admin','dispatch')").all();
  for (const s of staff) sendPush(s.id, `🍕 Новый заказ #${o.no}`, txt);
  logEv(o.name, `заказ #${o.no} на ${o.total} ₽`);
}
app.post('/api/orders', userGuard, (req, res) => {
  const b = req.body || {};
  const method = b.method === 'pickup' ? 'pickup' : 'delivery';
  let fee = 0;
  if (method === 'delivery') {
    const z = DELIVERY.zones.find(z => z.places.includes(String(b.place || '').trim()));
    if (!z) return res.status(400).json({ error: 'Выберите населённый пункт из списка' });
    if (!String(b.addr || '').trim()) return res.status(400).json({ error: 'Укажите адрес' });
    fee = z.fee;
  }
  const raw = Array.isArray(b.items) ? b.items.slice(0, 50) : [];
  if (!raw.length) return res.status(400).json({ error: 'Корзина пуста' });
  const items = []; let sum = 0;
  for (const li of raw) {
    const m = db.prepare("SELECT * FROM menu WHERE id=? AND section='delivery' AND is_on=1").get(String(li.id || ''));
    if (!m) return res.status(400).json({ error: 'Позиция недоступна' });
    const opts = JSON.parse(m.opts || '[]');
    const oi = Number.isInteger(li.oi) ? li.oi : -1;
    if (oi >= 0 && !opts[oi]) return res.status(400).json({ error: 'Вариант недоступен' });
    const price = oi >= 0 ? opts[oi].p : (parseInt(m.price) || 0);
    const qty = Math.max(1, Math.min(20, +li.qty || 1));
    items.push({ id: m.id, name: m.name, opt: oi >= 0 ? opts[oi].l : null, sz: oi >= 0 ? (opts[oi].sz || 0) : 0, price, qty });
    sum += price * qty;
  }
  const discount = method === 'pickup' ? Math.round(sum * DELIVERY.pickupDiscount) : 0;
  const gifts = [];
  const wp = weekPromo();
  if (wp && wp.gift) { const q = wp.threshold > 0 ? Math.floor(sum / wp.threshold) : 1; if (q > 0) gifts.push({ name: wp.gift, qty: q }); }
  const pm = pizzaMonth();
  if (pm) { const big = items.reduce((a, i) => a + (i.sz === 35 ? i.qty : 0), 0); if (big >= 2) gifts.push({ name: pm.name + ' — подарок', qty: 1 }); }
    let promoCode = '', promoDiscount = 0;
  const pc = String(b.promo || '').trim().toUpperCase();
  if (pc) {
    const p = db.prepare('SELECT * FROM promos WHERE code=?').get(pc);
    if (!p || !p.active || (p.scope || 'coffee') !== 'delivery') return res.status(400).json({ error: 'Промокод не найден для доставки' });
    if (p.expires && new Date(p.expires) < new Date()) return res.status(410).json({ error: 'Промокод истёк' });
    if (p.maxuses > 0 && p.uses >= p.maxuses) return res.status(410).json({ error: 'Промокод использован' });
    if (db.prepare('SELECT 1 FROM promo_use WHERE promo=? AND cid=?').get(p.id, req.user.id))
      return res.status(409).json({ error: 'Вы уже использовали этот промокод' });
    promoDiscount = p.kind === 'percent' ? Math.round(sum * Math.min(90, p.value) / 100) : Math.min(p.value || 0, sum);
    promoCode = p.code;
    db.prepare('INSERT INTO promo_use(promo,cid,ts) VALUES(?,?,?)').run(p.id, req.user.id, nowISO());
    db.prepare('UPDATE promos SET uses=uses+1 WHERE id=?').run(p.id);
  }
  const total = sum - discount - promoDiscount + fee;
  const no = ((db.prepare("SELECT value FROM meta WHERE key='order_no'").get()?.value | 0) + 1);
  db.prepare("INSERT INTO meta(key,value) VALUES('order_no',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(String(no));
  const o = { id: uid('o'), no, cid: req.user.id, name: req.user.name, phone: req.user.phone, method,
    place: method === 'delivery' ? String(b.place).trim() : '', addr: method === 'delivery' ? String(b.addr).trim() : '',
    slot: b.slot === 'asap' ? 'asap' : String(b.slot || 'asap').slice(0, 40), pay: b.pay === 'card' ? 'card' : 'cash',
    comment: String(b.comment || '').slice(0, 300), items, total, discount, fee, gifts, promo: promoCode, promodiscount: promoDiscount, status: 'new', created: nowISO(), updated: nowISO() };
  db.prepare(`INSERT INTO orders(id,no,cid,name,phone,method,place,addr,slot,pay,comment,items,total,discount,fee,gifts,status,created,updated)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(o.id, o.no, o.cid, o.name, o.phone, o.method, o.place, o.addr, o.slot, o.pay, o.comment,
      JSON.stringify(o.items), o.total, o.discount, o.fee, JSON.stringify(o.gifts), o.status, o.created, o.updated);
  orderNotifyStaff(o);
  res.json({ order: o });
});
app.get('/api/orders/mine', userGuard, (req, res) => {
  res.json({ orders: db.prepare('SELECT * FROM orders WHERE cid=? ORDER BY no DESC LIMIT 20').all(req.user.id)
    .map(o => ({ ...o, items: JSON.parse(o.items || '[]'), gifts: JSON.parse(o.gifts || '[]') })) });
});
app.get('/api/orders', dispatchGuard, (req, res) => {
  const st = req.query.status;
  const rows = st ? db.prepare('SELECT * FROM orders WHERE status=? ORDER BY no DESC LIMIT 50').all(st)
    : db.prepare("SELECT * FROM orders WHERE created>? ORDER BY no DESC LIMIT 50").all(new Date(Date.now() - 3 * 86400000).toISOString());
  res.json({ orders: rows.map(o => ({ ...o, items: JSON.parse(o.items || '[]'), gifts: JSON.parse(o.gifts || '[]') })) });
});
app.post('/api/orders/:id/status', dispatchGuard, (req, res) => {
  const s = String(req.body.status || '');
  if (!ORDER_STATUS[s]) return res.status(400).json({ error: 'Неизвестный статус' });
  const o = db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id);
  if (!o) return res.status(404).json({ error: 'Заказ не найден' });
  db.prepare('UPDATE orders SET status=?, updated=? WHERE id=?').run(s, nowISO(), o.id);
  sendPush(o.cid, `🍕 Заказ #${o.no}`,
  ORDER_STATUS[s] + (s === 'way' && o.addr ? ': ' + o.addr : ''),
  { inline_keyboard: [[{ text: '📦 Открыть заказ', web_app: { url: WEBAPP_URL + '/?src=tg&tab=orders' } }]] 
}); 
  logEv(req.user.name, `заказ #${o.no} → ${s}`);
  res.json({ ok: true });
});
app.post('/api/orders/:id/delay', dispatchGuard, (req, res) => {
  const min = +req.body.min || 0;
  const comment = String(req.body.comment || '').slice(0, 140);
  const o = db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id)
        || db.prepare('SELECT * FROM orders WHERE no=?').get(+req.params.id || 0);
  if (!o) return res.status(404).json({ error: 'Заказ не найден' });
  db.prepare('UPDATE orders SET eta=?, updated=? WHERE id=?').run(min ? `+${min} мин` : '', nowISO(), o.id);
  sendPush(o.cid, '🛵 Время доставки обновлено',
    `Заказ #${o.no}: задерживаем на +${min} мин.${comment ? ' Причина: ' + comment : ''} Спасибо, что ждёте!`,
    { inline_keyboard: [[{ text: '📦 Открыть заказ', web_app: { url: WEBAPP_URL + '/?src=tg&tab=orders' } }]] });
  logEv(req.user.name, `заказ #${o.no} задержка +${min} мин`);
  res.json({ ok: true });
});
app.post('/api/orders/delay-all', dispatchGuard, (req, res) => {
  const min = +req.body.min || 0;
  const comment = String(req.body.comment || '').slice(0, 140);
  const rows = db.prepare("SELECT * FROM orders WHERE status IN ('new','accept','cook','way')").all();
  for (const o of rows) {
    db.prepare('UPDATE orders SET eta=?, updated=? WHERE id=?').run(min ? `+${min} мин` : '', nowISO(), o.id);
    sendPush(o.cid, '🛵 Время доставки обновлено',
      `Заказ #${o.no}: задерживаем на +${min} мин.${comment ? ' Причина: ' + comment : ''} Спасибо, что ждёте!`,
      { inline_keyboard: [[{ text: '📦 Открыть заказ', web_app: { url: WEBAPP_URL + '/?src=tg&tab=orders' } }]] });
  }
  logEv(req.user.name, `задержка всем +${min} мин (${rows.length})`);
  res.json({ ok: true, count: rows.length });
});
app.get('/api/stats/redeems', adminGuard, (req, res) => {
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const rows = db.prepare("SELECT a FROM history WHERE a LIKE '🎁 Списан бесплатный кофе%' AND ts>?").all(monthAgo);
  const byItem = {};
  for (const r of rows) {
    const m = r.a.match(/кофе:\s*(.+?)\s*\(/);
    const k = m ? m[1] : 'классика';
    byItem[k] = (byItem[k] || 0) + 1;
  }
  res.json({ total: rows.length, byItem });
});
app.use(express.static(PUBLIC_DIR));
app.get('/api/stats/redeems', adminGuard, (req, res) => {
  const rows = db.prepare(`
    SELECT a, by, ts FROM history 
    WHERE a LIKE '%списан бесплатный кофе%' 
    ORDER BY id DESC LIMIT 100
  `).all();
  const stats = {};
  rows.forEach(r => {
    const match = r.a.match(/списан бесплатный кофе: (.+?) \(/);
    const item = match ? match[1] : 'неизвестно';
    stats[item] = (stats[item] || 0) + 1;
  });
  res.json({ 
    total: rows.length, 
    byItem: stats,
    recent: rows.slice(0, 20).map(r => ({
      action: r.a,
      by: r.by,
      time: r.ts
    }))
  });
});
app.listen(PORT, () => { console.log(`☕ ЗЕРНО API запущен на порту ${PORT}`); tgEnsureWebhook(); });