import { Injectable } from '@nestjs/common';
import {
  THERAPY_NUDGE_EVENT,
  THERAPY_NUDGE_PLACES,
  THERAPY_NUDGE_TRIGGERS,
} from '../analytics/therapy-nudge.constants';
import { PrismaService } from '../prisma/prisma.service';
import {
  formatTherapyNudge,
  TherapyNudgeMetrics,
} from './therapy-nudge-metrics.format';

const MONTH_MS = 30 * 86_400_000;

// Счётчики блока «Мост к терапевту» для /stats. Prisma count с JSON-фильтром
// по meta, не сырой SQL: иначе нужна запись в scripts/raw-sql-live-baseline.json
// (правило №18). Каждый ключ meta — свой фильтр в AND (в одном объекте
// path-фильтр один). Свой блок в StatsReportService: сбой не роняет соседей.
@Injectable()
export class TherapyNudgeMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async render(): Promise<string> {
    return formatTherapyNudge(await this.getMetrics());
  }

  async getMetrics(now = new Date()): Promise<TherapyNudgeMetrics> {
    const since = new Date(now.getTime() - MONTH_MS);
    const countMeta = (fields: Record<string, string>) =>
      this.prisma.analyticsEvent.count({
        where: {
          name: THERAPY_NUDGE_EVENT,
          createdAt: { gte: since },
          AND: Object.entries(fields).map(([key, value]) => ({
            meta: { path: [key], equals: value },
          })),
        },
      });
    const [shown, triggers, open, book, write, dismiss, introFromApp] =
      await Promise.all([
        Promise.all(
          THERAPY_NUDGE_PLACES.map((place) =>
            countMeta({ place, action: 'shown' }),
          ),
        ),
        Promise.all(
          THERAPY_NUDGE_TRIGGERS.map((trigger) =>
            countMeta({ place: 'signal_card', action: 'shown', trigger }),
          ),
        ),
        countMeta({ action: 'open' }),
        countMeta({ action: 'book' }),
        countMeta({ action: 'write' }),
        countMeta({ action: 'dismiss' }),
        // source хранится открыто (intro-lead.schema.ts), String? в schema.prisma.
        this.prisma.introLead.count({
          where: {
            createdAt: { gte: since },
            source: { contains: 'from=app' },
          },
        }),
      ]);
    return {
      shownByPlace: THERAPY_NUDGE_PLACES.map((place, i) => ({
        place,
        count: shown[i],
      })),
      signalByTrigger: THERAPY_NUDGE_TRIGGERS.map((trigger, i) => ({
        trigger,
        count: triggers[i],
      })),
      open,
      book,
      write,
      dismiss,
      introFromApp,
    };
  }
}
