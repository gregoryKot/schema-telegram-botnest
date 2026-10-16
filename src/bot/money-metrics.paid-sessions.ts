// «Оплатили сессию» в /stats (находка аудита 2026-10-11): раньше считали все
// CONFIRMED+COMPLETED по статусу, то есть и бесплатные знакомства (INTRO_15
// рождается сразу CONFIRMED), и брони, подтверждённые руками админа или
// dev-автоподтверждением. Три знакомства за неделю выглядели как «Оплатили
// сессию: 3 раза». Источник правды «деньги пришли» — Booking.paidAt: его
// ставят только подписанный вебхук и paymentAfterCancel.
//
// Окно «за неделю» — по paidAt (когда заплатили), не по createdAt.
// CANCELLED + paidAt («деньги после отмены») тоже в счёте: деньги получены,
// владельцу о них уже ушёл DM. Если нужно иначе — один фильтр по status.
//
// История до учёта: до PAID_AT_TRACKED_SINCE paidAt пуст даже там, где деньги
// пришли, и счёт «только по paidAt» молча обнулил бы строку «За всё время».
// Для броней, созданных до границы, остаётся прежнее правило (CONFIRMED или
// COMPLETED), но без знакомств. Платные брони, подтверждённые руками до
// 15.10, в счёте останутся — отличить их от вебхука уже нечем; бэкфилла paidAt
// нет (факта оплаты нет, а проба robokassa читает max(paidAt)).

import { BookingStatus, Prisma, SessionType } from '@prisma/client';
import { PAID_AT_TRACKED_SINCE } from '../booking/booking-paid-at';
import { PrismaService } from '../prisma/prisma.service';

/** Условие «платная сессия оплачена» для окна (без `since` — за всё время). */
export function paidSessionsWhere(since?: Date): Prisma.BookingWhereInput {
  return {
    OR: [
      { paidAt: since ? { gte: since } : { not: null } },
      {
        paidAt: null,
        status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
        type: { not: SessionType.INTRO_15 },
        createdAt: since
          ? { gte: since, lt: PAID_AT_TRACKED_SINCE }
          : { lt: PAID_AT_TRACKED_SINCE },
      },
    ],
  };
}

/** count через Prisma, не сырой SQL (правило №18). */
export function countPaidSessions(
  prisma: PrismaService,
  since?: Date,
): Promise<number> {
  return prisma.booking.count({ where: paidSessionsWhere(since) });
}
