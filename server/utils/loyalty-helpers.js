// server/utils/loyalty-helpers.js
export function cupWord(n) {
  const d10 = n % 10;
  const d100 = n % 100;
  if (d100 >= 11 && d100 <= 14) return 'чашек';
  if (d10 === 1) return 'чашка';
  if (d10 >= 2 && d10 <= 4) return 'чашки';
  return 'чашек';
}

export function stampBar(stamps, total = 10) {
  const s = Math.max(0, Math.min(stamps, total));
  return '🫘'.repeat(s) + '⚪'.repeat(total - s);
}
/**
 * Арифметика начисления штампов: сколько останется на карте и сколько подарков добавится.
 * Чистая функция без базы — единый источник правды для grantStamps и приветственных бонусов.
 * @param {number} stamps - Текущее число штампов на карте (0..9).
 * @param {number} free - Текущее число доступных подарков.
 * @param {number} add - Сколько штампов начисляем.
 * @param {number} [cardSize=10] - Размер карты лояльности.
 * @returns {{stamps: number, free: number, addedFree: number, gotFree: boolean}}
 */
export function splitStamps(stamps, free, add, cardSize = 10) {
  const total = Math.max(0, Number(stamps) || 0) + Math.max(0, Number(add) || 0);
  const addedFree = Math.floor(total / cardSize);
  const f = Math.max(0, Number(free) || 0);
  return { stamps: total % cardSize, free: f + addedFree, addedFree, gotFree: addedFree > 0 };
}
