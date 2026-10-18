// scripts/build-css.mjs: собирает public/app/ui/theme-v2.css из кусков в css-src/ (порядок по имени файла)
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const uiDir = path.resolve(here, '..', 'public/app/ui');
const srcDir = path.join(uiDir, 'css-src');
const files = (await readdir(srcDir)).filter((f) => f.endsWith('.css'))
  .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
const parts = [];
for (const f of files) parts.push(await readFile(path.join(srcDir, f), 'utf8'));
await writeFile(path.join(uiDir, 'theme-v2.css'), parts.join(''));
console.log(`theme-v2.css собран из ${files.length} частей`);