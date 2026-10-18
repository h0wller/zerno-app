// scripts/split-css.mjs: режет css-src/00-all.css по баннерам на части; порядок сохраняется, текст не меняется
import { readFile, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(here, '..', 'public/app/ui/css-src');
const allPath = path.join(srcDir, '00-all.css');

// [имя части, регэксп первой строки части]; порядок совпадает с порядком в файле
const ANCHORS = [
  ['10-base.css',        /^\/\* ── Базовые сбросы/],
  ['20-cards.css',       /^\/\* ── Карточки и сетка/],
  ['30-utils.css',       /^\/\* ── Утилиты/],
  ['40-catalog.css',     /^\/\* ── Сабфильтры каталога/],
  ['50-edit-mode.css',   /^\/\* ── Тумблер режима правки \(единый/],
  ['60-cart.css',        /^\/\* ══ КОРЗИНА: Базовый каркас/],
  ['70-ticker.css',      /^\/\* ── Тикер: база/],
  ['80-splash.css',      /^\/\* ── Сплэш бренда/],
  ['90-modals.css',      /^\/\* ── Ф5\.7 чанк 2/],
  ['100-chat.css',       /^\/\* ── Ф5\.8 чанк 3/],
  ['110-panel.css',      /^\/\* ══ правая панель/],
  ['120-cashier.css',    /^\/\* ── F5\.10 чанк 5/],
  ['130-service.css',    /^\/\* ── F5\.11 чанк 6/],
  ['140-topbar.css',     /^\/\* ══ шапка ══/],
  ['150-rail.css',       /^\/\* ── F5\.15: мобильный рейл/],
  ['160-tail.css',       /^\/\* ── F5\.16: мобильная доводка/],
];

const text = await readFile(allPath, 'utf8');
const lines = text.split('\n');
const cuts = [];
let from = 0;
for (const [name, re] of ANCHORS) {
  const idx = lines.findIndex((l, i) => i >= from && re.test(l));
  if (idx < 0) throw new Error(`Якорь не найден: ${name} (${re})`);
  cuts.push({ name, idx });
  from = idx + 1;
}

const parts = [];
const head = lines.slice(0, cuts[0].idx).join('\n') + '\n';
parts.push(['00-head.css', head]);
cuts.forEach((c, i) => {
  const end = i + 1 < cuts.length ? cuts[i + 1].idx : lines.length;
  parts.push([c.name, lines.slice(c.idx, end).join('\n') + (end < lines.length ? '\n' : '')]);
});

// Проверка: склейка частей должна дать исходный текст байт в байт
const joined = parts.map(([, t]) => t).join('');
if (joined !== text) throw new Error('Склейка не совпала с исходником, файлы не записаны');

for (const [name, t] of parts) await writeFile(path.join(srcDir, name), t);
await unlink(allPath);
console.log(`Разрезано на ${parts.length} частей: ${parts.map(([n]) => n).join(', ')}`);