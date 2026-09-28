// scripts/add-tg-link-auth.mjs
// Добавление эндпоинта /api/auth/tg-link для мгновенного входа через initData
// Запуск из корня проекта: node scripts/add-tg-link-auth.mjs

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const TARGET_FILE = path.resolve('server/routes/auth.js');
const BAK_FILE = TARGET_FILE + '.bak-tg-link';
const MARKER = '// [tg-link-auth-endpoint-v1]';

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
  console.log('server/routes/auth.js: уже пропатчено (' + MARKER + ').');
  process.exit(0);
}

// 1. Проверяем якорь импорта TG_TOKEN
const FROM_IMPORT = "import { tgSend } from '../services/telegram.js';";
const TO_IMPORT = "import { tgSend, TG_TOKEN } from '../services/telegram.js';";
if (content.split(FROM_IMPORT).length - 1 !== 1) {
  console.error('Якорь импорта tgSend не найден или неоднозначен.');
  process.exit(1);
}

// 2. Проверяем точку вставки роута после создания authRouter
const FROM_ROUTER = "export const authRouter = express.Router();";
const TO_ROUTER = [
  "export const authRouter = express.Router();",
  "",
  MARKER,
  "function validateTgInitData(initData, botToken) {",
  "  if (!initData || !botToken) return null;",
  "  try {",
  "    const params = new URLSearchParams(initData);",
  "    const hash = params.get('hash');",
  "    if (!hash) return null;",
  "    params.delete('hash');",
  "",
  "    const entries = Array.from(params.entries());",
  "    entries.sort((a, b) => a[0].localeCompare(b[0]));",
  "    const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join('\\n');",
  "",
  "    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();",
  "    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');",
  "",
  "    const hashBuf = Buffer.from(hash, 'hex');",
  "    const calcBuf = Buffer.from(calculatedHash, 'hex');",
  "    if (hashBuf.length !== calcBuf.length || !crypto.timingSafeEqual(hashBuf, calcBuf)) {",
  "      return null;",
  "    }",
  "",
  "    const userRaw = params.get('user');",
  "    if (!userRaw) return null;",
  "    const user = JSON.parse(userRaw);",
  "    const authDate = Number(params.get('auth_date') || 0);",
  "",
  "    return { user, authDate };",
  "  } catch (e) {",
  "    return null;",
  "  }",
  "}",
  "",
  "authRouter.post('/api/auth/tg-link', (req, res) => {",
  "  const initData = String(req.body.initData || '').trim();",
  "  const token = process.env.TEST_TOKEN || process.env.TELEGRAM_BOT_TOKEN || TG_TOKEN;",
  "",
  "  const valid = validateTgInitData(initData, token);",
  "  if (!valid || !valid.user || !valid.user.id) {",
  "    return res.status(401).json({ error: 'Неверные данные авторизации Telegram' });",
  "  }",
  "",
  "  const tgId = String(valid.user.id);",
  "  const tgName = [valid.user.first_name, valid.user.last_name].filter(Boolean).join(' ') || valid.user.username || 'Гость';",
  "",
  "  // 1. Проверяем, есть ли уже профиль с таким Telegram ID",
  "  let c = db.prepare('SELECT * FROM customers WHERE tg=?').get(tgId);",
  "  if (c) {",
  "    addHist(c.id, 'Вход через Telegram Mini App', 'Telegram');",
  "    return res.json({ token: issueToken(c.id), customer: cust(c), isNew: false });",
  "  }",
  "",
  "  // 2. Если профиля нет по TG — проверяем, передан ли номер",
  "  const rawPhone = String(req.body.phone || '').trim();",
  "  if (!rawPhone) {",
  "    return res.json({",
  "      needPhone: true,",
  "      tgUser: {",
  "        id: tgId,",
  "        name: tgName,",
  "        username: valid.user.username || null",
  "      }",
  "    });",
  "  }",
  "",
  "  const p = fmtPhone(rawPhone);",
  "  if (ph10(p).length < 10) {",
  "    return res.status(400).json({ error: 'Введите номер полностью' });",
  "  }",
  "",
  "  // 3. Ищем существующего клиента по номеру телефона",
  "  c = db.prepare('SELECT * FROM customers WHERE phone=?').get(p);",
  "  if (c) {",
  "    db.prepare('UPDATE customers SET tg=?, verified=1 WHERE id=?').run(tgId, c.id);",
  "    if (!c.welcome) {",
  "      grantWelcome(c.id, 'Telegram');",
  "    }",
  "    addHist(c.id, 'Telegram привязан через Mini App', 'Telegram');",
  "    const updated = db.prepare('SELECT * FROM customers WHERE id=?').get(c.id);",
  "    return res.json({ token: issueToken(c.id), customer: cust(updated), isNew: false });",
  "  }",
  "",
  "  // 4. Создаем нового клиента сразу верифицированным через Telegram",
  "  const finalName = String(req.body.name || '').trim() || tgName;",
  "  const pin = String(req.body.pin || '').trim();",
  "  const r = createCustomer(finalName, p, pin);",
  "  if (r.err) return res.status(r.code).json({ error: r.err });",
  "",
  "  db.prepare('UPDATE customers SET tg=?, verified=1, consent=? WHERE id=?')",
  "    .run(tgId, nowISO() + ' v1', r.customer.id);",
  "  grantWelcome(r.customer.id, 'Telegram');",
  "  addHist(r.customer.id, 'Регистрация через Telegram Mini App', 'Telegram');",
  "",
  "  const newCust = db.prepare('SELECT * FROM customers WHERE id=?').get(r.customer.id);",
  "  return res.json({ token: issueToken(r.customer.id), customer: cust(newCust), isNew: true });",
  "});"
].join('\n');

if (content.split(FROM_ROUTER).length - 1 !== 1) {
  console.error('Якорь точки вставки роута не найден в server/routes/auth.js.');
  process.exit(1);
}

fs.writeFileSync(BAK_FILE, raw, 'utf8');

let patched = content.split(FROM_IMPORT).join(TO_IMPORT);
patched = patched.split(FROM_ROUTER).join(TO_ROUTER);

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

console.log('Успешно: эндпоинт /api/auth/tg-link добавлен в auth.js.');
console.log('Бэкап: ' + BAK_FILE);