// scripts/fix-tg-fallbacks.mjs — правит server/routes/tg.js:
//   1. URL деталей заказа получает &brand=delivery
//   2. Тексты 'link_phone' / 'bonus' / 'orders' обрабатываются как callback_data
//      (Telegram Desktop иногда отправляет их как обычный текст)
// Идемпотентно. Проверяет якоря. Запуск: node scripts/fix-tg-fallbacks.mjs

import fs from 'node:fs';
import { execSync } from 'node:child_process';

const P = 'server/routes/tg.js';
const BAK = 'server/routes/tg.js.bak-fallback';

if (!fs.existsSync(P)) { console.error('Не найден ' + P); process.exit(1); }

let s = fs.readFileSync(P, 'utf8');

// ─── 1. URL деталей ────────────────────────────────────────────────────
{
  const MARKER = '// [fallback-url-v1]';
  const FROM = '`${APP_URL}/?src=tg&tab=orders&no=${o.no}`';
  const TO   = '`${APP_URL}/?src=tg&brand=delivery&tab=orders&no=${o.no}`';
  const count = s.split(FROM).length - 1;
  if (count === 0 && s.indexOf(TO) !== -1) {
    console.log('URL деталей: уже пропатчен');
  } else if (count === 0) {
    console.error('URL деталей: НЕ найдено');
    process.exit(1);
  } else {
    s = s.split(FROM).join(TO);
    console.log('URL деталей: brand=delivery добавлен (' + count + ' мест)');
  }
}

