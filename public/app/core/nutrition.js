import {
  NUTRITION_DISHES,
  NUTRITION_INGREDIENTS,
  NUTRITION_PREPARATIONS,
  PIZZA_DOUGH_PORTIONS
} from './nutrition-data.js';

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
      source: metadata.source || 'ТТК + усреднённая база продуктов',
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
    source: metadata.source || 'ТТК + усреднённая база продуктов',
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
      source: 'ТТК + усреднённая база продуктов'
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
    source: 'ТТК + усреднённая база продуктов',
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
    source: 'ТТК + усреднённая база продуктов',
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
    || NUTRITION_INGREDIENTS;
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
    NUTRITION_INGREDIENTS,
    window.INGREDIENTS_DB || {}
  );
  window.TECH_CARDS = Object.assign(
    {},
    NUTRITION_DISHES,
    window.TECH_CARDS || {}
  );
  window.calculateDishKbju = calculateDishKbju;
}
