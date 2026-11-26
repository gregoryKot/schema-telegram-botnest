// Конец VEVENT для занятости календаря — RFC 5545 §3.6.1 и §3.8.2.5.
// Событие описывает конец одним из способов: DTEND или DURATION. Без обоих
// событие на весь день (DTSTART;VALUE=DATE) длится сутки, а событие со
// временем по стандарту нулевое — для занятости берём час (fail-closed).
import { zonedWallClockToUtc } from '../utils/tz';

const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;

// dur-value: P{n}W либо P{n}D[T{n}H{n}M{n}S] либо PT…; знак «-» не принимается.
const DURATION_RE =
  /^\+?P(?:(\d+)W|(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?)$/;

/** Длительность iCal: дни (W×7 + D, номинальные) и точная часть H/M/S в мс;
 * null — нет поля, мусор, отрицательная или нулевая. */
function readDuration(ev: string): { days: number; ms: number } | null {
  const m = ev.match(/(?:^|\n)DURATION[^:\n]*:([^\r\n]+)/);
  const p = m?.[1].trim().match(DURATION_RE);
  if (!p) return null;
  const [, w, d, h, mi, s] = p.map((x) => (x === undefined ? 0 : +x));
  const days = w * 7 + d;
  const ms = h * HOUR_MS + mi * 60_000 + s * 1000;
  return days * DAY_MS + ms > 0 ? { days, ms } : null;
}

function isAllDay(ev: string): boolean {
  return /(?:^|\n)DTSTART[^:\n]*:\s*\d{8}\s*(?:\r|\n|$)/.test(ev);
}

// Вложенные компоненты (VALARM, RFC 5545 §3.6.6) — не свойства события: их
// DURATION — пауза между напоминаниями, SUMMARY — тема письма-напоминания.
export function ownProps(ev: string): string {
  return ev.replace(/BEGIN:VALARM[\s\S]*?END:VALARM/g, '');
}

// День DURATION номинальный (RFC 5545 §3.3.6): в день перевода часов P1D —
// 23 или 25 часов. Дни прибавляются к стенному времени DTSTART в зоне TZID;
// без зоны (UTC, floating, весь день) сутки — ровно 24 часа.
function addDays(ev: string, start: Date, days: number, tzid?: string): Date {
  const exact = new Date(start.getTime() + days * DAY_MS);
  const wall = ev.match(
    /(?:^|\n)DTSTART[^:\n]*:(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})\s*(?:\r|\n|$)/,
  );
  if (!tzid || !days || !wall) return exact;
  const [Y, Mo, D, h, mi, s] = wall.slice(1).map(Number);
  try {
    const shifted = new Date(Date.UTC(Y, Mo - 1, D + days, h, mi, s));
    return zonedWallClockToUtc(shifted.toISOString().slice(0, 19), tzid);
  } catch {
    return exact; // не-IANA TZID (старт уже floating) или дата вне Date
  }
}

/** Конец события: DTEND, иначе DTSTART + DURATION (дни — в зоне `tzid`),
 * иначе сутки (дата) или час. */
export function eventEnd(
  ev: string,
  start: Date,
  dtend: Date | null,
  tzid?: string,
): Date {
  if (dtend) return dtend;
  const own = ownProps(ev);
  const fallback = new Date(
    start.getTime() + (isAllDay(own) ? DAY_MS : HOUR_MS),
  );
  const dur = readDuration(own);
  if (!dur) return fallback;
  const end = new Date(addDays(own, start, dur.days, tzid).getTime() + dur.ms);
  // P99999999999999999999W конечно в мс, но не помещается в Date: не теряем событие.
  return Number.isFinite(end.getTime()) ? end : fallback;
}
