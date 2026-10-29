#!/usr/bin/env node
// scripts/repair-bonus-grants.mjs — точечное восстановление приветственного бонуса гостю, которого заблокировал бэкфилл bonus_grants.
//
// Режимы (по умолчанию — ТОЛЬКО ЧТЕНИЕ, ничего не меняется):
//   node scripts/repair-bonus-grants.mjs --db /var/www/data/zerno.db --affected
//        аудит: классификация ВСЕХ подтверждённых гостей по доказательствам (без ПДн), ничего не чинит;
//   node scripts/repair-bonus-grants.mjs --db /var/www/data/zerno.db --cid <id>
//        dry-run для одного клиента: предусловия и что именно будет сделано;
//   node scripts/repair-bonus-grants.mjs --db /var/www/data/zerno.db --cid <id> --apply
//        применение к ОДНОМУ клиенту (массового применения нет намеренно).
//   --notify   после успешного коммита отправить гостю ОДНО уведомление (без флага сообщений не уходит)
//
// --apply, по шагам (любое несоответствие = остановка до или откат транзакции):
//   1. --db обязателен; показывается realpath; ошибка, если это не файл или явно «чужой» /var/www/app/zerno.db;
//   2. предусловия: класс клиента == false_marks (доказанно ложные отметки бэкфилла);
//   3. резервная копия через SQLite API (db.backup(), корректно для WAL) → открыть КОПИЮ readonly,
//      PRAGMA integrity_check, клиент и его отметки присутствуют в копии; JSON-снимок «до» рядом с копией;
//   4. одна внешняя транзакция: удалить ТОЛЬКО отметки signup/qr этого клиента с ts == метке бэкфилла →
//      штатный grantBonus(notify:false) → проверки этапа C → повторный grantBonus обязан вернуть null;
//      любая проверка не прошла → throw → откат всей транзакции;
//   5. после коммита — снимок «после» и сравнение; install, чужие клиенты, bonus_cfg и маркер бэкфилла не меняются.
// В вывод и снимки не попадают: полный телефон, Telegram ID, токены, коды промокодов. Имя — инициалы.
import fs from 'node:fs';
import Database from 'better-sqlite3';

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : undefined; };
const has = (n) => args.includes('--' + n);
const die = (msg, code = 2) => { console.error('❌ ' + msg); process.exit(code); };

const apply = has('apply');
const cid = opt('cid');
if (!has('affected') && !cid) die('Укажите --cid <id> или --affected');
if (apply && !cid) die('--apply допустим только с --cid (массового применения нет)');
if (apply && has('affected')) die('--apply нельзя сочетать с --affected');

const dbArg = opt('db');
if (!dbArg) die('Укажите --db /var/www/data/zerno.db (автоопределение пути отключено намеренно)');
if (!fs.existsSync(dbArg) || !fs.statSync(dbArg).isFile()) die(`Файл базы не найден: ${dbArg}`);
const dbPath = fs.realpathSync(dbArg);
if (apply && dbPath === '/var/www/app/zerno.db') die('Это /var/www/app/zerno.db — не рабочая база. Рабочая: /var/www/data/zerno.db');
console.log(`База (realpath): ${dbPath}`);

process.env.DB_PATH = dbPath; // connection.js откроет именно эту базу
const { db } = await import('../server/db/connection.js');
const { classify, backfillTsOf, initials } = await import('./lib/bonus-forensics.mjs');
const { grantBonus, getBonusConfig } = await import('../server/domain/bonuses.js');
const { splitStamps } = await import('../server/utils/loyalty-helpers.js');
const { sendPush } = await import('../server/services/push.js');

const backfillTs = backfillTsOf(db);
if (!backfillTs) { console.log('Бэкфилл bonus_grants в этой базе не выполнялся — чинить нечего.'); process.exit(0); }
console.log(`Бэкфилл: ${backfillTs}`);

const LABEL = {
  false_marks: 'A · доказанно ложные отметки (кандидат на восстановление)',
  unclear: 'B · неясно (ручной разбор)',
  real: 'C · есть доказательства реального начисления/использования',
  not_marked: '— отметок signup/qr нет',
  unrelated: '— не гость / не подтверждён',
};

// ─────────── Аудит всех ───────────
if (has('affected')) {
  const rows = db.prepare('SELECT * FROM customers').all();
  const by = {};
  for (const c of rows) {
    const r = classify(db, c, backfillTs);
    (by[r.cls] ||= []).push({ c, r });
  }
  console.log(`Всего клиентов: ${rows.length}`);
  for (const k of ['false_marks', 'unclear', 'real', 'not_marked', 'unrelated']) console.log(`  ${LABEL[k]}: ${(by[k] || []).length}`);
  for (const k of ['false_marks', 'unclear']) {
    for (const { c, r } of (by[k] || [])) {
      console.log(`  [${k}] ${c.id} ${initials(c.name)} src=${c.src || '—'} tg=${c.tg ? 'привязан' : 'нет'} notify_tg=${c.notify_tg} · ${r.reasons.join('; ')}`);
    }
  }
  console.log('\nВНИМАНИЕ: класс A означает «отметка ничего не доказывает», а не «обязательно положен бонус». Давно активных клиентов массово не чиним — это бизнес-решение.');
  process.exit(0);
}

