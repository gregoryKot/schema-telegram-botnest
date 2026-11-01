// Момент времени — вторая половина конвенции из utils/calendarDate.ts, и
// ломается она зеркально.
//
// Инцидент 2026-09-17: КАЛЕНДАРНЫЙ ДЕНЬ (`2026-07-21`) читали локальной
// полночью — день уезжал на смещение зоны. Здесь наоборот: МОМЕНТ
// (`2026-09-18T23:30:00.000Z`) резали строкой — `iso.slice(0, 10)` даёт
// ГРИНВИЧСКИЙ день, а сравнивали его с локальным `todayStr()`. Восточнее UTC
// после ~14:00 по Гринвичу дни расходятся: запись, сделанную минуту назад,
// экран подписывал вчерашней датой вместо «Сегодня». Тем же срезом
// (`iso.slice(11, 16)`) показывали время — у человека в Москве запись,
// сделанная в 22:30, была подписана «19:30».
//
// Правило: момент остаётся моментом и показывается в ЗОНЕ ЧИТАТЕЛЯ — её он и
// имеет в виду, когда смотрит «во сколько это было». Календарный день, у
// которого зоны нет, остаётся собой. «Сегодня ли» (QA 2026-10-26): здесь
// сверяются дни самого человека — оценки (по его зоне) и записи дневника,
// поэтому «сегодня» местное и для момента, и для дня; со днём UTC в 00:10 по
// Москве сегодняшняя запись была «вчера». Дню, посчитанному сервером в UTC,
// нужен todayCalendarDate (calendarDate.ts).
import { isCalendarDate } from './calendarDate';
import { fmtDate, localDateStr, todayStr } from './format';

/**
 * `YYYY-MM-DD` строки в её собственной системе координат: календарный день
 * возвращается как есть (он уже UTC), момент — днём зоны читателя.
 * Нечитаемая строка — пустая, не «Invalid Date».
 */
export function momentDayKey(value: string): string {
  if (isCalendarDate(value)) return value;
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return '';
  return localDateStr(new Date(ms));
}

/**
 * Сегодня ли эта строка у того, кто смотрит: момент — его днём, календарный
 * день — как есть; оба сверяются с его местным «сегодня».
 */
export function momentIsToday(value: string, now: Date = new Date()): boolean {
  const key = momentDayKey(value);
  return key !== '' && key === todayStr(now);
}

/** Подпись дня: «Сегодня» либо дата («18 сен»). Нечитаемая строка — пустая. */
export function momentDayLabel(value: string): string {
  if (momentIsToday(value)) return 'Сегодня';
  const key = momentDayKey(value);
  return key ? fmtDate(key) : '';
}

/**
 * Время момента в зоне читателя — «22:30», а не гринвичский срез.
 * У календарного дня времени нет, поэтому для него — пустая строка.
 */
export function momentTime(value: string): string {
  if (isCalendarDate(value)) return '';
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return '';
  return new Date(ms).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
