/*
 * Approximate food-composition reference values and TTK-derived recipes.
 *
 * Ingredient composition is generic, not supplier-label data. Values are per
 * 100 g of the ingredient in the state named by the label. See
 * docs/nutrition-estimates.md for assumptions and limitations.
 */

export const NUTRITION_INGREDIENTS = {
  // Dairy, sauces and fats
  'sour-cream': { label: 'Сметана 18%', kcal: 184, p: 2.5, f: 18.0, c: 3.6 },
  mayonnaise: { label: 'Майонез, усреднённый', kcal: 627, p: 2.8, f: 67.0, c: 2.6 },
  mozzarella: { label: 'Моцарелла', kcal: 280, p: 22.0, f: 21.0, c: 2.2 },
  cheddar: { label: 'Сыр чеддер', kcal: 402, p: 25.0, f: 33.0, c: 1.3 },
  camembert: { label: 'Камамбер', kcal: 300, p: 19.8, f: 24.3, c: 0.5 },
  'cream-cheese': { label: 'Сыр сливочный', kcal: 310, p: 6.5, f: 31.0, c: 3.2 },
  'olive-oil': { label: 'Масло оливковое', kcal: 884, p: 0, f: 100, c: 0 },
  'vegetable-oil': { label: 'Масло растительное', kcal: 884, p: 0, f: 100, c: 0 },
  'rice-vinegar': { label: 'Уксус рисовый', kcal: 18, p: 0, f: 0, c: 0.4 },
  'pickle-brine': { label: 'Рассол огуречный, оценка', kcal: 2, p: 0, f: 0, c: 0.5 },
  seasoning: { label: 'Сухая приправа, оценка', kcal: 250, p: 10, f: 5, c: 40 },
  'soy-sauce': { label: 'Соевый соус', kcal: 53, p: 8.0, f: 0.6, c: 4.9 },
  'unagi-sauce': { label: 'Соус унаги', kcal: 224, p: 2.9, f: 0.1, c: 52.8 },
  'kimchi': { label: 'Кимчи', kcal: 15, p: 1.1, f: 0.5, c: 2.4 },

  // Dough and rice
  flour: { label: 'Мука пшеничная', kcal: 364, p: 10.3, f: 1.0, c: 76.3 },
  yeast: { label: 'Дрожжи сухие', kcal: 325, p: 40.4, f: 7.6, c: 41.2 },
  sugar: { label: 'Сахар', kcal: 387, p: 0, f: 0, c: 100 },
  water: { label: 'Вода', kcal: 0, p: 0, f: 0, c: 0 },
  salt: { label: 'Соль', kcal: 0, p: 0, f: 0, c: 0 },
  'sushi-rice-dry': { label: 'Рис для суши, сухой', kcal: 365, p: 7.1, f: 0.7, c: 80.0 },
  nori: { label: 'Нори, сухие', kcal: 349, p: 46.1, f: 0.1, c: 41.0 },
  'nori-sheet': { label: 'Нори, лист (масса листа оценена в 2,5 г)', kcal: 349, p: 46.1, f: 0.1, c: 41.0 },

  // Meat, fish and seafood
  ham: { label: 'Ветчина, усреднённая', kcal: 240, p: 14.5, f: 19.5, c: 1.5 },
  'chicken-marinated': { label: 'Курица маринованная, оценка', kcal: 180, p: 22.0, f: 9.0, c: 1.5 },
  'chicken-smoked': { label: 'Курица копчёная, оценка', kcal: 170, p: 27.0, f: 6.0, c: 1.0 },
  bacon: { label: 'Бекон', kcal: 458, p: 13.0, f: 45.0, c: 0.8 },
  pepperoni: { label: 'Пепперони', kcal: 465, p: 20.0, f: 42.0, c: 1.8 },
  tuna: { label: 'Тунец, филе', kcal: 130, p: 24.0, f: 4.0, c: 0 },
  salmon: { label: 'Лосось, филе', kcal: 208, p: 20.4, f: 13.4, c: 0 },
  shrimp: { label: 'Креветка, готовая', kcal: 99, p: 21.0, f: 1.4, c: 0.2 },
  'ground-beef': { label: 'Фарш говяжий, усреднённый', kcal: 250, p: 26.0, f: 16.0, c: 0 },
  'bonito-flakes': { label: 'Стружка сушёного тунца, оценка', kcal: 350, p: 77.0, f: 3.0, c: 0 },

  // Vegetables, herbs and fruit
  tomato: { label: 'Помидоры', kcal: 20, p: 1.1, f: 0.2, c: 3.8 },
  'canned-tomatoes': { label: 'Томаты консервированные', kcal: 21, p: 1.1, f: 0.2, c: 4.5 },
  mushrooms: { label: 'Шампиньоны', kcal: 27, p: 4.3, f: 1.0, c: 0.1 },
  'red-onion': { label: 'Лук красный', kcal: 40, p: 1.1, f: 0.1, c: 9.3 },
  onion: { label: 'Лук репчатый', kcal: 40, p: 1.1, f: 0.1, c: 9.3 },
  dill: { label: 'Укроп', kcal: 43, p: 3.5, f: 1.1, c: 7.0 },
  garlic: { label: 'Чеснок', kcal: 149, p: 6.4, f: 0.5, c: 33.1 },
  oregano: { label: 'Орегано сухой', kcal: 265, p: 9.0, f: 4.3, c: 68.9 },
  pepper: { label: 'Перец сладкий', kcal: 27, p: 1.3, f: 0.1, c: 5.3 },
  spinach: { label: 'Шпинат', kcal: 23, p: 2.9, f: 0.4, c: 3.6 },
  'cherry-tomato': { label: 'Помидоры черри', kcal: 22, p: 1.0, f: 0.2, c: 4.0 },
  broccoli: { label: 'Брокколи', kcal: 34, p: 2.8, f: 0.4, c: 6.6 },
  cucumber: { label: 'Огурец', kcal: 15, p: 0.8, f: 0.1, c: 2.8 },
  'pickled-cucumber': { label: 'Огурец маринованный', kcal: 16, p: 0.8, f: 0.1, c: 3.0 },
  pineapple: { label: 'Ананас консервированный', kcal: 60, p: 0.4, f: 0.1, c: 14.5 },
  sesame: { label: 'Кунжут', kcal: 573, p: 17.7, f: 49.7, c: 23.4 },
  'masago-orange': { label: 'Масаго оранжевая', kcal: 132, p: 17.5, f: 6.2, c: 1.5 },

  // Egg, milk and seasonings
  egg: { label: 'Яйцо куриное', kcal: 143, p: 12.6, f: 9.5, c: 0.7 },
  milk: { label: 'Молоко 3,2%', kcal: 60, p: 2.9, f: 3.2, c: 4.7 },
  'sweet-wasabi-unknown': { label: 'Порошок васаби, оценка', kcal: 300, p: 10.0, f: 2.0, c: 60.0 },
  lime: { label: 'Сок лайма', kcal: 25, p: 0.4, f: 0.1, c: 8.4 }
};

