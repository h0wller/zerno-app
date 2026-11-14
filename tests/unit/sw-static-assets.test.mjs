import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sw = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8');
const fontsCss = readFileSync(new URL('../../public/app/ui/fonts.css', import.meta.url), 'utf8');

test('service worker precaches every locally served WOFF2 font', () => {
  const fontPaths = [...fontsCss.matchAll(/url\((?:["']?)(\/app\/ui\/fonts\/[^)"']+\.woff2)(?:["']?)\)/g)]
    .map(match => match[1]);
  assert.ok(fontPaths.length > 0, 'fonts.css must declare local WOFF2 assets');
  for (const path of fontPaths) {
    assert.ok(sw.includes("'" + path + "'"), path + ' must be included in STATIC_ASSETS');
  }
});
