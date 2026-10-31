import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AnalyticsEventName } from '../analytics/analytics.constants';
import { formatConceptGraphMetrics } from './concept-graph-metrics.format';
import type { ConceptGraphMetrics } from './concept-graph-metrics.types';

// Типизированные имена: опечатка не даст молча пустой отчёт (сверка с allow-list).
const OPEN_EVENT: AnalyticsEventName = 'concept_graph_open';
const LINKED_EVENT: AnalyticsEventName = 'concept_mode_linked';
const SCHEMA_LINKED_EVENT: AnalyticsEventName = 'concept_schema_linked';
const CANVAS_EVENT: AnalyticsEventName = 'concept_canvas_open';
const FULLSCREEN_EVENT: AnalyticsEventName = 'concept_graph_fullscreen';
const SAVE_RETRY_EVENT: AnalyticsEventName = 'concept_save_retry';

// Счётчики графической концептуализации в кабинете терапевта для /stats: открыл схему
// случая, заполнил связи, записал тексты схемы, перенёс на холст, развернул на весь экран,
// повторял сохранение после ошибки
// (события concept_* из AnalyticsEvent). Без сырого SQL — count/groupBy через Prisma (групп
// немного). Свой домен — свой файл (правило №10), образец — profile-pattern-metrics.service.ts.
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
    ] = await Promise.all([
      countOf(OPEN_EVENT),
      // Одна группа на терапевта; анонимная строка (userId null) терапевтом
      // не считается.
      this.prisma.analyticsEvent.groupBy({
        by: ['userId'],
        where: { name: OPEN_EVENT, createdAt, userId: { not: null } },
      }),
      countOf(LINKED_EVENT),
      countOf(SCHEMA_LINKED_EVENT),
      countOf(CANVAS_EVENT),
      countOf(FULLSCREEN_EVENT),
      countOf(SAVE_RETRY_EVENT),
    ]);
    return {
      opens30: opens,
      therapists30: openers.length,
      linked30: linked,
      schemaLinked30: schemaLinked,
      canvasOpen30: canvas,
      fullscreen30: fullscreen,
      saveRetry30: saveRetry,
    };
  }
}
