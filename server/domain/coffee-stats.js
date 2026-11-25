const COFFEE_TIME_ZONE = 'Europe/Kaliningrad';

const zonedDateFormatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone: COFFEE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function localDateKey(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return zonedDateFormatter.format(date);
}

function localMidnightUtc(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day) - 2 * 60 * 60 * 1000).toISOString();
}

function currentMonthKey(now) {
  return localDateKey(now).slice(0, 7);
}

export function getCoffeeMonthPeriod(monthValue, now = new Date()) {
  const month = monthValue == null ? currentMonthKey(now) : String(monthValue).trim();
  const match = /^(\\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  if (!match) return null;

  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  if (year < 2000 || year > 2100) return null;

  const nextYear = monthNumber === 12 ? year + 1 : year;
  const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1;
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();

  return {
    month,
    year,
    monthNumber,
    daysInMonth,
    start: localMidnightUtc(year, monthNumber, 1),
    end: localMidnightUtc(nextYear, nextMonth, 1),
  };
}

function sortedItems(byItem) {
  return Object.entries(byItem)
    .sort(([aName, aQty], [bName, bQty]) => bQty - aQty || aName.localeCompare(bName, 'ru'))
    .map(([name, qty]) => ({ name, qty }));
}

export function buildCoffeeMonthStats(monthValue, rows = []) {
  const period = getCoffeeMonthPeriod(monthValue);
  if (!period) throw new RangeError('month must use YYYY-MM format');

  const days = Array.from({ length: period.daysInMonth }, (_, index) => {
    const day = index + 1;
    const date = `${period.month}-${String(day).padStart(2, '0')}`;
    const weekday = (new Date(Date.UTC(period.year, period.monthNumber - 1, day)).getUTCDay() + 6) % 7;
    return {
      date,
      label: `${String(day).padStart(2, '0')}.${String(period.monthNumber).padStart(2, '0')}`,
      weekday,
      redemptions: 0,
      stamps: 0,
      byItem: {},
    };
  });

  const daysByDate = new Map(days.map((day) => [day.date, day]));
  const byItem = {};
  let total = 0;
  let stamps = 0;

  for (const row of rows) {
    const action = String(row?.a || '');
    const date = localDateKey(row?.ts);
    const day = daysByDate.get(date);
    if (!day) continue;

    if (/^Штамп(?:\\s|$)/i.test(action)) {
      stamps += 1;
      day.stamps += 1;
      continue;
    }

    if (!/списан бесплатный кофе/i.test(action)) continue;
    const match = action.match(/списан бесплатный кофе:\\s*(.+?)\\s*\\(/i);
    const item = match ? match[1].trim() : 'неизвестно';

    total += 1;
    day.redemptions += 1;
    day.byItem[item] = (day.byItem[item] || 0) + 1;
    byItem[item] = (byItem[item] || 0) + 1;
  }

  const items = sortedItems(byItem);
  const normalizedDays = days.map((day) => ({
    ...day,
    items: sortedItems(day.byItem),
  }));

  return {
    month: period.month,
    timezone: COFFEE_TIME_ZONE,
    start: period.start,
    end: period.end,
    total,
    stamps,
    byItem: Object.fromEntries(items.map(({ name, qty }) => [name, qty])),
    items,
    days: normalizedDays,
  };
}
