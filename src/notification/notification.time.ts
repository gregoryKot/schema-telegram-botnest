/**
 * Чистые хелперы времени/таймзон для системы уведомлений.
 * Единственный источник правды — раньше tzOffsetAt/localDateString дублировались
 * в telegram.schedule.service.ts и telegram.settings.service.ts.
 */

/** Смещение таймзоны в часах на момент date. */
export function tzOffsetAt(tz: string, date = new Date()): number {
  const utc = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const local = new Date(date.toLocaleString('en-US', { timeZone: tz }));
  return Math.round((local.getTime() - utc.getTime()) / 3_600_000);
}

/** Локальная дата YYYY-MM-DD в таймзоне tz. */
export function localDateString(tz: string, base = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(base);
}

/** YYYY-MM-DD + n дней (календарно, без таймзонных сюрпризов — полдень UTC как якорь). */
export function addDaysLocal(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** UTC-момент localHour:00 в таймзоне tz для локальной даты dateStr. DST-безопасно. */
export function utcInstantForLocalHour(
  dateStr: string,
  localHour: number,
  tz: string,
): Date {
  // Полдень как DST-безопасный якорь для вычисления смещения этой даты
  const noonRef = new Date(`${dateStr}T12:00:00.000Z`);
  const offset = tzOffsetAt(tz, noonRef);
  const d = new Date(
    `${dateStr}T${String(localHour).padStart(2, '0')}:00:00.000Z`,
  );
  d.setTime(d.getTime() - offset * 3_600_000);
  return d;
}

/** Ближайший будущий момент localHour:00 в таймзоне tz. Никогда не в прошлом. */
export function nextSendAt(
  localHour: number,
  tz: string,
  now = new Date(),
): Date {
  for (let daysAhead = 0; daysAhead <= 2; daysAhead++) {
    const probe = new Date(now.getTime() + daysAhead * 86_400_000);
    const candidate = utcInstantForLocalHour(
      localDateString(tz, probe),
      localHour,
      tz,
    );
    if (candidate > now) return candidate;
  }
  // Недостижимо при daysAhead<=2, но TypeScript должен видеть возврат
  return utcInstantForLocalHour(
    localDateString(tz, new Date(now.getTime() + 3 * 86_400_000)),
    localHour,
    tz,
  );
}

/**
 * Сейчас тихие часы? Окно [start, end) по локальному часу, поддерживает переход
 * через полночь (22–8). start === end означает «тихие часы выключены».
 */
export function isQuietHours(
  tz: string,
  start: number,
  end: number,
  now = new Date(),
): boolean {
  if (start === end) return false;
  const h =
    Number(
      new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour: 'numeric',
        hour12: false,
      }).format(now),
    ) % 24;
  return start > end ? h >= start || h < end : h >= start && h < end;
}

/** Ближайший будущий момент окончания тихих часов (endHour:00 локально). */
export function nextQuietEnd(
  tz: string,
  endHour: number,
  now = new Date(),
): Date {
  return nextSendAt(endHour, tz, now);
}