// ─────────── Один клиент ───────────
const target = db.prepare('SELECT * FROM customers WHERE id=?').get(cid);
if (!target) die('Клиент с таким id не найден', 1);
const verdict = classify(db, target, backfillTs);
console.log(`Клиент ${target.id} ${initials(target.name)}: ${LABEL[verdict.cls]}`);
for (const r of verdict.reasons) console.log(`  · ${r}`);
if (verdict.cls !== 'false_marks') {
  console.log('Предусловия не выполнены — восстановление НЕ выполняется.');
  process.exit(apply ? 1 : 0);
}

const kind = target.src === 'qr' ? 'qr' : 'signup';
const cfg = getBonusConfig().kinds[kind];
console.log(`План: удалить отметки signup/qr (ts=${backfillTs}) → grantBonus('${kind}'); конфиг канала: штампов ${cfg?.coffee ?? 0}, скидка ${cfg?.delivery ?? 0} ₽, бесплатная доставка ${cfg?.freeFirstDelivery ? 'да' : 'нет'}.`);
if (!cfg || (cfg.coffee <= 0 && cfg.delivery <= 0 && !cfg.freeFirstDelivery)) die('Для этого канала в bonus_cfg ничего не начисляется — восстанавливать нечего', 1);
if (!apply) { console.log('DRY-RUN: ничего не изменено. Для применения добавьте --apply.'); process.exit(0); }

// снимок состояния клиента без ПДн (коды промокодов — только количество)
const snapshot = (id) => {
  const c = db.prepare('SELECT id, role, verified, welcome, cups, stamps, free FROM customers WHERE id=?').get(id);
  return {
    customer: c,
    grants: db.prepare('SELECT kind, ts FROM bonus_grants WHERE cid=? ORDER BY kind').all(id),
    bonusHistory: db.prepare("SELECT COUNT(*) n FROM history WHERE cid=? AND a LIKE '🎁 Бонус «%'").get(id).n,
    historyTotal: db.prepare('SELECT COUNT(*) n FROM history WHERE cid=?').get(id).n,
    promosOwned: db.prepare('SELECT COUNT(*) n FROM promos WHERE owner=?').get(id).n,
    freeshipOwned: db.prepare("SELECT COUNT(*) n FROM promos WHERE owner=? AND kind='freeship'").get(id).n,
  };
};
const globalState = () => ({
  customers: db.prepare('SELECT COUNT(*) n FROM customers').get().n,
  grantsTotal: db.prepare('SELECT COUNT(*) n FROM bonus_grants').get().n,
  promosTotal: db.prepare('SELECT COUNT(*) n FROM promos').get().n,
  bonusCfg: (db.prepare("SELECT value FROM meta WHERE key='bonus_cfg'").get() || {}).value || null,
  backfillMarker: (db.prepare("SELECT value FROM meta WHERE key='bonus_grants_backfilled'").get() || {}).value || null,
});

// ── 3. резервная копия через SQLite API и проверка копии ──
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const bak = `${dbPath}.pre-repair-${stamp}.bak`;
await db.backup(bak);
const copy = new Database(bak, { readonly: true, fileMustExist: true });
try {
  const ic = copy.pragma('integrity_check', { simple: true });
  if (ic !== 'ok') die(`integrity_check копии: ${ic} — остановлено, база не менялась`, 1);
  if (!copy.prepare('SELECT 1 FROM customers WHERE id=?').get(cid)) die('В копии нет целевого клиента — остановлено', 1);
  const gCopy = copy.prepare("SELECT COUNT(*) n FROM bonus_grants WHERE cid=? AND kind IN ('signup','qr')").get(cid).n;
  const gLive = db.prepare("SELECT COUNT(*) n FROM bonus_grants WHERE cid=? AND kind IN ('signup','qr')").get(cid).n;
  if (gCopy !== gLive) die('Отметки в копии не совпадают с живой базой — остановлено', 1);
  console.log(`Резервная копия: ${bak} · integrity_check=ok · клиент и отметки присутствуют`);
} finally { copy.close(); }

const before = snapshot(cid);
const gBefore = globalState();
fs.writeFileSync(`${bak}.before.json`, JSON.stringify({ at: new Date().toISOString(), before, global: gBefore }, null, 2));

