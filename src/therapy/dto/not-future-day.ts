import { ValidateBy } from 'class-validator';

// Календарный день не в будущем — для «начала терапии» (QA 2026-10-26: дата
// через месяц давала бейдж «в работе сегодня» и «с сегодняшнего дня»).
// День терапевта сервер не знает (дату вводят по своим часам), поэтому
// граница — самый поздний «сегодня» на Земле, UTC+14: законный местный день
// не отсекается ни в одной зоне, а завтра — уже везде будущее.
const MAX_ZONE_AHEAD_MS = 14 * 3_600_000;

export const latestTodayOnEarth = (now = Date.now()): string =>
  new Date(now + MAX_ZONE_AHEAD_MS).toISOString().slice(0, 10);

export const NotFutureDay = () =>
  ValidateBy({
    name: 'notFutureDay',
    validator: {
      validate: (v: unknown) =>
        typeof v === 'string' && v <= latestTodayOnEarth(),
      defaultMessage: () => '$property must not be in the future',
    },
  });
