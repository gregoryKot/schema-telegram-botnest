import { Injectable } from '@nestjs/common';
import { BookingStatus, SessionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CurrencyCounts,
  formatSessionCurrencyMetrics,
  SessionCurrencyMetrics,
} from './session-currency-metrics.format';

const WEEK_MS = 7 * 86_400_000;

// Платные сессии не в рублях для /stats. Prisma groupBy, не сырой SQL: иначе
// нужна запись в scripts/raw-sql-live-baseline.json (правило №18). Свой блок в
// StatsReportService: сбой запроса не должен ронять соседний блок «Деньги».
@Injectable()
export class SessionCurrencyMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async render(): Promise<string> {
    return formatSessionCurrencyMetrics(await this.getMetrics());
  }

  async getMetrics(now = new Date()): Promise<SessionCurrencyMetrics> {
    const since = new Date(now.getTime() - WEEK_MS);
    const [week, allTime] = await Promise.all([
      this.counts(since),
      this.counts(undefined),
    ]);
    return { week, allTime };
  }

  private async counts(since?: Date): Promise<CurrencyCounts> {
    const rows = await this.prisma.booking.groupBy({
      by: ['currency'],
      where: {
        type: { not: SessionType.INTRO_15 },
        currency: { not: 'RUB' },
        status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
        ...(since && { createdAt: { gte: since } }),
      },
      _count: { _all: true },
    });
    const out: CurrencyCounts = {};
    for (const r of rows) {
      if (r.currency === 'ILS' || r.currency === 'EUR' || r.currency === 'USD')
        out[r.currency] = r._count._all;
    }
    return out;
  }
}
