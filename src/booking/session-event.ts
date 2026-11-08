import { SessionType } from '@prisma/client';
import { SESSION_META } from './booking.config';

/**
 * Длина события сессии: в календаре владельца (CalDAV), в .ics клиента и на
 * странице записи. Решение владельца Р6 (2026-11-08): знакомство длится
 * столько, сколько обещает подпись в SESSION_META («15 минут»), а начинается
 * по прежней сетке. Слот сетки знакомство занимает целиком: занятость считают
 * по Booking.durationMin — длине слота правила (slot-filters.ts,
 * booking.availability.ts), и это число здесь не меняется. Короче слота
 * событие быть может, длиннее — нет.
 */
export function eventDurationMin(b: {
  type: SessionType;
  durationMin: number;
}): number {
  const meta = SESSION_META.find((m) => m.type === b.type);
  if (b.type !== SessionType.INTRO_15 || !meta) return b.durationMin;
  return Math.min(meta.durationMin, b.durationMin);
}
