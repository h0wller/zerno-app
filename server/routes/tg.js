/* server/routes/tg.js — module-08: Telegram bot webhook. */

import { Router } from 'express';
import { db } from '../db/connection.js';
import { tgSend, TG_TOKEN, TG_WEBHOOK_SECRET, APP_URL } from '../services/telegram.js';
import { fmtPhone, ph10 } from '../utils/phone.js';
import { otpStore } from '../utils/otp.js';
import { grantWelcome } from '../domain/loyalty.js';
import { cust, addHist, issueToken } from '../domain/helpers.js';
import { createCustomer } from '../domain/customers.js';
import { nowISO } from '../utils/id-time.js';
import { stampBar, cupWord } from '../utils/loyalty-helpers.js';

function welcomeKeyboard(c) {
  const rows = [
    [{ text: '☕ Кофейня — меню и штампы', web_app: { url: APP_URL + '/?src=tg&brand=coffee' } }],
    [{ text: '🍕 Пятница — доставка',     web_app: { url: APP_URL + '/?src=tg&brand=delivery' } }],
  ];
  if (c) {
    rows.push([
      { text: '📦 Мои заказы',    web_app: { url: APP_URL + '/?src=tg&brand=delivery&tab=orders' } },
      { text: '💬 Задать вопрос', callback_data: 'support_choose' },
    ]);
  } else {
    rows.push([{ text: '🔗 Привязать номер', callback_data: 'link_phone' }]);
  }
  return { inline_keyboard: rows };
}

async function answerCallback(cbId) {
  if (!cbId || !TG_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${TG_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: cbId }),
  }).catch(() => {});
}

function bonusKeyboard() {
  return { inline_keyboard: [
    [{ text: '📱 Показать QR кассиру', web_app: { url: APP_URL + '/?src=tg&brand=coffee&tab=bonus' } }],
    [{ text: '🔄 Обновить', callback_data: 'bonus' }],
  ]};
}

