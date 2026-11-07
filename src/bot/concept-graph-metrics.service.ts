import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AnalyticsEventName } from '../analytics/analytics.constants';
import { countEventsByKey } from './event-counts';
import { formatConceptGraphMetrics } from './concept-graph-metrics.format';
import type { ConceptGraphMetrics } from './concept-graph-metrics.types';

const OPEN_EVENT: AnalyticsEventName = 'concept_graph_open';
const SHARE_EVENT: AnalyticsEventName = 'concept_shared';
const CLIENT_OPEN_EVENT: AnalyticsEventName = 'client_concept_opened';

// Поле отчёта → событие, которое оно считает за 30 дней. NotCounted — не простой счёт: distinct
// по userId (groupBy), показанные сейчас схемы, включения/выключения показа (meta.on).
type NotCounted =
  'therapists30' | 'clientOpeners30' | 'sharedNow' | 'shareOn30' | 'shareOff30';
type CountedKey = Exclude<keyof ConceptGraphMetrics, NotCounted>;
const COUNTED: [CountedKey, AnalyticsEventName][] = [
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
  ['guideSchemas30', 'concept_guide_schema_open'],
  ['guideTechniques30', 'concept_guide_technique_open'],
  ['guideAssign30', 'concept_guide_assign'],
  ['guideMarkDone30', 'concept_guide_mark_done'],
  ['guideJournalOpen30', 'concept_guide_journal_open'],
  ['guideJournalEntry30', 'concept_guide_journal_entry'],
  ['clientOpens30', CLIENT_OPEN_EVENT],
];

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
    // Одна группа на пользователя; анонимная строка (userId null) не считается.
    const distinctUsers = (name: AnalyticsEventName) =>
      this.prisma.analyticsEvent.groupBy({
        by: ['userId'],
        where: { name, createdAt, userId: { not: null } },
      });
    // «Показать клиенту»: включения и выключения различает meta.on.
    const shareOf = (on: boolean) =>
      this.prisma.analyticsEvent.count({
        where: {
          name: SHARE_EVENT,
          createdAt,
          meta: { path: ['on'], equals: on },
        },
      });
    const [openers, clientOpeners, sharedNow, shareOn, shareOff, counted] =
      await Promise.all([
        distinctUsers(OPEN_EVENT),
        distinctUsers(CLIENT_OPEN_EVENT),
        this.prisma.clientConceptualization.count({
          where: { sharedWithClientAt: { not: null } },
        }),
        shareOf(true),
        shareOf(false),
        countEventsByKey(this.prisma, COUNTED, createdAt),
      ]);
    return {
      ...counted,
      therapists30: openers.length,
      clientOpeners30: clientOpeners.length,
      sharedNow,
      shareOn30: shareOn,
      shareOff30: shareOff,
    };
  }
}
