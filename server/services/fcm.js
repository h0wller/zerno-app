// server/services/fcm.js
// Сервис FCM: Firebase Cloud Messaging
// Инициализация один раз при старте; локальный флаг ready

import { initializeApp, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { db } from '../config.js';
let fcmReady = false;

if (process.env.FIREBASE_SA) {
  try {
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SA)) });
    fcmReady = true;
  } catch (e) { console.log('FCM init error', e.message); }
}

export async function sendFcm(cid, title, body) {
  try {
    if (!fcmReady) return;
    const messaging = getMessaging();
    const rows = db.prepare('SELECT token FROM fcm WHERE cid=?').all(cid);
    for (const r of rows) {
      try {
        await messaging.send({ token: r.token, notification: { title, body } });
      } catch (e) {
        if (String(e.code || '').includes('registration-token')) {
          db.prepare('DELETE FROM fcm WHERE token=?').run(r.token);
        }
      }
    }
  } catch (e) { console.log('FCM send error', e.message); }
}