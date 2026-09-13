import { db } from '../db/connection.js';
import { addHist, logEv, cust } from './helpers.js';
import { sendPush } from '../services/push.js';
import { APP_URL } from '../config.js';

export function grant(cid, by) { 
  const c = db.prepare('SELECT * FROM customers WHERE id=?').get(cid);
  if (!c) return null;
  c.stamps++; c.cups++;
  db.prepare('UPDATE customers SET stamps=?,cups=? WHERE id=?').run(c.stamps, c.cups, cid);
  addHist(cid, `Штамп ${c.stamps} из 10`, by);
  let ten = false;
  if (c.stamps >= 10) { c.stamps = 0; c.free++; ten = true;
    db.prepare('UPDATE customers SET stamps=?,free=? WHERE id=?').run(0, c.free, cid);
    addHist(cid, '🎉 10-й кофе — подарок начислен', 'Система'); }
  logEv(c.name, ten ? '10-й кофе — подарок начислен' : `+1 штамп → ${c.stamps} из 10`);
  const f = db.prepare('SELECT * FROM customers WHERE id=?').get(cid);
  if (ten) sendPush(cid, '🎁 Бесплатный кофе ждёт вас!', 'Вы собрали 10 штампов. Заходите — кофе за наш счёт.', { text: '☕ Мой профиль', url: APP_URL });
  else if (f.stamps === 9) sendPush(cid, '☕ Осталась одна чашка!', 'У вас 9 из 10 штампов. Следующий кофе — бесплатно 😉', { text: '☕ Мой профиль', url: APP_URL });
  return { customer: cust(f), ten, msg: ten ? '10-й штамп! Начислен бесплатный кофе' : `+1 штамп → ${f.stamps} из 10` }; 
}

export function redeem(cid, by, item) {
  const c = db.prepare('SELECT * FROM customers WHERE id=?').get(cid);
  if (!c || c.free < 1) return null;
  db.prepare('UPDATE customers SET free=? WHERE id=?').run(c.free - 1, cid);
  addHist(cid, `🎁 Списан бесплатный кофе: ${item || 'классика'} (осталось ${c.free - 1})`, by);
  logEv(c.name, 'списан бесплатный кофе: ' + (item || 'классика'));
  return { customer: cust(db.prepare('SELECT * FROM customers WHERE id=?').get(cid)) };
}

export function grantWelcome(cid, by) {
  const c = db.prepare('SELECT * FROM customers WHERE id=?').get(cid);
  if (!c || c.welcome) return null;
  db.prepare('UPDATE customers SET welcome=1, verified=1 WHERE id=?').run(cid);
  addHist(cid, '🎁 Приветственный бонус: +1 штамп', 'Система');
  return grant(cid, by || 'Система');
}