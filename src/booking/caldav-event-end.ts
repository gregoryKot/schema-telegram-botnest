// Конец VEVENT для занятости календаря — RFC 5545 §3.6.1 и §3.8.2.5.
// Событие описывает конец одним из способов: DTEND или DURATION. Без обоих
// событие на весь день (DTSTART;VALUE=DATE) длится сутки, а событие со
// временем по стандарту нулевое — для занятости берём час (fail-closed).

const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;

// dur-value: P{n}W либо P{n}D[T{n}H{n}M{n}S] либо PT…; знак «-» не принимается.
const DURATION_RE =
  /^\+?P(?:(\d+)W|(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?)$/;

/** Длительность iCal в мс; null — нет поля, мусор, отрицательная или нулевая. */
export function readDurationMs(ev: string): number | null {
  const m = ev.match(/(?:^|\n)DURATION[^:\n]*:([^\r\n]+)/);
  const p = m?.[1].trim().match(DURATION_RE);
  if (!p) return null;
  const [, w, d, h, mi, s] = p.map((x) => (x === undefined ? 0 : +x));
  const ms = w * 7 * DAY_MS + d * DAY_MS + h * HOUR_MS + mi * 60_000 + s * 1000;
  return ms > 0 ? ms : null;
}

function isAllDay(ev: string): boolean {
  return /(?:^|\n)DTSTART[^:\n]*:\s*\d{8}\s*(?:\r|\n|$)/.test(ev);
}

/** Конец события: DTEND, иначе DTSTART + DURATION, иначе сутки (дата) или час. */
export function eventEnd(ev: string, start: Date, dtend: Date | null): Date {
  if (dtend) return dtend;
  const ms = readDurationMs(ev) ?? (isAllDay(ev) ? DAY_MS : HOUR_MS);
  return new Date(start.getTime() + ms);
}
