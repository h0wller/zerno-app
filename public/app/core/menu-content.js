/**
 * Shared menu content rules used by compact cards and the enlarged photo view.
 *
 * Legacy delivery pizzas store their composition twice:
 * - desc is the readable, more specific text shown to guests;
 * - comp is the structured list retained for filtering and search.
 *
 * Keep the structured list in data, but do not render it a second time when the
 * delivery pizza already has a text composition in desc. Other menu categories
 * continue to render desc and comp independently.
 */
export function getVisibleComposition(item) {
  const composition = Array.isArray(item?.comp) ? item.comp.filter(Boolean) : [];
  const hasTextComposition =
    item?.section === 'delivery' &&
    item?.cat === 'pizza' &&
    String(item?.desc || '').trim().length > 0;

  return hasTextComposition ? [] : composition;
}
