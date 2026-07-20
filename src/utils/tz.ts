/** YYYY-MM-DD in the given IANA timezone */
export function localDate(tz: string, base = new Date()): string {
  return new Intl.DateTimeFormat('sv', { timeZone: tz }).format(base);
}

/**
 * Стенные часы в зоне tz → момент времени (UTC Date).
 *
 * Единственная реализация этого перевода в бэкенде — до 2026-07-20 их было
 * две, и вторая (localToUtc в src/booking/caldav-busy.ts) была сломана:
 * она разбирала отформатированную строку через `new Date(...)` БЕЗ суффикса
 * `Z`, поэтому строка читалась в локальной зоне процесса и в смещение
 * подмешивалось смещение сервера. Под TZ=UTC совпадало случайно, на любой
 * другой зоне смещение TZID терялось целиком. Отсюда суффикс `Z` ниже —
 * он не косметика, а суть: формат `sv` даёт «YYYY-MM-DD HH:mm:ss», и мы
 * обязаны прочитать его как UTC, чтобы зона процесса не участвовала.
 *
 * Строгая по зоне: неизвестный tz бросает RangeError (из Intl). Вызывающий
 * сам решает политику — notifyTimezone юзера валиден, а его невалидность это
 * баг, который должен всплыть; caldav же ловит ошибку и деградирует до
 * floating-времени (внешний календарь может прислать не-IANA TZID).
 *
 * @param localIso стенное время без зоны: `YYYY-MM-DD` или `YYYY-MM-DDTHH:mm:ss`
 * @param tz IANA-зона
 */
export function zonedWallClockToUtc(localIso: string, tz: string): Date {
  const naive = new Date(
    (localIso.includes('T') ? localIso : `${localIso}T00:00:00`) + 'Z',
  );
  const fmt = zoneFormatter(tz); // бросает RangeError на неизвестной зоне
  // Считаем стенные часы за UTC и вычитаем смещение зоны в этот момент.
  // Второй проход — на случай перехода на летнее время, когда смещение в
  // угаданный момент отличается от смещения в настоящий.
  const once = new Date(naive.getTime() - zoneOffsetMs(fmt, naive));
  return new Date(naive.getTime() - zoneOffsetMs(fmt, once));
}

/** UTC Date corresponding to midnight of localDateStr in timezone tz */
export function localMidnightUTC(localDateStr: string, tz: string): Date {
  return zonedWallClockToUtc(localDateStr, tz);
}

/** Смещение зоны в момент `at`, мс (восточнее UTC — положительное). */
function zoneOffsetMs(fmt: Intl.DateTimeFormat, at: Date): number {
  const wall = new Date(fmt.format(at).replace(' ', 'T') + 'Z');
  return wall.getTime() - at.getTime();
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

/** Кэширующий форматтер зоны. Бросает RangeError, если зона неизвестна. */
function zoneFormatter(tz: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(tz);
  if (cached) return cached;
  const fmt = new Intl.DateTimeFormat('sv', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  formatterCache.set(tz, fmt);
  return fmt;
}
