// Read busy intervals from the therapist's iCloud calendar via a CalDAV
// calendar-query REPORT, so slots that overlap real calendar events are hidden.
// Best-effort: recurring events (RRULE) are ignored; on any parse issue we
// simply return fewer/no intervals (fail-open — slots still show).

export interface Interval { start: Date; end: Date; }

export function busyQueryXml(from: Date, to: Date): string {
  const f = fmtUtc(from), t = fmtUtc(to);
  // <c:expand> asks the server to return each recurring event as concrete
  // instances within [from,to] (no RRULE), so weekly/repeating meetings count
  // as busy. If iCloud ignores expand it just returns the master event, which
  // we then skip — fail-open, no regression.
  return `<?xml version="1.0" encoding="utf-8"?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop><c:calendar-data><c:expand start="${f}" end="${t}"/></c:calendar-data></d:prop>
  <c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT">
    <c:time-range start="${f}" end="${t}"/>
  </c:comp-filter></c:comp-filter></c:filter>
</c:calendar-query>`;
}

/** Parse VEVENT DTSTART/DTEND pairs out of a CalDAV multistatus response. */
export function parseBusy(xml: string): Interval[] {
  const out: Interval[] = [];
  // Unfold iCal line continuations (RFC 5545: lines wrapped with CRLF + space).
  const text = xml.replace(/\r\n[ \t]/g, '').replace(/&#13;/g, '').replace(/&#10;/g, '\n');
  const events = text.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) ?? [];
  for (const ev of events) {
    if (/\nRRULE[:;]/.test(ev) || /^RRULE[:;]/.test(ev)) continue; // skip recurring (MVP)
    const start = findDate(ev, 'DTSTART');
    let end = findDate(ev, 'DTEND');
    if (!start) continue;
    if (!end) end = new Date(start.getTime() + 60 * 60_000); // default 1h
    out.push({ start, end });
  }
  return out;
}

function findDate(ev: string, field: 'DTSTART' | 'DTEND'): Date | null {
  const m = ev.match(new RegExp(`(?:^|\\n)${field}([^:\\n]*):([^\\r\\n]+)`));
  if (!m) return null;
  const params = m[1], value = m[2].trim();
  if (/^\d{8}$/.test(value)) {
    // All-day (VALUE=DATE) — treat the whole day as busy (UTC).
    const y = +value.slice(0, 4), mo = +value.slice(4, 6) - 1, d = +value.slice(6, 8);
    return new Date(Date.UTC(y, mo, d, 0, 0, 0));
  }
  const dt = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (!dt) return null;
  const [, Y, Mo, D, h, mi, s, z] = dt;
  if (z === 'Z') return new Date(`${Y}-${Mo}-${D}T${h}:${mi}:${s}.000Z`);
  const tzid = params.match(/TZID=([^;:]+)/)?.[1];
  if (tzid) return localToUtc(`${Y}-${Mo}-${D}T${h}:${mi}:${s}`, tzid);
  // Floating time — assume UTC (best effort).
  return new Date(`${Y}-${Mo}-${D}T${h}:${mi}:${s}.000Z`);
}

/** Local wall-clock (no Z) in tzid → UTC Date. */
function localToUtc(localIso: string, tz: string): Date {
  const naive = new Date(`${localIso}.000Z`);
  const local = new Date(naive.toLocaleString('en-US', { timeZone: tz }));
  const offset = naive.getTime() - local.getTime(); // (UTC - local) ms
  return new Date(naive.getTime() + offset);
}

function fmtUtc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}