export function createTgRouter({ appKb }) {
  const tgRouter = Router();

  async function sendBonusInfo(targetChatId) {
    const c = db.prepare('SELECT * FROM customers WHERE tg=?').get(targetChatId);
    if (!c) {
      await tgSend(targetChatId, 'Сначала привяжите номер — нажмите кнопку ниже 👇', appKb());
      return;
    }
    const left = 10 - c.stamps;
    const line = c.free
      ? ('🎁 Бесплатных кофе: <b>' + c.free + '</b>')
      : ('До подарка: <b>' + left + '</b> ' + cupWord(left));
    await tgSend(targetChatId,
      '☕ <b>' + c.name + '</b>\n\n' + stampBar(c.stamps) + '\n\nШтампов: <b>' + c.stamps + '/10</b>\n' + line,
      bonusKeyboard()
    );
  }

  async function sendLinkPhonePrompt(targetChatId) {
    await tgSend(targetChatId,
      'Привяжите номер телефона, чтобы копить штампы и получать бонусы.\n\n' +
      'Если у вас <b>уже есть профиль</b> в приложении — нажмите кнопку ниже и поделитесь номером 👇',
      appKb()
    );
    await tgSend(targetChatId,
      'Если профиля ещё нет — создайте его в приложении (10 секунд):',
      { inline_keyboard: [[{ text: '📝 Создать профиль', web_app: { url: APP_URL + '/?src=tg&brand=coffee' } }]] }
    );
  }

  async function sendSupportMenu(targetChatId) {
    await tgSend(targetChatId, '💬 Служба заботы на связи. По какой теме вопрос?', {
      inline_keyboard: [
        [{ text: '🍕 Доставка — «Пятница»', callback_data: 'support_delivery' }],
        [{ text: '☕ Кофейня — «…и кофе»',  callback_data: 'support_coffee' }],
      ]
    });
  }

  async function sendMenuButtons(targetChatId) {
    await tgSend(targetChatId, 'Меню открывается прямо в Telegram 🍕☕', {
      inline_keyboard: [
        [{ text: '☕ Кофейня', web_app: { url: APP_URL + '/?src=tg&brand=coffee' } }],
        [{ text: '🍕 Доставка', web_app: { url: APP_URL + '/?src=tg&brand=delivery' } }],
      ],
    });
  }

  async function sendSupportChatLink(targetChatId, ctx, msgIdToEdit = null) {
    const label = ctx === 'delivery' ? '🍕 Доставка' : '☕ Кофейня';
    const openBtn = {
      inline_keyboard: [[
        { text: '💬 Открыть чат с поддержкой', web_app: { url: APP_URL + '/?src=tg&brand=' + ctx + '&tab=chat&ctx=' + ctx } }
      ]]
    };
    if (msgIdToEdit && TG_TOKEN) {
      await fetch('https://api.telegram.org/bot' + TG_TOKEN + '/editMessageText', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: targetChatId,
          message_id: msgIdToEdit,
          text: 'Открываю чат: ' + label,
          reply_markup: openBtn,
        }),
      }).catch(() => {});
    } else {
      await tgSend(targetChatId, 'Открываю чат: ' + label, openBtn);
    }
  }

  async function sendOrdersInfo(targetChatId) {
    const c = db.prepare('SELECT * FROM customers WHERE tg=?').get(targetChatId);
    if (!c) {
      await tgSend(targetChatId, 'Сначала привяжите профиль 👇', appKb());
      return;
    }
    await tgSend(targetChatId,
      '📦 Мои заказы открываются в приложении — статусы, состав и повтор одним тапом:',
      { inline_keyboard: [[{ text: '📦 Открыть мои заказы', web_app: { url: APP_URL + '/?src=tg&brand=delivery&tab=orders' } }]] }
    );
  }

  tgRouter.post('/api/tg/webhook', async (req, res) => {
    if (TG_WEBHOOK_SECRET && req.header('x-telegram-bot-api-secret-token') !== TG_WEBHOOK_SECRET)
      return res.status(403).json({ error: 'bad secret' });

    const u = req.body;
    res.json({ ok: true });
    if (!u) return;

    try {
      var _kind = u.callback_query ? 'callback' : (u.message ? (u.message.contact ? 'contact' : 'message') : 'other');
      var _body = u.callback_query ? (u.callback_query.data || '') : (u.message ? (u.message.text || (u.message.contact ? 'phone' : '')) : '');
      console.log('[tg] in  kind=' + _kind + '  body=' + JSON.stringify(_body) + '  from=' + (u.message ? u.message.chat.id : (u.callback_query ? u.callback_query.from.id : '?')));
    } catch (e) {}

    /* ────────────────────────── CALLBACK QUERY ────────────────────────── */
    if (u.callback_query) {
      const cb = u.callback_query;
      const chatId = String(cb.message?.chat?.id || cb.from?.id || '');
      const data = String(cb.data || '');
      await answerCallback(cb.id);
      if (!chatId) return;

      if (data === 'bonus') {
        await sendBonusInfo(chatId);
        return;
      }
      if (data === 'orders') {
        await sendOrdersInfo(chatId);
        return;
      }
      if (data.startsWith('reorder_')) {
        const orderId = data.slice(8);
        await tgSend(chatId, 'Открываю корзину с тем же составом 🛒', {
          inline_keyboard: [[{ text: '🛒 Открыть корзину', web_app: { url: `${APP_URL}/?src=tg&brand=delivery&reorder=${orderId}` } }]],
        });
        return;
      }
      if (data.startsWith('call_')) {
        const orderId = data.slice(5);
        await tgSend(chatId, 'Открываю чат поддержки 💬', {
          inline_keyboard: [[{ text: '💬 Открыть чат', web_app: { url: `${APP_URL}/?src=tg&tab=chat&no=${orderId}` } }]],
        });
        return;
      }
      if (data === 'support_choose') {
        await sendSupportMenu(chatId);
        return;
      }
      if (data === 'support_delivery' || data === 'support_coffee') {
        await sendSupportChatLink(chatId, data === 'support_delivery' ? 'delivery' : 'coffee', cb.message?.message_id);
        return;
      }
      if (data === 'link_phone') {
        await sendLinkPhonePrompt(chatId);
        return;
      }
      return;
    }

    /* ────────────────────────── ОБЫЧНЫЕ СООБЩЕНИЯ ────────────────────────── */
    if (!u.message) return;
    const chatId = String(u.message.chat.id);
    const text = String(u.message.text || '').trim();

    if (text === 'link_phone' || text === 'bonus' || text === 'orders' ||
        text === 'support_choose' || text === 'support_delivery' || text === 'support_coffee') {
      const cbChatId = String(u.message.chat.id);

      if (text === 'support_choose') {
        await sendSupportMenu(cbChatId);
        return;
      }
      if (text === 'support_delivery' || text === 'support_coffee') {
        await sendSupportChatLink(cbChatId, text === 'support_delivery' ? 'delivery' : 'coffee');
        return;
      }
      if (text === 'link_phone') {
        await sendLinkPhonePrompt(cbChatId);
        return;
      }
      if (text === 'bonus') {
        await sendBonusInfo(cbChatId);
        return;
      }
      if (text === 'orders') {
        await sendOrdersInfo(cbChatId);
        return;
      }
    }

    if (text.startsWith('/start reg_')) {
      const token = text.slice(11).trim();
      const st = otpStore.get('regtg:' + token);
      if (!st || Date.now() > st.expires) {
        tgSend(chatId, 'Ссылка для подтверждения устарела ⏳\nНажми «Подтвердить в Telegram» в приложении ещё раз.');
        return;
      }
      otpStore.set('regchat:' + chatId, { token, phone: st.phone, name: st.name || '', expires: Date.now() + 10 * 60 * 1000 });
      await tgSend(chatId, `Подтверждаю номер ${fmtPhone(st.phone)} — нажмите кнопку ниже 👇`, appKb());
      return;
    }

    if (text === '/start') {
      const c = db.prepare('SELECT * FROM customers WHERE tg=?').get(chatId);
      const hello = c
        ? `С возвращением, <b>${c.name}</b>!\n\n${stampBar(c.stamps)}\nШтампов: <b>${c.stamps}/10</b>` +
          (c.free ? `\n🎁 Бесплатных кофе: <b>${c.free}</b>` : '')
        : '☕ Привет! Я бот «…и кофе» и доставки «Пятница» 🌊🍕\n\n' +
          'Привяжите номер и заберите приветственные бонусы:\n' +
          '☕ <b>+1 штамп</b> на кофе у моря\n' +
          '🍕 <b>Скидка 200 ₽</b> на первый заказ доставки (промокод <b>ПРИВЕТ</b>)\n\n' +
          'Штампы, меню, заказы и чат поддержки — всё здесь 👇';
      await tgSend(chatId, hello, welcomeKeyboard(c));
      return;
    }

    if (text === '/menu') {
      await sendMenuButtons(chatId);
      return;
    }

    if (text === '/bonus') {
      await sendBonusInfo(chatId);
      return;
    }

    if (text === '/orders') {
      await sendOrdersInfo(chatId);
      return;
    }

    if (text === '/help') {
      await tgSend(chatId,
        '🤖 <b>Чем я могу помочь:</b>\n\n' +
        '• <b>Команды:</b>\n' +
        '/menu — меню кофейни и доставки\n' +
        '/bonus — мои штампы и подарки\n' +
        '/orders — мои заказы и статус\n' +
        '/start — главное меню\n\n' +
        '• <b>Или просто спросите меня словами:</b>\n' +
        '— «Сколько у меня штампов?»\n' +
        '— «Где мой заказ?»\n' +
        '— «Часы работы и адрес»\n' +
        '— «Позови оператора»',
        welcomeKeyboard(db.prepare('SELECT * FROM customers WHERE tg=?').get(chatId))
      );
      return;
    }

    if (u.message.contact) {
      const pend = otpStore.get('regchat:' + chatId);
      if (pend && Date.now() < pend.expires) {
        const contactPhone = fmtPhone(u.message.contact.phone_number);
        if (contactPhone === fmtPhone(pend.phone)) {
          const targetCust = db.prepare('SELECT * FROM customers WHERE phone=?').get(contactPhone);
          if (targetCust) {
            db.prepare('UPDATE customers SET tg=?, verified=1 WHERE id=?').run(chatId, targetCust.id);
            if (!targetCust.welcome) grantWelcome(targetCust.id, 'Telegram');
            addHist(targetCust.id, 'Вход через Telegram-подтверждение', 'Telegram');
          } else {
            const tgUserName = [u.message.from?.first_name, u.message.from?.last_name].filter(Boolean).join(' ');
            const newName = pend.name || tgUserName || 'Гость';
            const r = createCustomer(newName, contactPhone, '');
            if (!r.err && r.customer) {
              db.prepare('UPDATE customers SET tg=?, verified=1, consent=? WHERE id=?').run(chatId, nowISO() + ' v1', r.customer.id);
              grantWelcome(r.customer.id, 'Telegram');
              addHist(r.customer.id, 'Регистрация через Telegram', 'Telegram');
            }
          }

          const finalCust = db.prepare('SELECT * FROM customers WHERE phone=?').get(contactPhone);
          const sessionToken = finalCust ? issueToken(finalCust.id) : null;
          const custObj = finalCust ? cust(finalCust) : null;

          otpStore.set('reg:' + contactPhone, {
            code: null,
            confirmed: true,
            token: sessionToken,
            customer: custObj,
            tgChat: chatId,
            expires: Date.now() + 10 * 60 * 1000
          });
          otpStore.delete('regchat:' + chatId);
          otpStore.delete('regtg:' + pend.token);

          await tgSend(chatId, '👍 Номер подтверждён', { remove_keyboard: true });
          const baseSite = (typeof APP_URL !== 'undefined' && APP_URL) || 'https://friday.andcoffee.online';
          const authLink = sessionToken ? (baseSite + '/?auth_token=' + sessionToken) : (baseSite + '/?src=tg');

          await tgSend(chatId,
            '🎉 <b>Профиль готов, ' + (custObj ? custObj.name : '') + '!</b>\n\n' +
            'Ваши приветственные бонусы активированы:\n' +
            '☕ <b>+1 штамп</b> на кофе у моря\n' +
            '🍕 <b>Скидка 200 ₽</b> на доставку (промокод <b>ПРИВЕТ</b>)\n\n' +
            'В браузере вход выполнился автоматически. Или откройте сайт кнопкой ниже 👇',
            {
              inline_keyboard: [[
                { text: '🚀 Открыть сайт (вход выполнен)', url: authLink }
              ]]
            }
          );
        } else {
          await tgSend(chatId, 'Номер не совпадает с указанным в приложении ⚠️ Нажмите кнопку ещё раз.');
        }
        return;
      }
    }

    const isPhoneInput = !!u.message.contact || (text && ph10(text).length === 10);
    if (isPhoneInput) {
      if (u.message.contact) {
        await tgSend(chatId, '👍 Номер получен', { remove_keyboard: true });
      }
      const rawPhone = u.message.contact ? u.message.contact.phone_number : text;
      const formatted = fmtPhone(rawPhone);
      const c = db.prepare('SELECT * FROM customers WHERE phone=?').get(formatted);
      if (c) {
        db.prepare('UPDATE customers SET tg=? WHERE id=?').run(chatId, c.id);
        if (!c.welcome) {
          grantWelcome(c.id, 'Telegram');
          await tgSend(chatId,
            '✅ Готово, ' + c.name + '! Профиль привязан 🎉\n\n' +
            '🎁 <b>Ваши приветственные бонусы:</b>\n' +
            '☕ +1 штамп на кофе (уже в вашей карте бонусов)\n' +
            '🍕 Скидка 200 ₽ на заказ доставки по промокоду <b>ПРИВЕТ</b>',
            welcomeKeyboard(c)
          );
        } else {
          await tgSend(chatId, '✅ Готово, ' + c.name + '! Профиль привязан.', welcomeKeyboard(c));
        }
      } else if (u.message.contact) {
        await tgSend(chatId,
          'Профиль с таким номером не найден ⚠️\n\nСоздайте его в приложении — займёт 10 секунд:',
          { inline_keyboard: [[{ text: '📝 Создать профиль', web_app: { url: APP_URL + '/?src=tg&brand=coffee' } }]] }
        );
      } else {
        await tgSend(chatId,
          'Профиль с номером ' + formatted + ' не найден ⚠️\n\nСоздайте его в приложении за 10 секунд — и получите приветственный штамп 🎁',
          { inline_keyboard: [[{ text: '📝 Создать профиль', web_app: { url: APP_URL + '/?src=tg&brand=coffee' } }]] }
        );
      }
      return;
    }

    const lower = text.toLowerCase();

    if (/(оператор|человек|помощь|поддержк|админ|связаться|проблем|жалоб|ошибк|позови)/i.test(lower)) {
      await sendSupportMenu(chatId);
      return;
    }

    if (/(штамп|бонус|бесплатн|подарок|зерн|зёрн|промокод|баллы|qr)/i.test(lower)) {
      await sendBonusInfo(chatId);
      return;
    }

    if (/(заказ|где курьер|где доставка|доставк|статус заказа)/i.test(lower)) {
      await sendOrdersInfo(chatId);
      return;
    }

    if (/(где вы|адрес|находит|как добраться|время работ|режим работ|часы работ|до скольки|со скольки|янтарн)/i.test(lower)) {
      await tgSend(chatId,
        '📍 <b>Наши заведения в пгт Янтарный:</b>\n\n' +
        '🌊 <b>Кофейня «…и кофе»</b>\n' +
        'Советская ул., 70г (на берегу моря)\n' +
        '⏰ Май–сентябрь: 8:00–21:00\n' +
        '⏰ Октябрь–апрель: 8:00–20:00\n\n' +
        '🍕 <b>Доставка пиццы «Пятница»</b>\n' +
        'Советская ул., 38А\n' +
        '⏰ Ежедневно: 11:00–22:00 (~45 мин)\n' +
        '🛍 При самовывозе скидка −10%',
        {
          inline_keyboard: [
            [{ text: '☕ Меню кофейни', web_app: { url: APP_URL + '/?src=tg&brand=coffee' } }],
            [{ text: '🍕 Заказать доставку', web_app: { url: APP_URL + '/?src=tg&brand=delivery' } }],
          ]
        }
      );
      return;
    }

    if (/(меню|пицц|ролл|кофе|напитк|десерт)/i.test(lower)) {
      await sendMenuButtons(chatId);
      return;
    }

    const custCur = db.prepare('SELECT * FROM customers WHERE tg=?').get(chatId);
    await tgSend(chatId,
      'Я подскажу по меню, заказам и бонусам 🌊\nВыберите действие в меню ниже или напишите свой вопрос:',
      welcomeKeyboard(custCur)
    );
  });

  return tgRouter;
}
