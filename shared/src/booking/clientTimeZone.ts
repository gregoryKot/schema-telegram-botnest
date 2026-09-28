// Время слотов записи на консультацию — в часовом поясе ПОСЕТИТЕЛЯ, не МСК.
// Слот приходит с сервера моментом времени (ISO с зоной), поэтому его можно
// честно показать в любой зоне: момент времени показывается в зоне читателя
// (правило №25 CLAUDE.md — «Календарный день — полночь UTC», для момента
// это не про UTC, а про то, что зона читателя и есть его локальное время).
//
// Все функции здесь чистые (без React/DOM) — используются и в
// webapp/src/components/booking, и в бэкенд-форматтере уведомления админу
// (там своя копия словаря городов из-за tsconfig.build.json, см. комментарий
// в src/booking/client-timezone-names.ts).
import { cityLabel, isValidTimeZone } from '../utils/timeZoneNames';

const MSK = 'Europe/Moscow';

/** Определить часовой пояс посетителя; фолбэк — Europe/Moscow. */
export function resolveClientTimeZone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && isValidTimeZone(tz)) return tz;
  } catch {
    // Intl недоступен/бросил — берём фолбэк ниже.
  }
  return MSK;
}

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
 * Пояс посетителя — САМА Москва или её российский синоним (то же смещение,
 * та же страна), а не просто пояс, чьё СМЕЩЕНИЕ сейчас совпадает с
 * московским. Стамбул круглый год UTC+3, Израиль летом UTC+3 — оба дают
 * `isMoscowOffset === true`, но подпись «по московскому времени» посетителю
 * из Израиля не про его пояс, а про чужую страну (инцидент: найдено на
 * проде 2026-09-28). Волгоград/Киров/Симферополь — с 2014/2016/2018 гг. на
 * том же смещении, что Москва, но это по-прежнему Россия, а не совпадение.
 */
const MOSCOW_TIME_ZONES: readonly string[] = [
  'Europe/Moscow',
  'Europe/Simferopol',
  'Europe/Kirov',
  'Europe/Volgograd',
];

/** Пояс посетителя — сама Москва (или российский синоним), см. MOSCOW_TIME_ZONES выше. */
export function isMoscowTimeZone(tz: string): boolean {
  return MOSCOW_TIME_ZONES.includes(tz);
}

/** Календарный день слота в зоне `tz` — ключ для группировки (en-CA = YYYY-MM-DD). */
export function localDayKey(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

/** «Сегодня» / «Завтра» / «вт, 30 сент.» — в зоне `tz`, относительно `now`. */
export function localDayLabel(
  iso: string,
  tz: string,
  now: Date = new Date(),
): string {
  const key = localDayKey(iso, tz);
  if (key === localDayKey(now.toISOString(), tz)) return 'Сегодня';
  if (
    key === localDayKey(new Date(now.getTime() + 86_400_000).toISOString(), tz)
  )
    return 'Завтра';
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: tz,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(iso));
}

/** «19:00» — время слота в зоне `tz`. */
export function localTimeLabel(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

/** «19:00» по Москве — используется и как «второе» время под выбранным слотом. */
export function mskTimeLabel(iso: string): string {
  return localTimeLabel(iso, MSK);
}

/**
 * Подпись над лентой слотов: «Время указано по вашему часовому поясу
 * (Бангкок, UTC+7)» либо «Время указано по московскому времени», если
 * смещение зоны посетителя сейчас совпадает с московским.
 */
export function timeZoneCaption(tz: string, at: Date = new Date()): string {
  if (isMoscowTimeZone(tz)) return 'Время указано по московскому времени.';
  return `Время указано по вашему часовому поясу (${cityLabel(tz)}, ${offsetLabel(tz, at)}).`;
}

/** «(15:00 МСК)» рядом с выбранным слотом — пусто, только если зона и есть московская. */
export function mskHintLabel(iso: string, tz: string): string {
  if (isMoscowTimeZone(tz)) return '';
  return `(${mskTimeLabel(iso)} МСК)`;
}

/** Хвост кнопки отправки: «по вашему времени» либо «МСК» (только для московского пояса). */
export function submitTimeSuffix(tz: string): string {
  return isMoscowTimeZone(tz) ? 'МСК' : 'по вашему времени';
}

/**
 * Группирует слоты по календарному дню в зоне `tz`, сохраняя хронологический
 * порядок появления — тот же слот в UTC+7 может уехать на другой день, чем
 * в МСК (23:30 МСК = следующие сутки в Бангкоке).
 */
export function groupByLocalDay<T extends { startsAt: string }>(
  items: readonly T[],
  tz: string,
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = localDayKey(item.startsAt, tz);
    (map.get(key) ?? map.set(key, []).get(key)!).push(item);
  }
  return map;
}
