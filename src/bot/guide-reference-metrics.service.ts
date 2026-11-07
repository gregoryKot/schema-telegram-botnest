import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AnalyticsEventName } from '../analytics/analytics.constants';
import { countEventsByKey } from './event-counts';
import { formatGuideReferenceMetrics } from './guide-reference-metrics.format';
import type { GuideReferenceMetrics } from './guide-reference-metrics.types';

const OPEN_EVENT: AnalyticsEventName = 'cabinet_guide_open';

// Поле отчёта → событие, которое оно считает за 30 дней; therapists30 — distinct по userId.
type CountedKey = Exclude<keyof GuideReferenceMetrics, 'therapists30'>;
const COUNTED: [CountedKey, AnalyticsEventName][] = [
  ['opens30', OPEN_EVENT],
  ['modes30', 'cabinet_guide_mode_open'],
  ['schemas30', 'cabinet_guide_schema_open'],
  ['techniques30', 'cabinet_guide_technique_open'],
  ['notes30', 'cabinet_guide_note_open'],
];

// Счётчики «Справочника» в меню терапевта для /stats (события cabinet_guide_* из AnalyticsEvent,
// смысл — src/analytics/cabinet-events.constants.ts). Те же листы из схемы случая клиента
// считает concept-graph-metrics.service.ts (concept_guide_*). Имена типизированы
// AnalyticsEventName: опечатка не даст молча пустой отчёт. Без сырого SQL — count/groupBy через
// Prisma. Образец — screen-share-metrics.service.ts.
@Injectable()
export class GuideReferenceMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Готовый текстовый блок для /stats. */
  async render(): Promise<string> {
    return formatGuideReferenceMetrics(await this.getMetrics());
  }

  async getMetrics(): Promise<GuideReferenceMetrics> {
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
