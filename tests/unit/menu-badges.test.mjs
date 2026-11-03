import test from 'node:test';
import assert from 'node:assert/strict';

import { getMenuBadgeClass } from '../../public/app/core/menu-badges.js';

test('menu badge labels keep legacy classes for existing menu records', () => {
  assert.equal(getMenuBadgeClass('Хит'), 'hit');
  assert.equal(getMenuBadgeClass('New'), 'new');
  assert.equal(getMenuBadgeClass('Vegan'), 'vegan');
});

test('new menu badge labels map to their own semantic classes', () => {
  assert.equal(getMenuBadgeClass('Острое'), 'spicy');
  assert.equal(getMenuBadgeClass('Рекомендуем'), 'recommended');
  assert.equal(getMenuBadgeClass('Сезонное'), 'seasonal');
  assert.equal(getMenuBadgeClass('Лимитка'), 'limited');
  assert.equal(getMenuBadgeClass('Без кофеина'), 'decaf');
});

test('unknown menu badge labels remain neutral instead of implying vegan', () => {
  assert.equal(getMenuBadgeClass('Любимая позиция'), 'neutral');
  assert.equal(getMenuBadgeClass(''), 'neutral');
  assert.equal(getMenuBadgeClass(null), 'neutral');
});
