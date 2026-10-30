import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateDishKbju } from '../../public/app/core/nutrition.js';

test('pizza TTK is calculated using the selected diameter, dough and TTK finished weight', () => {
  const pizza = {
    id: 'pz-marg',
    name: 'Маргарита',
    opts: [
      { l: '25 см, пышное', w: '415 г', sz: 25 },
      { l: '35 см, пышное', w: '750 г', sz: 35 },
      { l: '25 см, тонкое', w: '335 г', sz: 25 },
      { l: '35 см, тонкое', w: '550 г', sz: 35 }
    ]
  };

  const thick = calculateDishKbju(pizza, '', { option: pizza.opts[0] });
  const thin = calculateDishKbju(pizza, '', { option: pizza.opts[2] });
  const large = calculateDishKbju(pizza, '', { option: pizza.opts[1] });

  assert.equal(thick.status, 'ready');
  assert.equal(thick.totalWeight, 395);
  assert.equal(thick.weightSource, 'выход готового изделия из ТТК');
  assert.equal(thin.totalWeight, 395);
  assert.equal(large.totalWeight, 585);
  assert.ok(thick.perPortion.kcal > thin.perPortion.kcal);
  assert.ok(thick.per100.kcal > 0);
  assert.ok(large.perPortion.kcal > thick.perPortion.kcal);
});

test('pizza uses TTK finished output when catalog option weight is absent', () => {
  const result = calculateDishKbju({ id: 'pz-marg', name: 'Маргарита' });
  assert.equal(result.status, 'ready');
  assert.equal(result.totalWeight, 395);
  assert.equal(result.weightSource, 'выход готового изделия из ТТК');
});

test('white sauce is calculated as a nested preparation and scaled to a 40 g portion', () => {
  const result = calculateDishKbju({ id: 'sc-white', name: 'Белый соус' });

  assert.equal(result.status, 'ready');
  assert.equal(result.totalWeight, 40);
  assert.ok(result.per100.kcal > 300);
  assert.ok(result.perPortion.kcal > 0);
});

test('sushi rice dressing is included in the cooked rice used by rolls', () => {
  const result = calculateDishKbju({ id: 'rl-phil-og', name: 'Филадельфия с огурцом' });

  assert.equal(result.status, 'ready');
  assert.equal(result.totalWeight, 250);
  assert.ok(result.perPortion.kcal > 0);
  assert.ok(result.per100.p > 0);
});

test('nori sheet units are converted to estimated grams', () => {
  const result = calculateDishKbju({ id: 'rl-hos-og', name: 'Ролл с огурцом' });

  assert.equal(result.status, 'ready');
  assert.equal(result.totalWeight, 150);
  const nori = result.breakdown.find(entry => entry.name.includes('Нори'));
  assert.ok(nori);
  assert.equal(nori.grams, 2.5);
});

test('baking sauce resolves kalini sauce to the red sauce preparation', () => {
  const result = calculateDishKbju({ id: 'rl-kioto-kr', name: 'Киото с креветкой' });

  assert.equal(result.status, 'ready');
  assert.equal(result.complete, true);
  assert.equal(result.totalWeight, 290);
  assert.ok(result.per100.kcal > 0);
  assert.ok(result.perPortion.kcal > 0);
  assert.ok(result.breakdown.some(entry => entry.name === 'Соус для запекания'));
});

test('the baked chicken roll also receives a complete estimated result', () => {
  const result = calculateDishKbju({ id: 'rl-bake-ch', name: 'Запечённый ролл с копчёной курицей' });

  assert.equal(result.status, 'ready');
  assert.equal(result.complete, true);
  assert.equal(result.totalWeight, 300);
  assert.ok(result.per100.kcal > 0);
});

test('menu positions without supplied TTK data do not receive invented values', () => {
  assert.equal(calculateDishKbju({ id: 'pz-hamsal', name: 'Ветчина-салями' }), null);
  assert.equal(calculateDishKbju({ id: 'set-phil', name: 'Сет Филадельфия' }), null);
});

test('existing direct nutrition values remain supported', () => {
  const result = calculateDishKbju({
    id: 'legacy-item',
    kbju: { weight: 200, kcal: 240, p: 12, f: 8, c: 20 }
  });

  assert.equal(result.status, 'ready');
  assert.equal(result.estimated, false);
  assert.deepEqual(result.perPortion, { kcal: 480, p: 24, f: 16, c: 40 });
});

test('legacy Russian ingredient keys in custom tech cards remain supported', () => {
  const result = calculateDishKbju({
    id: 'legacy-russian-recipe',
    techCard: {
      'моцарелла': 100,
      'помидоры': 50
    }
  });

  assert.equal(result.status, 'ready');
  assert.equal(result.totalWeight, 150);
  assert.equal(result.perPortion.kcal, 290);
  assert.equal(result.per100.kcal, 193);
});

test('custom ingredient recipes remain supported for deterministic extensions', () => {
  const result = calculateDishKbju(
    { id: 'test-dish', recipe: { flour: 200, mozzarella: 50 } },
    '',
    {
      ingredientsDb: {
        flour: { kcal: 350, p: 10, f: 2, c: 70 },
        mozzarella: { kcal: 280, p: 22, f: 21, c: 2 }
      },
      preparations: {}
    }
  );

  assert.equal(result.status, 'ready');
  assert.equal(result.totalWeight, 250);
  assert.equal(result.per100.kcal, 336);
});
