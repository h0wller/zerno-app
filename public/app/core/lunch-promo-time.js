const KALININGRAD_OFFSET_MS = 2 * 60 * 60 * 1000;
const LUNCH_START_MINUTES = 11 * 60;
const LUNCH_END_MINUTES = 15 * 60;

export function getNextLunchPromoBoundaryDelay(now = new Date()) {
  const kaliningradNow = new Date(new Date(now).getTime() + KALININGRAD_OFFSET_MS);
  const dayOfWeek = kaliningradNow.getUTCDay();
  const minuteOfDay = kaliningradNow.getUTCHours() * 60 + kaliningradNow.getUTCMinutes();

  let daysAhead = 0;
  let targetMinute;

  if (dayOfWeek >= 1 && dayOfWeek <= 5 && minuteOfDay < LUNCH_START_MINUTES) {
    targetMinute = LUNCH_START_MINUTES;
  } else if (dayOfWeek >= 1 && dayOfWeek <= 5 && minuteOfDay < LUNCH_END_MINUTES) {
    targetMinute = LUNCH_END_MINUTES;
  } else {
    let nextDay = dayOfWeek;
    do {
      daysAhead += 1;
      nextDay = (nextDay + 1) % 7;
    } while (nextDay === 0 || nextDay === 6);
    targetMinute = LUNCH_START_MINUTES;
  }

  const targetTime = Date.UTC(
    kaliningradNow.getUTCFullYear(),
    kaliningradNow.getUTCMonth(),
    kaliningradNow.getUTCDate() + daysAhead,
    Math.floor(targetMinute / 60),
    targetMinute % 60
  );

  return Math.max(0, targetTime - kaliningradNow.getTime());
}
