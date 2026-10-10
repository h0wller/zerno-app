import { db } from '../db/connection.js';
import { addHist, logEv, cust } from './helpers.js';
import { sendPush } from '../services/push.js';
import { APP_URL } from '../services/telegram.js';
import { stampBar, cupWord } from '../utils/loyalty-helpers.js';

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

export function grantWelcome(cid, by) {
  const c = db.prepare('SELECT * FROM customers WHERE id=?').get(cid);
  if (!c || c.welcome) return null;
  db.prepare('UPDATE customers SET welcome=1, verified=1 WHERE id=?').run(cid);
  addHist(cid, '🎁 Приветственные бонусы: +1 штамп и скидка 200 ₽ на доставку (код ПРИВЕТ)', 'Система');
  return grant(cid, by || 'Система');
}