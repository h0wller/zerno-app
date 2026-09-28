// scripts/fix-tg-smart-replies.mjs
// Умные естественные ответы на вопросы гостей и точное распознавание номеров в tg.js
// Запуск из корня проекта: node scripts/fix-tg-smart-replies.mjs

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const TARGET_FILE = path.resolve('server/routes/tg.js');
const BAK_FILE = TARGET_FILE + '.bak-smart-replies';
const MARKER = '// [tg-smart-replies-v1]';

function readNorm(P) {
  const raw = fs.readFileSync(P, 'utf8');
  const isCRLF = raw.indexOf('\r\n') !== -1;
  return { content: raw.replace(/\r\n/g, '\n'), isCRLF, raw };
}

function writeNorm(P, content, isCRLF) {
  fs.writeFileSync(P, isCRLF ? content.replace(/\n/g, '\r\n') : content, 'utf8');
}

if (!fs.existsSync(TARGET_FILE)) {
  console.error('Файл не найден: ' + TARGET_FILE);
  process.exit(1);
}

const { content, isCRLF, raw } = readNorm(TARGET_FILE);

if (content.indexOf(MARKER) !== -1) {
  console.log('server/routes/tg.js: уже пропатчено (' + MARKER + ').');
  process.exit(0);
}

// 1. Проверяем якорь импорта phone.js (добавляем ph10)
const FROM_IMPORT = "import { fmtPhone } from '../utils/phone.js';";
const TO_IMPORT = "import { fmtPhone, ph10 } from '../utils/phone.js';";
if (content.split(FROM_IMPORT).length - 1 !== 1) {
  console.error('Якорь импорта fmtPhone не найден в server/routes/tg.js.');
  process.exit(1);
}

// 2. Проверяем блок /help
const FROM_HELP = [
  "    /* 6. /help */",
  "    if (text === '/help') { // [tg-ux-v1]",
  "      await tgSend(chatId,",
  "        'Что умею:\\n' +",
  "        '/menu — меню кофейни и доставки\\n' +",
  "        '/bonus — мои штампы и подарки\\n' +",
  "        '/orders — мои заказы\\n' +",
  "        '/start — главное меню\\n\\n' +",
  "        'Или пишите вопрос словами — отвечу сам или позову сотрудника.',",
  "        welcomeKeyboard(db.prepare('SELECT * FROM customers WHERE tg=?').get(chatId))",
  "      );",
  "      return;",
  "    }"
].join('\n');

if (content.split(FROM_HELP).length - 1 !== 1) {
  console.error('Якорь блока /help не найден в server/routes/tg.js.');
  process.exit(1);
}

const TO_HELP = [
  "    /* 6. /help */",
  "    if (text === '/help') { // [tg-ux-v1]",
  "      await tgSend(chatId,",
  "        '🤖 <b>Чем я могу помочь:</b>\\n\\n' +",
  "        '• <b>Команды:</b>\\n' +",
  "        '/menu — меню кофейни и доставки\\n' +",
  "        '/bonus — мои штампы и подарки\\n' +",
  "        '/orders — мои заказы и статус\\n' +",
  "        '/start — главное меню\\n\\n' +",
  "        '• <b>Или просто спросите меня словами:</b>\\n' +",
  "        '— «Сколько у меня штампов?»\\n' +",
  "        '— «Где мой заказ?»\\n' +",
  "        '— «Часы работы и адрес»\\n' +",
  "        '— «Позови оператора»',",
  "        welcomeKeyboard(db.prepare('SELECT * FROM customers WHERE tg=?').get(chatId))",
  "      );",
  "      return;",
  "    }"
].join('\n');