// ── 4. внешняя транзакция: удаление ложных отметок + штатное начисление + проверки этапа C ──
let result = null;
const expectStamps = splitStamps(before.customer.stamps, before.customer.free, cfg.coffee);
const run = db.transaction(() => {
  const del = db.prepare("DELETE FROM bonus_grants WHERE cid=? AND kind IN ('signup','qr') AND ts=?").run(cid, backfillTs);
  if (del.changes < 1) throw new Error('не найдено отметок бэкфилла для удаления');
  result = grantBonus(cid, kind, { notify: false });
  if (!result) throw new Error('grantBonus вернул null — состояние откатывается');

  const s = snapshot(cid);
  const check = (cond, msg) => { if (!cond) throw new Error('проверка не пройдена: ' + msg); };
  const welcome = s.grants.filter((g) => g.kind === 'signup' || g.kind === 'qr');
  check(welcome.length === 1 && welcome[0].kind === kind, 'должна быть ровно одна приветственная отметка нужного канала');
  const instBefore = before.grants.find((g) => g.kind === 'install') || null;
  const instAfter = s.grants.find((g) => g.kind === 'install') || null;
  check(JSON.stringify(instBefore) === JSON.stringify(instAfter), 'отметка install изменилась');
  check(s.customer.stamps === expectStamps.stamps && s.customer.free === expectStamps.free, 'штампы/подарки не соответствуют конфигу и splitStamps');
  check(s.customer.cups === before.customer.cups, 'cups изменились');
  check(s.bonusHistory === 1 && s.historyTotal === before.historyTotal + 1, 'в истории должна появиться ровно одна запись начисления');
  const expFree = cfg.freeFirstDelivery ? 1 : 0;
  check(s.freeshipOwned === before.freeshipOwned + expFree, 'число персональных freeship-промокодов не соответствует конфигу');
  check(s.promosOwned === before.promosOwned + expFree, 'появились лишние персональные промокоды');
  const g = globalState();
  const expPromos = gBefore.promosTotal + expFree + (cfg.delivery > 0 ? 1 : 0);
  check(g.promosTotal === expPromos, 'общее число промокодов изменилось сверх ожидаемого');
  check(g.customers === gBefore.customers && g.bonusCfg === gBefore.bonusCfg && g.backfillMarker === gBefore.backfillMarker, 'затронуты общие данные/конфигурация');
  check(g.grantsTotal === gBefore.grantsTotal - del.changes + 1, 'затронуты отметки других клиентов');
  // идемпотентность: повторный вызов внутри той же транзакции обязан ничего не начислить
  check(grantBonus(cid, kind, { notify: false }) === null, 'повторный grantBonus начислил бонус второй раз');
  check(grantBonus(cid, kind === 'qr' ? 'signup' : 'qr', { notify: false }) === null, 'второй канал приветственного бонуса начислил подарок');
  check(JSON.stringify(snapshot(cid)) === JSON.stringify(s), 'повторные вызовы изменили состояние');
});

try { run(); } catch (e) {
  console.error(`❌ Транзакция откачена: ${e.message}`);
  const after = snapshot(cid);
  console.error(JSON.stringify(after) === JSON.stringify(before) ? 'Состояние клиента идентично исходному. Копия: ' + bak : '⚠ состояние отличается от исходного — сравните со снимком ' + bak + '.before.json');
  process.exit(1);
}

const after = snapshot(cid);
fs.writeFileSync(`${bak}.after.json`, JSON.stringify({ at: new Date().toISOString(), after, global: globalState() }, null, 2));
console.log('✅ Коммит выполнен. Проверки этапа C пройдены внутри транзакции.');
console.log(`  до:    штампов ${before.customer.stamps}, подарков ${before.customer.free}, запись бонуса в истории ${before.bonusHistory}, freeship ${before.freeshipOwned}`);
console.log(`  после: штампов ${after.customer.stamps}, подарков ${after.customer.free}, запись бонуса в истории ${after.bonusHistory}, freeship ${after.freeshipOwned}`);
console.log(`  отметки: ${after.grants.map((g) => g.kind).join(', ')}`);

if (has('notify')) {
  const r = await sendPush(cid, '🎁 Бонус начислен', result.message);
  const tg = r.telegram;
  console.log(`Уведомление: Telegram ${tg?.ok ? 'принят API' : 'НЕ отправлен (' + (tg?.reason || 'нет данных') + ')'}, web ${r.web?.ok ? 'отправлено ' + r.web.sent : (r.web?.reason || 'нет')}. Принятие API ≠ прочтение гостем.`);
} else {
  console.log('Уведомление НЕ отправлялось (нет --notify). Гость увидит бонус в приложении.');
}
