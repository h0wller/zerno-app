// Telegram summary of current benefits across both Zerno App brands.
// Values are read from the persisted customer profile and active personal delivery code.
export function formatTelegramBenefitsMessage({ customer, freeDeliveryCode, deliveryStatus = 'known' }) {
  const stamps = Math.max(0, Math.min(10, Number(customer?.stamps) || 0));
  const freeCoffee = Math.max(0, Number(customer?.free) || 0);

  const coffeeGift = freeCoffee > 0
    ? 'Есть бесплатный кофе ×' + freeCoffee + '. Откройте карту в профиле кофейни и покажите QR кассиру.'
    : 'Бесплатных кофе сейчас нет. Карта штампов и QR доступны в профиле кофейни; покажите QR кассиру при визите.';

  let delivery;
  if (deliveryStatus === 'unknown') {
    delivery = 'Не удалось проверить персональный код. Бесплатную доставку подтвердить не могу — проверьте корзину в приложении.';
  } else if (freeDeliveryCode) {
    delivery = 'Персональная бесплатная первая доставка доступна. Откройте «Пятницу», добавьте товары в корзину: приложение подставит код автоматически и покажет подтверждение.';
  } else {
    delivery = 'Персонального кода бесплатной доставки сейчас нет. Бесплатная доставка не подтверждена.';
  }

  return [
    '☕ <b>«…и кофе»</b>',
    'Карта: <b>' + stamps + '/10</b> штампов; бесплатных кофе: <b>' + freeCoffee + '</b>.',
    coffeeGift,
    '',
    '🍕 <b>«Пятница»</b>',
    delivery,
  ].join('\\n');
}
