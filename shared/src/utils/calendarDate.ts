// Строки с датой приезжают из API в двух видах, и это разные сущности:
//
//   • момент времени — ISO с зоной: `2026-07-21T10:00:00.000Z`;
//   • календарный день — `2026-07-21`: ни времени, ни зоны в нём нет.
//
// Инцидент 2026-09-17: календарный день разбирался как `${at}T00:00:00` —
// без `Z`, то есть как полночь ЗОНЫ МАШИНЫ. На UTC+3 запись уезжала на три
// часа назад и выпадала из недельной выборки «Моего пути», под TZ=UTC всё
// сходилось — CI был зелёный, баг нашёл владелец на своей машине.
//
// Конвенция проекта: **календарный день = полночь UTC**, и читается он, и
// показывается в UTC. Причины: строка не несёт зоны, а данные у web и
// мини-аппа общие — один и тот же день обязан фильтроваться одинаково с
// телефона в Москве и с ноутбука в Лиссабоне. Тем же способом день уже
// сравнивался в sortJourneyItems и в бэкендовом journey.service.
//
// Момент времени остаётся моментом: его показывают в зоне читателя (её и
// имеет в виду пользователь, когда смотрит «во сколько это было»).

/** `YYYY-MM-DD` — календарный день без времени. */
const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isCalendarDate(value: string): boolean {
  return CALENDAR_DATE.test(value);
}

/**
 * Момент для сравнения и сортировки; `NaN` — нечитаемая строка.
 * Календарный день берётся полночью UTC, поэтому результат один в любой зоне.
 */
export function dateStringMs(value: string): number {
  return Date.parse(isCalendarDate(value) ? `${value}T00:00:00Z` : value);
}

/** Зона, в которой строку надо читать и показывать. */
function zoneOf(value: string): 'UTC' | undefined {
  return isCalendarDate(value) ? 'UTC' : undefined;
}

export interface DateStringParts {
  year: number;
  /** 1-12 (не 0-11, как у Date) */
  month: number;
  day: number;
  /** 0 — воскресенье, как у Date.getDay() */
  weekday: number;
}

/**
 * Календарные части строки в её собственной зоне: у дня — в UTC (день
 * остаётся собой), у момента — в зоне читателя. Нечитаемая строка — `null`.
 */
export function dateStringParts(value: string): DateStringParts | null {
  const ms = dateStringMs(value);
  if (Number.isNaN(ms)) return null;
  const d = new Date(ms);
  return isCalendarDate(value)
    ? {
        year: d.getUTCFullYear(),
        month: d.getUTCMonth() + 1,
        day: d.getUTCDate(),
        weekday: d.getUTCDay(),
      }
    : {
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        day: d.getDate(),
        weekday: d.getDay(),
      };
}

/**
 * Дата для показа. Нечитаемая строка — пустая строка, не «Invalid Date».
 * Календарный день форматируется в UTC: иначе на западных смещениях
 * `2026-07-14` показалось бы как 13 июля.
 */
export function formatDateString(
  value: string,
  options: Intl.DateTimeFormatOptions,
  locale = 'ru-RU',
): string {
  const ms = dateStringMs(value);
  if (Number.isNaN(ms)) return '';
  return new Date(ms).toLocaleDateString(locale, {
    timeZone: zoneOf(value),
    ...options,
  });
}

/**
 * Сегодняшний КАЛЕНДАРНЫЙ день — той же конвенции, что дни из API (полночь
 * UTC), поэтому сравнивать с `lastActiveDate`/датой сессии можно напрямую.
 *
 * НЕ то же, что `todayStr()` из format.ts: тот отдаёт локальную дату машины
 * и годится для «сегодня» в интерфейсе одного человека (заголовок, ключ
 * localStorage). Сравнивать его с календарным днём сервера нельзя: в зонах,
 * где локальная дата уже другая (UTC+10 после полудня UTC), совпадений не
 * будет вообще — дашборд «сегодня» у терапевта переставал рендериться.
 */
export function todayCalendarDate(): string {
  return new Date().toISOString().slice(0, 10);
}
