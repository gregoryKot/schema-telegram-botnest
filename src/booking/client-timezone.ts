// Часовой пояс посетителя, пришедший в BookDto.clientTimeZone (IANA, напр.
// "Asia/Bangkok") — используется, чтобы уведомление админу о брони показывало
// и местное время клиента, не только МСК.
//
// Копия словаря городов и офсет-логики из shared/src/booking/clientTimeZone.ts
// и shared/src/utils/timeZoneNames.ts, а НЕ импорт оттуда: backend
// tsconfig.build.json (rootDir: "./src", exclude: ["shared", …]) не даёт
// импортировать файлы вне rootDir — `tsc --noEmit -p tsconfig.build.json`
// упал бы с TS6059 ("File is not under rootDir"), а backend src/ сейчас
// вообще не импортирует ничего из shared/. Расширять rootDir ради одного
// модуля — более рискованное изменение, чем поддерживать синхронизацию
// тестом: `client-timezone.sync.spec.ts` подгружает оба файла и сверяет
// словари и результаты офсет-функций на контрольных зонах (тот же приём,
// что у пула фраз канала — healthy-adult.data.ts ↔ живой пул, правило
// «сида в миграции» CLAUDE.md).
import { isValidTimeZone, cityLabel } from './client-timezone-names';

const MSK = 'Europe/Moscow';

export { isValidTimeZone, cityLabel };

/** Смещение зоны от UTC в минутах в момент `at` (учитывает DST на эту дату). */
export function offsetMinutes(tz: string, at: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(at)) parts[p.type] = p.value;
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/** «UTC+7», «UTC+5:30», «UTC+0», «UTC-8». */
export function offsetLabel(tz: string, at: Date): string {
  const minutes = offsetMinutes(tz, at);
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `UTC${sign}${h}${m ? ':' + String(m).padStart(2, '0') : ''}`;
}

/** Смещение зоны посетителя в момент `at` совпадает со смещением Москвы. */
export function isMoscowOffset(tz: string, at: Date): boolean {
  return offsetMinutes(tz, at) === offsetMinutes(MSK, at);
}

/**
 * Пояс — САМА Москва или её российский синоним, а не любой пояс с сейчас
 * совпадающим смещением (Израиль летом тоже UTC+3, но это не Москва) — см.
 * комментарий у MOSCOW_TIME_ZONES в shared/src/booking/clientTimeZone.ts,
 * копия синхронизируется client-timezone.sync.spec.ts.
 */
const MOSCOW_TIME_ZONES: readonly string[] = [
  'Europe/Moscow',
  'Europe/Simferopol',
  'Europe/Kirov',
  'Europe/Volgograd',
];

export function isMoscowTimeZone(tz: string): boolean {
  return MOSCOW_TIME_ZONES.includes(tz);
}

/** «19:00» — время в зоне `tz`. */
export function localTimeLabel(at: Date, tz: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
  }).format(at);
}

/**
 * Строка «у клиента» для уведомления админу: «у клиента 19:00 (Бангкок,
 * UTC+7)». `null`, если пояс не задан/невалиден/и есть Москва (или её
 * российский синоним) — тогда сообщение выглядит как раньше (только МСК).
 * Для чужого пояса с совпадающим смещением (Стамбул, Израиль летом) строка
 * всё равно показывается — офсет случайно совпал, но время «у клиента»
 * всё ещё стоит подтвердить явно.
 */
export function clientTimeLine(
  at: Date,
  clientTz: string | null | undefined,
): string | null {
  if (!clientTz || !isValidTimeZone(clientTz) || isMoscowTimeZone(clientTz))
    return null;
  return `у клиента ${localTimeLabel(at, clientTz)} (${cityLabel(clientTz)}, ${offsetLabel(clientTz, at)})`;
}
