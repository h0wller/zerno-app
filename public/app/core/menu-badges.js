const BADGE_CLASSES = Object.freeze({
  'Хит': 'hit',
  'New': 'new',
  'Новинка': 'new',
  'Vegan': 'vegan',
  'Веганское': 'vegan',
  'Острое': 'spicy',
  'Рекомендуем': 'recommended',
  'Сезонное': 'seasonal',
  'Лимитка': 'limited',
  'Без кофеина': 'decaf',
});

export function getMenuBadgeClass(label) {
  return BADGE_CLASSES[String(label || '')] || 'neutral';
}
