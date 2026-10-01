/* server/routes/chat.js — module-08: чат гость ↔ стафф */
import { Router } from 'express';
import { db } from '../db/connection.js';
import { chatGuard } from '../middleware/auth.js';
import { nowISO } from '../utils/id-time.js';
import { sendPush } from '../services/push.js';

const chatRouter = Router();

chatRouter.post('/api/chat/send', (req, res) => {
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

chatRouter.post('/api/chat/botlog', (req, res) => {
  const key = String(req.body.key || '').slice(0, 64);
  const text = String(req.body.text || '').slice(0, 2000);
  if (!key || !text) return res.status(400).json({ error: 'bad request' });
  db.prepare('INSERT INTO chat(key,who,text,ts,read_s) VALUES(?,?,?,?,0)').run(key, 'bot', text, nowISO());
  res.json({ ok: true });
});

chatRouter.get('/api/chat/thread', (req, res) => {
  const key = String(req.query.key || '').slice(0, 64);
  const after = +(req.query.after || 0);
  res.json({ msgs: db.prepare('SELECT id,who,text,ts FROM chat WHERE key=? AND id>? ORDER BY id').all(key, after) });
});

chatRouter.get('/api/chat/list', chatGuard, (req, res) => {
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

chatRouter.get('/api/chat/dialog', chatGuard, (req, res) => {
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

chatRouter.post('/api/chat/reply', chatGuard, (req, res) => {
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

chatRouter.post('/api/chat/close', chatGuard, (req, res) => {
  const key = String(req.body.key || '').slice(0, 64);
  const mctx = (db.prepare('SELECT ctx FROM chat_meta WHERE key=?').get(key) || {}).ctx || 'coffee';
  if ((req.user.role === 'dispatch' && mctx !== 'delivery') || (req.user.role === 'cashier' && mctx !== 'coffee'))
    return res.status(403).json({ error: 'Этот чат ведёт другое заведение' });
  db.prepare('INSERT INTO chat_meta(key,closed,staff_in) VALUES(?,1,0) ON CONFLICT(key) DO UPDATE SET closed=1, staff_in=0').run(key);
  db.prepare('INSERT INTO chat(key,who,text,ts,read_g) VALUES(?,?,?,?,0)').run(key, 'system', '✅ Чат закрыт. Бот Ника снова на связи.', nowISO());
  res.json({ ok: true });
});

chatRouter.post('/api/chat/open', chatGuard, (req, res) => {
  db.prepare('INSERT INTO chat_meta(key,closed) VALUES(?,0) ON CONFLICT(key) DO UPDATE SET closed=0').run(String(req.body.key || '').slice(0, 64));
  res.json({ ok: true });
});

export default chatRouter;