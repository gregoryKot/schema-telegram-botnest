import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AnalyticsEventName } from '../analytics/analytics.constants';
import { countEventsByKey } from './event-counts';
import { formatGuideReferenceMetrics } from './guide-reference-metrics.format';
import type { GuideReferenceMetrics } from './guide-reference-metrics.types';
import { ANSWER_COUNTED, formatGuideAnswerLines, type GuideAnswerMetrics } from './guide-answer-metrics';

const OPEN_EVENT: AnalyticsEventName = 'cabinet_guide_open';

// Поле отчёта → событие, которое оно считает за 30 дней; therapists30 — distinct по userId.
type Metrics = GuideReferenceMetrics & GuideAnswerMetrics;
type CountedKey = Exclude<keyof Metrics, 'therapists30'>;
const COUNTED: [CountedKey, AnalyticsEventName][] = [
  ['opens30', OPEN_EVENT],
  ['modes30', 'cabinet_guide_mode_open'],
  ['schemas30', 'cabinet_guide_schema_open'],
  ['techniques30', 'cabinet_guide_technique_open'],
  ['notes30', 'cabinet_guide_note_open'],
  ['tables30', 'cabinet_guide_table_open'],
  ...ANSWER_COUNTED,
];

// Счётчики «Справочника» терапевта для /stats (cabinet_guide_*, смысл — cabinet-events.constants.ts); те же листы
// из схемы случая считает concept-graph-metrics.service.ts. Имена типизированы: опечатка не даст молча пустой отчёт.
@Injectable()
export class GuideReferenceMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Готовый текстовый блок для /stats. */
  async render(): Promise<string> {
    const m = await this.getMetrics();
    return [formatGuideReferenceMetrics(m), ...formatGuideAnswerLines(m)].join('\n');
  }

  async getMetrics(): Promise<Metrics> {
    const createdAt = { gte: new Date(Date.now() - 30 * 86_400_000) };
    const [therapists, counted] = await Promise.all([
      // Одна группа на терапевта; анонимная строка (userId null) терапевтом не считается.
      this.prisma.analyticsEvent.groupBy({
        by: ['userId'],
        where: { name: OPEN_EVENT, createdAt, userId: { not: null } },
      }),
      countEventsByKey(this.prisma, COUNTED, createdAt),
    ]);
    return { ...counted, therapists30: therapists.length };
  }
}
