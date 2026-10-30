import { test, expect } from '@playwright/test';

test.describe('Poster & Delivery Hours Suite (F3.66)', () => {
  test('delivery info endpoint returns schedule and today status', async ({ request }) => {
    const res = await request.get('/api/delivery/info');
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.schedule).toBeDefined();
    expect(data.today).toBeDefined();
    expect(typeof data.today.isOpen).toBe('boolean');
    expect(typeof data.today.canAcceptAsap).toBe('boolean');
    expect(data.days).toHaveLength(2);
    expect(data.days.map(day => day.offset)).toEqual([0, 1]);
    for (const day of data.days) {
      expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(day.open).toBe(11);
      expect([21, 22]).toContain(day.close);
    }
  });

  test('schedule honors winter calendar and poster shows hours', async ({ request, page }) => {
    const d = await (await request.get('/api/delivery/info')).json();
    expect(d.schedule.open).toBe(11);
    expect([21, 22]).toContain(d.schedule.close);
    await page.goto('/poster.html');
    await expect(page.locator('body')).toContainText('Октябрь–апрель');
    await expect(page.locator('body')).toContainText('11:00–22:00');
  });
});


function deliverySchedule(date, tomorrow, close) {
  const day = (value, offset) => ({ offset, date: value, open: 11, close });
  return {
    eta: 45,
    slotStep: 30,
    slotDays: 2,
    zones: [],
    busySlots: [],
    schedule: { open: 11, close },
    today: { date, open: 11, close, isOpen: false, canAcceptAsap: false },
    days: [day(date, 0), day(tomorrow, 1)],
  };
}

test('клиентские предзаказы следуют зимнему расписанию при подмене системного времени', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-27T08:30:00.000Z'));
  let schedule = deliverySchedule('2026-10-27', '2026-10-28', 21);
  await page.route('**/api/delivery/info', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(schedule),
  }));

  await page.goto('/?brand=delivery');
  await expect.poll(() => page.evaluate(() => window.deliveryInfo && window.deliveryInfo.today && window.deliveryInfo.today.date))
    .toBe('2026-10-27');

  const beforeOpening = await page.evaluate(() => {
    window.populateSlots();
    return {
      clock: window.getKaliningradTime(),
      mode: window.preorderMode(),
      options: Array.from(document.querySelectorAll('#checkoutSlot option')).map(option => option.value),
    };
  });
  expect(beforeOpening.clock).toEqual({ hour: 10, minute: 30 });
  expect(beforeOpening.mode).toBe('today');
  expect(beforeOpening.options).toContain('27.10 | 11:30–12:00');
  expect(beforeOpening.options).toContain('27.10 | 20:30–21:00');
  expect(beforeOpening.options).not.toContain('27.10 | 21:00–21:30');

  await page.clock.setFixedTime(new Date('2026-10-27T18:14:00.000Z')); // 20:14 в Калининграде
  expect(await page.evaluate(() => window.preorderMode())).toBeNull();

  await page.clock.setFixedTime(new Date('2026-10-27T18:15:00.000Z')); // ровно за 45 минут до закрытия
  const afterCutoff = await page.evaluate(() => {
    window.populateSlots();
    return {
      mode: window.preorderMode(),
      groups: Array.from(document.querySelectorAll('#checkoutSlot optgroup')).map(group => group.label),
      options: Array.from(document.querySelectorAll('#checkoutSlot option')).map(option => option.value),
    };
  });
  expect(afterCutoff.mode).toBe('tomorrow');
  expect(afterCutoff.groups).toEqual(['Завтра (28.10)']);
  expect(afterCutoff.options.some(value => value.startsWith('27.10 |'))).toBe(false);
  expect(afterCutoff.options).toContain('28.10 | 20:30–21:00');
  expect(afterCutoff.options).not.toContain('28.10 | 21:00–21:30');

  // Приложение долго открыто: после полуночи обновляем график, а не используем вчерашнюю дату.
  await page.clock.setFixedTime(new Date('2026-10-27T22:01:00.000Z')); // 00:01 следующего дня
  schedule = deliverySchedule('2026-10-28', '2026-10-29', 21);
  await page.evaluate(() => window.refreshDeliveryInfo());
  const afterMidnight = await page.evaluate(() => ({
    today: window.deliveryInfo.today.date,
    mode: window.preorderMode(),
    options: Array.from(document.querySelectorAll('#checkoutSlot option')).map(option => option.value),
  }));
  expect(afterMidnight.today).toBe('2026-10-28');
  expect(afterMidnight.mode).toBe('today');
  expect(afterMidnight.options).toContain('28.10 | 11:30–12:00');
  expect(afterMidnight.options.some(value => value.startsWith('27.10 |'))).toBe(false);
});

test('пятничное зимнее расписание оставляет слот до 22:00 при подмене времени', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-30T18:45:00.000Z')); // 20:45 в Калининграде
  const schedule = deliverySchedule('2026-10-30', '2026-10-31', 22);
  await page.route('**/api/delivery/info', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(schedule),
  }));

  await page.goto('/?brand=delivery');
  await expect.poll(() => page.evaluate(() => window.deliveryInfo && window.deliveryInfo.today && window.deliveryInfo.today.date))
    .toBe('2026-10-30');

  const beforeClose = await page.evaluate(() => {
    window.populateSlots();
    return {
      mode: window.preorderMode(),
      options: Array.from(document.querySelectorAll('#checkoutSlot option')).map(option => option.value),
    };
  });
  expect(beforeClose.mode).toBeNull();
  expect(beforeClose.options).toContain('30.10 | 21:30–22:00');
  expect(beforeClose.options).not.toContain('30.10 | 22:00–22:30');

  await page.clock.setFixedTime(new Date('2026-10-30T19:15:00.000Z')); // 21:15, за 45 минут до закрытия
  expect(await page.evaluate(() => window.preorderMode())).toBe('tomorrow');
});
