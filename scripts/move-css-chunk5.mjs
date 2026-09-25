/* Ф5.6.2g-fix: консолидация конфетти-подсистемы в fx.js.
v2-regex push-ui съел const fx/fxx внутрь window.pushBusy-ассайна → pieces остался
module-private в push-ui → ReferenceError: pieces is not defined на штампе.
Решение: весь конфетти-блок (fx/fxx/pieces/fxOn + fitFx + resize) переезжает в fx.js
как module-private состояние; push-ui чистим от fx-кода и window-артефактов v2. */
import fs from 'node:fs';
const P = 'public/app/core/push-ui.js';
const FX = 'public/app/core/fx.js';
let p = fs.readFileSync(P, 'utf8');
let f = fs.readFileSync(FX, 'utf8');

/* 1. убрать window-артефакты v2 для fx-состояния */
p = p.replace(/^[ \t]*window\.(fx|fxx|pieces|fxOn)[ \t]*=[^\n]*\n/gm, '');
p = p.replace(/^[ \t]*window\.fitFx[ \t]*=[^\n]*\n/gm, '');

/* 2. вырезать конфетти-блок из push-ui (от const fx до resize-биндинга) */
let block = '';
const reBlock = /const\s+fx\s*=[\s\S]*?addEventListener\(["']resize["'],\s*fitFx\);/;
const m = p.match(reBlock);
if (m) { block = m[0]; p = p.replace(reBlock, ''); }

/* 3. фолбэк: если блок не собрался — синтезируем чистый */
if (!block || !block.includes('function fitFx')) {
  block = 'const fx = $("#fx"),\n  fxx = fx.getContext("2d");\nlet pieces = [],\n  fxOn = false;\nfunction fitFx() {\n  fx.width = innerWidth;\n  fx.height = innerHeight;\n}\nfitFx();\naddEventListener("resize", fitFx);';
  console.log('⚠️ блок не найден целиком — синтезирована чистая версия');
}

/* 4. страховка: в push-ui не осталось fx-ссылок */
if (/\b(fxx|fxOn|pieces|fitFx)\b/.test(p.replace(/\/\*[\s\S]*?\*\//g, ''))) {
  console.error('❌ push-ui.js всё ещё ссылается на fx/fxx/pieces/fxOn — покажи строки вручную');
  process.exit(1);
}

/* 5. вставить блок в fx.js (после шапки), если fitFx ещё не там */
if (!f.includes('function fitFx')) {
  const lines = f.split('\n');
  let at = 0;
  if (lines[0].trim().startsWith('/*')) at = 1;
  lines.splice(at, 0, '/* ── Ф5.6.2g-fix: конфетти-подсистема целиком в fx.js (module-private) ── */\n' + block + '\n');
  f = lines.join('\n');
}
if (!f.includes('window.fitFx =')) f += '\nwindow.fitFx = fitFx;\n';

fs.writeFileSync(P, p);
fs.writeFileSync(FX, f);
console.log('✅ конфетти консолидировано в fx.js; push-ui.js очищен');