// server/services/push.js
// Оркестратор уведомлений: Telegram HTML + Web Push/FCM plain text.
import { createRequire } from 'node:module';
import { db } from '../db/connection.js';
import { tgSend, escapeTelegramHtml } from './telegram.js';
import { sendFcm } from './fcm.js';

const require = createRequire(import.meta.url);
const { sendNotification } = require('web-push');

export async function sendTg(cid, title, htmlBody, markup) {
  try {
    const customer = db.prepare('SELECT id, tg FROM customers WHERE id=?').get(cid);
    if (!customer || !customer.tg) return { ok: false, reason: 'no_tg' };
    const html = title
      ? escapeTelegramHtml(title) + (htmlBody ? '\\n' + htmlBody : '')
      : String(htmlBody || '');
    const result = await tgSend(customer.tg, html, markup);
    if (!result?.ok) {
      console.error('[push] tg failed for customer:', result?.reason || 'unknown');
      return result || { ok: false, reason: 'empty_result' };
    }
    console.log('[push] tg accepted by API: cid=' + cid);
    return result;
  } catch (error) {
    console.error('[push] tg ERR for cid=' + cid + ':', error.message);
    return { ok: false, reason: 'exception', error: error.message };
  }
}

/**
 * Canonical form: sendPush(cid, { title, text, html }, markup?)
 * text is plain for Web Push and FCM; html is escaped Telegram HTML.
 * The legacy positional signature remains temporarily for maintenance scripts.
 */
export async function sendPush(cid, notification, bodyOrMarkup, legacyMarkup, legacyTelegramBody) {
  const canonical = notification && typeof notification === 'object' && !Array.isArray(notification);
  const title = String(canonical ? notification.title || '' : notification || '');
  const text = String(canonical ? notification.text || '' : bodyOrMarkup || '');
  const html = String(canonical
    ? (notification.html === undefined ? escapeTelegramHtml(text) : notification.html)
    : (legacyTelegramBody === undefined ? escapeTelegramHtml(text) : legacyTelegramBody));
  const markup = canonical ? bodyOrMarkup : legacyMarkup;

  const result = { ok: false, telegram: null, web: null, fcm: null };
  try {
    const customer = db.prepare('SELECT tg, notify_tg, notify_web FROM customers WHERE id=?').get(cid);
    if (!customer) return { ...result, error: 'customer_not_found' };
    const wantTelegram = customer.notify_tg !== 0;
    const wantWeb = customer.notify_web !== 0;

    if (wantTelegram) {
      result.telegram = await sendTg(cid, title, html, markup);
    } else {
      result.telegram = { ok: false, reason: 'disabled' };
    }

    if (wantWeb) {
      const fcmResult = await sendFcm(cid, title, text).catch(error => {
        console.error('[push] sendFcm err cid=' + cid + ':', error.message);
        return { sent: 0, failed: 1 };
      });
      result.fcm = {
        ...fcmResult,
        ok: Number(fcmResult?.sent) > 0,
        reason: Number(fcmResult?.sent) > 0 ? undefined : 'not_delivered'
      };

      const subscriptions = db.prepare('SELECT sub FROM subs WHERE cid=?').all(cid);
      let sent = 0;
      let failed = 0;
      for (const row of subscriptions) {
        try {
          await sendNotification(JSON.parse(row.sub), JSON.stringify({ title, body: text }));
          sent++;
        } catch (error) {
          failed++;
          if (error.statusCode === 404 || error.statusCode === 410) {
            db.prepare('DELETE FROM subs WHERE sub=?').run(row.sub);
          } else {
            console.error('[push] webpush send err cid=' + cid + ':', error.message);
          }
        }
      }
      result.web = {
        ok: sent > 0,
        sent,
        failed,
        reason: sent > 0 ? undefined : (subscriptions.length ? 'delivery_failed' : 'no_subscription')
      };
    } else {
      result.fcm = { ok: false, sent: 0, failed: 0, reason: 'disabled' };
      result.web = { ok: false, sent: 0, failed: 0, reason: 'disabled' };
    }

    result.ok = !!(result.telegram?.ok || result.web?.ok || result.fcm?.ok);
    return result;
  } catch (error) {
    console.error('[push] sendPush fatal err for cid=' + cid + ':', error.message);
    return { ...result, ok: false, error: error.message };
  }
}
