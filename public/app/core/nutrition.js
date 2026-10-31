import {
  NUTRITION_DISHES,
  NUTRITION_INGREDIENTS,
  NUTRITION_PREPARATIONS,
  PIZZA_DOUGH_PORTIONS
} from './nutrition-data.js';

const DEFAULT_NUTRITION_SOURCE = 'ТТК + усреднённая база продуктов';

const LEGACY_INGREDIENT_ALIASES = {
  'тесто пицца': { kcal: 255, p: 8.2, f: 3.5, c: 47.6 },
  'тесто': { kcal: 255, p: 8.2, f: 3.5, c: 47.6 },
  'мука': { kcal: 342, p: 10.3, f: 1.1, c: 70.6 },
  'рис для суши': { kcal: 140, p: 2.8, f: 0.3, c: 31.2 },
  'рис': { kcal: 140, p: 2.8, f: 0.3, c: 31.2 },
  'нори': { kcal: 349, p: 46.1, f: 0.1, c: 41.0 },
  'моцарелла': { kcal: 280, p: 22.0, f: 21.0, c: 1.0 },
  'сыр моцарелла': { kcal: 280, p: 22.0, f: 21.0, c: 1.0 },
  'чеддер': { kcal: 402, p: 25.0, f: 33.0, c: 1.3 },
  'сыр чеддер': { kcal: 402, p: 25.0, f: 33.0, c: 1.3 },
  'пармезан': { kcal: 431, p: 38.0, f: 29.0, c: 4.1 },
  'сыр пармезан': { kcal: 431, p: 38.0, f: 29.0, c: 4.1 },
  'дорблю': { kcal: 353, p: 21.4, f: 28.7, c: 0.0 },
  'сыр дорблю': { kcal: 353, p: 21.4, f: 28.7, c: 0.0 },
  'фета': { kcal: 264, p: 14.2, f: 21.3, c: 4.1 },
  'сливочный сыр': { kcal: 310, p: 6.5, f: 31.0, c: 3.2 },
  'творожный сыр': { kcal: 268, p: 6.8, f: 25.5, c: 3.0 },
  'соус томатный': { kcal: 54, p: 1.4, f: 1.2, c: 9.2 },
  'томатный соус': { kcal: 54, p: 1.4, f: 1.2, c: 9.2 },
  'соус сливочный': { kcal: 215, p: 2.8, f: 20.5, c: 4.8 },
  'сливочный соус': { kcal: 215, p: 2.8, f: 20.5, c: 4.8 },
  'соус цезарь': { kcal: 390, p: 3.2, f: 40.0, c: 4.0 },
  'соус барбекю': { kcal: 172, p: 0.8, f: 0.6, c: 40.8 },
  'соус чесночный': { kcal: 380, p: 1.5, f: 39.0, c: 5.2 },
  'соус спайси': { kcal: 410, p: 1.2, f: 42.0, c: 6.0 },
  'соус унаги': { kcal: 224, p: 2.9, f: 0.1, c: 52.8 },
  'соус терияки': { kcal: 140, p: 3.5, f: 0.2, c: 31.0 },
  'майонез': { kcal: 627, p: 2.8, f: 67.0, c: 2.6 },
  'песто': { kcal: 450, p: 5.1, f: 45.0, c: 5.5 },
  'ветчина': { kcal: 240, p: 14.5, f: 19.5, c: 1.5 },
  'пепперони': { kcal: 465, p: 20.0, f: 42.0, c: 1.8 },
  'салями': { kcal: 445, p: 21.0, f: 39.0, c: 1.5 },
  'бекон': { kcal: 458, p: 13.0, f: 45.0, c: 0.8 },
  'курица': { kcal: 165, p: 23.0, f: 7.5, c: 0.5 },
  'куриное филе': { kcal: 165, p: 23.0, f: 7.5, c: 0.5 },
  'охотничьи колбаски': { kcal: 410, p: 15.5, f: 38.0, c: 1.8 },
  'говядина': { kcal: 250, p: 26.0, f: 16.0, c: 0.0 },
  'свинина': { kcal: 290, p: 21.0, f: 23.0, c: 0.0 },
  'лосось': { kcal: 208, p: 20.4, f: 13.4, c: 0.0 },
  'семга': { kcal: 208, p: 20.4, f: 13.4, c: 0.0 },
  'угорь': { kcal: 315, p: 18.0, f: 26.0, c: 2.5 },
  'креветки': { kcal: 99, p: 21.0, f: 1.4, c: 0.2 },
  'тунец': { kcal: 130, p: 24.0, f: 4.0, c: 0.0 },
  'снежный краб': { kcal: 95, p: 7.5, f: 1.0, c: 14.0 },
  'краб-микс': { kcal: 195, p: 6.5, f: 14.0, c: 10.5 },
  'икра масаго': { kcal: 132, p: 17.5, f: 6.2, c: 1.5 },
  'мидии': { kcal: 172, p: 24.0, f: 4.5, c: 7.4 },
  'шампиньоны': { kcal: 27, p: 4.3, f: 1.0, c: 0.1 },
  'грибы': { kcal: 27, p: 4.3, f: 1.0, c: 0.1 },
  'томаты': { kcal: 20, p: 1.1, f: 0.2, c: 3.8 },
  'помидоры': { kcal: 20, p: 1.1, f: 0.2, c: 3.8 },
  'черри': { kcal: 22, p: 1.0, f: 0.2, c: 4.0 },
  'огурец': { kcal: 15, p: 0.8, f: 0.1, c: 2.8 },
  'огурцы маринованные': { kcal: 16, p: 0.8, f: 0.1, c: 3.0 },
  'перец болгарский': { kcal: 27, p: 1.3, f: 0.1, c: 5.3 },
  'халапеньо': { kcal: 29, p: 0.9, f: 0.4, c: 6.5 },
  'лук красный': { kcal: 41, p: 1.4, f: 0.1, c: 9.1 },
  'лук фри': { kcal: 590, p: 6.0, f: 44.0, c: 42.0 },
  'маслины': { kcal: 115, p: 0.8, f: 10.7, c: 6.3 },
  'оливки': { kcal: 145, p: 1.0, f: 15.3, c: 3.8 },
  'ананас': { kcal: 60, p: 0.4, f: 0.1, c: 14.5 },
  'авокадо': { kcal: 160, p: 2.0, f: 14.7, c: 1.8 },
  'айсберг': { kcal: 14, p: 0.9, f: 0.1, c: 3.0 },
  'руккола': { kcal: 25, p: 2.6, f: 0.7, c: 2.1 },
  'кунжут': { kcal: 573, p: 17.7, f: 49.7, c: 23.4 },
  'картофель фри': { kcal: 312, p: 3.4, f: 15.0, c: 41.0 },
  'наггетсы': { kcal: 275, p: 14.8, f: 16.5, c: 17.0 },
  'эспрессо': { kcal: 9, p: 0.1, f: 0.2, c: 1.7 },
  'молоко 3.2%': { kcal: 60, p: 2.9, f: 3.2, c: 4.7 },
  'молоко': { kcal: 60, p: 2.9, f: 3.2, c: 4.7 },
  'сливки 10%': { kcal: 119, p: 2.7, f: 10.0, c: 4.5 },
  'сливки 20%': { kcal: 207, p: 2.5, f: 20.0, c: 4.0 },
  'альтернативное молоко': { kcal: 46, p: 0.8, f: 1.5, c: 7.2 },
  'сироп': { kcal: 268, p: 0.0, f: 0.0, c: 67.0 }
};