// 3. Проверяем блок секции 8 (обработка текста и номеров)
const FROM_SECTION_8 = [
  "    /* 8. Пользователь прислал contact или текст — ищем профиль по номеру */",
  "    const phone = u.message.contact ? u.message.contact.phone_number : text;",
  "    const c = db.prepare('SELECT * FROM customers WHERE phone=?').get(fmtPhone(phone));",
  "    if (c) {",
  "      db.prepare('UPDATE customers SET tg=? WHERE id=?').run(chatId, c.id);",
  "      if (!c.welcome) {",
  "        grantWelcome(c.id, 'Telegram');",
  "        await tgSend(chatId, " + "`" + "✅ Готово, ${c.name}! Профиль привязан.\\n🎁 Приветственный бонус начислен: +1 штамп!" + "`" + ", welcomeKeyboard(c));",
  "      } else {",
  "        await tgSend(chatId, " + "`" + "✅ Готово, ${c.name}! Профиль привязан." + "`" + ", welcomeKeyboard(c));",
  "      }",
  "    } else if (u.message.contact) {",
  "      tgSend(chatId,",
  "        'Профиль с таким номером не найден ⚠️\\n\\nСоздайте его в приложении — займёт 10 секунд:',",
  "        { inline_keyboard: [[{ text: '📝 Создать профиль', web_app: { url: APP_URL + '/?src=tg&brand=coffee' } }]] }",
  "      );",
  "    } else {",
  "      /* Свободный текст без команды — мягкая подсказка */",
  "      tgSend(chatId,",
  "        '☕ Я бот «…и кофе» + «Пятница».\\nНажмите /start, чтобы увидеть меню, или выберите действие ниже:',",
  "        welcomeKeyboard(db.prepare('SELECT * FROM customers WHERE tg=?').get(chatId))",
  "      );",
  "    }"
].join('\n');

if (content.split(FROM_SECTION_8).length - 1 !== 1) {
  console.error('Якорь секции 8 не найден в server/routes/tg.js.');
  process.exit(1);
}

