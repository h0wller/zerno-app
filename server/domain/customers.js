import crypto from 'crypto';
import { db } from '../db/connection.js';
import { addHist, cust } from './helpers.js';
import { uid, nowISO } from '../utils/id-time.js';
import { fmtPhone, ph10 } from '../utils/phone.js';
import { hashPin } from '../utils/security.js';

export function createCustomer(name, phone, pin, createdBy = 'Приложение') {
  const p = fmtPhone(phone);
  const phoneDigits = ph10(p);
  if (String(name).trim().length < 2) return { err: 'Введите имя', code: 400 };
  if (phoneDigits.length !== 10) return { err: 'Введите номер полностью', code: 400 };
  if (pin !== undefined && pin !== '' && !/^\\d{4}$/.test(String(pin))) {
    return { err: 'PIN — ровно 4 цифры', code: 400 };
  }

  return db.transaction(() => {
    // Legacy rows may contain different formatting for the same phone.
    // Compare the canonical digits across every registration entry point.
    const duplicate = db.prepare('SELECT phone FROM customers').all()
      .some(row => ph10(row.phone) === phoneDigits);
    if (duplicate) return { err: 'exists', code: 409 };

    const id = uid('u');
    const qr = 'Z-' + crypto.randomBytes(3).toString('hex').toUpperCase();
    db.prepare('INSERT INTO customers (id,name,phone,stamps,free,cups,qr,created_at,role,pin) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run(id, name.trim(), p, 0, 0, 0, qr, nowISO(), 'guest', pin ? hashPin(pin) : '');
    if (createdBy) addHist(id, 'Профиль создан', createdBy);
    return { customer: cust(db.prepare('SELECT * FROM customers WHERE id=?').get(id)) };
  }).immediate();
}