const DEFAULT_INGREDIENTS_DB = Object.assign(
  {},
  NUTRITION_INGREDIENTS,
  LEGACY_INGREDIENT_ALIASES
);

const NORI_SHEET_GRAMS = 2.5;

function parseJson(value) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch (_) {
    return null;
  }
}

function round1(value) {
  return Math.round((Number(value) || 0) * 10) / 10;
}

function roundMacros(totals) {
  return {
    kcal: Math.round(totals.kcal),
    p: round1(totals.p),
    f: round1(totals.f),
    c: round1(totals.c)
  };
}

function normalizeQuantity(value) {
  if (typeof value === 'number' || typeof value === 'string') {
    return { grams: Number.parseFloat(value) || 0, inlineNutrition: null };
  }

  if (!value || typeof value !== 'object') {
    return { grams: 0, inlineNutrition: null };
  }

  const rawAmount = value.g ?? value.grams ?? value.weight ?? value.amount ?? 0;
  const amount = Number.parseFloat(rawAmount) || 0;
  const unit = String(value.unit || '').trim().toLowerCase();
  const grams = unit === 'sheet' || unit === 'лист'
    ? amount * NORI_SHEET_GRAMS
    : amount;

  const inlineNutrition = value.kcal != null
    ? {
        kcal: Number(value.kcal) || 0,
        p: Number(value.p) || 0,
        f: Number(value.f) || 0,
        c: Number(value.c) || 0
      }
    : null;

  return { grams, inlineNutrition };
}

