import { initDatabase, getVapidPublicKey } from './server/db/index.js';
 initDatabase();
import express from 'express';
import webpush from 'web-push';

// ── Конфигурация и БД ──
import { db, PORT, PUBLIC_DIR, WEBAPP_URL, } from './server/config.js';
// ── Утилиты ──
import { nowISO, uid } from './server/utils/id-time.js';
import {
  userGuard, chatGuard, adminGuard, dispatchGuard,
  securityHeaders, corsMiddleware
} from './server/middleware/index.js';

import { tgSend, tgEnsureWebhook, TG_BOT_USERNAME, TG_CHANNEL, TG_WEBHOOK_SECRET, APP_URL } from './server/services/telegram.js';
import { sendPush } from './server/services/push.js';
// === module-05: domain customers/auth + loyalty ===
import { authRouter } from './server/routes/auth.js';
import { staffRouter } from './server/routes/staff.js';
import { promosRouter } from './server/routes/promos.js';
import ordersRouter, { ORDER_STATUS } from './server/routes/orders.js';
import chatRouter from './server/routes/chat.js';
import { createTgRouter } from './server/routes/tg.js';
import { item, cust, addHist, logEv, getMeta, touch, issueToken } from './server/domain/helpers.js';
// Если в оставшихся роутах server.js (например, в заказах) используются функции лояльности, 
// раскомментируй и эти две строки:
// import { grant, redeem } from './server/domain/loyalty.js';
// import { createCustomer } from './server/domain/customers.js';

const app = express();
function appKb() {
  return {
    keyboard: [[{ text: '📱 Поделиться номером', request_contact: true }]],
    resize_keyboard: true,
  };
}
app.use(securityHeaders);
app.use(corsMiddleware);
app.use(express.json({ limit: '10mb' }));

// === module-05: роутеры auth и staff ===
app.use(authRouter);
app.use(staffRouter);
app.use(promosRouter);
app.use(ordersRouter);
app.use(chatRouter);
app.use(createTgRouter({ appKb }));

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.post('/api/clientlog', (req, res) => {
  console.log('[client]', (req.body && req.body.kind) || '?', (req.body && req.body.msg) || '');
  res.json({ ok: true });
});
app.get('/api/config', (req, res) => res.json({ tgUsername: TG_BOT_USERNAME }));
/* ── меню ── */
app.get('/api/menu', (req, res) => res.json({
  items: db.prepare("SELECT * FROM menu WHERE is_on=1 AND section='coffee'").all().map(item),
  updatedAt: getMeta(),
}));
app.get('/api/menu/all', adminGuard, (req, res) => res.json({
  items: db.prepare('SELECT * FROM menu').all().map(item),
  updatedAt: getMeta(),
}));
app.get('/api/dmenu', (req, res) => res.json({
  items: db.prepare("SELECT * FROM menu WHERE is_on=1 AND section='delivery'").all().map(item),
}));
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
app.get('/api/vapid', (req, res) => res.json({ publicKey: getVapidPublicKey() }));
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
const rows = db.prepare(`SELECT c.id AS cid, c.tg, c.notify_tg, c.notify_web FROM customers c
WHERE c.id IN (SELECT cid FROM subs) OR (c.tg IS NOT NULL AND c.tg != '')`).all();
let ok = 0, fail = 0; const errs = [];
for (const c of rows) {
if (c.notify_web !== 0) {
const subs = db.prepare('SELECT sub FROM subs WHERE cid=?').all(c.cid);
for (const s of subs) {
try { await webpush.sendNotification(JSON.parse(s.sub), JSON.stringify({ title: '…и кофе 🌊', body })); ok++; }
catch (e) { fail++; errs.push(e.statusCode || e.message);
if (e.statusCode === 404 || e.statusCode === 410) db.prepare('DELETE FROM subs WHERE sub=?').run(s.sub); }
}
}
if (c.notify_tg !== 0 && c.tg) {
try { await tgSend(c.tg, '…и кофе 🌊\n' + body); ok++; } catch (e) { fail++; }
}
}
logEv(req.user.name, `пуш всем (${rows.length})`);
res.json({ ok: true, sent: rows.length, delivered: ok, failed: fail, errors: errs.slice(0, 5) });
});

app.post('/api/push/unsubscribe', userGuard, (req, res) => {
  db.prepare('DELETE FROM subs WHERE cid=?').run(req.user.id);
  res.json({ ok: true });
});
app.post('/api/push/del', adminGuard, (req, res) => {
  db.prepare('DELETE FROM subs WHERE cid=?').run(String(req.body.cid || ''));
  res.json({ ok: true });
});
/* ── статика ── */
app.use(express.static(PUBLIC_DIR, { setHeaders: (res, p) => {
  if (p.endsWith('index.html') || p.endsWith('sw.js')) res.setHeader('Cache-Control', 'no-cache');
} }));
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
const server = app.listen(PORT, () => { console.log(`☕ ЗЕРНО API запущен на порту ${PORT}`); tgEnsureWebhook(); });
process.on('SIGTERM', () => { console.log('[srv] SIGTERM, корректно закрываюсь…'); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 3000); });