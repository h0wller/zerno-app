// scripts/add-welcome-offer.mjs
// Исправленный скрипт: добавление промокода ПРИВЕТ на 200 ₽ без несуществующих колонок
// Запуск из корня: node scripts/add-welcome-offer.mjs

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import Database from 'better-sqlite3';

// Определяем путь к БД (учитываем .env или стандартные пути)
function getDbPath() {
  if (process.env.DB_PATH) return process.env.DB_PATH;
  const envPath = path.resolve('.env');
  if (fs.existsSync(envPath)) {
    const raw = fs.readFileSync(envPath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      if (line.startsWith('DB_PATH=')) {
        return line.slice(8).trim().replace(/^['"]|['"]$/g, '');
      }
    }
  }
  return '/var/www/data/zerno.db';
}

const dbPath = getDbPath();
const resolvedDbPath = fs.existsSync(dbPath) ? dbPath : './zerno.db';
console.log('[db] Открываем базу данных:', resolvedDbPath);

const db = new Database(resolvedDbPath);

const TG_FILE = path.resolve('server/routes/tg.js');
const LOYALTY_FILE = path.resolve('server/domain/loyalty.js');
const BAK_TG = TG_FILE + '.bak-welcome-offer';
const BAK_LOYALTY = LOYALTY_FILE + '.bak-welcome-offer';
const MARKER = '// [tg-welcome-offer-200-v1]';

function readNorm(P) {
  const raw = fs.readFileSync(P, 'utf8');
  const isCRLF = raw.indexOf('\r\n') !== -1;
  return { content: raw.replace(/\r\n/g, '\n'), isCRLF, raw };
}

function writeNorm(P, content, isCRLF) {
  fs.writeFileSync(P, isCRLF ? content.replace(/\n/g, '\r\n') : content, 'utf8');
}

if (!fs.existsSync(TG_FILE)) {
  console.error('Файл не найден: ' + TG_FILE);
  process.exit(1);
}
if (!fs.existsSync(LOYALTY_FILE)) {
  console.error('Файл не найден: ' + LOYALTY_FILE);
  process.exit(1);
}

// ── 1. Создание / обновление промокодов ПРИВЕТ и PRIVET в БД ──
function upsertPromo(code) {
  const row = db.prepare('SELECT id FROM promos WHERE code=?').get(code);
  if (!row) {
    db.prepare(`
      INSERT INTO promos (id, code, kind, value, maxuses, uses, active, scope, created)
      VALUES (?, ?, 'money', 200, 0, 0, 1, 'delivery', datetime('now'))
    `).run('promo_' + code.toLowerCase(), code);
    console.log('[db] Промокод ' + code + ' создан (скидка 200 ₽ на доставку).');
  } else {
    db.prepare(`
      UPDATE promos SET kind='money', value=200, active=1, scope='delivery' WHERE code=?
    `).run(code);
    console.log('[db] Промокод ' + code + ' обновлен (200 ₽, active, delivery).');
  }
}

upsertPromo('ПРИВЕТ');
upsertPromo('PRIVET');

const tgData = readNorm(TG_FILE);
const loyaltyData = readNorm(LOYALTY_FILE);

if (tgData.content.indexOf(MARKER) !== -1) {
  console.log('server/routes/tg.js: уже пропатчено (' + MARKER + ').');
  process.exit(0);
}

// ── 2. Патч server/routes/tg.js (анонс в /start и при привязке номера) ──
const FROM_TG_START = "        : '☕ Привет! Я бот «…и кофе» и доставки «Пятница».\\n\\nЗдесь: штампы, бонусы, заказы и поддержка.\\nНачнём?';";
const TO_TG_START = [
  "        : '☕ Привет! Я бот «…и кофе» и доставки «Пятница» 🌊🍕\\n\\n' +",
  "          'Привяжите номер и заберите приветственные бонусы:\\n' +",
  "          '☕ <b>+1 штамп</b> на кофе у моря\\n' +",
  "          '🍕 <b>Скидка 200 ₽</b> на первый заказ доставки (промокод <b>ПРИВЕТ</b>)\\n\\n' +",
  "          'Штампы, меню, заказы и чат поддержки — всё здесь 👇';"
].join('\n');

if (tgData.content.split(FROM_TG_START).length - 1 !== 1) {
  console.error('Якорь /start не найден в server/routes/tg.js.');
  process.exit(1);
}

const FROM_TG_LINKED = "          await tgSend(chatId, '✅ Готово, ' + c.name + '! Профиль привязан.\\n🎁 Приветственный бонус начислен: +1 штамп!', welcomeKeyboard(c));";
const TO_TG_LINKED = [
  "          " + MARKER,
  "          await tgSend(chatId,",
  "            '✅ Готово, ' + c.name + '! Профиль привязан 🎉\\n\\n' +",
  "            '🎁 <b>Ваши приветственные бонусы:</b>\\n' +",
  "            '☕ +1 штамп на кофе (уже в вашей карте бонусов)\\n' +",
  "            '🍕 Скидка 200 ₽ на заказ доставки по промокоду <b>ПРИВЕТ</b>',",
  "            welcomeKeyboard(c)",
  "          );"
].join('\n');

if (tgData.content.split(FROM_TG_LINKED).length - 1 !== 1) {
  console.error('Якорь подтверждения номера не найден в server/routes/tg.js.');
  process.exit(1);
}

// ── 3. Патч server/domain/loyalty.js (история бонусов) ──
const FROM_LOYALTY_HIST = "  addHist(cid, '🎁 Приветственный бонус: +1 штамп', 'Система');";
const TO_LOYALTY_HIST = "  addHist(cid, '🎁 Приветственные бонусы: +1 штамп и скидка 200 ₽ на доставку (код ПРИВЕТ)', 'Система');";

if (loyaltyData.content.split(FROM_LOYALTY_HIST).length - 1 !== 1) {
  console.error('Якорь addHist не найден в server/domain/loyalty.js.');
  process.exit(1);
}

// ── Запись бэкапов и применение патчей ──
fs.writeFileSync(BAK_TG, tgData.raw, 'utf8');
let patchedTg = tgData.content.split(FROM_TG_START).join(TO_TG_START);
patchedTg = patchedTg.split(FROM_TG_LINKED).join(TO_TG_LINKED);
writeNorm(TG_FILE, patchedTg, tgData.isCRLF);

fs.writeFileSync(BAK_LOYALTY, loyaltyData.raw, 'utf8');
const patchedLoyalty = loyaltyData.content.split(FROM_LOYALTY_HIST).join(TO_LOYALTY_HIST);
writeNorm(LOYALTY_FILE, patchedLoyalty, loyaltyData.isCRLF);

// ── Проверка синтаксиса ──
try {
  execSync('node --check ' + TG_FILE, { stdio: 'pipe' });
  execSync('node --check ' + LOYALTY_FILE, { stdio: 'pipe' });
  console.log('Синтаксис tg.js и loyalty.js корректен (node --check passed).');
} catch (e) {
  console.error('Синтаксис сломан:');
  console.error((e.stderr || '').toString());
  fs.writeFileSync(TG_FILE, tgData.raw, 'utf8');
  fs.writeFileSync(LOYALTY_FILE, loyaltyData.raw, 'utf8');
  process.exit(1);
}

console.log('Успешно: промокод ПРИВЕТ активирован, тексты бота обновлены.');
console.log('Бэкапы: ' + BAK_TG + ', ' + BAK_LOYALTY);