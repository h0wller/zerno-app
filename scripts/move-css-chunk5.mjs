/* Ф5.6.2i: устранить лексическое затенение в конвертированных модулях.
Голые вызовы функций, которые модуль сам экспортирует в window (и которые снаружи
могут быть обёрнуты: sv→syncBrandViews, admin-extra→loadMenu, cashier-log→setMode),
заменяем на window.X(...) — как резолвилось в classic-режиме в момент вызова.
Не трогаем: определения (function X(), window.X =), внутренние неэкспортируемые
функции (loop и т.п.), обращения через точку/$. */
import fs from 'node:fs';
const FILES = ['catalog', 'staffpin', 'editor', 'promo', 'dash', 'push-ui', 'fx', 'overlay-core']
  .map(n => 'public/app/core/' + n + '.js');
let total = 0;
for (const f of FILES) {
  let s = fs.readFileSync(f, 'utf8');
  const names = new Set();
  const reExp = /window\.(\w+)\s*=\s*\1\s*;/g;
  let m;
  while ((m = reExp.exec(s))) names.add(m[1]);
  let changed = 0;
  for (const n of names) {
    const re = new RegExp('(?<!function\\s)(?<![\\w$.])' + n + '\\s*\\(', 'g');
    const before = s;
    s = s.replace(re, (hit, off) => {
      /* не трогаем строку-шим window.n = n; (там нет скобок сразу после имени) и комментарии */
      return 'window.' + n + '(';
    });
    if (s !== before) changed++;
    total += (before.match(re) || []).length;
  }
  if (changed) { fs.writeFileSync(f, s); console.log('✅ ' + f.split('/').pop() + ': головые вызовы → window.* (' + [...names].join(', ') + ')'); }
}
console.log('✅ всего замен:', total);