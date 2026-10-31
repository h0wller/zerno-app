import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { menuImageForResponse } from '../../server/utils/menu-image.js';

test('menu API only exposes existing local dish media', (t) => {
  const publicDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zerno-menu-media-'));
  const dishesDir = path.join(publicDir, 'media', 'dishes');
  fs.mkdirSync(dishesDir, { recursive: true });
  fs.writeFileSync(path.join(dishesDir, 'esp-card.webp'), 'test image');
  t.after(() => fs.rmSync(publicDir, { recursive: true, force: true }));

  assert.equal(
    menuImageForResponse('/media/dishes/esp-card.webp?v=1793379227400', publicDir),
    '/media/dishes/esp-card.webp?v=1793379227400'
  );
  assert.equal(menuImageForResponse('/media/dishes/missing-card.webp?v=1', publicDir), null);
  assert.equal(menuImageForResponse('/media/dishes/../../server.js', publicDir), null);
  assert.equal(menuImageForResponse('https://cdn.example.test/dish.webp', publicDir), 'https://cdn.example.test/dish.webp');
  assert.equal(menuImageForResponse(null, publicDir), null);
});
