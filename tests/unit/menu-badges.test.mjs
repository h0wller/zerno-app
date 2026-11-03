import test from 'node:test';
import assert from 'node:assert/strict';

import { getMenuBadgeClass, getMenuBadgeLabel } from '../../public/app/core/menu-badges.js';

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
  assert.equal(getMenuBadgeClass('Популярное'), 'popular');
  assert.equal(getMenuBadgeClass('Фирменное'), 'signature');
  assert.equal(getMenuBadgeClass('Для двоих'), 'share');
  assert.equal(getMenuBadgeClass('Сытное'), 'hearty');
  assert.equal(getMenuBadgeClass('Лёгкое'), 'light');
  assert.equal(getMenuBadgeClass('Пряное'), 'spicy');
});

test('unknown menu badge labels remain neutral instead of implying vegan', () => {
  assert.equal(getMenuBadgeClass('Любимая позиция'), 'neutral');
  assert.equal(getMenuBadgeClass(''), 'neutral');
  assert.equal(getMenuBadgeClass(null), 'neutral');
});


test('legacy English badge values are localized for customer-facing cards', () => {
  assert.equal(getMenuBadgeLabel('New'), 'Новинка');
  assert.equal(getMenuBadgeLabel('Vegan'), 'Веганское');
  assert.equal(getMenuBadgeLabel('Любимая позиция'), 'Любимая позиция');
});
