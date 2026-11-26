// Момент события «завтра в N часов» для листа плана: им пользуются и .ics
// (ics.ts), и ссылка «Google Календарь» (PlanConfirm webapp) — одно событие.
const HOUR_MS = 3_600_000;

/**
 * Начало события «завтра в localHour» по поясу человека (мс UTC). «Завтра» —
 * от МЕСТНОГО дня человека: раньше день брался из UTC-полей устройства, и
 * после местной полуночи в Москве событие вставало на сегодня, а в Сиднее —
 * на послезавтра (правило №25). null — 09:00 местного.
 */
export function planEventStartMs(
  localHour: number | null,
  tzOffset: number,
  now: Date = new Date(),
): number {
  const local = new Date(now.getTime() + tzOffset * HOUR_MS); // UTC-поля = местные
  const day = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate() + 1,
  );
  return day + ((localHour ?? 9) - tzOffset) * HOUR_MS;
}
