// Смещение пояса и местное время суток — в минутах, через Intl (E12, аудит
// 2026-11). Раньше смещение считалось в часах с Math.round: у Asia/Kolkata
// (+5:30) выходило +6, конец тихих часов 08:00 превращался в 07:30 местного,
// очередь в 07:30 снова видела «тихо» и переносила на завтра 07:30 — отложенное
// тихими часами не приходило никогда. Индия, Непал (+5:45), Иран, Ньюфаундленд,
// Южная Австралия живут не по целому часу.

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    formatters.set(tz, f);
  }
  return f;
}

/** Настенные часы в поясе tz на момент date. */
function wallClock(tz: string, date: Date) {
  const parts = formatterFor(tz).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour') % 24,
    minute: get('minute'),
    second: get('second'),
  };
}

/** Смещение пояса tz от UTC в минутах на момент date (Asia/Kolkata = 330). */
export function tzOffsetMinutes(tz: string, date = new Date()): number {
  const w = wallClock(tz, date);
  const wallAsUtc = Date.UTC(
    w.year,
    w.month - 1,
    w.day,
    w.hour,
    w.minute,
    w.second,
  );
  // Настенные часы — с точностью до секунды; момент приводим к ней же.
  const instant = Math.floor(date.getTime() / 1000) * 1000;
  return (wallAsUtc - instant) / 60_000;
}

/** Минута местных суток 0…1439 в поясе tz на момент date. */
export function localMinutesOfDay(tz: string, date = new Date()): number {
  const w = wallClock(tz, date);
  return w.hour * 60 + w.minute;
}

/** Подпись смещения для экранов бота: «UTC+3», «UTC+5:30», «UTC-3:30». */
export function utcOffsetLabel(tz: string, date = new Date()): string {
  const minutes = tzOffsetMinutes(tz, date);
  const abs = Math.abs(minutes);
  const rest = abs % 60;
  const tail = rest ? `:${String(rest).padStart(2, '0')}` : '';
  return `UTC${minutes < 0 ? '-' : '+'}${Math.floor(abs / 60)}${tail}`;
}
