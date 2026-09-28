// server/services/push.js
// Оркестратор уведомлений: TG + Web Push + FCM
// Уважает notify_tg / notify_web флаги клиента

import webpush from 'web-push';
import { db } from '../config.js';
import { tgSend } from './telegram.js';
import { sendFcm } from './fcm.js';
// sendSms импортируем для доступности, но в sendPush не используется
// (может быть использован другими доменами)

// [tg-push-logging-v1]
export async function sendTg(cid, title, body, markup) {
  try {
    const c = db.prepare('SELECT id, tg FROM customers WHERE id=?').get(cid);
    if (!c || !c.tg) {
      console.log('[push] tg skip: cid=' + cid + ' (нет привязанного Telegram)');
      return { ok: false, reason: 'no_tg' };
    }
    const text = title ? (title + '\n' + body) : body;
    await tgSend(c.tg, text, markup);
    console.log('[push] tg ok: cid=' + cid + ' tg=' + c.tg + ' title="' + (title || '') + '"');
    return { ok: true };
  } catch (err) {
    console.error('[push] tg ERR for cid=' + cid + ':', err.message);
    return { ok: false, error: err.message };
  }
}

export async function sendPush(cid, title, body, markup) {
  try {
    const c = db.prepare('SELECT tg, notify_tg, notify_web FROM customers WHERE id=?').get(cid);
    const wantTg = !c || c.notify_tg !== 0;
    const wantWeb = !c || c.notify_web !== 0;

    if (wantTg) {
      await sendTg(cid, title, body, markup).catch(e => {
        console.error('[push] sendTg unhandled for cid=' + cid + ':', e.message);
      });
    } else {
      console.log('[push] tg skip: notify_tg выключен у cid=' + cid);
    }

    if (wantWeb) {
      sendFcm(cid, title, body).catch(e => {
        console.error('[push] sendFcm err cid=' + cid + ':', e.message);
      });
      const rows = db.prepare('SELECT sub FROM subs WHERE cid=?').all(cid);
      for (const r of rows) {
        try {
          await webpush.sendNotification(JSON.parse(r.sub), JSON.stringify({ title, body }));
        } catch (e) {
          if (e.statusCode === 404 || e.statusCode === 410) {
            console.log('[push] webpush sub expired (удаляем): cid=' + cid);
            db.prepare('DELETE FROM subs WHERE sub=?').run(r.sub);
          } else {
            console.error('[push] webpush send err cid=' + cid + ':', e.message);
          }
        }
      }
    }
    return { ok: true };
  } catch (err) {
    console.error('[push] sendPush fatal err for cid=' + cid + ':', err.message);
    return { ok: false, error: err.message };
  }
}