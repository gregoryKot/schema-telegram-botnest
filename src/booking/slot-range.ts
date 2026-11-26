import { BadRequestException } from '@nestjs/common';
import { isCalendarDay } from '../utils/calendar-day';

// Диапазон публичного GET /api/booking/slots и окно занятости календаря, из
// которого нарезаются ответы, — одно определение (правило №4): окно обязано
// покрывать любой диапазон, который пропускает ручка. Аудит 2026-11, S17:
// каждая новая пара дат делала новый REPORT в iCloud; теперь ручка пускает
// только диапазоны внутри окна, а окно читается раз в 60 с
// (caldav-busy-cache.ts).

const DAY_MS = 86_400_000;

/**
 * «Сегодня» клиента западнее UTC — ещё вчерашний день UTC (правило №25:
 * календарный день — полночь UTC, «сегодня» у каждого своё), поэтому `from`
 * на сутки раньше сегодняшнего UTC-дня — не прошлое.
 */
export const SLOTS_PAST_GRACE_DAYS = 1;

/**
 * Насколько вперёд видна запись: квартал, как потолок длины диапазона (D1,
 * аудит 2026-08). Форма записи просит две недели; дальше — только руками.
 */
export const SLOTS_HORIZON_DAYS = 92;

/** Окно по умолчанию, когда `to` не задан. */
const DEFAULT_SPAN_DAYS = 14;

/** Полночь UTC дня момента `ms`. */
function utcDay(ms: number): number {
  return Math.floor(ms / DAY_MS) * DAY_MS;
}

/**
 * Окно занятости на «сейчас»: [вчера 00:00Z, сегодня + горизонт + 1 сутки) —
 * целые UTC-сутки, как окно слотов (slot-window.ts), до конца последнего
 * разрешённого дня.
 */
export function slotsBusyWindow(now: number): { from: Date; to: Date } {
  const today = utcDay(now);
  return {
    from: new Date(today - SLOTS_PAST_GRACE_DAYS * DAY_MS),
    to: new Date(today + (SLOTS_HORIZON_DAYS + 1) * DAY_MS),
  };
}

// L11 аудита 2026-08: сырой query-параметр уходил в new Date() и на кривой
// строке давал Invalid Date → Prisma 500 на неавторизованном GET. Пускаем
// только настоящий день YYYY-MM-DD (calendar-day.ts: `2026-11-31` — 400, а не
// 1 декабря; полночь UTC, правило №25); пусто → null (дефолт вызывающего).
function parseSlotDate(v: string | undefined): Date | null {
  if (!v) return null;
  if (!isCalendarDay(v))
    throw new BadRequestException('Некорректная дата, ожидается YYYY-MM-DD');
  return new Date(`${v}T00:00:00Z`);
}

/**
 * Диапазон публичной выдачи слотов из query. `from` по умолчанию — сейчас,
 * `to` — плюс две недели (не дальше горизонта). 400: дата не YYYY-MM-DD,
 * `from` в прошлом (раньше вчерашнего UTC-дня), `to` раньше `from`, день за
 * горизонтом записи.
 */
export function resolveSlotRange(
  fromRaw: string | undefined,
  toRaw: string | undefined,
  now = Date.now(),
): { from: Date; to: Date } {
  const win = slotsBusyWindow(now);
  const lastMs = win.to.getTime() - 1;
  const from = parseSlotDate(fromRaw) ?? new Date(now);
  if (from < win.from)
    throw new BadRequestException('Начало диапазона уже прошло');
  if (from.getTime() > lastMs)
    throw new BadRequestException(
      `Запись открыта на ${SLOTS_HORIZON_DAYS} дня вперёд`,
    );
  const to =
    parseSlotDate(toRaw) ??
    new Date(Math.min(from.getTime() + DEFAULT_SPAN_DAYS * DAY_MS, lastMs));
  if (utcDay(to.getTime()) < utcDay(from.getTime()))
    throw new BadRequestException('Конец диапазона раньше начала');
  if (to.getTime() > lastMs)
    throw new BadRequestException(
      `Запись открыта на ${SLOTS_HORIZON_DAYS} дня вперёд`,
    );
  return { from, to };
}
