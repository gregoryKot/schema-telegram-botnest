import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AnalyticsEventName } from '../analytics/analytics.constants';
import type { PlanStatus } from '../therapy/therapy-plan.types';
import { formatPlanMetrics } from './plan-metrics.format';
import type { PlanMetrics } from './plan-metrics.types';

const ADDED_EVENT: AnalyticsEventName = 'therapy_plan_item_added';
const STATUS_EVENT: AnalyticsEventName = 'therapy_plan_item_status';

// Счётчики вкладки «План работы» карточки клиента для /stats (события therapy_plan_item_* из
// AnalyticsEvent, смысл — src/analytics/plan-events.constants.ts). Без сырого SQL — count/groupBy
// через Prisma, разрез по meta — фильтром пути. Образец — guide-reference-metrics.service.ts.
@Injectable()
export class PlanMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Готовый текстовый блок для /stats. */
  async render(): Promise<string> {
    return formatPlanMetrics(await this.getMetrics());
  }

  async getMetrics(): Promise<PlanMetrics> {
    const createdAt = { gte: new Date(Date.now() - 30 * 86_400_000) };
    const added = { name: ADDED_EVENT, createdAt };
    const statusOf = (status: PlanStatus) =>
      this.prisma.analyticsEvent.count({
        where: {
          name: STATUS_EVENT,
          createdAt,
          meta: { path: ['status'], equals: status },
        },
      });
    const [added30, fromGuide30, therapists, active30, done30] =
      await Promise.all([
        this.prisma.analyticsEvent.count({ where: added }),
        this.prisma.analyticsEvent.count({
          where: { ...added, meta: { path: ['fromGuide'], equals: true } },
        }),
        // Одна группа на терапевта; анонимная строка (userId null) терапевтом не считается.
        this.prisma.analyticsEvent.groupBy({
          by: ['userId'],
          where: { ...added, userId: { not: null } },
        }),
        statusOf('active'),
        statusOf('done'),
      ]);
    return {
      added30,
      fromGuide30,
      therapists30: therapists.length,
      active30,
      done30,
    };
  }
}
