/* Brand-specific, full-colour inline illustrations for both guest category rails. */
const ICONS = {
  coffee: {
    coffee: '<ellipse cx="24" cy="39" rx="15" ry="3" fill="#D6E6F1"/><path d="M9 17h23v12a8 8 0 0 1-8 8h-7a8 8 0 0 1-8-8V17Z" fill="#F5E7D2" stroke="#174A73" stroke-width="2"/><path d="M32 20h2.5a5 5 0 0 1 0 10H32" fill="#D6EAF4" stroke="#174A73" stroke-width="2"/><path d="M14 22h13" stroke="#B77A4A" stroke-width="3" stroke-linecap="round"/><path d="M16 10c-2 2 2 3 0 5m7-7c-2 2 2 3 0 5" fill="none" stroke="#3E8FD0" stroke-width="2" stroke-linecap="round"/>',
    drinks: '<path d="M12 13h22l-2 25H14l-2-25Z" fill="#D7EDF4" stroke="#174A73" stroke-width="2"/><path d="M14 22h18l-1 13H15l-1-13Z" fill="#76B9D5"/><path d="m24 13 5-9" stroke="#B77A4A" stroke-width="3" stroke-linecap="round"/><path d="M18 27c3-3 6 3 10 0" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"/><circle cx="19" cy="18" r="2" fill="#F5E7D2"/>',
    seasonal: '<path d="M7 29c5-7 10-7 15 0s10 7 19 0" fill="none" stroke="#287EA8" stroke-width="4" stroke-linecap="round"/><path d="M7 36c5-7 10-7 15 0s10 7 19 0" fill="none" stroke="#78BCD5" stroke-width="3" stroke-linecap="round"/><circle cx="31" cy="12" r="7" fill="#F2C66D"/><path d="M31 1v3m0 16v3M20 12h3m16 0h3" stroke="#D99A4C" stroke-width="2" stroke-linecap="round"/>',
    food: '<path d="M7 29a17 17 0 0 1 34 0H7Z" fill="#E7B96E" stroke="#174A73" stroke-width="2"/><path d="M7 29h34v5H7z" fill="#F5E7D2" stroke="#174A73" stroke-width="2"/><path d="M13 24c2-7 7-10 11-10s9 3 11 10" fill="#F4D89D"/><circle cx="19" cy="21" r="2" fill="#B77A4A"/><circle cx="29" cy="18" r="2" fill="#3E8F76"/>',
    desserts: '<path d="M8 27h32l-4 12H12L8 27Z" fill="#F4D6D9" stroke="#174A73" stroke-width="2"/><path d="M8 27c0-5 5-7 9-4 3-7 13-7 16 0 4-3 8-1 7 4H8Z" fill="#FFF1E8" stroke="#174A73" stroke-width="2"/><path d="M24 8c-4 5-4 7 0 9 4-2 4-4 0-9Z" fill="#D97983"/><circle cx="24" cy="25" r="2" fill="#B77A4A"/>',
    shop: '<path d="M10 16h28l-2 23H12l-2-23Z" fill="#D7EAF3" stroke="#174A73" stroke-width="2"/><path d="M17 17v-5a7 7 0 0 1 14 0v5" fill="none" stroke="#B77A4A" stroke-width="3" stroke-linecap="round"/><path d="M16 24h16" stroke="#3E8FD0" stroke-width="2"/><path d="M20 29h8" stroke="#174A73" stroke-width="2" stroke-linecap="round"/>'
  },
  delivery: {
    pizza: '<path d="M7 12a31 31 0 0 1 34 0L24 42 7 12Z" fill="#F2C45E" stroke="#3A2A1C" stroke-width="2.5" stroke-linejoin="round"/><path d="M7 12a31 31 0 0 1 34 0" fill="none" stroke="#C03B2A" stroke-width="5"/><path d="m24 42-7-12 7-18 7 18-7 12Z" fill="#E9A83F" opacity=".75"/><circle cx="19" cy="21" r="3" fill="#C03B2A"/><circle cx="30" cy="26" r="3" fill="#C03B2A"/><circle cx="24" cy="33" r="2.5" fill="#557A45"/>',
    rolls: '<rect x="6" y="13" width="36" height="25" rx="12" fill="#F3E8D7" stroke="#3A2A1C" stroke-width="2.5"/><ellipse cx="24" cy="25.5" rx="11" ry="9" fill="#E9A83F" stroke="#3A2A1C" stroke-width="2"/><ellipse cx="24" cy="25.5" rx="5.5" ry="4.5" fill="#F6EEE1"/><circle cx="24" cy="25.5" r="2.5" fill="#E87554"/><path d="M9 17c4-4 26-4 30 0" fill="none" stroke="#557A45" stroke-width="3" stroke-linecap="round"/>',
    sets: '<rect x="7" y="9" width="34" height="31" rx="3" fill="#F6EEE1" stroke="#3A2A1C" stroke-width="2.5"/><path d="M7 21h34M24 9v31" stroke="#3A2A1C" stroke-width="2"/><path d="M12 14h7v4h-7z" fill="#C03B2A"/><circle cx="31" cy="15.5" r="3" fill="#E9A83F"/><path d="M12 28h7v7h-7z" fill="#557A45"/><circle cx="31" cy="31.5" r="4" fill="#E87554"/>',
    drinks: '<path d="M11 14h26l-3 25H14l-3-25Z" fill="#F3E8D7" stroke="#3A2A1C" stroke-width="2.5"/><path d="M14 23h20l-2 13H16l-2-13Z" fill="#E9A83F"/><path d="m25 14 5-9" stroke="#C03B2A" stroke-width="3" stroke-linecap="round"/><circle cx="21" cy="19" r="2" fill="#557A45"/><path d="M17 28c4-3 8 3 13 0" fill="none" stroke="#FFF9F0" stroke-width="2.5" stroke-linecap="round"/>',
    sauces: '<path d="M17 6h14v6l4 4v20a4 4 0 0 1-4 4H17a4 4 0 0 1-4-4V16l4-4V6Z" fill="#E9A83F" stroke="#3A2A1C" stroke-width="2.5"/><path d="M17 12h14M14 25h20" stroke="#3A2A1C" stroke-width="2"/><path d="M18 30c4-4 8 4 13 0" fill="none" stroke="#C03B2A" stroke-width="3" stroke-linecap="round"/>'
  }
};

export function renderCategoryIcon(id, brand = 'coffee') {
  const brandIcons = ICONS[brand] || ICONS.coffee;
  const artwork = brandIcons[id] || brandIcons[Object.keys(brandIcons)[0]];
  return '<svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true" focusable="false">' + artwork + '</svg>';
}
