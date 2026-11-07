// Строка «время уже заняли» в блоке «Деньги» /stats (правило №8; аудит 2026-10,
// находка r2-1#2). Запись отвечает 409, когда выбранное время уже занято. Это
// законно при гонке двух клиентов за одно время, поэтому смотрим не на факт, а
// на долю: попытки за 7 дней = созданные брони + отказы «занято». Высокая доля
// значит, что сайт предлагает занятое время (так было со слотами последнего
// дня окна записи). Отказ пишет createBookingGuarded серверным событием
// (booking-events.constants.ts). count через Prisma, не сырой SQL (правило №18).
// Язык простой: без «409» и «слот».

import { PrismaService } from '../prisma/prisma.service';
import { BOOKING_SLOT_TAKEN_EVENT } from '../analytics/booking-events.constants';
import { times } from './money-metrics.format';

/**
 * Порог подсветки. Законная гонка за одно время — редкость (на сайте с
 * единицами-десятками записей в неделю двое выбирают одно окно за те же
 * минуты раз в месяцы), поэтому два отказа за неделю при доле от 10% — уже
 * расхождение слотов, а не совпадение. Один отказ не подсвечивается.
 */
export const SLOT_TAKEN_ALERT = { minTaken: 2, share: 0.1 } as const;

export interface SlotTaken {
  /** Отказы «время уже заняли» за 7 дней. */
  taken: number;
  /** Созданные брони за 7 дней — попытки, дошедшие до записи. */
  created: number;
}

export async function countSlotTaken(
  prisma: PrismaService,
  now: number = Date.now(),
): Promise<SlotTaken> {
  const since = new Date(now - 7 * 86_400_000);
  const [taken, created] = await Promise.all([
    // userId = null: событие пишет только сервер; подделка через POST
    // /api/event приходит со своим userId и в счёт не попадает.
    prisma.analyticsEvent.count({
      where: {
        name: BOOKING_SLOT_TAKEN_EVENT,
        userId: null,
        createdAt: { gte: since },
      },
    }),
    prisma.booking.count({ where: { createdAt: { gte: since } } }),
  ]);
  return { taken, created };
}

/** Чистая функция. Попыток не было (в том числе пустая база) — строки нет. */
export function formatSlotTaken({ taken, created }: SlotTaken): string[] {
  const attempts = taken + created;
  if (attempts === 0) return [];
  const head = `Записаться пробовали за 7 дней: ${times(attempts)}`;
  if (taken === 0) return [`${head}; «время уже заняли» — ни разу.`];
  const share = taken / attempts;
  const line = `${head}; «время уже заняли» — ${times(taken)} (${Math.round(share * 100)}%).`;
  const alarm =
    taken >= SLOT_TAKEN_ALERT.minTaken && share >= SLOT_TAKEN_ALERT.share;
  if (!alarm) return [line];
  return [
    `⚠️ ${line}`,
    'Для случайного совпадения это часто: похоже, сайт предлагает уже занятое время. Стоит открыть запись и сверить свободные окна с расписанием.',
  ];
}
