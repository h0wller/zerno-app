/* Ф5.7: декомпозиция legacy-core.js на 8 кластерных модулей.
Dry-run по умолчанию: печатает диапазоны и головы кластеров. --apply: пишет файлы,
меняет тег, удаляет legacy-core.js. Вербатим: top-level = global, порядок сохранён. */
import fs from 'node:fs';
const APPLY = process.argv.includes('--apply');
const SRC = 'public/app/core/legacy-core.js';
const IDX = 'public/index.html';
if (!fs.existsSync(SRC)) { console.error('❌ legacy-core.js не найден — сначала externalize-inline4.mjs (Ф5.6.1)'); process.exit(1); }
const code = fs.readFileSync(SRC, 'utf8');

const CLUSTERS = [
  ['catalog',      ['"use strict";']],
  ['staffpin',     ['function openPin(', 'function openPin (']],
  ['editor',       ['document.getElementById("grid").addEventListener("click"']],
  ['promo',        ['/* ── промокоды ── */']],
  ['dash',         ['/* ── дашборд ── */']],
  ['push-ui',      ['function urlBase64ToUint8Array(']],
  ['fx',           ['function confetti(']],
  ['overlay-core', ['function syncOverlay(']],
];
const pos = [];
let prev = 0;
for (const [name, anchors] of CLUSTERS) {
  let at = -1;
  for (const a of anchors) { const i = code.indexOf(a, prev); if (i >= 0) { at = i; break; } }
  if (at < 0) { console.error('❌ якорь кластера "' + name + '" не найден после offset ' + prev); process.exit(1); }
  pos.push(at);
  prev = at + 1;
}
pos.push(code.length);

console.log(APPLY ? '══ APPLY ══' : '══ DRY-RUN ══');
for (let i = 0; i < CLUSTERS.length; i++) {
  const slice = code.slice(pos[i], pos[i + 1]);
  console.log(CLUSTERS[i][0].padEnd(13), String(pos[i]).padStart(6), '→', String(pos[i + 1]).padStart(6),
    '|', String(slice.length).padStart(6), 'симв |', slice.trim().slice(0, 70).replace(/\s+/g, ' '));
}
if (!APPLY) { console.log('\nℹ️ Сухой прогон. Диапазоны разумны и монотонны → node scripts/split-legacy-core.mjs --apply'); process.exit(0); }

for (let i = 0; i < CLUSTERS.length; i++) {
  const name = CLUSTERS[i][0];
  fs.writeFileSync('public/app/core/' + name + '.js',
    '/* public/app/core/' + name + '.js — Ф5.7: кластер "' + name + '" из legacy-core.js (вербатим, порядок сохранён). Top-level = global. */\n' +
    code.slice(pos[i], pos[i + 1]));
}
let idx = fs.readFileSync(IDX, 'utf8');
const tag = '<script src="./app/core/legacy-core.js"></script>';
if (!idx.includes(tag)) { console.error('❌ тег legacy-core.js не найден в index.html'); process.exit(1); }
idx = idx.replace(tag, CLUSTERS.map(([n]) => '<script src="./app/core/' + n + '.js"></script>').join('\n'));
fs.writeFileSync(IDX, idx);
fs.unlinkSync(SRC);
console.log('✅ 8 модулей записаны, тег заменён на 8, legacy-core.js удалён');