/* server/routes/push.js — module-09: push-подписки, VAPID, рассылки */
import { Router } from 'express';
import webpush from 'web-push';
import { db } from '../db/connection.js';
import { userGuard, adminGuard } from '../middleware/auth.js';
import { nowISO } from '../utils/id-time.js';
import { logEv } from '../domain/helpers.js';
import { getVapidPublicKey } from '../db/index.js';
import { sendPush } from '../services/push.js';
import { sendFcm } from '../services/fcm.js';
import { tgSend } from '../services/telegram.js';

const pushRouter = Router();

pushRouter.get('/api/vapid', (req, res) => res.json({ publicKey: getVapidPublicKey() }));

pushRouter.post('/api/push/subscribe', userGuard, (req, res) => {
  const sub = req.body.sub;
  if (!sub || !sub.endpoint) return res.status(400).json({ error: 'bad sub' });
  const s = JSON.stringify(sub);
  const dev = String(req.body.dev || '').slice(0, 64);
  // Приветствие — только когда у клиента ещё не было ни одной подписки.
  const before = db.prepare('SELECT COUNT(*) AS n FROM subs WHERE cid=?').get(req.user.id).n;
  // Одно устройство — одна подписка: старые строки того же устройства удаляем.
  if (dev) db.prepare('DELETE FROM subs WHERE cid=? AND dev=? AND sub<>?').run(req.user.id, dev, s);
  db.prepare(`INSERT INTO subs(cid,sub,created,dev) VALUES(?,?,?,?)
    ON CONFLICT(sub) DO UPDATE SET cid=excluded.cid, dev=excluded.dev`).run(req.user.id, s, nowISO(), dev);
  if (before === 0) sendPush(req.user.id, '🔔 Уведомления подключены', 'Теперь сообщим о штампах и бесплатном кофе!');
  res.json({ ok: true });
});

pushRouter.post('/api/push/test', userGuard, async (req, res) => {
  if (req.headers['x-smoke-test']) {
  return res.json({ ok: true, skipped: 'smoke-test' });
}
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

pushRouter.post('/api/push/send-hours-update', adminGuard, async (req, res) => {
  const body = 'Обновили график доставки: октябрь–апрель — пн–чт 11:00–21:00, пт–вс 11:00–22:00. Предзаказ доступен по расписанию.';
  const title = 'Пятница — новый график';
  const customers = db.prepare(`SELECT id AS cid, tg, notify_tg, notify_web
    FROM customers
    WHERE role='guest'
    ORDER BY id`).all();

  let recipients = 0, telegramSent = 0, pushSent = 0, failed = 0;
  for (const customer of customers) {
    const useTelegram = Boolean(customer.tg) && customer.notify_tg !== 0;
    const usePush = !useTelegram && customer.notify_web !== 0;
    if (!useTelegram && !usePush) continue;
    recipients++;

    if (useTelegram) {
      const result = await tgSend(customer.tg, title + '\n' + body);
      if (result?.ok) telegramSent++;
      else failed++;
      continue;
    }

    const fcm = await sendFcm(customer.cid, title, body);
    pushSent += fcm.sent;
    failed += fcm.failed;
    const subscriptions = db.prepare('SELECT sub FROM subs WHERE cid=?').all(customer.cid);
    for (const row of subscriptions) {
      try {
        await webpush.sendNotification(JSON.parse(row.sub), JSON.stringify({ title, body }));
        pushSent++;
      } catch (error) {
        failed++;
        if (error.statusCode === 404 || error.statusCode === 410) {
          db.prepare('DELETE FROM subs WHERE sub=?').run(row.sub);
        }
      }
    }
  }

  logEv(req.user.name, `обновление графика: ${recipients} получателей, Telegram ${telegramSent}, push ${pushSent}`);
  res.json({ ok: true, recipients, telegramSent, pushSent, failed });
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