// ─── 2. Fallback text → callback ──────────────────────────────────────
{
  const MARKER = '// [fallback-text-callback-v1]';
  const ANCHOR = '    const text = String(u.message.text || \'\').trim();';

  if (s.indexOf(MARKER) !== -1) {
    console.log('Fallback: уже пропатчен');
  } else if (s.indexOf(ANCHOR) === -1) {
    console.error('Fallback: НЕ найден якорь const text');
    process.exit(1);
  } else {
    const BLOCK = [
      ANCHOR,
      '',
      '    ' + MARKER,
      '    // Telegram Desktop (некоторые версии) отправляет callback_data обычным текстом.',
      '    // Перехватываем и обрабатываем как callback, чтобы кнопки работали везде.',
      '    if (text === \'link_phone\' || text === \'bonus\' || text === \'orders\') {',
      '      const cbChatId = String(u.message.chat.id);',
      '      if (text === \'link_phone\') {',
      '        const existing = db.prepare(\'SELECT * FROM customers WHERE tg=?\').get(cbChatId);',
      '        if (existing) {',
      '          const left = 10 - existing.stamps;',
      '          const line = existing.free',
      '            ? \'🎁 Бесплатных кофе: <b>\' + existing.free + \'</b>\'',
      '            : \'До подарка: <b>\' + left + \'</b> \' + (left === 1 ? \'чашка\' : (left >= 2 && left <= 4 ? \'чашки\' : \'чашек\'));',
      '          await tgSend(cbChatId,',
      '            \'Профиль уже привязан ✅\\n\\n<b>\' + existing.name + \'</b> · \' + fmtPhone(existing.phone) + \'\\n\\n\' +',
      '            stampBar(existing.stamps) + \'\\nШтампов: <b>\' + existing.stamps + \'/10</b>\\n\' + line,',
      '            bonusKeyboard()',
      '          );',
      '          return;',
      '        }',
      '        await tgSend(cbChatId,',
      '          \'Привяжите номер телефона — копите штампы и получайте бонусы.\\n\\n\' +',
      '          \'Если у вас <b>уже есть профиль</b> — нажмите кнопку ниже и поделитесь номером 👇\',',
      '          appKb()',
      '        );',
      '        await tgSend(cbChatId,',
      '          \'Если профиля ещё нет — создайте его в приложении:\',',
      '          { inline_keyboard: [[{ text: \'📝 Создать профиль\', web_app: { url: APP_URL + \'/?src=tg&brand=coffee\' } }]] }',
      '        );',
      '        return;',
      '      }',
      '      if (text === \'bonus\') {',
      '        const existing = db.prepare(\'SELECT * FROM customers WHERE tg=?\').get(cbChatId);',
      '        if (!existing) {',
      '          await tgSend(cbChatId, \'Сначала привяжите номер — нажмите кнопку ниже 👇\', appKb());',
      '          return;',
      '        }',
      '        const left = 10 - existing.stamps;',
      '        const line = existing.free',
      '          ? \'🎁 Бесплатных кофе: <b>\' + existing.free + \'</b>\'',
      '          : \'До подарка: <b>\' + left + \'</b> \' + (left === 1 ? \'чашка\' : (left >= 2 && left <= 4 ? \'чашки\' : \'чашек\'));',
      '        await tgSend(cbChatId,',
      '          \'☕ <b>\' + existing.name + \'</b>\\n\\n\' + stampBar(existing.stamps) + \'\\n\\nШтампов: <b>\' + existing.stamps + \'/10</b>\\n\' + line,',
      '          bonusKeyboard()',
      '        );',
      '        return;',
      '      }',
      '      if (text === \'orders\') {',
      '        const existing = db.prepare(\'SELECT * FROM customers WHERE tg=?\').get(cbChatId);',
      '        if (!existing) {',
      '          await tgSend(cbChatId, \'Сначала привяжите профиль 👇\', appKb());',
      '          return;',
      '        }',
      '        const rows = db.prepare(\'SELECT id,no,status,total FROM orders WHERE cid=? ORDER BY no DESC LIMIT 5\').all(existing.id);',
      '        if (!rows.length) {',
      '          await tgSend(cbChatId, \'Заказов пока нет 🍕\', {',
      '            inline_keyboard: [[{ text: \'🍕 Открыть меню\', web_app: { url: APP_URL + \'/?src=tg&brand=delivery\' } }]],',
      '          });',
      '          return;',
      '        }',
      '        for (const o of rows) {',
      '          const idx = STEPS.indexOf(o.status);',
      '          const bar = STEPS.map((s, i) => i <= idx && idx >= 0 ? \'●\' : \'○\').join(\'─\');',
      '          const emoji = STATUS_EMOJI[o.status] || \'•\';',
      '          await tgSend(cbChatId,',
      '            \'<b>#\' + o.no + \'</b> · \' + emoji + \' \' + (ORDER_STATUS[o.status] || o.status) + \'\\n\' + bar + \'\\nИтого: <b>\' + o.total + \' ₽</b>\',',
      '            { inline_keyboard: [',
      '              [{ text: \'📦 Детали\', web_app: { url: APP_URL + \'/?src=tg&brand=delivery&tab=orders&no=\' + o.no } }],',
      '              [{ text: \'🔁 Повторить\', callback_data: \'reorder_\' + o.id }],',
      '            ]}',
      '          );',
      '        }',
      '        return;',
      '      }',
      '    }',
    ].join('\n');

    s = s.replace(ANCHOR, BLOCK);
    fs.writeFileSync(P, s, 'utf8');
    console.log('Fallback text→callback: добавлен для link_phone/bonus/orders');
  }
}

// ─── Бэкап + проверка ─────────────────────────────────────────────────
fs.writeFileSync(BAK, fs.readFileSync(P, 'utf8'), 'utf8');
console.log('Бэкап: ' + BAK);

try {
  execSync('node --check ' + P, { stdio: 'pipe' });
  console.log('node --check: OK');
} catch (e) {
  console.error('Синтаксис сломан:');
  console.error((e.stderr || '').toString());
  console.error('Откат: copy ' + BAK + ' ' + P);
  process.exit(1);
}

console.log('');
console.log('Готово. Дальше:');
console.log('  1. git add -A && git commit -m "fix(tg): fallback text-callback + brand=delivery в деталях" && git push');
console.log('  2. pm2 restart zerno-app --update-env');
console.log('  3. В боте проверь:');
console.log('     • /start -> «Привязать номер» -> приходит reply-кнопка + inline «Создать профиль»');
console.log('     • /orders -> «Детали» -> Mini App открывает профиль delivery с заказами');
console.log('     • /orders -> «Повторить» -> корзина с тем же составом');
console.log('     • /bonus -> «Показать QR» -> сразу полный QR-экран');