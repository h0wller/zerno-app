/* server/routes/push.js — module-09: push-подписки, VAPID, рассылки */
import { Router } from 'express';
import webpush from 'web-push';
import { db } from '../db/connection.js';
import { userGuard, adminGuard } from '../middleware/auth.js';
import { nowISO } from '../utils/id-time.js';
import { logEv } from '../domain/helpers.js';
import { getVapidPublicKey } from '../db/index.js';
import { sendPush } from '../services/push.js';
import { tgSend } from '../services/telegram.js';

const pushRouter = Router();

pushRouter.get('/api/vapid', (req, res) => res.json({ publicKey: getVapidPublicKey() }));

pushRouter.post('/api/push/subscribe', userGuard, (req, res) => {
  const sub = req.body.sub;
  if (!sub || !sub.endpoint) return res.status(400).json({ error: 'bad sub' });
  const s = JSON.stringify(sub);
  const existed = db.prepare('SELECT 1 FROM subs WHERE cid=? AND sub=?').get(req.user.id, s);
  db.prepare('INSERT OR IGNORE INTO subs(cid,sub,created) VALUES(?,?,?)').run(req.user.id, s, nowISO());
  if (!existed) sendPush(req.user.id, '🔔 Уведомления подключены', 'Теперь сообщим о штампах и бесплатном кофе!');
  res.json({ ok: true });
});

pushRouter.post('/api/push/test', userGuard, async (req, res) => {
  const s = await sendPush(req.user.id, '🔔 Тестовый пуш', 'Если ты это видишь — пуши на этом устройстве работают');
  res.json(s);
});

pushRouter.post('/api/push/fcm', userGuard, (req, res) => {
  const token = String(req.body.token || '');
  if (!token) return res.status(400).json({ error: 'bad token' });
  db.prepare('INSERT OR IGNORE INTO fcm(cid,token,created) VALUES(?,?,?)').run(req.user.id, token, nowISO());
  res.json({ ok: true });
});

pushRouter.get('/api/push/subs', adminGuard, (req, res) => {
  const subs = db.prepare(`SELECT s.created, s.cid, c.name, c.phone FROM subs s LEFT JOIN customers c ON c.id=s.cid ORDER BY s.id DESC`).all();
  const tg = db.prepare(`SELECT created_at AS created, id AS cid, name, phone FROM customers WHERE tg IS NOT NULL AND tg != '' ORDER BY created_at DESC`).all();
  res.json({ subs, tg });
});

pushRouter.post('/api/push/send', adminGuard, async (req, res) => {
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

pushRouter.post('/api/push/unsubscribe', userGuard, (req, res) => {
  db.prepare('DELETE FROM subs WHERE cid=?').run(req.user.id);
  res.json({ ok: true });
});

pushRouter.post('/api/push/del', adminGuard, (req, res) => {
  db.prepare('DELETE FROM subs WHERE cid=?').run(String(req.body.cid || ''));
  res.json({ ok: true });
});

export default pushRouter;