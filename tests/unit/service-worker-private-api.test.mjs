import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');

test('Service Worker bypasses every private fitness API endpoint before cache routing', () => {
  const guard = source.match(/if\s*\(\s*request\.method[\s\S]*?\)\s*\{\s*return;\s*\}/);
  assert.ok(guard, 'top-level Service Worker request bypass must exist');
  assert.match(guard[0], /url\.pathname\.startsWith\(['"]\/api\/fitness\/['"]\)/);
  assert.ok(guard[0].indexOf('/api/fitness/') < guard[0].indexOf('request.mode ==='));
});

test('Service Worker advances the static cache version when the private API bypass is introduced', () => {
  assert.match(source, /zerno-static-v649/);
});
