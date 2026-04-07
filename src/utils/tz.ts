/** YYYY-MM-DD in the given IANA timezone */
export function localDate(tz: string, base = new Date()): string {
  return new Intl.DateTimeFormat('sv', { timeZone: tz }).format(base);
}

/** UTC Date corresponding to midnight of localDateStr in timezone tz */
export function localMidnightUTC(localDateStr: string, tz: string): Date {
  const utcMidnight = new Date(localDateStr + 'T00:00:00Z');
  const localStr = new Intl.DateTimeFormat('sv', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(utcMidnight).replace(' ', 'T') + 'Z';
  const offsetMs = new Date(localStr).getTime() - utcMidnight.getTime();
  return new Date(utcMidnight.getTime() - offsetMs);
}
