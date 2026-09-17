import { Injectable } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  MoneyMetrics,
  MoneySourceStats,
  MoneyWindow,
  formatMoneyMetrics,
} from './money-metrics.format';

type StatusCountSum = {
  status: string;
  _count: { _all: number };
  _sum: { amount: number | null };
};
type StatusCount = { status: BookingStatus; _count: { _all: number } };

// Счётчики денег для /stats: донаты, подписка, платные сессии. Свой домен —
// свой файл (правило №10), образец — account-link-metrics.service.ts.
@Injectable()
export class MoneyMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Готовый текстовый блок для /stats. */
  async render(): Promise<string> {
    return formatMoneyMetrics(await this.getMetrics());
  }

  async getMetrics(): Promise<MoneyMetrics> {
    const since7 = new Date(Date.now() - 7 * 86_400_000);
    const [week, allTime] = await Promise.all([
      this.window(since7),
      this.window(undefined),
    ]);
    return { week, allTime };
  }

  private async window(since?: Date): Promise<MoneyWindow> {
    const where = since ? { createdAt: { gte: since } } : undefined;
    const [donationRows, chargeRows, bookingRows] = await Promise.all([
      this.prisma.donation.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
        _sum: { amount: true },
      }),
      this.prisma.subscriptionCharge.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
        _sum: { amount: true },
      }),
      this.prisma.booking.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
    ]);
    return {
      donations: sourceStats(donationRows),
      subscriptions: sourceStats(chargeRows),
      paidSessions: sessionCount(bookingRows, [
        BookingStatus.CONFIRMED,
        BookingStatus.COMPLETED,
      ]),
      pendingSessions: sessionCount(bookingRows, [BookingStatus.HELD]),
    };
  }
}

/** Donation/SubscriptionCharge share the same PaymentStatus shape. */
function sourceStats(rows: StatusCountSum[]): MoneySourceStats {
  const paid = rows.find((r) => r.status === 'paid');
  const pending = rows.find((r) => r.status === 'pending');
  return {
    paidCount: paid?._count._all ?? 0,
    paidSum: paid?._sum.amount ?? 0,
    pendingCount: pending?._count._all ?? 0,
  };
}

function sessionCount(rows: StatusCount[], statuses: BookingStatus[]): number {
  return rows
    .filter((r) => statuses.includes(r.status))
    .reduce((sum, r) => sum + r._count._all, 0);
}
