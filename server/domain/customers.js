import crypto from 'crypto';
import { db } from '../db/connection.js';
import { addHist, cust } from './helpers.js';
import { uid, nowISO } from '../utils/id-time.js';
import { fmtPhone, ph10 } from '../utils/phone.js';
import { hashPin } from '../utils/security.js';

export function createCustomer(name, phone, pin) { 
  const p = fmtPhone(phone);
  if (String(name).trim().length < 2) return { err: 'Введите имя', code: 400 };
  if (ph10(p).length < 10) return { err: 'Введите номер полностью', code: 400 };
  if (pin !== undefined && !/^\d{4}$/.test(String(pin))) return { err: 'PIN — ровно 4 цифры', code: 400 };
  if (db.prepare('SELECT 1 FROM customers WHERE phone=?').get(p)) return { err: 'exists', code: 409 };
  const id = uid('u'), qr = 'Z-' + crypto.randomBytes(3).toString('hex').toUpperCase();
  db.prepare('INSERT INTO customers (id,name,phone,stamps,free,cups,qr,created_at,role,pin) VALUES (?,?,?,?,?,?,?,?,?,?)')
  .run(id, name.trim(), p, 0, 0, 0, qr, nowISO(), 'guest', pin? hashPin(pin) : '');
  addHist(id, 'Профиль создан', 'Приложение');
  return { customer: cust(db.prepare('SELECT * FROM customers WHERE id=?').get(id)) }; 
}