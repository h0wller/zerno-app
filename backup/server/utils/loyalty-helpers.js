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