const BADGE_CLASSES = Object.freeze({
  'Хит': 'hit',
  'New': 'new',
  'Новинка': 'new',
  'Vegan': 'vegan',
  'Веганское': 'vegan',
  'Острое': 'spicy',
  'Пряное': 'spicy',
  'Рекомендуем': 'recommended',
  'Популярное': 'popular',
  'Фирменное': 'signature',
  'Сезонное': 'seasonal',
  'Лимитка': 'limited',
  'Для двоих': 'share',
  'Сытное': 'hearty',
  'Лёгкое': 'light',
  'Без кофеина': 'decaf',
});

const BADGE_LABELS = Object.freeze({
  New: 'Новинка',
  Vegan: 'Веганское',
});

export function getMenuBadgeClass(label) {
  return BADGE_CLASSES[String(label || '')] || 'neutral';
}

export function getMenuBadgeLabel(label) {
  const value = String(label || '');
  return BADGE_LABELS[value] || value;
}
