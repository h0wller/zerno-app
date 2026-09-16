// server/services/push.js
// Оркестратор уведомлений: TG + Web Push + FCM
// Уважает notify_tg / notify_web флаги клиента

import webpush from 'web-push';
import { db } from '../config.js';
import { tgSend } from './telegram.js';
import { sendFcm } from './fcm.js';
// sendSms импортируем для доступности, но в sendPush не используется
// (может быть использован другими доменами)

export async function sendTg(cid, title, body, markup) {
  const c = db.prepare('SELECT tg FROM customers WHERE id=?').get(cid);
  if (c && c.tg) await tgSend(c.tg, `${title}\n${body}`, markup);
}

export async function sendPush(cid, title, body, markup) {
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
        if (e.statusCode === 404 || e.statusCode === 410) {
          db.prepare('DELETE FROM subs WHERE sub=?').run(r.sub);
        }
      }
    }
  }
  return { ok: true };
}