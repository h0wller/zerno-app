// scripts/test-tg-suite.mjs
// Сквозной интеграционный автотест Telegram-бота и auth-роутов
// Запуск из корня: node scripts/test-tg-suite.mjs

import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

function loadEnv() {
  const envPath = path.resolve('.env');
  if (!fs.existsSync(envPath)) return {};
  const raw = fs.readFileSync(envPath, 'utf8');
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const k = trimmed.slice(0, eqIdx).trim();
      let v = trimmed.slice(eqIdx + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      env[k] = v;
      if (!process.env[k]) process.env[k] = v;
    }
  }
  return env;
}

loadEnv();

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const SECRET = process.env.TG_WEBHOOK_SECRET || '';

function getDbPath() {
  if (process.env.DB_PATH) return process.env.DB_PATH;
  return fs.existsSync('/var/www/data/zerno.db') ? '/var/www/data/zerno.db' : './zerno.db';
}

let passed = 0;
let failed = 0;

function report(name, ok, details = '') {
  if (ok) {
    passed++;
    console.log(`  \x1b[32m[PASS]\x1b[0m ${name} ${details ? '(' + details + ')' : ''}`);
  } else {
    failed++;
    console.log(`  \x1b[31m[FAIL]\x1b[0m ${name} ${details ? '— ' + details : ''}`);
  }
}

async function postWebhook(payload) {
  const headers = { 'Content-Type': 'application/json' };
  if (SECRET) headers['x-telegram-bot-api-secret-token'] = SECRET;
  const res = await fetch(`${BASE_URL}/api/tg/webhook`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });
  return res;
}

async function run() {
  console.log(`\n=== Запуск сьюта тестов Telegram-бота (${BASE_URL}) ===\n`);

  // 1. Проверка доступности сервера
  try {
    const hRes = await fetch(`${BASE_URL}/api/health`);
    const hData = await hRes.json().catch(() => ({}));
    report('API Healthcheck (/api/health)', hRes.ok && hData.ok === true);
  } catch (err) {
    report('API Healthcheck (/api/health)', false, 'Сервер не отвечает на порту ' + PORT);
    console.log('\nУбедитесь, что сервер запущен: npm start или pm2 status\n');
    process.exit(1);
  }

  // 2. Проверка базы данных и промокода ПРИВЕТ
  try {
    const dbPath = getDbPath();
    const db = new Database(dbPath, { readonly: true });
    const promo = db.prepare("SELECT code, kind, value, active, scope FROM promos WHERE code='ПРИВЕТ'").get();
    const promoOk = promo && promo.kind === 'money' && promo.value === 200 && promo.active === 1 && promo.scope === 'delivery';
    report('Промокод ПРИВЕТ в БД (скидка 200 ₽, delivery)', promoOk, promo ? `${promo.value} ₽, ${promo.scope}` : 'не найден');
    db.close();
  } catch (err) {
    report('Проверка БД SQLite', false, err.message);
  }

  const TEST_CHAT = 999000111;

  // 3. Тест вебхука: команда /start
  try {
    const r = await postWebhook({
      update_id: 10001,
      message: { message_id: 1, chat: { id: TEST_CHAT }, text: '/start' }
    });
    report('Webhook: обработка /start', r.status === 200);
  } catch (e) {
    report('Webhook: обработка /start', false, e.message);
  }

  // 4. Тест вебхука: команда /bonus
  try {
    const r = await postWebhook({
      update_id: 10002,
      message: { message_id: 2, chat: { id: TEST_CHAT }, text: '/bonus' }
    });
    report('Webhook: обработка /bonus', r.status === 200);
  } catch (e) {
    report('Webhook: обработка /bonus', false, e.message);
  }

  // 5. Тест вебхука: Callback-запрос support_choose
  try {
    const r = await postWebhook({
      update_id: 10003,
      callback_query: { id: 'cb_test_1', from: { id: TEST_CHAT }, data: 'support_choose' }
    });
    report('Webhook: callback support_choose', r.status === 200);
  } catch (e) {
    report('Webhook: callback support_choose', false, e.message);
  }

  // 6. Тест вебхука: Callback-запрос support_delivery
  try {
    const r = await postWebhook({
      update_id: 10004,
      callback_query: { id: 'cb_test_2', from: { id: TEST_CHAT }, data: 'support_delivery' }
    });
    report('Webhook: callback support_delivery', r.status === 200);
  } catch (e) {
    report('Webhook: callback support_delivery', false, e.message);
  }

  // 7. Тест вебхука: NLP фраза «где курьер»
  try {
    const r = await postWebhook({
      update_id: 10005,
      message: { message_id: 5, chat: { id: TEST_CHAT }, text: 'подскажите где мой курьер' }
    });
    report('Webhook NLP: распознавание «где курьер»', r.status === 200);
  } catch (e) {
    report('Webhook NLP: распознавание «где курьер»', false, e.message);
  }

  // 8. Тест вебхука: NLP фраза «позови оператора»
  try {
    const r = await postWebhook({
      update_id: 10006,
      message: { message_id: 6, chat: { id: TEST_CHAT }, text: 'позови оператора пожалуйста' }
    });
    report('Webhook NLP: вызов оператора', r.status === 200);
  } catch (e) {
    report('Webhook NLP: вызов оператора', false, e.message);
  }

  // 9. Тест эндпоинта /api/auth/tg-link на отклонение невалидной подписи
  try {
    const r = await fetch(`${BASE_URL}/api/auth/tg-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: 'fake_tampered_init_data=1&hash=deadbeef' })
    });
    report('Безопасность /api/auth/tg-link: отказ невалидной подписи (401)', r.status === 401);
  } catch (e) {
    report('Безопасность /api/auth/tg-link', false, e.message);
  }

  console.log(`\nИтог: \x1b[32m${passed} успешно\x1b[0m, \x1b[31m${failed} ошибок\x1b[0m\n`);
  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error('Критический сбой тестов:', err);
  process.exit(1);
});