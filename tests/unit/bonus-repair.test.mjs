// Точечное восстановление приветственного бонуса (scripts/repair-bonus-grants.mjs): классификация по доказательствам,
// бэкап, проверки внутри транзакции, откат, идемпотентность. Базу создаём до импорта connection.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';


const TMP_DB = path.join(os.tmpdir(), `zerno-repair-${process.pid}-${Date.now()}.db`);
process.env.DB_PATH = TMP_DB;
process.env.NODE_ENV = 'test';

const { db } = await import('../../server/db/connection.js');
const { initSchema } = await import('../../server/db/schema.js');
const { grantBonus, setBonusConfig } = await import('../../server/domain/bonuses.js');

initSchema();
setBonusConfig({ days: 30, kinds: { signup: { coffee: 10, freeFirstDelivery: 1 }, qr: { coffee: 10, freeFirstDelivery: 1 }, install: { coffee: 0 } } });

initSchema();
setBonusConfig({ days: 30, kinds: { signup: { coffee: 10, freeFirstDelivery: 1 }, qr: { coffee: 10, freeFirstDelivery: 1 }, install: { coffee: 0 } } });

let seq = 0;
function makeCustomer(over = {}) {
  const id = `a${++seq}`;
  db.prepare('INSERT INTO customers(id,name,phone,verified,role,tg,created_at) VALUES(?,?,?,?,?,?,?)').run(
    id, over.name || 'Анна Тестова', over.phone || `+7 999 000-${String(seq).padStart(2, '0')}-${String(seq).padStart(2, '0')}`,
    over.verified === undefined ? 1 : over.verified, 'guest', over.tg || null, over.created || '2026-09-01T10:00:00.000Z');
  return id;
}
const row = (id) => db.prepare('SELECT stamps, free, verified FROM customers WHERE id=?').get(id);
const grants = (id) => db.prepare('SELECT kind, ts FROM bonus_grants WHERE cid=? ORDER BY kind').all(id);
const bonusHist = (id) => db.prepare("SELECT COUNT(*) n FROM history WHERE cid=? AND a LIKE '🎁 Бонус «%'").get(id).n;


const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const runScript = (name, args) => spawnSync(process.execPath, [...process.execArgv, path.join(ROOT, 'scripts', name), '--db', TMP_DB, ...args],
  { encoding: 'utf8', env: { ...process.env, DB_PATH: TMP_DB } });

/** Гость, которого заблокировал старый бэкфилл: помечен им, подтверждён позже, бонуса нет. */
function makeBlockedGuest() {
  const id = makeCustomer({ verified: 0, phone: `+7 999 777-${String(++seq).padStart(2, '0')}-99`, tg: null });
  const ts = db.prepare("SELECT value FROM meta WHERE key='bonus_grants_backfilled'").get().value;
  for (const k of ['signup', 'qr', 'install']) db.prepare('INSERT OR IGNORE INTO bonus_grants(cid,kind,ts) VALUES(?,?,?)').run(id, k, ts);
  db.prepare('UPDATE customers SET verified=1 WHERE id=?').run(id);
  const later = new Date(Date.parse(ts) + 60000).toISOString();
  db.prepare('INSERT INTO history(cid,ts,a,by) VALUES(?,?,?,?)').run(id, later, '✅ Профиль активирован сотрудником', 'Сотрудник');
  return id;
}

const snap = (id) => ({
  c: db.prepare('SELECT stamps, free, cups FROM customers WHERE id=?').get(id),
  g: grants(id), h: db.prepare('SELECT COUNT(*) n FROM history WHERE cid=?').get(id).n,
  p: db.prepare('SELECT COUNT(*) n FROM promos WHERE owner=?').get(id).n,
});
const cleanBackups = () => {
  const out = [];
  for (const f of fs.readdirSync(os.tmpdir())) if (f.startsWith(path.basename(TMP_DB) + '.pre-repair-')) { out.push(f); fs.unlinkSync(path.join(os.tmpdir(), f)); }
  return out;
};

test('repair: dry-run ничего не меняет и показывает план', () => {
  const id = makeBlockedGuest();
  const before = snap(id);
  const dry = runScript('repair-bonus-grants.mjs', ['--cid', id]);
  assert.equal(dry.status, 0, dry.stderr);
  assert.match(dry.stdout, /A · доказанно ложные отметки/);
  assert.match(dry.stdout, /DRY-RUN/);
  assert.deepEqual(snap(id), before);
  assert.equal(cleanBackups().length, 0, 'dry-run не создаёт копий');
});

