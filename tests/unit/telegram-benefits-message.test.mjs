import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatTelegramBenefitsMessage } from '../../server/domain/telegram-benefits-message.js';

test('reports current coffee stamps and directs an available free coffee to cashier QR', () => {
  const message = formatTelegramBenefitsMessage({
    customer: { stamps: 7, free: 1 },
    freeDeliveryCode: null,
  });

  assert.match(message, /7\/10/);
  assert.match(message, /бесплатных кофе: <b>1<\/b>/);
  assert.match(message, /покажите QR кассиру/);
  assert.match(message, /Персонального кода бесплатной доставки сейчас нет/);
});

test('does not promise coffee or delivery rewards when current profile has none', () => {
  const message = formatTelegramBenefitsMessage({
    customer: { stamps: 0, free: 0 },
    freeDeliveryCode: null,
  });

  assert.match(message, /Бесплатных кофе сейчас нет/);
  assert.match(message, /Бесплатная доставка не подтверждена/);
  assert.doesNotMatch(message, /бесплатная первая доставка доступна/i);
});

test('reports Friday free delivery only when an active personal code exists', () => {
  const message = formatTelegramBenefitsMessage({
    customer: { stamps: 3, free: 0 },
    freeDeliveryCode: 'B12345678',
  });

  assert.match(message, /Персональная бесплатная первая доставка доступна/);
  assert.match(message, /подставит его автоматически, если в корзине не выбран другой промокод/);
  assert.doesNotMatch(message, /B12345678/);
});

test('distinguishes a failed delivery-code lookup from a confirmed absence', () => {
  const message = formatTelegramBenefitsMessage({
    customer: { stamps: 0, free: 0 },
    freeDeliveryCode: null,
    deliveryStatus: 'unknown',
  });

  assert.match(message, /Не удалось проверить персональный код/);
  assert.doesNotMatch(message, /Персонального кода бесплатной доставки сейчас нет/);
});
