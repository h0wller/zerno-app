#!/usr/bin/env node
/* Точечные вставки для файлов, которые в вашем репозитории могли уйти далеко от снапшота
   (public/index.html, server/db/schema.js, server/routes/auth.js).
   Идемпотентны: если фрагмент уже есть — пропускают. Ничего не удаляют.
   Запуск:  node apply/inserters.mjs [--apply]     (без --apply — только печать плана) */
import { readFileSync, writeFileSync } from 'node:fs';

const APPLY = process.argv.includes('--apply');

const INDEX_RULE = `/* Резерв высоты для карточек меню вне экрана.
   Без него пропущенная раскладка карточки = max(min-height:340, резерв 320) = 340px,
   а после отрисовки ~350px → скачок при скролле и разные высоты рядов в сетке.
   347px + рамки карточки = 349px — ровно реальная высота отрисованной карточки
   (180px медиа + 167px тело + 2px рамки), поэтому ряды совпадают и до отрисовки, и после. */
#grid .card:nth-child(n+5) {
  contain-intrinsic-block-size: 347px;
}
`;

const SCHEMA_BACKFILL = `
  /* ── Бонусы: разовый бэкфилл bonus_grants ──
     Профили, созданные до появления таблицы bonus_grants, уже получали приветственные бонусы
     (или не получат их задним числом). Помечаем все три вида как выданные, чтобы grantBonus
     не считал старого клиента новичком и не начислил напиток повторно.
     Идемпотентно: флаг в meta + INSERT OR IGNORE по PK(cid, kind). */
  if (!db.prepare("SELECT 1 FROM meta WHERE key='bonus_grants_backfilled'").get()) {
    const ts = new Date().toISOString();
    const fill = db.prepare('INSERT OR IGNORE INTO bonus_grants(cid,kind,ts) VALUES(?,?,?)');
    const backfill = db.transaction(() => {
      for (const row of db.prepare('SELECT id FROM customers').all()) {
        fill.run(row.id, 'signup', ts);
        fill.run(row.id, 'qr', ts);
        fill.run(row.id, 'install', ts);
      }
      db.prepare("INSERT INTO meta(key,value) VALUES('bonus_grants_backfilled',?)").run(ts);
    });
    backfill();
  }
`;

const AUTH_GRANT = `  // Приветственный бонус — как и при активации сотрудником (/api/staff/activate-guest).
  grantBonus(c.id, c.src === QR_SOURCE ? 'qr' : 'signup');
`;

let changed = 0;
let skipped = 0;
const problems = [];

function report(file, status, note = '') {
  const icon = status === 'ok' ? '✅' : status === 'skip' ? '➖' : '⚠️';
  console.log(`${icon} ${file}: ${status}${note ? ' — ' + note : ''}`);
  if (status === 'ok') changed++;
  if (status === 'skip') skipped++;
  if (status === 'manual') problems.push(`${file}: ${note}`);
}

/** Вставляет block после строки, содержащей marker (ищется с позиции from). */
function insertAfterLine(src, marker, block, from = 0) {
  const i = src.indexOf(marker, from);
  if (i === -1) return null;
  const eol = src.indexOf('\n', i);
  if (eol === -1) return null;
  return src.slice(0, eol + 1) + block + src.slice(eol + 1);
}

/** Вставляет block после закрывающей «}» строки правила, начинающегося с marker. */
function insertAfterRule(src, marker, block) {
  const i = src.indexOf(marker);
  if (i === -1) return null;
  const brace = src.indexOf('{', i);
  if (brace === -1) return null;
  const close = src.indexOf('}', brace);
  if (close === -1) return null;
  const eol = src.indexOf('\n', close);
  const at = eol === -1 ? src.length : eol + 1;
  return src.slice(0, at) + block + src.slice(at);
}

function save(file, next) {
  if (APPLY) writeFileSync(file, next, 'utf8');
  report(file, 'ok', APPLY ? 'вставлено' : 'будет вставлено (dry-run)');
}

/* ── 1. public/index.html: резерв высоты для content-visibility ── */
{
  const file = 'public/index.html';
  const src = readFileSync(file, 'utf8');
  if (src.includes('contain-intrinsic-block-size')) {
    report(file, 'skip', 'contain-intrinsic-block-size уже есть');
  } else {
    const anchor = src.indexOf('content-visibility: auto');
    if (anchor === -1) {
      report(file, 'manual', 'не найден блок с content-visibility: auto — вставьте правило из apply/files/public/index.html вручную (см. README)');
    } else {
      const next = insertAfterRule(src, '#grid .card:nth-child(n+5)', '\n' + INDEX_RULE);
      if (next) save(file, next);
      else report(file, 'manual', 'не удалось найти конец правила #grid .card:nth-child(n+5)');
    }
  }
}

/* ── 2. server/db/schema.js: бэкфилл bonus_grants в конце initSchema ── */
{
  const file = 'server/db/schema.js';
  const src = readFileSync(file, 'utf8');
  if (src.includes('bonus_grants_backfilled')) {
    report(file, 'skip', 'бэкфилл уже есть');
  } else {
    const tableAt = src.indexOf('CREATE TABLE IF NOT EXISTS bonus_grants');
    if (tableAt === -1) {
      report(file, 'manual', 'не найдена таблица bonus_grants — сначала она должна создаваться в initSchema()');
    } else {
      // закрывающая "`);" db.exec(...) после создания таблицы/индексов
      const execEnd = src.indexOf('`);', tableAt);
      if (execEnd === -1) {
        report(file, 'manual', 'не найден конец db.exec(`…`) после bonus_grants');
      } else {
        const eol = src.indexOf('\n', execEnd);
        const next = src.slice(0, eol + 1) + SCHEMA_BACKFILL + src.slice(eol + 1);
        save(file, next);
      }
    }
  }
}

/* ── 3. server/routes/auth.js: бонус при активации гостем по коду ── */
{
  const file = 'server/routes/auth.js';
  const src = readFileSync(file, 'utf8');
  const marker = "addHist(c.id, '✅ Профиль активирован на кассе', 'Кассир');";
  const at = src.indexOf(marker);
  if (at === -1) {
    report(file, 'manual', 'не найдена строка addHist(… «Профиль активирован на кассе» …) — проверьте /api/auth/activate-guest');
  } else {
    const tail = src.slice(at);
    const already = tail.slice(0, 400).includes('grantBonus(c.id');
    if (already) {
      report(file, 'skip', 'grantBonus уже вызывается после активации на кассе');
    } else {
      const next = insertAfterLine(src, marker, AUTH_GRANT);
      if (next) save(file, next);
      else report(file, 'manual', 'не удалось вставить grantBonus после addHist');
    }
  }
}

/* ── 4. scripts/backfill-bonus-grants.mjs: дубль удалён (логика в schema.js) ── */
{
  const file = 'scripts/backfill-bonus-grants.mjs';
  let exists = true;
  try { readFileSync(file, 'utf8'); } catch { exists = false; }
  if (!exists) report(file, 'skip', 'файла нет');
  else report(file, 'ok', 'удалить вручную: rm ' + file + ' (логика переехала в initSchema)');
}

console.log(`\nИтог: вставок ${changed}, пропущено ${skipped}, требует рук ${problems.length}`);
if (problems.length) {
  console.log('\nЧто сделать вручную:');
  problems.forEach((p) => console.log('  • ' + p));
}
if (!APPLY) console.log('\nЭто dry-run. Применить: node apply/inserters.mjs --apply');
process.exit(problems.length ? 2 : 0);
