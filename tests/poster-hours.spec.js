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


function deliverySchedule(date, tomorrow, close, tomorrowClose = close) {
  const day = (value, offset, dayClose) => ({ offset, date: value, open: 11, close: dayClose });
  return {
    eta: 45,
    slotStep: 30,
    slotDays: 2,
    zones: [],
    busySlots: [],
    schedule: { open: 11, close },
    today: { date, open: 11, close, isOpen: false, canAcceptAsap: false },
    days: [day(date, 0, close), day(tomorrow, 1, tomorrowClose)],
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


test('переход с летнего на зимнее расписание 1 октября проверяется с подменой времени', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-30T18:44:00.000Z')); // 20:44, слот 21:30 доступен с учётом ETA 45 мин
  let schedule = deliverySchedule('2026-09-30', '2026-10-01', 22, 21);
  await page.route('**/api/delivery/info', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(schedule),
  }));

  await page.goto('/?brand=delivery');
  await expect.poll(() => page.evaluate(() => window.deliveryInfo && window.deliveryInfo.today && window.deliveryInfo.today.date))
    .toBe('2026-09-30');

  const beforeSummerCutoff = await page.evaluate(() => {
    window.populateSlots();
    return {
      mode: window.preorderMode(),
      options: Array.from(document.querySelectorAll('#checkoutSlot option')).map(option => option.value),
    };
  });
  expect(beforeSummerCutoff.mode).toBeNull();
  expect(beforeSummerCutoff.options).toContain('30.09 | 21:30–22:00');

  await page.clock.setFixedTime(new Date('2026-09-30T19:15:00.000Z')); // за 45 минут до летнего закрытия
  const afterCutoff = await page.evaluate(() => {
    window.populateSlots();
    return {
      mode: window.preorderMode(),
      options: Array.from(document.querySelectorAll('#checkoutSlot option')).map(option => option.value),
    };
  });
  expect(afterCutoff.mode).toBe('tomorrow');
  expect(afterCutoff.options).toContain('01.10 | 20:30–21:00');
  expect(afterCutoff.options).not.toContain('01.10 | 21:00–21:30');

  await page.clock.setFixedTime(new Date('2026-09-30T22:01:00.000Z')); // 00:01, уже 1 октября
  schedule = deliverySchedule('2026-10-01', '2026-10-02', 21, 22);
  await page.evaluate(() => window.refreshDeliveryInfo());
  const afterMonthChange = await page.evaluate(() => ({
    today: window.deliveryInfo.today.date,
    close: window.deliveryInfo.today.close,
    mode: window.preorderMode(),
    options: Array.from(document.querySelectorAll('#checkoutSlot option')).map(option => option.value),
  }));
  expect(afterMonthChange.today).toBe('2026-10-01');
  expect(afterMonthChange.close).toBe(21);
  expect(afterMonthChange.mode).toBe('today');
  expect(afterMonthChange.options).toContain('01.10 | 20:30–21:00');
  expect(afterMonthChange.options).not.toContain('01.10 | 21:00–21:30');
});

test('переход с зимнего на летнее расписание 1 мая проверяется с подменой времени', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-04-30T19:15:00.000Z')); // 21:15, сегодня зимнее закрытие в 21:00
  let schedule = deliverySchedule('2026-04-30', '2026-05-01', 21, 22);
  await page.route('**/api/delivery/info', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(schedule),
  }));

  await page.goto('/?brand=delivery');
  await expect.poll(() => page.evaluate(() => window.deliveryInfo && window.deliveryInfo.today && window.deliveryInfo.today.date))
    .toBe('2026-04-30');

  const tomorrowSlots = await page.evaluate(() => {
    window.populateSlots();
    return {
      mode: window.preorderMode(),
      options: Array.from(document.querySelectorAll('#checkoutSlot option')).map(option => option.value),
    };
  });
  expect(tomorrowSlots.mode).toBe('tomorrow');
  expect(tomorrowSlots.options).toContain('01.05 | 21:30–22:00');
  expect(tomorrowSlots.options).not.toContain('01.05 | 22:00–22:30');

  await page.clock.setFixedTime(new Date('2026-04-30T22:01:00.000Z')); // 00:01, уже 1 мая
  schedule = deliverySchedule('2026-05-01', '2026-05-02', 22, 22);
  await page.evaluate(() => window.refreshDeliveryInfo());
  const afterMonthChange = await page.evaluate(() => ({
    today: window.deliveryInfo.today.date,
    close: window.deliveryInfo.today.close,
    mode: window.preorderMode(),
    options: Array.from(document.querySelectorAll('#checkoutSlot option')).map(option => option.value),
  }));
  expect(afterMonthChange.today).toBe('2026-05-01');
  expect(afterMonthChange.close).toBe(22);
  expect(afterMonthChange.mode).toBe('today');
  expect(afterMonthChange.options).toContain('01.05 | 21:30–22:00');
  expect(afterMonthChange.options).not.toContain('01.05 | 22:00–22:30');
});