test('repair: --apply — копия + integrity_check, одна приветственная отметка, install цел, один freeship, одна запись истории; повтор отклонён', () => {
  const id = makeBlockedGuest();
  const other = makeBlockedGuest(); // посторонний клиент с такими же ложными отметками не должен измениться
  const otherBefore = snap(other);
  const instBefore = grants(id).find((g) => g.kind === 'install');
  const histBefore = snap(id).h, promosBefore = snap(id).p;
  const ap = runScript('repair-bonus-grants.mjs', ['--cid', id, '--apply']);
  assert.equal(ap.status, 0, ap.stderr + ap.stdout);
  assert.match(ap.stdout, /integrity_check=ok/);
  assert.match(ap.stdout, /Проверки этапа C пройдены/);
  assert.match(ap.stdout, /Уведомление НЕ отправлялось/);
  const files = cleanBackups();
  assert.ok(files.some((f) => f.endsWith('.bak')), 'резервная копия создана');
  assert.ok(files.some((f) => f.endsWith('.before.json')) && files.some((f) => f.endsWith('.after.json')), 'снимки до/после сохранены');

  const s = snap(id);
  assert.equal(s.c.free, 1);
  assert.equal(s.c.stamps, 0);
  assert.equal(s.g.filter((g) => g.kind === 'signup' || g.kind === 'qr').length, 1, 'ровно одна приветственная отметка');
  assert.deepEqual(s.g.find((g) => g.kind === 'install'), instBefore, 'install не тронут');
  assert.equal(bonusHist(id), 1);
  assert.equal(s.h, histBefore + 1);
  assert.equal(s.p, promosBefore + 1, 'ровно один персональный freeship-промокод');
  assert.deepEqual(snap(other), otherBefore, 'другой клиент не затронут');

  const again = runScript('repair-bonus-grants.mjs', ['--cid', id, '--apply']);
  assert.equal(again.status, 1, 'повторное применение отклоняется');
  assert.match(again.stdout, /Предусловия не выполнены/);
  assert.deepEqual(snap(id), s, 'повтор ничего не начислил');
  assert.equal(grantBonus(id, 'signup'), null);
  assert.equal(grantBonus(id, 'qr'), null);
  cleanBackups();
});

test('repair: клиент, получивший бонус штатно, и клиент со следами лояльности не чинятся', () => {
  const real = makeBlockedGuest();
  db.prepare("INSERT INTO history(cid,ts,a,by) VALUES(?,?,?,?)").run(real, new Date().toISOString(), '🎁 Бонус «Регистрация»: приветственный напиток', 'Система');
  const unclear = makeBlockedGuest();
  db.prepare("INSERT INTO history(cid,ts,a,by) VALUES(?,?,?,?)").run(unclear, new Date().toISOString(), 'Штамп 1 из 10', 'Касса');
  const withPromo = makeBlockedGuest();
  db.prepare("INSERT INTO promos(id,code,kind,value,active,maxuses,uses,created,scope,owner) VALUES(?,?,?,?,1,1,0,?,?,?)")
    .run('p-' + withPromo, 'X' + withPromo, 'freeship', 0, new Date().toISOString(), 'delivery', withPromo);
  for (const id of [real, unclear, withPromo]) {
    const before = snap(id);
    const r = runScript('repair-bonus-grants.mjs', ['--cid', id, '--apply']);
    assert.equal(r.status, 1, id);
    assert.match(r.stdout, /Предусловия не выполнены/);
    assert.deepEqual(snap(id), before, 'состояние не изменилось');
  }
  assert.equal(cleanBackups().length, 0, 'без выполненных предусловий копия не создаётся');
});

test('repair: защита параметров — --apply без --cid / вместе с --affected / без --db отклоняется', () => {
  const id = makeBlockedGuest();
  assert.equal(runScript('repair-bonus-grants.mjs', ['--affected', '--apply']).status, 2);
  const noDb = spawnSync(process.execPath, [...process.execArgv, path.join(ROOT, 'scripts', 'repair-bonus-grants.mjs'), '--cid', id, '--apply'],
    { encoding: 'utf8', env: { ...process.env, DB_PATH: TMP_DB } });
  assert.equal(noDb.status, 2);
  assert.match(noDb.stderr, /--db/);
  assert.equal(grants(id).length, 3);
});

test('repair: канал без начислений в bonus_cfg — остановка, состояние прежнее', () => {
  const id = makeBlockedGuest();
  const before = snap(id);
  const cfgBefore = db.prepare("SELECT value FROM meta WHERE key='bonus_cfg'").get().value;
  setBonusConfig({ days: 30, kinds: { signup: { coffee: 0, delivery: 0, freeFirstDelivery: 0 }, qr: { coffee: 0, delivery: 0, freeFirstDelivery: 0 }, install: { coffee: 0 } } });
  const r = runScript('repair-bonus-grants.mjs', ['--cid', id, '--apply']);
  db.prepare("UPDATE meta SET value=? WHERE key='bonus_cfg'").run(cfgBefore);
  assert.equal(r.status, 1);
  assert.deepEqual(snap(id), before);
  cleanBackups();
});

test('repair --affected: аудит классифицирует клиентов, ничего не меняет и не выводит ПДн', () => {
  const a = makeBlockedGuest();
  const normalGuest = makeCustomer({ verified: 1 });
  grantBonus(normalGuest, 'signup'); // штатное начисление (отметка не от бэкфилла)
  const size = fs.statSync(TMP_DB).mtimeMs;
  const r = runScript('repair-bonus-grants.mjs', ['--affected']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /A · доказанно ложные отметки/);
  assert.match(r.stdout, new RegExp(`\\[false_marks\\] ${a}\\b`));
  assert.doesNotMatch(r.stdout, new RegExp(`\\[(false_marks|unclear)\\] ${normalGuest}\\b`));
  const phone = db.prepare('SELECT phone FROM customers WHERE id=?').get(a).phone;
  assert.ok(!r.stdout.includes(phone) && !r.stdout.includes('Анна Тестова'));
  assert.equal(grants(a).length, 3);
  void size;
});

test('чистка: временная БД удаляется', () => {
  db.close();
  for (const f of fs.readdirSync(os.tmpdir())) if (f.startsWith(path.basename(TMP_DB))) fs.unlinkSync(path.join(os.tmpdir(), f));
  assert.ok(!fs.existsSync(TMP_DB));
});
