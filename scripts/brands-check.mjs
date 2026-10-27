#!/usr/bin/env node
/* scripts/brands-check.mjs — валидатор манифеста брендов (Фаза A, ворота pretest).
   Windows-safe: пути для динамических импортов конвертируются в file:// URL. */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fails = 0;
const ok = (m) => console.log('✅', m);
const bad = (m) => { fails++; console.error('❌', m); };

// КЛЮЧЕВАЯ ПРАВКА: оборачиваем путь в file:// URL через pathToFileURL
const registryPath = path.join(ROOT, 'public', 'app', 'brands', 'registry.js');
const mod = await import(pathToFileURL(registryPath).href);

const BRANDS = mod.BRANDS;
const MENU_SECTIONS = ['coffee', 'delivery'];
const LOYALTY = ['stamps', 'gifts', 'none'];

for (const [key, b] of Object.entries(BRANDS)) {
  if (key !== b.id) bad(`бренд "${key}": id не совпадает с ключом`);
  for (const f of ['label', 'emoji', 'menuSection', 'loyalty', 'tokensFrom']) {
    if (!b[f]) bad(`бренд "${key}": нет поля ${f}`);
  }
  if (!MENU_SECTIONS.includes(b.menuSection)) bad(`бренд "${key}": menuSection вне схемы`);
  if (!LOYALTY.includes(b.loyalty)) bad(`бренд "${key}": loyalty вне схемы`);
  if (!b.authLogo || !b.authLogo.src || !b.authLogo.box) {
  bad('бренд "' + key + '": authLogo неполный (нужны src, box)');
}

  const lg = b.logo || {};
  if (!lg.src || !lg.w || !lg.h || !lg.alt) bad(`бренд "${key}": logo неполный (нужны src,w,h,alt)`);
  else {
    if (!existsSync(path.join(ROOT, 'public', lg.src.replace(/^\//, '')))) bad(`бренд "${key}": файл логотипа не найден: ${lg.src}`);
    const ratio = lg.w / lg.h;
    if (ratio < 0.5 || ratio > 6) bad(`бренд "${key}": пропорция логотипа вне 0.5–6 (${ratio.toFixed(2)})`);
    if (ratio > 1.5 && !/\.svg$/.test(lg.src)) bad(`бренд "${key}": горизонтальный логотип — только .svg (урок F5.39)`);
  }

  if (!Array.isArray(b.ticker) || b.ticker.length < 3) bad(`бренд "${key}": ticker меньше 3 строк`);
  if (!b.chat || !b.chat.greet || !Array.isArray(b.chat.hints) || !b.chat.hints.length) bad(`бренд "${key}": chat.greet/hints неполный`);
  if (!b.splash || !b.splash.title || !b.splash.sub) bad(`бренд "${key}": splash неполный`);
}

const tokensPath = path.join(ROOT, 'public', 'app', 'ui', 'brand-tokens.css');
const tokens = existsSync(tokensPath) ? readFileSync(tokensPath, 'utf8') : '';
for (const [key, b] of Object.entries(BRANDS)) {
  if (b.tokensFrom === 'brand-tokens' && !tokens.includes(`[data-brand="${key}"]`)) {
    bad(`бренд "${key}": нет таблицы токенов в brand-tokens.css`);
  }
}

const sw = readFileSync(path.join(ROOT, 'public', 'sw.js'), 'utf8');
for (const p of ['/app/ui/brand-tokens.css', '/app/brands/registry.js']) {
  if (!sw.includes(`'${p}'`) && !sw.includes(`"${p}"`)) bad(`sw.js: в STATIC_ASSETS нет ${p}`);
}

if (fails) { console.error(`\n💥 brands-check: ошибок ${fails}`); process.exit(1); }
ok('brands-check: манифест брендов корректен');