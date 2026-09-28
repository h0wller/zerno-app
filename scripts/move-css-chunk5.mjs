// scripts/fix-publicurl-normalize.mjs — добавляет .replace(/\/+$/, '') в telegram.js.
// Идемпотентно. Запуск: node scripts/fix-publicurl-normalize.mjs

import fs from 'node:fs';
import { execSync } from 'node:child_process';

const P = 'server/services/telegram.js';
const BAK = 'server/services/telegram.js.bak-url';

if (!fs.existsSync(P)) { console.error('Не найден ' + P); process.exit(1); }

let s = fs.readFileSync(P, 'utf8');

if (s.indexOf('_normalizeUrl') !== -1) {
  console.log('Нормализация уже добавлена.');
  try { execSync('node --check ' + P, { stdio: 'pipe' }); console.log('node --check: OK'); }
  catch (e) { console.error('Синтаксис сломан:'); console.error((e.stderr || '').toString()); process.exit(1); }
  process.exit(0);
}

fs.writeFileSync(BAK, s, 'utf8');
console.log('Бэкап: ' + BAK);

// Ищем оригинальные строки
const oldPublic = "export const PUBLIC_URL = process.env.PUBLIC_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? 'https://' + process.env.RAILWAY_PUBLIC_DOMAIN : '');";
const oldApp    = "export const APP_URL = PUBLIC_URL || 'https://app.andcoffee.online';";

if (s.indexOf(oldPublic) === -1 || s.indexOf(oldApp) === -1) {
  console.error('Не нашёл якоря в telegram.js. Ожидалось:');
  console.error('  ' + oldPublic);
  console.error('  ' + oldApp);
  console.error('Файл не тронут.');
  process.exit(1);
}

const newPublic = "const _normalizeUrl = (u) => String(u || '').replace(/\\/+$/, '');\nexport const PUBLIC_URL = _normalizeUrl(process.env.PUBLIC_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? 'https://' + process.env.RAILWAY_PUBLIC_DOMAIN : ''));";
const newApp = "export const APP_URL = PUBLIC_URL || 'https://app.andcoffee.online';";

s = s.replace(oldPublic, newPublic);
s = s.replace(oldApp, newApp);
fs.writeFileSync(P, s, 'utf8');
console.log('telegram.js: PUBLIC_URL нормализован (trailing slash срезается).');

try { execSync('node --check ' + P, { stdio: 'pipe' }); console.log('node --check: OK'); }
catch (e) {
  console.error('Синтаксис сломан:');
  console.error((e.stderr || '').toString());
  console.error('Откат: copy ' + BAK + ' ' + P);
  process.exit(1);
}

console.log('');
console.log('Готово.');
console.log('');
console.log('Дальше:');
console.log('  1. git add -A && git commit -m "fix(tg): normalize PUBLIC_URL — kill double-slash в webhook" && git push');
console.log('  2. Дождись автодеплоя на Timeweb, затем:');
console.log('       pm2 restart zerno-app');
console.log('     (или кнопка «Перезапустить» в панели).');
console.log('  3. При рестарте tgEnsureWebhook() увидит расхождение и переставит webhook');
console.log('     на корректный single-slash URL.');
console.log('  4. Проверь: node scripts/check-webhook-url.mjs');
console.log('     Ожидаешь:');
console.log('       url: https://friday.andcoffee.online/api/tg/webhook  ← без двойного слэша');
console.log('       pending: 0, last_error: —');
console.log('  5. Открой бота, нажми /start.');
console.log('');
console.log('Откат: copy ' + BAK + ' ' + P);