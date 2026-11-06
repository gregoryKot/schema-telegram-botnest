import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AnalyticsEventName } from '../analytics/analytics.constants';
import { formatConceptGraphMetrics } from './concept-graph-metrics.format';
import type { ConceptGraphMetrics } from './concept-graph-metrics.types';

const OPEN_EVENT: AnalyticsEventName = 'concept_graph_open';

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
    const countOf = (name: AnalyticsEventName) =>
      this.prisma.analyticsEvent.count({ where: { name, createdAt } });
    const [
      opens,
      openers,
      linked,
      schemaLinked,
      canvas,
      fullscreen,
      saveRetry,
      brief,
      syncToMap,
      syncFromMap,
    ] = await Promise.all([
      countOf(OPEN_EVENT),
      // Одна группа на терапевта; анонимная строка (userId null) терапевтом
      // не считается.
      this.prisma.analyticsEvent.groupBy({
        by: ['userId'],
        where: { name: OPEN_EVENT, createdAt, userId: { not: null } },
      }),
      countOf('concept_mode_linked'),
      countOf('concept_schema_linked'),
      countOf('concept_canvas_open'),
      countOf('concept_graph_fullscreen'),
      countOf('concept_save_retry'),
      countOf('concept_brief_open'),
      countOf('concept_sync_to_map'),
      countOf('concept_sync_from_map'),
    ]);
    return {
      opens30: opens,
      therapists30: openers.length,
      linked30: linked,
      schemaLinked30: schemaLinked,
      canvasOpen30: canvas,
      fullscreen30: fullscreen,
      saveRetry30: saveRetry,
      brief30: brief,
      syncToMap30: syncToMap,
      syncFromMap30: syncFromMap,
    };
  }
}