/*
 * Preparation recipes are evaluated recursively. yieldWeight is the stated
 * batch output, not the sum of inputs; it accounts for the stated preparation
 * yield (and, for cooked rice/omelette, water loss or absorption).
 */
export const NUTRITION_PREPARATIONS = {
  'white-sauce': {
    label: 'Белый соус',
    yieldWeight: 1006,
    ingredients: { 'sour-cream': 500, mayonnaise: 500, oregano: 3, salt: 3 }
  },
  'red-sauce': {
    label: 'Красный соус',
    yieldWeight: 2677,
    ingredients: {
      'canned-tomatoes': 2500,
      oregano: 6,
      garlic: 15,
      sugar: 6,
      salt: 100,
      'olive-oil': 50
    }
  },
  'garlic-sauce': {
    label: 'Чесночный соус',
    yieldWeight: 767,
    ingredients: { mayonnaise: 600, garlic: 15, 'pickle-brine': 150, seasoning: 2 }
  },
  'rose-sauce': {
    label: 'Розовый соус',
    yieldWeight: 500,
    ingredients: { 'red-sauce': 200, 'white-sauce': 300 }
  },
  'spicy-sauce': {
    label: 'Спайси соус',
    yieldWeight: 1050,
    ingredients: { mayonnaise: 600, kimchi: 450 }
  },
  'baking-sauce': {
    label: 'Соус для запекания',
    yieldWeight: 1140,
    ingredients: {
      mayonnaise: 600,
      mozzarella: 400,
      'kalini-sauce': 80,
      'masago-orange': 60
    }
  },
  'rice-seasoning': {
    label: 'Заправка для риса',
    yieldWeight: 1970,
    ingredients: { 'rice-vinegar': 1000, sugar: 900, salt: 70 }
  },
  'sushi-rice': {
    label: 'Рис для роллов, готовый',
    yieldWeight: 7000,
    ingredients: {
      'sushi-rice-dry': 3000,
      water: 3100,
      'rice-seasoning': 900
    }
  },
  'mixed-soy-sauce': {
    label: 'Соевый соус с водой и сахаром',
    yieldWeight: 2400,
    ingredients: { 'soy-sauce': 1000, water: 1000, sugar: 400 }
  },
  omelette: {
    label: 'Омлет',
    yieldWeight: 65,
    ingredients: {
      egg: 100,
      milk: 40,
      'mixed-soy-sauce': 15,
      sugar: 10
    }
  },
  wasabi: {
    label: 'Васаби',
    yieldWeight: 600,
    ingredients: {
      'sweet-wasabi-unknown': 200,
      water: 350,
      lime: 50
    }
  },
  'pizza-dough': {
    label: 'Тесто для пиццы',
    // 1 litre of olive oil is approximated as 910 g (density ~0.91 g/ml).
    yieldWeight: 9195,
    ingredients: {
      flour: 5000,
      yeast: 15,
      sugar: 40,
      water: 3100,
      'olive-oil': 910,
      salt: 130
    }
  }
};