function recipeEntries(recipe) {
  if (Array.isArray(recipe)) {
    return recipe.map(entry => [entry?.name || entry?.ing, entry]);
  }

  const ingredients = recipe && recipe.ingredients
    ? recipe.ingredients
    : recipe;

  return ingredients && typeof ingredients === 'object'
    ? Object.entries(ingredients)
    : [];
}

function ingredientLabel(key) {
  if (NUTRITION_INGREDIENTS[key]?.label) return NUTRITION_INGREDIENTS[key].label;
  if (NUTRITION_PREPARATIONS[key]?.label) return NUTRITION_PREPARATIONS[key].label;
  if (key === 'nori-sheet') return 'нори';
  return String(key || 'неизвестный ингредиент');
}

function emptyTotals() {
  return { grams: 0, kcal: 0, p: 0, f: 0, c: 0 };
}

function addMacros(target, macros, grams) {
  const factor = grams / 100;
  target.grams += grams;
  target.kcal += (Number(macros.kcal) || 0) * factor;
  target.p += (Number(macros.p) || 0) * factor;
  target.f += (Number(macros.f) || 0) * factor;
  target.c += (Number(macros.c) || 0) * factor;
}

function evaluateRecipe(recipe, sources, stack = []) {
  if (!recipe || typeof recipe !== 'object') {
    return { complete: false, missingIngredients: ['состав не задан'] };
  }

  const totals = emptyTotals();
  const missingIngredients = new Set();
  const breakdown = [];

  for (const [rawKey, rawValue] of recipeEntries(recipe)) {
    const key = String(rawKey || '').trim();
    if (!key) continue;

    const { grams, inlineNutrition } = normalizeQuantity(rawValue);
    if (grams <= 0) continue;

    if (inlineNutrition) {
      addMacros(totals, inlineNutrition, grams);
      breakdown.push({ name: key, grams: round1(grams) });
      continue;
    }

    const ingredient = sources.ingredientsDb[key];
    if (ingredient) {
      addMacros(totals, ingredient, grams);
      breakdown.push({ name: ingredient.label || key, grams: round1(grams) });
      continue;
    }

    const preparation = sources.preparations[key];
    if (preparation) {
      if (stack.includes(key)) {
        missingIngredients.add('циклическая рецептура: ' + ingredientLabel(key));
        continue;
      }

      const nested = evaluateRecipe(preparation, sources, [...stack, key]);
      if (!nested.complete || !nested.per100) {
        nested.missingIngredients.forEach(name => missingIngredients.add(name));
        continue;
      }

      addMacros(totals, nested.per100, grams);
      breakdown.push({ name: preparation.label || key, grams: round1(grams) });
      continue;
    }

    missingIngredients.add(ingredientLabel(key));
  }

  const statedYield = Number(recipe.yieldWeight) || 0;
  const totalWeight = statedYield > 0 ? statedYield : totals.grams;
  if (totals.grams <= 0 || totalWeight <= 0) {
    missingIngredients.add('нет ингредиентов с известными граммовками');
  }

  const complete = missingIngredients.size === 0 && totals.grams > 0 && totalWeight > 0;
  const per100 = complete
    ? roundMacros({
        kcal: totals.kcal * 100 / totalWeight,
        p: totals.p * 100 / totalWeight,
        f: totals.f * 100 / totalWeight,
        c: totals.c * 100 / totalWeight
      })
    : null;

  return {
    complete,
    missingIngredients: [...missingIngredients],
    totalWeight: Math.round(totalWeight),
    totalIngredientWeight: Math.round(totals.grams),
    totals: roundMacros(totals),
    per100,
    perPortion: complete ? roundMacros(totals) : null,
    breakdown
  };
}

