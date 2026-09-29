import { SessionType } from '@prisma/client';

// CalDAV transports events as iCalendar (RFC 5545) documents — pushing an event
// to iCloud means PUTting a VCALENDAR/VEVENT body over HTTP. This builder
// produces that body. It is NOT a calendar subscription feed.

export interface CalEvent {
  uid: string;
  startsAt: Date;
  durationMin: number;
  summary: string;
  description?: string;
  location?: string;
  organizerEmail?: string;
  /** URL-свойство события (RFC 5545 §3.8.4.6) — ссылка «подробнее» в клиенте календаря. */
  url?: string;
  /** Напоминание за N минут до начала (VALARM DISPLAY). */
  alarmMinutesBefore?: number;
}

/** Build the VCALENDAR/VEVENT body that CalDAV PUTs to iCloud (RFC 5545). */
export function buildVcalendar(
  events: CalEvent[],
  calName = 'Запись на сессии',
): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//schemehappens//booking//RU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calName)}`,
  ];
  for (const ev of events) lines.push(...buildVevent(ev));
  lines.push('END:VCALENDAR');
  // RFC 5545 requires CRLF line endings и «складывание» строк длиннее 75
  // октетов (§3.1) — продолжение начинается с одного пробела.
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

function buildVevent(ev: CalEvent): string[] {
  const end = new Date(ev.startsAt.getTime() + ev.durationMin * 60_000);
  const out = [
    'BEGIN:VEVENT',
    `UID:${ev.uid}`,
    `DTSTAMP:${fmtUtc(new Date())}`,
    `DTSTART:${fmtUtc(ev.startsAt)}`,
    `DTEND:${fmtUtc(end)}`,
    `SUMMARY:${escapeText(ev.summary)}`,
  ];
  if (ev.description) out.push(`DESCRIPTION:${escapeText(ev.description)}`);
  if (ev.location) out.push(`LOCATION:${escapeText(ev.location)}`);
  if (ev.organizerEmail) out.push(`ORGANIZER:mailto:${ev.organizerEmail}`);
  if (ev.url) out.push(`URL:${escapeText(ev.url)}`);
  if (ev.alarmMinutesBefore != null)
    out.push(...buildValarm(ev.alarmMinutesBefore));
  out.push('END:VEVENT');
  return out;
}

function buildValarm(minutesBefore: number): string[] {
  return [
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Напоминание о встрече',
    `TRIGGER:-PT${Math.max(0, Math.round(minutesBefore))}M`,
    'END:VALARM',
  ];
}

// RFC 5545 §3.1: content line SHOULD be folded at 75 octets (UTF-8 byte
// length, not char length — a multi-byte char is never split mid-codepoint).
// Continuation lines are re-joined with CRLF + a single leading space.
function foldLine(line: string): string {
  if (Buffer.byteLength(line, 'utf8') <= 75) return line;
  const parts: string[] = [];
  let chunk = '';
  let chunkBytes = 0;
  for (const ch of line) {
    const chBytes = Buffer.byteLength(ch, 'utf8');
    const limit = parts.length === 0 ? 75 : 74; // continuation reserves 1 octet for the leading space
    if (chunkBytes + chBytes > limit) {
      parts.push(chunk);
      chunk = '';
      chunkBytes = 0;
    }
    chunk += ch;
    chunkBytes += chBytes;
  }
  if (chunk) parts.push(chunk);
  return parts.join('\r\n ');
}

/** YYYYMMDDTHHMMSSZ in UTC */
function fmtUtc(d: Date): string {
  return d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

/** Escape per RFC 5545: backslash, comma, semicolon, newline */
function escapeText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

export function sessionLabel(type: SessionType): string {
  return type === SessionType.INTRO_15
    ? 'Знакомство (15 мин)'
    : 'Сессия (50 мин)';
}
