import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DELIVERY_SCHEDULE,
  getDeliveryDays,
  getDeliveryHours,
  validateDeliverySlot,
} from '../../server/domain/delivery-hours.js';

test('летнее расписание: каждый день с 11:00 до 22:00', () => {
  const monday = getDeliveryHours(new Date('2026-06-01T09:00:00.000Z'));
  const sunday = getDeliveryHours(new Date('2026-06-07T09:00:00.000Z'));

  assert.deepEqual([monday.open, monday.close], [11, 22]);
  assert.deepEqual([sunday.open, sunday.close], [11, 22]);
});

test('зимнее расписание: понедельник–четверг до 21:00, пятница–воскресенье до 22:00', () => {
  for (const isoDate of [
    '2026-10-26T09:00:00.000Z',
    '2026-10-27T09:00:00.000Z',
    '2026-10-28T09:00:00.000Z',
    '2026-10-29T09:00:00.000Z',
  ]) {
    assert.equal(getDeliveryHours(new Date(isoDate)).close, 21);
  }

  for (const isoDate of [
    '2026-10-30T09:00:00.000Z',
    '2026-10-31T09:00:00.000Z',
    '2026-11-01T09:00:00.000Z',
  ]) {
    assert.equal(getDeliveryHours(new Date(isoDate)).close, 22);
  }
});

test('слоты на сегодня и завтра получают расписание именно соответствующего дня', () => {
  const days = getDeliveryDays(new Date('2026-10-25T20:30:00.000Z'), 2);

  assert.deepEqual(days.map(({ date, open, close }) => ({ date, open, close })), [
    { date: '2026-10-25', open: 11, close: 22 },
    { date: '2026-10-26', open: 11, close: 21 },
  ]);
});

test('последний зимний слот понедельника заканчивается ровно в 21:00', () => {
  const now = new Date('2026-10-26T17:30:00.000Z'); // 19:30 в Калининграде

  assert.equal(validateDeliverySlot('26.10 | 20:30–21:00', now).valid, true);
  assert.equal(validateDeliverySlot('26.10 | 21:00–21:30', now).valid, false);
});

test('последний слот пятницы зимой и летом заканчивается в 22:00', () => {
  const winterNow = new Date('2026-10-30T18:30:00.000Z'); // 20:30 в Калининграде
  const summerNow = new Date('2026-06-01T18:30:00.000Z'); // 20:30 в Калининграде

  assert.equal(validateDeliverySlot('30.10 | 21:30–22:00', winterNow).valid, true);
  assert.equal(validateDeliverySlot('01.06 | 21:30–22:00', summerNow).valid, true);
});

test('предзаказ на завтра проверяется по расписанию завтрашнего дня, а не сегодняшнего', () => {
  const sundayNight = new Date('2026-10-25T20:30:00.000Z'); // 22:30 в воскресенье

  assert.equal(validateDeliverySlot('26.10 | 20:30–21:00', sundayNight).valid, true);
  assert.equal(validateDeliverySlot('26.10 | 21:00–21:30', sundayNight).valid, false);
});

test('сегодняшние слоты требуют минимум 45 минут, а слоты не на ближайшие два дня запрещены', () => {
  const now = new Date('2026-10-26T18:45:00.000Z'); // 20:45 в Калининграде

  assert.deepEqual(DELIVERY_SCHEDULE.minimumLeadMinutes, 45);
  assert.equal(validateDeliverySlot('26.10 | 21:00–21:30', now).valid, false);
  assert.equal(validateDeliverySlot('28.10 | 20:30–21:00', now).valid, false);
  assert.equal(validateDeliverySlot('26.10 | 20:30–21:00', now).valid, false);
});

test('проверка ASAP учитывает запас на доставку и точное время закрытия', () => {
  const beforeCutoff = getDeliveryHours(new Date('2026-10-26T18:14:00.000Z')); // 20:14
  const atCutoff = getDeliveryHours(new Date('2026-10-26T18:15:00.000Z')); // 20:15

  assert.equal(beforeCutoff.isOpen, true);
  assert.equal(beforeCutoff.canAcceptAsap, true);
  assert.equal(atCutoff.isOpen, true);
  assert.equal(atCutoff.canAcceptAsap, false);
});