function parseOptionList(item) {
  const options = parseJson(item && item.opts);
  return Array.isArray(options) ? options : [];
}

function getPizzaOption(option, item) {
  const selected = option || parseOptionList(item)[0] || null;
  const label = String(selected?.l || selected?.name || '');
  const diameterFromLabel = Number(label.match(/\b(25|35)\s*см/i)?.[1]) || 0;
  const diameter = Number(selected?.sz) || diameterFromLabel || 25;
  const thickness = /тонк/i.test(label) ? 'thin' : 'thick';
  const size = diameter >= 35 ? 'B' : 'M';
  const doughKey = (diameter >= 35 ? '35' : '25') + '-' + thickness;
  const doughGrams = PIZZA_DOUGH_PORTIONS[doughKey] || PIZZA_DOUGH_PORTIONS['25-thin'];
  const optionWeight = Number.parseFloat(
    String(selected?.w || '').replace(',', '.').replace(/[^\d.]/g, '')
  ) || 0;

  return {
    selected,
    label,
    size,
    doughGrams,
    optionWeight
  };
}

function makeResult(evaluated, metadata = {}) {
  if (!evaluated.complete || !evaluated.per100 || !evaluated.perPortion) {
    return {
      status: 'incomplete',
      complete: false,
      estimated: true,
      missingIngredients: evaluated.missingIngredients || [],
      totalWeight: evaluated.totalWeight || metadata.totalWeight || 0,
      source: metadata.source || DEFAULT_NUTRITION_SOURCE,
      weightSource: metadata.weightSource || 'ТТК',
      selectedOption: metadata.selectedOption || ''
    };
  }

  return {
    status: 'ready',
    complete: true,
    estimated: true,
    totalWeight: evaluated.totalWeight,
    totalIngredientWeight: evaluated.totalIngredientWeight,
    per100: evaluated.per100,
    perPortion: evaluated.perPortion,
    breakdown: evaluated.breakdown,
    source: metadata.source || DEFAULT_NUTRITION_SOURCE,
    weightSource: metadata.weightSource || 'ТТК',
    selectedOption: metadata.selectedOption || ''
  };
}

function calculatePizza(item, recipe, sources, option) {
  const optionInfo = getPizzaOption(option, item);
  const sizeRecipe = recipe.sizes?.[optionInfo.size];

  if (!sizeRecipe) {
    return {
      status: 'incomplete',
      complete: false,
      estimated: true,
      missingIngredients: ['ТТК для выбранного размера пиццы'],
      totalWeight: 0,
      source: DEFAULT_NUTRITION_SOURCE
    };
  }

  const ingredients = {
    ...sizeRecipe.ingredients,
    'pizza-dough': optionInfo.doughGrams
  };
  const ttkYieldWeight = Number(sizeRecipe.yieldWeight) || 0;
  const portionWeight = ttkYieldWeight || optionInfo.optionWeight;
  const recipeForPortion = { ingredients, yieldWeight: portionWeight || undefined };
  const evaluated = evaluateRecipe(recipeForPortion, sources);

  return makeResult(evaluated, {
    source: DEFAULT_NUTRITION_SOURCE,
    weightSource: ttkYieldWeight ? 'выход готового изделия из ТТК' : 'вес выбранной опции меню',
    selectedOption: optionInfo.label
  });
}

