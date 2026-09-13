// server/services/sms.js
// Сервис SMS: sms.ru через API_ID
// ph10 — нормализация телефона из utils/phone.js

import { ph10 } from '../utils/phone.js';

const SMS_API = process.env.SMSRU_API_ID || '';

export async function sendSms(phone, text) {
  if (!SMS_API) { console.log('[DEV SMS]', phone, text); return; }
  try {
    await fetch(`https://sms.ru/sms/send?api_id=${SMS_API}&to=7${ph10(phone)}&text=${encodeURIComponent(text)}&json=1`);
  } catch (e) {}
}