export const PIZZA_DOUGH_PORTIONS = {
  '25-thick': 280,
  '35-thick': 480,
  '25-thin': 200,
  '35-thin': 280
};

/*
 * Pizza ingredient weights and nominal finished output are taken from the
 * supplied TTK. M maps to 25 cm; B maps to 35 cm. Dough is supplied separately
 * and selected from PIZZA_DOUGH_PORTIONS when a size/crust option is chosen.
 */
export const NUTRITION_DISHES = {
  // Pizzas
  'pz-marg': {
    label: 'Пицца Маргарита',
    kind: 'pizza',
    sizes: {
      M: { yieldWeight: 395, ingredients: { 'white-sauce': 50, mozzarella: 100, 'red-sauce': 15, tomato: 50 } },
      B: { yieldWeight: 585, ingredients: { 'white-sauce': 100, mozzarella: 150, 'red-sauce': 15, tomato: 65 } }
    }
  },
  'pz-hamgr': {
    label: 'Пицца Ветчина и грибы',
    kind: 'pizza',
    sizes: {
      M: { yieldWeight: 460, ingredients: { 'white-sauce': 50, 'red-sauce': 15, mozzarella: 100, ham: 40, mushrooms: 40, 'red-onion': 10, dill: 10 } },
      B: { yieldWeight: 590, ingredients: { 'white-sauce': 100, 'red-sauce': 15, mozzarella: 150, ham: 60, mushrooms: 50, 'red-onion': 15, dill: 10 } }
    }
  },
  'pz-chickgr': {
    label: 'Пицца Курица-грибы',
    kind: 'pizza',
    sizes: {
      M: { yieldWeight: 600, ingredients: { 'white-sauce': 50, mozzarella: 50, 'chicken-marinated': 100, mushrooms: 50, dill: 10 } },
      B: { yieldWeight: 900, ingredients: { 'white-sauce': 100, mozzarella: 100, 'chicken-marinated': 150, mushrooms: 100, dill: 10 } }
    }
  },
  'pz-mush': {
    label: 'Пицца Грибная',
    kind: 'pizza',
    sizes: {
      M: { yieldWeight: 630, ingredients: { 'white-sauce': 50, mozzarella: 100, mushrooms: 150, dill: 10 } },
      B: { yieldWeight: 930, ingredients: { 'white-sauce': 100, mozzarella: 100, mushrooms: 200, dill: 10 } }
    }
  },
  'pz-bacon': {
    label: 'Пицца с беконом',
    kind: 'pizza',
    sizes: {
      M: { yieldWeight: 600, ingredients: { 'white-sauce': 50, mozzarella: 100, mushrooms: 50, bacon: 45, 'red-onion': 10 } },
      B: { yieldWeight: 1000, ingredients: { 'white-sauce': 100, mozzarella: 150, mushrooms: 100, bacon: 80, 'red-onion': 20 } }
    }
  },
  'pz-pep': {
    label: 'Пицца Пепперони',
    kind: 'pizza',
    sizes: {
      M: { yieldWeight: 620, ingredients: { 'red-sauce': 60, mozzarella: 50, pepperoni: 80, 'red-onion': 20, dill: 10 } },
      B: { yieldWeight: 950, ingredients: { 'red-sauce': 120, mozzarella: 100, pepperoni: 100, 'red-onion': 40, dill: 10 } }
    }
  },
  'pz-tuna': {
    label: 'Пицца Тунец-сладкий перец',
    kind: 'pizza',
    sizes: {
      M: { yieldWeight: 620, ingredients: { 'white-sauce': 50, mozzarella: 50, tuna: 100, pepper: 40, cheddar: 45 } },
      B: { yieldWeight: 920, ingredients: { 'white-sauce': 100, mozzarella: 100, tuna: 100, pepper: 80, cheddar: 45 } }
    }
  },
  'pz-veg': {
    label: 'Пицца Овощная',
    kind: 'pizza',
    sizes: {
      M: { yieldWeight: 495, ingredients: { 'red-sauce': 50, mozzarella: 30, spinach: 30, pepper: 25, 'cherry-tomato': 25, broccoli: 20, dill: 10 } },
      B: { yieldWeight: 785, ingredients: { 'red-sauce': 100, mozzarella: 60, spinach: 60, pepper: 50, 'cherry-tomato': 50, broccoli: 50, dill: 10 } }
    }
  },
  'pz-cheese': {
    // Maps to the supplied three-cheese TTK (mozzarella + cheddar + camembert).
    label: 'Пицца Сырная',
    kind: 'pizza',
    sizes: {
      M: { yieldWeight: 660, ingredients: { 'white-sauce': 50, mozzarella: 100, cheddar: 30, camembert: 30 } },
      B: { yieldWeight: 1000, ingredients: { 'white-sauce': 100, mozzarella: 150, cheddar: 50, camembert: 50 } }
    }
  },
  'pz-chickpine': {
    label: 'Пицца Курица-ананас',
    kind: 'pizza',
    sizes: {
      M: { yieldWeight: 610, ingredients: { 'white-sauce': 50, mozzarella: 60, 'chicken-marinated': 90, pineapple: 40, dill: 10 } },
      B: { yieldWeight: 920, ingredients: { 'white-sauce': 100, mozzarella: 100, 'chicken-marinated': 100, pineapple: 70, dill: 10 } }
    }
  },
  'pz-farsh': {
    label: 'Пицца с фаршем',
    kind: 'pizza',
    sizes: {
      M: { yieldWeight: 700, ingredients: { 'red-sauce': 50, 'white-sauce': 50, mozzarella: 30, 'ground-beef': 50, 'pickled-cucumber': 30, onion: 10, cheddar: 25 } },
      B: { yieldWeight: 1100, ingredients: { 'red-sauce': 100, 'white-sauce': 100, mozzarella: 100, 'ground-beef': 150, 'pickled-cucumber': 50, onion: 20, cheddar: 50 } }
    }
  },

  // Rolls
  'rl-phil-og': {
    label: 'Филадельфия с огурцом',
    yieldWeight: 250,
    ingredients: { 'sushi-rice': 140, 'nori-sheet': { amount: 0.25, unit: 'sheet' }, 'cream-cheese': 25, cucumber: 20, salmon: 60 }
  },
  'rl-phil-sliv': {
    label: 'Филадельфия сливочная',
    yieldWeight: 250,
    ingredients: { 'sushi-rice': 140, 'nori-sheet': { amount: 0.25, unit: 'sheet' }, 'cream-cheese': 40, salmon: 60 }
  },
  'rl-calif': {
    label: 'Калифорния с креветкой',
    yieldWeight: 250,
    ingredients: { 'sushi-rice': 140, 'nori-sheet': { amount: 0.25, unit: 'sheet' }, 'cream-cheese': 30, 'spicy-sauce': 10, shrimp: 30, cucumber: 20, 'masago-orange': 30 }
  },
  'rl-phil-tn': {
    label: 'Филадельфия с тунцом',
    yieldWeight: 260,
    ingredients: { 'sushi-rice': 140, 'nori-sheet': { amount: 0.25, unit: 'sheet' }, 'cream-cheese': 25, cucumber: 20, tuna: 60, 'spicy-sauce': 10 }
  },
  'rl-smoke-ch': {
    label: 'Ролл с копчёной курицей',
    yieldWeight: 240,
    ingredients: { 'sushi-rice': 140, 'nori-sheet': { amount: 0.25, unit: 'sheet' }, 'cream-cheese': 30, pepper: 10, cucumber: 20, sesame: 20, 'chicken-smoked': 30 }
  },
  'rl-bonito': {
    label: 'Ролл Бонито',
    yieldWeight: 210,
    ingredients: { 'sushi-rice': 140, 'nori-sheet': { amount: 0.25, unit: 'sheet' }, 'cream-cheese': 40, tuna: 20, cucumber: 10, 'bonito-flakes': 10 }
  },
  'rl-tartar-ls': {
    label: 'Ролл тар-тар с лососем',
    yieldWeight: 250,
    ingredients: { 'sushi-rice': 140, 'nori-sheet': { amount: 0.25, unit: 'sheet' }, 'cream-cheese': 30, omelette: 20, cucumber: 20, salmon: 40, 'spicy-sauce': 10 }
  },
  'rl-tartar-kr': {
    label: 'Ролл тар-тар с креветкой',
    yieldWeight: 250,
    ingredients: { 'sushi-rice': 140, 'nori-sheet': { amount: 0.25, unit: 'sheet' }, 'cream-cheese': 30, omelette: 20, cucumber: 20, shrimp: 40, 'spicy-sauce': 10 }
  },
  'rl-tartar-tn': {
    label: 'Ролл тар-тар с тунцом',
    yieldWeight: 250,
    ingredients: { 'sushi-rice': 140, 'nori-sheet': { amount: 0.25, unit: 'sheet' }, 'cream-cheese': 30, omelette: 20, cucumber: 20, tuna: 40, 'spicy-sauce': 10 }
  },
  'rl-kioto-ls': {
    label: 'Киото с лососем',
    yieldWeight: 290,
    ingredients: {
      'sushi-rice': 140,
      'nori-sheet': { amount: 1, unit: 'sheet' },
      salmon: 30,
      'cream-cheese': 25,
      'baking-sauce': 25,
      'unagi-sauce': 10,
      sesame: 2
    }
  },
  'rl-bake-ch': {
    label: 'Запечённый ролл с копчёной курицей',
    yieldWeight: 300,
    ingredients: {
      'sushi-rice': 140,
      'nori-sheet': { amount: 0.7, unit: 'sheet' },
      'cream-cheese': 20,
      pepper: 10,
      omelette: 20,
      cucumber: 20,
      sesame: 22,
      'baking-sauce': 55,
      'chicken-smoked': 30,
      'unagi-sauce': 10
    }
  },
  'rl-bake-phil': {
    label: 'Запечённая Филадельфия',
    yieldWeight: 280,
    ingredients: {
      'sushi-rice': 130,
      'nori-sheet': { amount: 0.25, unit: 'sheet' },
      'cream-cheese': 70,
      cucumber: 20,
      salmon: 60,
      'unagi-sauce': 10,
      sesame: 2
    }
  },
  'rl-marioka-kr': {
    label: 'Марюка с креветкой',
    yieldWeight: 260,
    ingredients: {
      'sushi-rice': 140,
      'nori-sheet': { amount: 0.25, unit: 'sheet' },
      shrimp: 30,
      'spicy-sauce': 10,
      'cream-cheese': 60,
      'unagi-sauce': 10,
      sesame: 2
    }
  },
  'rl-marioka-ls': {
    label: 'Марюка с лососем',
    yieldWeight: 260,
    ingredients: {
      'sushi-rice': 140,
      'nori-sheet': { amount: 0.25, unit: 'sheet' },
      salmon: 40,
      'cream-cheese': 60,
      'unagi-sauce': 10,
      sesame: 2
    }
  },
  'rl-kioto-kr': {
    label: 'Киото с креветкой',
    yieldWeight: 290,
    ingredients: {
      'sushi-rice': 140,
      'nori-sheet': { amount: 1, unit: 'sheet' },
      shrimp: 30,
      'spicy-sauce': 10,
      'cream-cheese': 25,
      'baking-sauce': 55,
      'unagi-sauce': 10,
      sesame: 2
    }
  },
  'rl-hos-og': {
    label: 'Ролл с огурцом',
    yieldWeight: 150,
    ingredients: { 'sushi-rice': 120, 'nori-sheet': { amount: 1, unit: 'sheet' }, cucumber: 40 }
  },
  'rl-hos-ls': {
    label: 'Ролл с лососем',
    yieldWeight: 150,
    ingredients: { 'sushi-rice': 120, 'nori-sheet': { amount: 1, unit: 'sheet' }, salmon: 40 }
  },
  'rl-hos-tn': {
    label: 'Ролл с тунцом',
    yieldWeight: 160,
    ingredients: {
      'sushi-rice': 120,
      'nori-sheet': { amount: 1, unit: 'sheet' },
      tuna: 30,
      cucumber: 10,
      'unagi-sauce': 10,
      sesame: 2
    }
  },
  'rl-hos-kr': {
    label: 'Ролл с креветкой',
    yieldWeight: 150,
    ingredients: {
      'sushi-rice': 120,
      'nori-sheet': { amount: 1, unit: 'sheet' },
      shrimp: 30,
      'spicy-sauce': 10
    }
  },

  // Sauce portions sold separately; batch macros are scaled to the 40 g menu portion.
  'sc-red': { label: 'Красный соус', kind: 'preparation', preparation: 'red-sauce', portionWeight: 40 },
  'sc-rose': { label: 'Розовый соус', kind: 'preparation', preparation: 'rose-sauce', portionWeight: 40 },
  'sc-garlic': { label: 'Чесночный соус', kind: 'preparation', preparation: 'garlic-sauce', portionWeight: 40 },
  'sc-white': { label: 'Белый соус', kind: 'preparation', preparation: 'white-sauce', portionWeight: 40 }
};

// User-supplied TTKs omit unweighed microgreens and decorative greens.
// Unknown components (currently "соус калиний") deliberately remain unresolved.
