/* Shared inline SVG icons for the guest category rails. */
const CATEGORY_ICON_PATHS = {
  coffee: '<path d="M4 9h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9Z"/><path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17M7 4c0 1 1 1 1 2M12 3c0 1 1 1 1 2"/>',
  drinks: '<path d="M5 5h14l-1.4 15H6.4L5 5Z"/><path d="M8 9h8M12 5l2-3M9 2l2 3"/>',
  seasonal: '<path d="M3 15c2.2-2.4 4.4-2.4 6.6 0s4.4 2.4 6.6 0 4.4-2.4 5.8-1.2"/><path d="M3 19c2.2-2.4 4.4-2.4 6.6 0s4.4 2.4 6.6 0 4.4-2.4 5.8-1.2M16 4v4m-2-2h4"/>',
  food: '<path d="M4 14c0-5 3.6-9 8-9s8 4 8 9H4Z"/><path d="M3 14h18M6 18h12M8 10h.01M13 8h.01M16 11h.01"/>',
  desserts: '<path d="M4 11h16l-2 9H6l-2-9Z"/><path d="M4 11c0-2 2-3 4-2 1-3 6-3 8 0 2-1 4 0 4 2M12 3v3m-2-3h4"/>',
  shop: '<path d="M4 9h16l-1 11H5L4 9Z"/><path d="M8 9V6a4 4 0 0 1 8 0v3M9 13v3m6-3v3"/>',
  pizza: '<path d="M3 7a19 19 0 0 1 18 0L12 21 3 7Z"/><path d="m3 7 18 0M9 10l1 1m4 2 1 1m-7 1 1 1"/>',
  rolls: '<path d="M4 8c0-2 3.6-4 8-4s8 2 8 4-3.6 4-8 4-8-2-8-4Z"/><path d="M4 8v8c0 2 3.6 4 8 4s8-2 8-4V8M9 6.5h.01M14 8h.01"/>',
  sets: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16M10 4v16m5-12h2m-2 4h2"/>',
  sauces: '<path d="M9 3h6v3l2 2v11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V8l2-2V3Z"/><path d="M9 6h6m-7 7h8"/>'
};

export function renderCategoryIcon(id) {
  const paths = CATEGORY_ICON_PATHS[id] || CATEGORY_ICON_PATHS.coffee;
  return '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + paths + '</svg>';
}
