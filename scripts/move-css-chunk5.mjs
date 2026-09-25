/* Ф5.8b: пакетная конверсия IIFE-листьев → type="module" (только смена тега).
Безопасность: файл обязан быть IIFE ('(function' в первых 400 символах) И тег обязан
иметь defer (иначе конверсия меняет тайминг parse→defer). Несовпадение → skip с варном.
Модули исполняются в общем defer-порядке по позиции тега — порядок сохранён. */
import fs from 'node:fs';
const IDX = 'public/index.html';
const NAMES = [
  'app/chat.js', 'app/core/chat-head.js', 'app/core/chat-state.js', 'app/chat-core.js',
  'app/core/config.js', 'app/core/deeplink.js', 'app/core/swipe.js', 'app/core/overlay.js',
  'app/admin-extra.js', 'app/core/notify.js', 'app/core/splash.js', 'app/ui/settings.js',
  'app/ui/delivery-search.js', 'app/ui/cashier-log.js', 'app/ui/cashier-card.js',
  'app/live.js', 'app/scanner.js', 'app/ui/scrolltop.js', 'app/ui/styles.js', 'app/core/a11y.js',
];
let idx = fs.readFileSync(IDX, 'utf8');
let done = 0;
for (const rel of NAMES) {
  const file = 'public/' + rel;
  const src = fs.readFileSync(file, 'utf8');
  if (!/\(function/.test(src.slice(0, 400))) { console.log('⚠️ ' + rel + ': не IIFE — пропуск (пойдёт в Ф5.8c с шимами)'); continue; }
  const re = new RegExp('<script([^>]*?)src="([^"]*' + rel.replace(/[./]/g, '\\$&') + ')"([^>]*)>');
  const m = idx.match(re);
  if (!m) { console.log('⚠️ ' + rel + ': тег не найден — проверь вручную'); continue; }
  if (/type="module"/.test(m[0])) { console.log('⚠️ ' + rel + ': уже module'); continue; }
  if (!/defer/.test(m[1] + m[3])) { console.log('⚠️ ' + rel + ': тег без defer — пропуск (тайминг-риск)'); continue; }
  idx = idx.replace(m[0], '<script type="module" src="' + m[2] + '"></script>');
  console.log('✅ ' + rel + ' → type="module"');
  done++;
}
if (done) fs.writeFileSync(IDX, idx);
console.log('✅ конвертировано:', done, 'из', NAMES.length);