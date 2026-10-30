import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getVisibleComposition } from '../../public/app/core/menu-content.js';

test('delivery pizza renders text composition instead of duplicate ingredient chips', () => {
  const pizza = {
    section: 'delivery',
    cat: 'pizza',
    desc: 'Белый соус, моцарелла, маринованная курица',
    comp: ['белый соус', 'моцарелла', 'курица'],
  };

  assert.deepEqual(getVisibleComposition(pizza), []);
});

test('delivery pizza falls back to structured composition when desc is empty', () => {
  const pizza = {
    section: 'delivery',
    cat: 'pizza',
    desc: '  ',
    comp: ['соус', 'сыр'],
  };

  assert.deepEqual(getVisibleComposition(pizza), ['соус', 'сыр']);
});

test('rolls and sets keep their structured composition', () => {
  for (const cat of ['rolls', 'sets']) {
    const item = {
      section: 'delivery',
      cat,
      desc: '',
      comp: ['рис', 'нори', 'лосось'],
    };

    assert.deepEqual(getVisibleComposition(item), ['рис', 'нори', 'лосось']);
  }
});

test('other categories can show description and structured composition independently', () => {
  const coffeeItem = {
    section: 'coffee',
    cat: 'coffee',
    desc: 'Классика с мягкой пенкой',
    comp: ['эспрессо', 'молоко'],
  };

  assert.deepEqual(getVisibleComposition(coffeeItem), ['эспрессо', 'молоко']);
});

test('missing composition data is handled safely', () => {
  assert.deepEqual(getVisibleComposition(null), []);
  assert.deepEqual(getVisibleComposition({ comp: null }), []);
});
