// Второй рубеж против записи поверх личного события владельца (аудит 2026-10).
// CALENDAR_BLOCK_SLOTS прячет занятые в календаре часы из выдачи слотов
// (slot.service.ts), но слот, выданный до появления события, или прямой POST
// мимо выдачи ложились поверх события: book() сверялся только с бронями.
//
// Проверка стоит ДО advisory-lock бронирования (booking.create.ts): лок
// защищает от гонки двух броней, а событие в iCloud создаёт не наш код —
// держать лок и транзакцию на время запроса в iCloud незачем. Занятость
// берётся из общего кэша CalDavService (одно окно раз в 60 с,
// caldav-busy-cache.ts): клиент только что видел слоты, кэш обычно тёплый.
//
// Fail-open — осознанное решение: календарь упал (getBusyTimes сам отдаёт []
// и открывает аварию в caldav-health.ts) или не ответил за таймаут — запись
// проходит, в лог warn. Воронка записи не зависит от iCloud, как и выдача слотов.
import { ConflictException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Interval } from './caldav-busy';
import { overlapsInterval } from './slot-filters';

export const CALENDAR_CHECK_TIMEOUT_MS = 3_000;

export interface CalendarBusySource {
  getBusyTimes(from: Date, to: Date): Promise<Interval[]>;
}

/** Источник занятости для book(): только при CALENDAR_BLOCK_SLOTS=true. */
export function calendarGuard(
  config: Pick<ConfigService, 'get'>,
  calDav: CalendarBusySource | undefined,
): CalendarBusySource | undefined {
  return config.get<string>('CALENDAR_BLOCK_SLOTS') === 'true'
    ? calDav
    : undefined;
}

/** 409 «Slot already taken» (тот же текст, что у пересечения с бронью),
 * если слот пересекает событие календаря; сбой или таймаут — пропуск с warn.
 * Без источника (флаг выключен) — ничего не делает. */
export async function assertCalendarFree(
  cal: CalendarBusySource | undefined,
  slot: { startsAt: Date; durationMin: number },
  logger: Logger,
): Promise<void> {
  if (!cal) return;
  const { startsAt } = slot;
  const endsAt = new Date(startsAt.getTime() + slot.durationMin * 60_000);
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`timeout ${CALENDAR_CHECK_TIMEOUT_MS} ms`)),
      CALENDAR_CHECK_TIMEOUT_MS,
    );
  });
  let busy: Interval[];
  try {
    busy = await Promise.race([cal.getBusyTimes(startsAt, endsAt), timeout]);
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    logger.warn(`Calendar check skipped, booking proceeds: ${reason}`);
    return;
  } finally {
    clearTimeout(timer);
  }
  if (overlapsInterval(startsAt, endsAt, busy))
    throw new ConflictException('Slot already taken');
}
