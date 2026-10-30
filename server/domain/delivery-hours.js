const KALININGRAD_TIME_ZONE = 'Europe/Kaliningrad';
const KALININGRAD_UTC_OFFSET_MS = 2 * 60 * 60 * 1000;

export const DELIVERY_SCHEDULE = Object.freeze({
  open: 11,
  summerClose: 22,
  winterWeekdayClose: 21,
  summerStartMonth: 5,
  summerEndMonth: 9,
  slotStepMinutes: 30,
  firstSlotOffsetMinutes: 30,
  minimumLeadMinutes: 45,
  slotDays: 2,
});

const WEEKDAY_INDEX = Object.freeze({
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
});

const pad = (value) => String(value).padStart(2, '0');

export function getKaliningradDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: KALININGRAD_TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    dayOfWeek: WEEKDAY_INDEX[parts.weekday] ?? date.getUTCDay(),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute) || 0,
  };
}

export function getDeliveryHours(date = new Date()) {
  const parts = getKaliningradDateParts(date);
  const isSummer = parts.month >= DELIVERY_SCHEDULE.summerStartMonth
    && parts.month <= DELIVERY_SCHEDULE.summerEndMonth;
  const isMondayToThursday = parts.dayOfWeek >= 1 && parts.dayOfWeek <= 4;
  const open = DELIVERY_SCHEDULE.open;
  const close = !isSummer && isMondayToThursday
    ? DELIVERY_SCHEDULE.winterWeekdayClose
    : DELIVERY_SCHEDULE.summerClose;
  const currentMinutes = parts.hour * 60 + parts.minute;
  const isOpen = currentMinutes >= open * 60 && currentMinutes < close * 60;

  return {
    ...parts,
    open,
    close,
    isOpen,
    canAcceptAsap: isOpen && currentMinutes + DELIVERY_SCHEDULE.minimumLeadMinutes < close * 60,
  };
}

function dateAtKaliningradNoon(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day, 12) - KALININGRAD_UTC_OFFSET_MS);
}

export function getDeliveryDays(now = new Date(), count = DELIVERY_SCHEDULE.slotDays) {
  const current = getKaliningradDateParts(now);
  const todayUtc = Date.UTC(current.year, current.month - 1, current.day);

  return Array.from({ length: Math.max(0, count) }, (_, offset) => {
    const date = dateAtKaliningradNoon(current.year, current.month, current.day + offset);
    const hours = getDeliveryHours(date);
    const dayUtc = Date.UTC(hours.year, hours.month - 1, hours.day);

    return {
      offset,
      date: `${hours.year}-${pad(hours.month)}-${pad(hours.day)}`,
      dayOffset: Math.round((dayUtc - todayUtc) / 86400000),
      open: hours.open,
      close: hours.close,
    };
  });
}

export function validateDeliverySlot(slot, now = new Date()) {
  const match = String(slot || '').trim().match(
    /^(\\d{2})\\.(\\d{2})\\s*\\|\\s*(\\d{2}):(\\d{2})[–-](\\d{2}):(\\d{2})$/,
  );
  if (!match) return { valid: false, reason: 'format' };

  const [, dayText, monthText, startHourText, startMinuteText, endHourText, endMinuteText] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const startHour = Number(startHourText);
  const startMinute = Number(startMinuteText);
  const endHour = Number(endHourText);
  const endMinute = Number(endMinuteText);

  if (month < 1 || month > 12 || startHour > 23 || endHour > 23
    || startMinute > 59 || endMinute > 59) {
    return { valid: false, reason: 'time' };
  }

  const current = getKaliningradDateParts(now);
  const todayUtc = Date.UTC(current.year, current.month - 1, current.day);
  let target = null;

  for (const year of [current.year, current.year + 1]) {
    const targetUtc = Date.UTC(year, month - 1, day);
    const targetDate = new Date(targetUtc);
    if (targetDate.getUTCFullYear() !== year
      || targetDate.getUTCMonth() !== month - 1
      || targetDate.getUTCDate() !== day) continue;

    const dayOffset = Math.round((targetUtc - todayUtc) / 86400000);
    if (dayOffset >= 0 && dayOffset < DELIVERY_SCHEDULE.slotDays) {
      target = { year, dayOffset };
      break;
    }
  }

  if (!target) return { valid: false, reason: 'date' };

  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;
  if (endMinutes - startMinutes !== DELIVERY_SCHEDULE.slotStepMinutes) {
    return { valid: false, reason: 'duration' };
  }

  const startInstant = new Date(
    Date.UTC(target.year, month - 1, day, startHour, startMinute) - KALININGRAD_UTC_OFFSET_MS,
  );
  const hours = getDeliveryHours(startInstant);
  if (startMinutes < hours.open * 60 + DELIVERY_SCHEDULE.firstSlotOffsetMinutes
    || endMinutes > hours.close * 60) {
    return { valid: false, reason: 'hours' };
  }

  if (target.dayOffset === 0
    && startInstant.getTime() - now.getTime() < DELIVERY_SCHEDULE.minimumLeadMinutes * 60000) {
    return { valid: false, reason: 'lead-time' };
  }

  return {
    valid: true,
    date: `${target.year}-${pad(month)}-${pad(day)}`,
    datePart: `${pad(day)}.${pad(month)}`,
    dayOffset: target.dayOffset,
    open: hours.open,
    close: hours.close,
  };
}
