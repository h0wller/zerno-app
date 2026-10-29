// server/services/push.js
// Оркестратор уведомлений: TG + Web Push + FCM
// Уважает notify_tg / notify_web флаги клиента

import webpush from 'web-push';
import { db } from '../db/connection.js';
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
    const result = await tgSend(c.tg, text, markup);
    if (!result?.ok) {
      console.error('[push] tg failed for customer:', result?.reason || 'unknown');
      return result || { ok: false, reason: 'empty_result' };
    }
    console.log('[push] tg ok: cid=' + cid + ' title="' + (title || '') + '"');
    return result;
  } catch (err) {
    console.error('[push] tg ERR for cid=' + cid + ':', err.message);
    return { ok: false, reason: 'exception', error: err.message };
  }
}

export async function sendPush(cid, title, body, markup) {
  const result = { ok: true, telegram: null, web: null, fcm: null };
  try {
    const c = db.prepare('SELECT tg, notify_tg, notify_web FROM customers WHERE id=?').get(cid);
    const wantTg = !c || c.notify_tg !== 0;
    const wantWeb = !c || c.notify_web !== 0;

    if (wantTg) {
      result.telegram = await sendTg(cid, title, body, markup);
    } else {
      result.telegram = { ok: false, reason: 'disabled' };
      console.log('[push] tg skip: notify_tg выключен у cid=' + cid);
    }

    if (wantWeb) {
      result.fcm = await sendFcm(cid, title, body).then(
        value => ({ ok: true, value }),
        err => {
          console.error('[push] sendFcm err cid=' + cid + ':', err.message);
          return { ok: false, reason: 'exception', error: err.message };
        }
      );
      const rows = db.prepare('SELECT sub FROM subs WHERE cid=?').all(cid);
      let sent = 0;
      let failed = 0;
      for (const r of rows) {
        try {
          await webpush.sendNotification(JSON.parse(r.sub), JSON.stringify({ title, body }));
          sent++;
        } catch (e) {
          failed++;
          if (e.statusCode === 404 || e.statusCode === 410) {
            console.log('[push] webpush sub expired (удаляем): cid=' + cid);
            db.prepare('DELETE FROM subs WHERE sub=?').run(r.sub);
          } else {
            console.error('[push] webpush send err cid=' + cid + ':', e.message);
          }
        }
      }
      result.web = { ok: failed === 0, sent, failed };
    } else {
      result.web = { ok: false, reason: 'disabled' };
    }
    result.ok = !!(result.telegram?.ok || result.web?.ok || result.fcm?.ok);
    return result;
  } catch (err) {
    console.error('[push] sendPush fatal err for cid=' + cid + ':', err.message);
    return { ...result, ok: false, error: err.message };
  }
}