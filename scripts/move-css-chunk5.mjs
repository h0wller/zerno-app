// scripts/fix-tg-buttons.mjs — починка кнопки «Задать вопрос».
//   A. Явный setWebhook с allowed_updates: message, callback_query, edited_message.
//   B. Кнопки поддержки → две прямые web_app, без callback-цепочки.
//      «☕ Чат кофейни» и «🍕 Чат доставки» в один тап.
// Идемпотентно, CRLF-safe. Запуск: node scripts/fix-tg-buttons.mjs

import fs from 'node:fs';
import { execSync } from 'node:child_process';

function readNorm(P) {
  const raw = fs.readFileSync(P, 'utf8');
  const isCRLF = raw.indexOf('\r\n') !== -1;
  return { content: raw.replace(/\r\n/g, '\n'), isCRLF, raw };
}
function writeNorm(P, content, isCRLF) {
  fs.writeFileSync(P, isCRLF ? content.replace(/\n/g, '\r\n') : content, 'utf8');
}
function check(P) {
  try { execSync('node --check ' + P, { stdio: 'pipe' }); return true; }
  catch (e) { console.error('Синтаксис сломан в ' + P + ':\n' + (e.stderr || '').toString()); return false; }
}

// ─── Часть A: setWebhook с явными allowed_updates ─────────────────────
{
  const env = Object.fromEntries(
    fs.readFileSync('.env', 'utf8').split(/\r?\n/)
      .map(l => l.trim()).filter(l => l && !l.startsWith('#'))
      .map(l => {
        const i = l.indexOf('=');
        if (i < 0) return null;
        let v = l.slice(i + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        return [l.slice(0, i).trim(), v];
      }).filter(Boolean)
  );

  const TOKEN = env.TEST_TOKEN || env.TELEGRAM_BOT_TOKEN;
  const SECRET = env.TG_WEBHOOK_SECRET || '';
  const APP_URL = (env.PUBLIC_URL || env.APP_URL || '').replace(/\/+$/, '');
  if (!TOKEN) { console.error('✗ Нет TEST_TOKEN в .env'); process.exit(1); }
  if (!APP_URL) { console.error('✗ Нет PUBLIC_URL в .env'); process.exit(1); }

  const tg = async (m, b) => {
    const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${m}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(b || {}),
    });
    return r.json();
  };

  console.log('→ Текущий webhook:');
  const before = (await tg('getWebhookInfo')).result;
  console.log('  allowed_updates: ' + (before.allowed_updates || []).join(', ') || '  (пусто → ВСЕ)');
  console.log('  pending:         ' + before.pending_update_count);
  console.log('');

  console.log('→ Переустанавливаю с явным allowed_updates...');
  const setRes = await tg('setWebhook', {
    url: APP_URL + '/api/tg/webhook',
    secret_token: SECRET || undefined,
    allowed_updates: ['message', 'callback_query', 'edited_message'],
    drop_pending_updates: true,
    max_connections: 40,
  });
  if (!setRes.ok) { console.error('✗ setWebhook: ' + setRes.description); process.exit(1); }
  console.log('✓ setWebhook OK');

  const after = (await tg('getWebhookInfo')).result;
  console.log('');
  console.log('→ После переустановки:');
  console.log('  url:              ' + after.url);
  console.log('  allowed_updates:  ' + (after.allowed_updates || []).join(', '));
  console.log('  pending:          ' + after.pending_update_count);
  console.log('');

  if (!(after.allowed_updates || []).includes('callback_query')) {
    console.error('✗ Telegram не подтвердил callback_query в allowed_updates!');
    console.error('   Это баг, писать в поддержку @BotFather.');
  } else {
    console.log('✓ callback_query теперь разрешён');
  }
}

// ─── Часть B: кнопки поддержки → две прямые web_app ───────────────────
{
  const P = 'server/routes/tg.js';
  const { content, isCRLF } = readNorm(P);
  let s = content;
  const MARKER = '// [tg-direct-support-v1]';

  if (s.indexOf(MARKER) !== -1) {
    console.log('');
    console.log('✓ tg.js: прямые кнопки поддержки уже есть');
  } else {
    // Ищем блок кнопок в welcomeKeyboard — там сейчас одна «Задать вопрос» с callback_data.
    const FROM = "      { text: '💬 Задать вопрос', callback_data: 'support_choose' },";
    if (s.indexOf(FROM) === -1) {
      console.error('');
      console.error('✗ tg.js: не найдена кнопка «Задать вопрос» с callback_data.');
      console.error('   Возможно, ты уже правил вручную. Пришли текущий welcomeKeyboard.');
      process.exit(1);
    }

    // Заменяем одну кнопку «Задать вопрос» на две — «☕ Чат» и «🍕 Чат».
    const TO = [
      "      " + MARKER,
      "      { text: '☕ Чат кофейни', web_app: { url: APP_URL + '/?src=tg&brand=coffee&tab=chat&ctx=coffee' } },",
      "      { text: '🍕 Чат доставки', web_app: { url: APP_URL + '/?src=tg&brand=delivery&tab=chat&ctx=delivery' } },",
    ].join('\n');

    s = s.replace(FROM, TO);
    writeNorm(P, s, isCRLF);
    console.log('');
    console.log('✓ tg.js: «Задать вопрос» → «☕ Чат кофейни» + «🍕 Чат доставки»');
  }
  if (!check(P)) process.exit(1);
}

// ─── sw.js ────────────────────────────────────────────────────────────
{
  const P = 'public/sw.js';
  if (fs.existsSync(P)) {
    const { content, isCRLF } = readNorm(P);
    const m = content.match(/zerno-static-v(\d+)/);
    if (m) {
      const before = m[1];
      const next = content.replace(/zerno-static-v(\d+)/, 'zerno-static-v' + (parseInt(before, 10) + 1));
      writeNorm(P, next, isCRLF);
      console.log('✓ sw.js: STATIC_CACHE v' + before + ' → v' + (parseInt(before, 10) + 1));
    }
  }
}

console.log('');
console.log('Готово. Дальше:');
console.log('  1. git add -A');
console.log('  2. git commit -m "fix(tg): allowed_updates callback_query + прямые кнопки чата"');
console.log('  3. git push');
console.log('  4. pm2 restart zerno-app --update-env');
console.log('');
console.log('ВАЖНО: открой бота и нажми /start ЗАНОВО. Старое сообщение с одной кнопкой');
console.log('       «Задать вопрос» не перерисуется — Telegram кэширует старые сообщения.');
console.log('       Новое сообщение будет с двумя кнопками чата:');
console.log('         [☕ Чат кофейни]  [🍕 Чат доставки]');
console.log('       Тап на любую → сразу Mini App с правильной Никой, без callback-цепочки.');