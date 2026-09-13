import { initDatabase, getVapidPublicKey } from './server/db/index.js';
 initDatabase();
import express from 'express';
import webpush from 'web-push';

// ── Конфигурация и БД ──
import { db, PORT, PUBLIC_DIR, WEBAPP_URL, } from './server/config.js';
// ── Утилиты ──
import {  fmtPhone } from './server/utils/phone.js';
import { nowISO, uid } from './server/utils/id-time.js';
import { otpStore } from './server/utils/otp.js';
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
import ordersRouter from './server/routes/orders.js';
import { item, cust, addHist, logEv, getMeta, touch, issueToken } from './server/domain/helpers.js';
// Если в оставшихся роутах server.js (например, в заказах) используются функции лояльности, 
// раскомментируй и эти две строки:
// import { grant, redeem } from './server/domain/loyalty.js';
// import { createCustomer } from './server/domain/customers.js';

const app = express();
app.use(securityHeaders);
app.use(corsMiddleware);
app.use(express.json({ limit: '10mb' }));

// === module-05: роутеры auth и staff ===
app.use(authRouter);
app.use(staffRouter);
app.use(promosRouter);
app.use(ordersRouter);

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