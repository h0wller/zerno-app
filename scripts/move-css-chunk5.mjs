// scripts/fix-tg-remove-keyboard.mjs
// Скрытие нативной кнопки «Поделиться номером» после получения контакта
// Запуск из корня: node scripts/fix-tg-remove-keyboard.mjs

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const TARGET_FILE = path.resolve('server/routes/tg.js');
const BAK_FILE = TARGET_FILE + '.bak-remove-keyboard';
const MARKER = '// [tg-remove-keyboard-clean-v1]';

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

// 1. Проверяем якорь в секции 7 (подтверждение reg_<token>)
const FROM_SEC_7 = "tgSend(chatId, '✅ Номер подтверждён! Вернитесь в приложение и завершите регистрацию — +1 штамп уже ваш 🎁');";
const TO_SEC_7 = "await tgSend(chatId, '✅ Номер подтверждён! Вернитесь в приложение и завершите регистрацию — +1 штамп уже ваш 🎁', { remove_keyboard: true });";

if (content.split(FROM_SEC_7).length - 1 !== 1) {
  console.error('Якорь секции 7 не найден в server/routes/tg.js.');
  process.exit(1);
}

// 2. Проверяем якорь в секции 8 (получение номера)
const FROM_SEC_8 = "    // 8. Проверка, прислан ли номер телефона (контакт или 10 цифр)\n    const isPhoneInput = !!u.message.contact || (text && ph10(text).length === 10);\n    if (isPhoneInput) {";
const TO_SEC_8 = [
  "    " + MARKER,
  "    // 8. Проверка, прислан ли номер телефона (контакт или 10 цифр)",
  "    const isPhoneInput = !!u.message.contact || (text && ph10(text).length === 10);",
  "    if (isPhoneInput) {",
  "      if (u.message.contact) {",
  "        await tgSend(chatId, '👍 Номер получен', { remove_keyboard: true });",
  "      }"
].join('\n');

if (content.split(FROM_SEC_8).length - 1 !== 1) {
  console.error('Якорь секции 8 не найден в server/routes/tg.js.');
  process.exit(1);
}

fs.writeFileSync(BAK_FILE, raw, 'utf8');

let patched = content.split(FROM_SEC_7).join(TO_SEC_7);
patched = patched.split(FROM_SEC_8).join(TO_SEC_8);

writeNorm(TARGET_FILE, patched, isCRLF);

try {
  execSync('node --check ' + TARGET_FILE, { stdio: 'pipe' });
  console.log('Синтаксис server/routes/tg.js корректен (node --check passed).');
} catch (e) {
  console.error('Синтаксис сломан:');
  console.error((e.stderr || '').toString());
  fs.writeFileSync(TARGET_FILE, raw, 'utf8');
  process.exit(1);
}

console.log('Успешно: скрытие клавиатуры настроено.');
console.log('Бэкап: ' + BAK_FILE);