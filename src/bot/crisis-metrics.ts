import type { PrismaService } from '../prisma/prisma.service';

export interface CrisisMetrics {
  shown: number;
  hotlineTapped: number;
  /** То же, но только из формы записи на консультацию (surface = booking). */
  booking: { shown: number; hotlineTapped: number };
}

/** Экран формы записи на консультацию (CRISIS_SURFACES) — отдельная строка отчёта. */
const BOOKING_SURFACE = 'booking';

/**
 * Показы кризисной карточки и нажатия на телефон доверия за период — всего и
 * отдельно из формы записи на консультацию (правило №8): без разбивки не видно,
 * сколько людей пишут о тяжёлом в заявке, а не в дневниках. Фильтр по meta —
 * через Prisma (JSON path), сырого SQL нет.
 */
export async function countCrisis(
  prisma: Pick<PrismaService, 'analyticsEvent'>,
  since: Date,
): Promise<CrisisMetrics> {
  const ev = (name: string, surface?: string) =>
    prisma.analyticsEvent.count({
      where: {
        name,
        createdAt: { gte: since },
        ...(surface && { meta: { path: ['surface'], equals: surface } }),
      },
    });
  const [shown, hotlineTapped, bookingShown, bookingTapped] = await Promise.all(
    [
      ev('crisis_card_shown'),
      ev('crisis_hotline_tapped'),
      ev('crisis_card_shown', BOOKING_SURFACE),
      ev('crisis_hotline_tapped', BOOKING_SURFACE),
    ],
  );
  return {
    shown,
    hotlineTapped,
    booking: { shown: bookingShown, hotlineTapped: bookingTapped },
  };
}
