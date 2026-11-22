/* server/routes/push.js — module-09: push-подписки, VAPID, рассылки */
import { Router } from 'express';
import { db } from '../db/connection.js';
import { userGuard, adminGuard } from '../middleware/auth.js';
import { nowISO } from '../utils/id-time.js';
import { logEv } from '../domain/helpers.js';
import { getVapidPublicKey } from '../db/index.js';
import { sendPush } from '../services/push.js';

const pushRouter = Router();

pushRouter.get('/api/vapid', (req, res) => res.json({ publicKey: getVapidPublicKey() }));

pushRouter.post('/api/push/subscribe', userGuard, (req, res) => {
  const sub = req.body.sub;
  if (!sub || !sub.endpoint) return res.status(400).json({ error: 'bad sub' });
  const s = JSON.stringify(sub);
  const dev = String(req.body.dev || '').slice(0, 64);
  // Одно устройство — одна подписка: старые строки того же устройства удаляем.
  if (dev) db.prepare('DELETE FROM subs WHERE cid=? AND dev=? AND sub<>?').run(req.user.id, dev, s);
  db.prepare(`INSERT INTO subs(cid,sub,created,dev) VALUES(?,?,?,?)
    ON CONFLICT(sub) DO UPDATE SET cid=excluded.cid, dev=excluded.dev`).run(req.user.id, s, nowISO(), dev);
  res.json({ ok: true });
});

pushRouter.post('/api/push/test', userGuard, async (req, res) => {
  if (req.headers['x-smoke-test']) {
  return res.json({ ok: true, skipped: 'smoke-test' });
}
  const result = await sendPush(req.user.id, {
    title: '🔔 Тестовый пуш',
    text: 'Если ты это видишь — пуши на этом устройстве работают'
  });
  const deliveredToDevice = !!(result.web?.ok || result.fcm?.ok);
  res.status(deliveredToDevice ? 200 : 503).json({
    ...result,
    ok: deliveredToDevice,
    reason: deliveredToDevice ? undefined : 'no_device_delivery',
    message: deliveredToDevice
      ? 'Тестовое уведомление передано службе доставки устройства'
      : 'Подписка сохранена, но ни Web Push, ни FCM не подтвердили отправку на устройство',
    error: deliveredToDevice ? undefined : 'Подписка сохранена, но доставка на устройство не подтверждена'
  });
});

pushRouter.post('/api/push/fcm', userGuard, (req, res) => {
  const token = String(req.body.token || '');
  if (!token) return res.status(400).json({ error: 'bad token' });
  db.prepare(`INSERT INTO fcm(cid,token,created) VALUES(?,?,?)
    ON CONFLICT(token) DO UPDATE SET cid=excluded.cid, created=excluded.created`)
    .run(req.user.id, token, nowISO());
  res.json({ ok: true });
});

pushRouter.get('/api/push/subs', adminGuard, (req, res) => {
  const subs = db.prepare(`SELECT s.created, s.cid, c.name, c.phone FROM subs s LEFT JOIN customers c ON c.id=s.cid ORDER BY s.id DESC`).all();
  const tg = db.prepare(`SELECT created_at AS created, id AS cid, name, phone FROM customers WHERE tg IS NOT NULL AND tg != '' ORDER BY created_at DESC`).all();
  res.json({ subs, tg });
});

pushRouter.post('/api/push/send', adminGuard, async (req, res) => {
  const body = String(req.body.body || '').trim().slice(0, 2000);
  if (!body) return res.status(400).json({ error: 'Введите текст уведомления' });
  const rows = db.prepare(`SELECT id AS cid FROM customers c
    WHERE c.id IN (SELECT cid FROM subs)
       OR c.id IN (SELECT cid FROM fcm)
       OR (c.tg IS NOT NULL AND c.tg != '')`).all();
  let delivered = 0;
  let failed = 0;
  const errors = [];
  for (const customer of rows) {
    const result = await sendPush(customer.cid, { title: '…и кофе 🌊', text: body });
    const count = Number(result.web?.sent || 0) + Number(result.fcm?.sent || 0) + (result.telegram?.ok ? 1 : 0);
    delivered += count;
    if (!result.ok) {
      failed++;
      errors.push(result.web?.reason || result.fcm?.reason || result.telegram?.reason || 'not_delivered');
    }
  }
  logEv(req.user.name, `пуш всем (${rows.length})`);
  res.json({ ok: failed === 0, sent: rows.length, recipients: rows.length, delivered, failed, errors: errors.slice(0, 5) });
});

pushRouter.post('/api/push/send-hours-update', adminGuard, async (req, res) => {
  const body = 'Обновили график доставки: октябрь–апрель — пн–чт 11:00–21:00, пт–вс 11:00–22:00. Предзаказ доступен по расписанию.';
  const title = 'Пятница — новый график';
  const customers = db.prepare(`SELECT id AS cid
    FROM customers
    WHERE role='guest'
    ORDER BY id`).all();

  let recipients = 0, telegramSent = 0, pushSent = 0, failed = 0;
  for (const customer of customers) {
    const result = await sendPush(customer.cid, { title, text: body });
    const telegramAccepted = !!result.telegram?.ok;
    const pushAccepted = Number(result.web?.sent || 0) + Number(result.fcm?.sent || 0);
    if (!telegramAccepted && !pushAccepted) continue;
    recipients++;
    if (telegramAccepted) telegramSent++;
    pushSent += pushAccepted;
    if (!result.ok) failed++;
  }

  logEv(req.user.name, `обновление графика: ${recipients} получателей, Telegram ${telegramSent}, push ${pushSent}`);
  res.json({ ok: failed === 0, recipients, telegramSent, pushSent, failed });
});

function removeDevicePushRegistrations(cid, device = {}) {
  const endpoint = String(device.endpoint || '');
  const token = String(device.token || '');

  if (endpoint) {
    const rows = db.prepare('SELECT sub FROM subs WHERE cid=?').all(cid);
    for (const row of rows) {
      try {
        if (JSON.parse(row.sub).endpoint === endpoint) {
          db.prepare('DELETE FROM subs WHERE cid=? AND sub=?').run(cid, row.sub);
        }
      } catch (_) {}
    }
  }
  if (token) db.prepare('DELETE FROM fcm WHERE cid=? AND token=?').run(cid, token);

  // An empty tuple is the explicit account-wide operation (used by settings
  // that revoke all registered devices). A partial tuple is device-scoped.
  if (!endpoint && !token) {
    db.prepare('DELETE FROM subs WHERE cid=?').run(cid);
    db.prepare('DELETE FROM fcm WHERE cid=?').run(cid);
  }
}

pushRouter.post('/api/push/unsubscribe', userGuard, (req, res) => {
  removeDevicePushRegistrations(req.user.id, req.body || {});
  res.json({ ok: true });
});

pushRouter.post('/api/push/del', adminGuard, (req, res) => {
  const cid = String(req.body.cid || '');
  db.prepare('DELETE FROM subs WHERE cid=?').run(cid);
  db.prepare('DELETE FROM fcm WHERE cid=?').run(cid);
  res.json({ ok: true });
});

export default pushRouter;