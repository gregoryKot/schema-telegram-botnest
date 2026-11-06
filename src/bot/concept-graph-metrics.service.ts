import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AnalyticsEventName } from '../analytics/analytics.constants';
import { formatConceptGraphMetrics } from './concept-graph-metrics.format';
import type { ConceptGraphMetrics } from './concept-graph-metrics.types';

const OPEN_EVENT: AnalyticsEventName = 'concept_graph_open';
const SHARE_EVENT: AnalyticsEventName = 'concept_shared';
const CLIENT_OPEN_EVENT: AnalyticsEventName = 'client_concept_opened';

// Счётчики графической концептуализации в кабинете терапевта для /stats (события concept_*
// из AnalyticsEvent, смысл — src/analytics/concept-events.constants.ts). Имена типизированы
// AnalyticsEventName: опечатка не даст молча пустой отчёт. Без сырого SQL — count/groupBy через
// Prisma. Свой домен — свой файл (правило №10), образец — profile-pattern-metrics.service.ts.
// Показ схемы клиенту — события concept_shared / client_concept_opened и число показанных сейчас
// схем (ClientConceptualization.sharedWithClientAt).
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
    // «Показать клиенту»: включения и выключения различает meta.on.
    const shareOf = (on: boolean) =>
      this.prisma.analyticsEvent.count({
        where: {
          name: SHARE_EVENT,
          createdAt,
          meta: { path: ['on'], equals: on },
        },
      });
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
      sharedNow,
      shareOn,
      shareOff,
      clientOpens,
      clientOpeners,
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
      this.prisma.clientConceptualization.count({
        where: { sharedWithClientAt: { not: null } },
      }),
      shareOf(true),
      shareOf(false),
      countOf(CLIENT_OPEN_EVENT),
      this.prisma.analyticsEvent.groupBy({
        by: ['userId'],
        where: { name: CLIENT_OPEN_EVENT, createdAt, userId: { not: null } },
      }),
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
      sharedNow,
      shareOn30: shareOn,
      shareOff30: shareOff,
      clientOpens30: clientOpens,
      clientOpeners30: clientOpeners.length,
    };
  }
}
