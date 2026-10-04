#!/usr/bin/env node
/* fix-redeclare.mjs — устранение warning no-redeclare в public/app/admin-extra.js */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const p = path.join(process.cwd(), 'public', 'app', 'admin-extra.js');
let s = readFileSync(p, 'utf8');

const targetRe = /function\s+applyBrandChrome\s*\(\)\s*\{[\s\S]*?\n\}\s*window\.applyBrandChrome\s*=/;

const cleanFunction = `function applyBrandChrome(){
  if(__chromeLast===brand)return;
  __chromeLast=brand;

  var bConfig = (typeof window.BRANDS !== 'undefined')
    ? window.BRANDS[brand] || window.BRANDS.coffee
    : { ticker: ['…и кофе'], logo: { src: '/andCoffee.svg', w: 42, h: 42, alt: '…и кофе' }, emoji: '☕' };

  var track = document.getElementById('tickerTrack');
  if(track){
    var L = bConfig.ticker || ['…и кофе'];
    var L4 = L.concat(L, L, L);
    track.innerHTML = L4.map(function (x) { return '<span>' + x + '</span>'; }).join('');
    padTicker();
  }

  var mark = document.getElementById('brandMark') || document.querySelector('.topbar .brand .mark');
  if (mark) {
    var lg = bConfig.logo || { src: '/andCoffee.svg', w: 42, h: 42, alt: '…и кофе' };
    mark.innerHTML =
      '<img class="brandLogo" id="brandLogoImg" src="' + lg.src + '" alt="' + lg.alt + '"' +
      ' width="' + lg.w + '" height="' + lg.h + '"' +
      ' decoding="async" fetchpriority="high"' +
      ' onerror="this.outerHTML=\\'<span style=&quot;font-size:26px&quot;>' + (bConfig.emoji || '☕') + '</span>\\'">';
  }
}
window.applyBrandChrome =`;

if (targetRe.test(s)) {
  s = s.replace(targetRe, cleanFunction);
  writeFileSync(p, s, 'utf8');
  console.log('✅ admin-extra.js: applyBrandChrome() очищена от повторных объявлений var');
} else {
  console.log('⏭ Шаблон applyBrandChrome не найден или уже исправлен');
}

console.log('\n🔍 Запуск npm run lint:code...');
execSync('npm run lint:code', { stdio: 'inherit' });