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
  // RFC 5545 requires CRLF line endings
  return lines.join('\r\n') + '\r\n';
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
  out.push('END:VEVENT');
  return out;
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
