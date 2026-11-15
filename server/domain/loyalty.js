import { db } from '../db/connection.js';
import { addHist, logEv, cust } from './helpers.js';
import { sendPush } from '../services/push.js';
import { APP_URL } from '../services/telegram.js';
import { stampBar, cupWord, splitStamps } from '../utils/loyalty-helpers.js';

export { stampBar, cupWord };

export function grant(cid, by) {
  const c = db.prepare('SELECT * FROM customers WHERE id=?').get(cid);
  if (!c) return null;
  c.stamps++; c.cups++;
  db.prepare('UPDATE customers SET stamps=?,cups=? WHERE id=?').run(c.stamps, c.cups, cid);
  addHist(cid, `Штамп ${c.stamps} из 10`, by);
  let ten = false;
  if (c.stamps >= 10) {
    c.stamps = 0; c.free++; ten = true;
    db.prepare('UPDATE customers SET stamps=?,free=? WHERE id=?').run(0, c.free, cid);
    addHist(cid, '🎉 10-й кофе — подарок начислен', 'Система');
  }
  logEv(c.name, ten ? '10-й кофе — подарок начислен' : `+1 штамп → ${c.stamps} из 10`);
  const f = db.prepare('SELECT * FROM customers WHERE id=?').get(cid);
  const baseAppUrl = APP_URL || 'https://friday.andcoffee.online';
  const bonusKb = {
    inline_keyboard: [[
      { text: '☕ Открыть карту штампов', web_app: { url: baseAppUrl + '/?src=tg&brand=coffee&tab=bonus' } }
    ]]
  };

  if (ten) {
    sendPush(
      cid,
      '🎁 Бесплатный кофе ваш!',
      `${stampBar(10)} 10/10\n\nВы собрали 10 штампов! Заходите в «…и кофе» — напиток за наш счёт ☕🎉`,
      {
        inline_keyboard: [[
          { text: '📱 Показать QR кассиру', web_app: { url: baseAppUrl + '/?src=tg&brand=coffee&tab=bonus' } }
        ]]
      }
    );
  } else if (f.stamps === 9) {
    sendPush(
      cid,
      '🔥 Осталась всего одна чашка!',
      `${stampBar(9)} 9/10\n\nУ вас 9 из 10 штампов. Следующий кофе — бесплатно! Ждём вас у моря 🌊`,
      bonusKb
    );
  } else {
    const left = 10 - f.stamps;
    sendPush(
      cid,
      '☕ Вам начислен штамп!',
      `${stampBar(f.stamps)} ${f.stamps}/10\n\nШтампов: ${f.stamps} из 10. До подарка осталось: ${left} ${cupWord(left)} 🌊`,
      bonusKb
    );
  }
  return { customer: cust(f), ten, msg: ten ? '10-й штамп! Начислен бесплатный кофе' : `+1 штамп → ${f.stamps} из 10` };
  
}
/**
 * Ядро начисления штампов: один UPDATE и расчёт подарков.
 * Не пишет историю/журнал и не открывает транзакцию — это делает вызывающий,
 * чтобы составное начисление (например, приветственный бонус) осталось одной атомарной операцией.
 * @param {string} cid - id клиента.
 * @param {number} n - сколько штампов начислить.
 * @returns {{ten: boolean, addedFree: number, stamps: number, free: number, name: string, added: number}|null}
 *   null, если клиента нет или n <= 0.
 */
export function applyStamps(cid, n) {
  const add = Math.floor(Number(n) || 0);
  const c = db.prepare('SELECT id, name, stamps, free FROM customers WHERE id=?').get(cid);
  if (!c || add <= 0) return null;
  const r = splitStamps(c.stamps, c.free, add);
  db.prepare('UPDATE customers SET stamps=?, free=? WHERE id=?').run(r.stamps, r.free, cid);
  return { ten: r.gotFree, addedFree: r.addedFree, stamps: r.stamps, free: r.free, name: c.name, added: add };
}

/**
 * Начисляет n штампов одним UPDATE в транзакции: 10 и больше — складываются в подарки,
 * остаток остаётся на карте. cups не трогает (это счётчик реально выпитых чашек, его пишет grant).
 * Пишет ровно одну запись в историю и НЕ отправляет пуш: текст уведомления знает только вызывающий.
 * @param {string} cid - id клиента.
 * @param {number} n - сколько штампов начислить.
 * @param {string} [by] - автор операции для истории.
 * @returns {{customer: object, ten: boolean, addedFree: number}|null} null, если клиента нет или n <= 0.
 */
export function grantStamps(cid, n, by = 'Система') {
  let r = null;
  const apply = db.transaction(() => {
    r = applyStamps(cid, n);
    if (!r) return;
    addHist(cid, `Начислено ${r.added} шт. → ${r.stamps}/10${r.addedFree ? `, подарок(ов): +${r.addedFree}` : ''}`, by);
    logEv(r.name, `+${r.added} штампов → ${r.stamps}/10`);
  });
  apply();
  if (!r) return null;
  return { customer: cust(db.prepare('SELECT * FROM customers WHERE id=?').get(cid)), ten: r.ten, addedFree: r.addedFree };
}

export function redeem(cid, by, item) {
  const c = db.prepare('SELECT * FROM customers WHERE id=?').get(cid);
  if (!c || c.free < 1) return null;
  db.prepare('UPDATE customers SET free=? WHERE id=?').run(c.free - 1, cid);
  addHist(cid, `🎁 Списан бесплатный кофе: ${item || 'классика'} (осталось ${c.free - 1})`, by);
  logEv(c.name, 'списан бесплатный кофе: ' + (item || 'классика'));
  const baseAppUrl = APP_URL || 'https://friday.andcoffee.online';
  const leftFree = c.free - 1;
  const freeText = leftFree > 0 ? `\nДоступных подарков: <b>${leftFree}</b>` : '';
  sendPush(
    cid,
    '🎁 Бесплатный кофе получен!',
    `Списан подарок: <b>${item || 'кофе'}</b>.${freeText}\nСпасибо, что вы с нами 🌊`,
    {
      inline_keyboard: [[
        { text: '☕ Открыть меню', web_app: { url: baseAppUrl + '/?src=tg&brand=coffee' } }
      ]]
    }
  );
  return { customer: cust(db.prepare('SELECT * FROM customers WHERE id=?').get(cid)) };
}

export function grantWelcome(cid, _by) {
  const c = db.prepare('SELECT * FROM customers WHERE id=?').get(cid);
  if (!c || c.welcome) return null;
  db.prepare('UPDATE customers SET welcome=1, verified=1 WHERE id=?').run(cid);
  // Приветственные бонусы (10 штампов = напиток, первая доставка бесплатно) выдаёт grantBonus по настройке админа.
  return { customer: cust(db.prepare('SELECT * FROM customers WHERE id=?').get(cid)) };
}