function calculatePreparationDish(recipe, sources) {
  const preparation = sources.preparations[recipe.preparation];
  const evaluated = preparation
    ? evaluateRecipe(preparation, sources)
    : { complete: false, missingIngredients: [ingredientLabel(recipe.preparation)] };

  if (!evaluated.complete || !evaluated.per100) {
    return makeResult({
      ...evaluated,
      totalWeight: Number(recipe.portionWeight) || evaluated.totalWeight || 0
    });
  }

  const portionWeight = Number(recipe.portionWeight) || evaluated.totalWeight;
  const perPortion = roundMacros({
    kcal: evaluated.per100.kcal * portionWeight / 100,
    p: evaluated.per100.p * portionWeight / 100,
    f: evaluated.per100.f * portionWeight / 100,
    c: evaluated.per100.c * portionWeight / 100
  });

  return {
    status: 'ready',
    complete: true,
    estimated: true,
    totalWeight: portionWeight,
    per100: evaluated.per100,
    perPortion,
    breakdown: [{ name: preparation.label || recipe.preparation, grams: portionWeight }],
    source: DEFAULT_NUTRITION_SOURCE,
    weightSource: 'порция из меню',
    selectedOption: ''
  };
}

function calculateDirectNutrition(item, recipe) {
  let direct = (item && (item.kbju || item.nutrition))
    || (recipe && recipe.kcal != null ? recipe : null);
  direct = parseJson(direct);

  if (!direct || (direct.kcal == null && direct.p == null)) return null;

  const weight = Number(direct.weight || direct.grams || 0) || 0;
  const per100 = {
    kcal: Math.round(Number(direct.kcal) || 0),
    p: Number(direct.p) || 0,
    f: Number(direct.f) || 0,
    c: Number(direct.c) || 0
  };

  return {
    status: 'ready',
    complete: true,
    estimated: false,
    totalWeight: weight,
    per100,
    perPortion: weight > 0
      ? roundMacros({
          kcal: per100.kcal * weight / 100,
          p: per100.p * weight / 100,
          f: per100.f * weight / 100,
          c: per100.c * weight / 100
        })
      : null,
    breakdown: [],
    source: 'значение блюда',
    weightSource: 'поле блюда',
    selectedOption: ''
  };
}

/**
 * Calculate estimated nutrition per 100 g and per menu portion.
 * options.option is the selected delivery-pizza size/crust option.
 * Sources can be overridden for deterministic tests and future supplier labels.
 */
export function calculateDishKbju(item, titleFallback, options = {}) {
  if (!item || typeof item !== 'object') return null;

  const ingredientsDb = options.ingredientsDb
    || (typeof window !== 'undefined' && window.INGREDIENTS_DB)
    || DEFAULT_INGREDIENTS_DB;
  const preparations = options.preparations || NUTRITION_PREPARATIONS;
  const techCards = options.techCards
    || (typeof window !== 'undefined' && window.TECH_CARDS)
    || {};

  const sources = { ingredientsDb, preparations };
  const nameKey = String(item.name || titleFallback || '').trim();
  const lowerName = nameKey.toLowerCase();
  const itemId = item.id != null ? String(item.id) : '';

  const customRecipe = parseJson(item.recipe || item.techCard)
    || techCards[itemId]
    || techCards[nameKey]
    || Object.entries(techCards).find(([key]) => key.trim().toLowerCase() === lowerName)?.[1]
    || null;

  if (customRecipe?.kcal != null) {
    return calculateDirectNutrition(item, customRecipe);
  }

  const recipe = NUTRITION_DISHES[itemId] || customRecipe;
  if (recipe?.kind === 'pizza') {
    return calculatePizza(item, recipe, sources, options.option);
  }
  if (recipe?.kind === 'preparation') {
    return calculatePreparationDish(recipe, sources);
  }
  if (recipe) {
    const evaluated = evaluateRecipe(recipe, sources);
    return makeResult(evaluated);
  }

  return calculateDirectNutrition(item, customRecipe);
}

if (typeof window !== 'undefined') {
  // Keep existing window contracts while moving ownership out of menu.js.
  window.INGREDIENTS_DB = Object.assign(
    {},
    DEFAULT_INGREDIENTS_DB,
    window.INGREDIENTS_DB || {}
  );
  window.TECH_CARDS = Object.assign(
    {},
    NUTRITION_DISHES,
    window.TECH_CARDS || {}
  );
  window.calculateDishKbju = calculateDishKbju;
}
