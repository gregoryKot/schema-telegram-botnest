import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AnalyticsEventName } from '../analytics/analytics.constants';
import type { TaskAssignSource } from '../analytics/cabinet-events.constants';
import { formatTaskAssignMetrics } from './task-assign-metrics.format';
import type { TaskAssignMetrics } from './task-assign-metrics.types';

const EVENT: AnalyticsEventName = 'task_assign_source';

// Откуда терапевты берут задания клиентам, для /stats (событие task_assign_source из
// AnalyticsEvent, смысл — src/analytics/cabinet-events.constants.ts). Без сырого SQL: count
// через Prisma, разрез по meta.source — фильтром пути. Образец — plan-metrics.service.ts.
@Injectable()
export class TaskAssignMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Готовый текстовый блок для /stats. */
  async render(): Promise<string> {
    return formatTaskAssignMetrics(await this.getMetrics());
  }

  async getMetrics(): Promise<TaskAssignMetrics> {
    const createdAt = { gte: new Date(Date.now() - 30 * 86_400_000) };
    const sourceOf = (source: TaskAssignSource) =>
      this.prisma.analyticsEvent.count({
        where: {
          name: EVENT,
          createdAt,
          meta: { path: ['source'], equals: source },
        },
      });
    const [tile30, catalog30, custom30, guide30, template30] =
      await Promise.all([
        sourceOf('tile'),
        sourceOf('catalog'),
        sourceOf('custom'),
        sourceOf('guide'),
        sourceOf('template'),
      ]);
    return { tile30, catalog30, custom30, guide30, template30 };
  }
}
