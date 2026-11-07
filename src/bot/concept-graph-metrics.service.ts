import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AnalyticsEventName } from '../analytics/analytics.constants';
import { formatConceptGraphMetrics } from './concept-graph-metrics.format';
import type { ConceptGraphMetrics } from './concept-graph-metrics.types';

const OPEN_EVENT: AnalyticsEventName = 'concept_graph_open';

// Поле отчёта → событие, которое оно считает за 30 дней (кроме therapists30 — это groupBy).
const COUNTED: [
  Exclude<keyof ConceptGraphMetrics, 'therapists30'>,
  AnalyticsEventName,
][] = [
  ['opens30', OPEN_EVENT],
  ['linked30', 'concept_mode_linked'],
  ['schemaLinked30', 'concept_schema_linked'],
  ['canvasOpen30', 'concept_canvas_open'],
  ['fullscreen30', 'concept_graph_fullscreen'],
  ['saveRetry30', 'concept_save_retry'],
  ['brief30', 'concept_brief_open'],
  ['syncToMap30', 'concept_sync_to_map'],
  ['syncFromMap30', 'concept_sync_from_map'],
  ['guideModes30', 'concept_guide_mode_open'],
  ['guideTechniques30', 'concept_guide_technique_open'],
  ['guideAssign30', 'concept_guide_assign'],
];

// Счётчики графической концептуализации в кабинете терапевта для /stats (события concept_*
// из AnalyticsEvent, смысл — src/analytics/concept-events.constants.ts). Имена типизированы
// AnalyticsEventName: опечатка не даст молча пустой отчёт. Без сырого SQL — count/groupBy через
// Prisma. Свой домен — свой файл (правило №10), образец — profile-pattern-metrics.service.ts.
@Injectable()
export class ConceptGraphMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Готовый текстовый блок для /stats. */
  async render(): Promise<string> {
    return formatConceptGraphMetrics(await this.getMetrics());
  }

  async getMetrics(): Promise<ConceptGraphMetrics> {
    const createdAt = { gte: new Date(Date.now() - 30 * 86_400_000) };
    const [openers, counts] = await Promise.all([
      // Одна группа на терапевта; анонимная строка (userId null) терапевтом
      // не считается.
      this.prisma.analyticsEvent.groupBy({
        by: ['userId'],
        where: { name: OPEN_EVENT, createdAt, userId: { not: null } },
      }),
      Promise.all(
        COUNTED.map(([, name]) =>
          this.prisma.analyticsEvent.count({ where: { name, createdAt } }),
        ),
      ),
    ]);
    const metrics = { therapists30: openers.length } as ConceptGraphMetrics;
    COUNTED.forEach(([key], i) => {
      metrics[key] = counts[i];
    });
    return metrics;
  }
}