const TO_SECTION_8 = [
  "    " + MARKER,
  "    // 8. Проверка, прислан ли номер телефона (контакт или 10 цифр)",
  "    const isPhoneInput = !!u.message.contact || (text && ph10(text).length === 10);",
  "    if (isPhoneInput) {",
  "      const rawPhone = u.message.contact ? u.message.contact.phone_number : text;",
  "      const formatted = fmtPhone(rawPhone);",
  "      const c = db.prepare('SELECT * FROM customers WHERE phone=?').get(formatted);",
  "      if (c) {",
  "        db.prepare('UPDATE customers SET tg=? WHERE id=?').run(chatId, c.id);",
  "        if (!c.welcome) {",
  "          grantWelcome(c.id, 'Telegram');",
  "          await tgSend(chatId, '✅ Готово, ' + c.name + '! Профиль привязан.\\n🎁 Приветственный бонус начислен: +1 штамп!', welcomeKeyboard(c));",
  "        } else {",
  "          await tgSend(chatId, '✅ Готово, ' + c.name + '! Профиль привязан.', welcomeKeyboard(c));",
  "        }",
  "      } else if (u.message.contact) {",
  "        await tgSend(chatId,",
  "          'Профиль с таким номером не найден ⚠️\\n\\nСоздайте его в приложении — займёт 10 секунд:',",
  "          { inline_keyboard: [[{ text: '📝 Создать профиль', web_app: { url: APP_URL + '/?src=tg&brand=coffee' } }]] }",
  "        );",
  "      } else {",
  "        await tgSend(chatId,",
  "          'Профиль с номером ' + formatted + ' не найден ⚠️\\n\\nСоздайте его в приложении за 10 секунд — и получите приветственный штамп 🎁',",
  "          { inline_keyboard: [[{ text: '📝 Создать профиль', web_app: { url: APP_URL + '/?src=tg&brand=coffee' } }]] }",
  "        );",
  "      }",
  "      return;",
  "    }",
  "",
  "    // 9. Умные ответы на естественные вопросы гостей",
  "    const lower = text.toLowerCase();",
  "",
  "    // а) Вызов поддержки / оператора",
  "    if (/(оператор|человек|помощь|поддержк|админ|связаться|проблем|жалоб|ошибк|позови)/i.test(lower)) {",
  "      await tgSend(chatId, '💬 Служба заботы на связи. По какой теме вопрос?', {",
  "        inline_keyboard: [",
  "          [{ text: '🍕 Доставка — «Пятница»', callback_data: 'support_delivery' }],",
  "          [{ text: '☕ Кофейня — «…и кофе»',  callback_data: 'support_coffee' }],",
  "        ]",
  "      });",
  "      return;",
  "    }",
  "",
  "    // б) Штампы / бонусы / бесплатный кофе",
  "    if (/(штамп|бонус|бесплатн|подарок|зерн|зёрн|промокод|баллы|qr)/i.test(lower)) {",
  "      const c = db.prepare('SELECT * FROM customers WHERE tg=?').get(chatId);",
  "      if (c) {",
  "        const left = 10 - c.stamps;",
  "        const line = c.free",
  "          ? ('🎁 Бесплатных кофе: <b>' + c.free + '</b>')",
  "          : ('До подарка: <b>' + left + '</b> ' + (left === 1 ? 'чашка' : (left >= 2 && left <= 4 ? 'чашки' : 'чашек')));",
  "        await tgSend(chatId,",
  "          '☕ <b>' + c.name + '</b>\\n\\n' + stampBar(c.stamps) + '\\n\\nШтампов: <b>' + c.stamps + '/10</b>\\n' + line,",
  "          bonusKeyboard()",
  "        );",
  "      } else {",
  "        await tgSend(chatId,",
  "          '🎁 <b>Программа лояльности «…и кофе»:</b>\\n\\nКаждый 10-й кофе — бесплатно!\\nПривяжите номер телефона, чтобы видеть свои штампы и копить бонусы 👇',",
  "          welcomeKeyboard(null)",
  "        );",
  "      }",
  "      return;",
  "    }",
  "",
  "    // в) Заказы / статус доставки",
  "    if (/(заказ|где курьер|где доставка|доставк|статус заказа)/i.test(lower)) {",
  "      await tgSend(chatId,",
  "        '📦 Все ваши заказы со статусами и составом доступны в приложении:',",
  "        { inline_keyboard: [[{ text: '📦 Открыть мои заказы', web_app: { url: APP_URL + '/?src=tg&brand=delivery&tab=orders' } }]] }",
  "      );",
  "      return;",
  "    }",
  "",
  "    // г) Адрес / график работы",
  "    if (/(где вы|адрес|находит|как добраться|время работ|режим работ|часы работ|до скольки|со скольки|янтарн)/i.test(lower)) {",
  "      await tgSend(chatId,",
  "        '📍 <b>Наши заведения в пгт Янтарный:</b>\\n\\n' +",
  "        '🌊 <b>Кофейня «…и кофе»</b>\\n' +",
  "        'Советская ул., 70г (на берегу моря)\\n' +",
  "        '⏰ Май–сентябрь: 8:00–21:00\\n' +",
  "        '⏰ Октябрь–апрель: 8:00–20:00\\n\\n' +",
  "        '🍕 <b>Доставка пиццы «Пятница»</b>\\n' +",
  "        'Советская ул., 38А\\n' +",
  "        '⏰ Ежедневно: 11:00–22:00 (~45 мин)\\n' +",
  "        '🛍 При самовывозе скидка −10%',",
  "        {",
  "          inline_keyboard: [",
  "            [{ text: '☕ Меню кофейни', web_app: { url: APP_URL + '/?src=tg&brand=coffee' } }],",
  "            [{ text: '🍕 Заказать доставку', web_app: { url: APP_URL + '/?src=tg&brand=delivery' } }],",
  "          ]",
  "        }",
  "      );",
  "      return;",
  "    }",
  "",
  "    // д) Меню / пицца / напитки",
  "    if (/(меню|пицц|ролл|кофе|напитк|десерт)/i.test(lower)) {",
  "      await tgSend(chatId, 'Меню открывается прямо в Telegram 🍕☕', {",
  "        inline_keyboard: [",
  "          [{ text: '☕ Кофейня', web_app: { url: APP_URL + '/?src=tg&brand=coffee' } }],",
  "          [{ text: '🍕 Доставка', web_app: { url: APP_URL + '/?src=tg&brand=delivery' } }],",
  "        ]",
  "      });",
  "      return;",
  "    }",
  "",
  "    // е) Мягкий ответ по умолчанию с кнопками действий",
  "    const custCur = db.prepare('SELECT * FROM customers WHERE tg=?').get(chatId);",
  "    await tgSend(chatId,",
  "      'Я подскажу по меню, заказам и бонусам 🌊\\nВыберите действие в меню ниже или напишите свой вопрос:',",
  "      welcomeKeyboard(custCur)",
  "    );"
].join('\n');

fs.writeFileSync(BAK_FILE, raw, 'utf8');

let patched = content.split(FROM_IMPORT).join(TO_IMPORT);
patched = patched.split(FROM_HELP).join(TO_HELP);
patched = patched.split(FROM_SECTION_8).join(TO_SECTION_8);

writeNorm(TARGET_FILE, patched, isCRLF);

try {
  execSync('node --check ' + TARGET_FILE, { stdio: 'pipe' });
  console.log('Синтаксис корректен (node --check passed).');
} catch (e) {
  console.error('Синтаксис сломан:');
  console.error((e.stderr || '').toString());
  fs.writeFileSync(TARGET_FILE, raw, 'utf8');
  process.exit(1);
}

console.log('Успешно: умные ответы и строгая проверка телефонов добавлены в tg.js.');
console.log('Бэкап: ' + BAK_FILE);