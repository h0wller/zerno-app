// scripts/fix-tg-push-logging.mjs
// Логирование и прозрачная обработка ошибок отправки в push.js
// Запуск из корня: node scripts/fix-tg-push-logging.mjs

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const TARGET_FILE = path.resolve('server/services/push.js');
const BAK_FILE = TARGET_FILE + '.bak-push-logging';
const MARKER = '// [tg-push-logging-v1]';

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
  console.log('server/services/push.js: уже пропатчено (' + MARKER + ').');
  process.exit(0);
}

const FROM_BLOCK = [
  "export async function sendTg(cid, title, body, markup) {",
  "  const c = db.prepare('SELECT tg FROM customers WHERE id=?').get(cid);",
  "  if (c && c.tg) await tgSend(c.tg, " + "`" + "${" + "title}\\n${" + "body}`" + ", markup);",
  "}",
  "",
  "export async function sendPush(cid, title, body, markup) {",
  "  const c = db.prepare('SELECT tg, notify_tg, notify_web FROM customers WHERE id=?').get(cid);",
  "  const wantTg = !c || c.notify_tg !== 0;",
  "  const wantWeb = !c || c.notify_web !== 0;",
  "",
  "  if (wantTg) sendTg(cid, title, body, markup).catch(() => {});",
  "",
  "  if (wantWeb) {",
  "    sendFcm(cid, title, body).catch(() => {});",
  "    const rows = db.prepare('SELECT sub FROM subs WHERE cid=?').all(cid);",
  "    for (const r of rows) {",
  "      try {",
  "        await webpush.sendNotification(JSON.parse(r.sub), JSON.stringify({ title, body }));",
  "      } catch (e) {",
  "        if (e.statusCode === 404 || e.statusCode === 410) {",
  "          db.prepare('DELETE FROM subs WHERE sub=?').run(r.sub);",
  "        }",
  "      }",
  "    }",
  "  }",
  "  return { ok: true };",
  "}"
].join('\n');

const count = content.split(FROM_BLOCK).length - 1;
if (count !== 1) {
  console.error('Ошибка: целевой блок функции sendTg/sendPush не найден ровно 1 раз (найдено: ' + count + ').');
  process.exit(1);
}

const TO_BLOCK = [
  MARKER,
  "export async function sendTg(cid, title, body, markup) {",
  "  try {",
  "    const c = db.prepare('SELECT id, tg FROM customers WHERE id=?').get(cid);",
  "    if (!c || !c.tg) {",
  "      console.log('[push] tg skip: cid=' + cid + ' (нет привязанного Telegram)');",
  "      return { ok: false, reason: 'no_tg' };",
  "    }",
  "    const text = title ? (title + '\\n' + body) : body;",
  "    await tgSend(c.tg, text, markup);",
  "    console.log('[push] tg ok: cid=' + cid + ' tg=' + c.tg + ' title=\"' + (title || '') + '\"');",
  "    return { ok: true };",
  "  } catch (err) {",
  "    console.error('[push] tg ERR for cid=' + cid + ':', err.message);",
  "    return { ok: false, error: err.message };",
  "  }",
  "}",
  "",
  "export async function sendPush(cid, title, body, markup) {",
  "  try {",
  "    const c = db.prepare('SELECT tg, notify_tg, notify_web FROM customers WHERE id=?').get(cid);",
  "    const wantTg = !c || c.notify_tg !== 0;",
  "    const wantWeb = !c || c.notify_web !== 0;",
  "",
  "    if (wantTg) {",
  "      await sendTg(cid, title, body, markup).catch(e => {",
  "        console.error('[push] sendTg unhandled for cid=' + cid + ':', e.message);",
  "      });",
  "    } else {",
  "      console.log('[push] tg skip: notify_tg выключен у cid=' + cid);",
  "    }",
  "",
  "    if (wantWeb) {",
  "      sendFcm(cid, title, body).catch(e => {",
  "        console.error('[push] sendFcm err cid=' + cid + ':', e.message);",
  "      });",
  "      const rows = db.prepare('SELECT sub FROM subs WHERE cid=?').all(cid);",
  "      for (const r of rows) {",
  "        try {",
  "          await webpush.sendNotification(JSON.parse(r.sub), JSON.stringify({ title, body }));",
  "        } catch (e) {",
  "          if (e.statusCode === 404 || e.statusCode === 410) {",
  "            console.log('[push] webpush sub expired (удаляем): cid=' + cid);",
  "            db.prepare('DELETE FROM subs WHERE sub=?').run(r.sub);",
  "          } else {",
  "            console.error('[push] webpush send err cid=' + cid + ':', e.message);",
  "          }",
  "        }",
  "      }",
  "    }",
  "    return { ok: true };",
  "  } catch (err) {",
  "    console.error('[push] sendPush fatal err for cid=' + cid + ':', err.message);",
  "    return { ok: false, error: err.message };",
  "  }",
  "}"
].join('\n');

fs.writeFileSync(BAK_FILE, raw, 'utf8');
const patched = content.split(FROM_BLOCK).join(TO_BLOCK);
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

console.log('Успешно: логирование push.js обновлено.');
console.log('Бэкап: ' + BAK_FILE);