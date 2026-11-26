import { localDate, zonedWallClockToUtc } from '../utils/tz';
import { shiftDay } from '../bot/bot.activity-streak';

// План практики и его напоминание (E11 аудита 2026-11). План ставится на
// завтрашний день человека по его поясу, а момент напоминания брался от
// UTC-даты сервера: `setUTCDate(+1)` + час UTC. В Москве план, созданный в
// 00:00–02:59, напоминал на день раньше (в UTC ещё вчера), во Владивостоке
// «Утром» (9 местного = 23 UTC) — на день позже. Теперь момент — стенные часы
// дня плана в поясе человека.

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** День плана — завтра по календарю человека (пояс `tz`). */
export function planDay(tz: string, now = new Date()): string {
  return shiftDay(localDate(tz, now), 1);
}

export interface PlanReminderHour {
  /** Час по поясу человека — его шлёт клиент после E11. */
  localHour?: number | null;
  /** Час UTC — так слали клиенты до E11; принимается на переходный срок. */
  utcHour?: number | null;
}

/**
 * Момент напоминания для плана на день `day` (местный день в поясе `tz`);
 * `null` — без напоминания. Пришли оба часа — главный местный.
 */
export function planReminderAt(
  day: string,
  tz: string,
  hour: PlanReminderHour,
): Date | null {
  if (typeof hour.localHour === 'number') {
    const hh = String(hour.localHour).padStart(2, '0');
    return zonedWallClockToUtc(`${day}T${hh}:00:00`, tz);
  }
  if (typeof hour.utcHour !== 'number') return null;
  // Старый клиент перевёл местный час в UTC сам. Из моментов с этим часом UTC
  // берём тот, что приходится на день плана в поясе человека.
  const base = Date.parse(`${day}T00:00:00Z`) + hour.utcHour * HOUR_MS;
  const candidates = [0, -1, 1].map((d) => new Date(base + d * DAY_MS));
  return candidates.find((at) => localDate(tz, at) === day) ?? candidates[0];
}
