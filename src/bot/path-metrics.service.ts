import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AnalyticsEventName } from '../analytics/analytics.constants';
import { countEventsGrouped } from './event-counts-grouped';
import { formatPathMetrics } from './path-metrics.format';
import type { PathMetrics } from './path-metrics.types';

// Поле отчёта → событие, которое оно считает за 30 дней; имена типизированы — опечатка не даст пустой отчёт.
const COUNTED: [keyof PathMetrics, AnalyticsEventName][] = [
  ['created30', 'therapy_path_created'],
  ['phasesStarted30', 'therapy_path_phase_started'],
  ['phasesFinished30', 'therapy_path_phase_finished'],
  ['sessionsMarked30', 'therapy_plan_session_marked'],
  ['shifted30', 'therapy_path_dates_shifted'],
  ['drafts30', 'therapy_path_draft_built'],
];

// Счётчики пути клиента для /stats (смысл событий — src/analytics/path-events.constants.ts): один groupBy.
@Injectable()
export class PathMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Готовый текстовый блок для /stats. */
  async render(): Promise<string> {
    return formatPathMetrics(await this.getMetrics());
  }

  getMetrics(): Promise<PathMetrics> {
    const createdAt = { gte: new Date(Date.now() - 30 * 86_400_000) };
    return countEventsGrouped(this.prisma, COUNTED, createdAt);
  }
}
