import { Injectable } from '@nestjs/common';
import { THERAPY_NUDGE_EVENT } from '../analytics/therapy-nudge.constants';
import { PrismaService } from '../prisma/prisma.service';
import { aggregateTherapyNudge } from './therapy-nudge-metrics.aggregate';
import {
  formatTherapyNudge,
  TherapyNudgeMetrics,
} from './therapy-nudge-metrics.format';

const MONTH_MS = 30 * 86_400_000;

// Счётчики блока «Мост к терапевту» для /stats. Один findMany по индексу
// (name, createdAt) за 30 дней и чистый агрегат meta в памяти — не сырой SQL
// (иначе запись в scripts/raw-sql-live-baseline.json, правило №18) и не count
// на каждое место: 17 мест × 4 причины давали 25 сканов одних и тех же строк,
// и perf-гейт stats-report вышел за планку (PR #945). Свой блок в
// StatsReportService: сбой не роняет соседей.
@Injectable()
export class TherapyNudgeMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async render(): Promise<string> {
    return formatTherapyNudge(await this.getMetrics());
  }

  async getMetrics(now = new Date()): Promise<TherapyNudgeMetrics> {
    const since = new Date(now.getTime() - MONTH_MS);
    const [events, introFromApp, bookingFromApp] = await Promise.all([
      this.prisma.analyticsEvent.findMany({
        where: { name: THERAPY_NUDGE_EVENT, createdAt: { gte: since } },
        select: { meta: true },
      }),
      // source хранится открыто (intro-lead.schema.ts), String? в schema.prisma.
      this.prisma.introLead.count({
        where: {
          createdAt: { gte: since },
          source: { contains: 'from=app' },
        },
      }),
      // Booking.source — тоже открытое String? (атрибуция лида, не PII).
      this.prisma.booking.count({
        where: { createdAt: { gte: since }, source: { contains: 'from=app' } },
      }),
    ]);
    return {
      ...aggregateTherapyNudge(events.map((e) => e.meta)),
      introFromApp,
      bookingFromApp,
    };
  }
}
