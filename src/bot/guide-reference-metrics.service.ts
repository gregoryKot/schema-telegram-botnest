import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AnalyticsEventName } from '../analytics/analytics.constants';
import { countEventsGrouped } from './event-counts-grouped';
import { formatGuideReferenceMetrics } from './guide-reference-metrics.format';
import type { GuideReferenceMetrics } from './guide-reference-metrics.types';
import { withGuideExtras } from './guide-mark-metrics';

const OPEN_EVENT: AnalyticsEventName = 'cabinet_guide_open';

// Поле отчёта → событие, которое оно считает за 30 дней; therapists30 — distinct по userId.
type CountedKey = Exclude<keyof GuideReferenceMetrics, 'therapists30'>;
const COUNTED: [CountedKey, AnalyticsEventName][] = [
  ['opens30', OPEN_EVENT],
  ['modes30', 'cabinet_guide_mode_open'],
  ['schemas30', 'cabinet_guide_schema_open'],
  ['techniques30', 'cabinet_guide_technique_open'],
  ['notes30', 'cabinet_guide_note_open'],
  ['needs30', 'cabinet_guide_need_open'],
  ['concerns30', 'cabinet_guide_concern_open'],
  ['tables30', 'cabinet_guide_table_open'],
];

// Счётчики «Справочника» терапевта для /stats (cabinet_guide_*); имена типизированы — опечатка не даст пустой отчёт.
@Injectable()
export class GuideReferenceMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async render(): Promise<string> {
    const block = formatGuideReferenceMetrics(await this.getMetrics());
    return withGuideExtras(this.prisma, block);
  }

  async getMetrics(): Promise<GuideReferenceMetrics> {
    const createdAt = { gte: new Date(Date.now() - 30 * 86_400_000) };
    const [therapists, counted] = await Promise.all([
      // Одна группа на терапевта; анонимная строка (userId null) терапевтом не считается.
      this.prisma.analyticsEvent.groupBy({
        by: ['userId'],
        where: { name: OPEN_EVENT, createdAt, userId: { not: null } },
      }),
      countEventsGrouped(this.prisma, COUNTED, createdAt),
    ]);
    return { ...counted, therapists30: therapists.length };
  }
}
