import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AnalyticsEventName } from '../analytics/analytics.constants';
import { formatScreenShareMetrics } from './screen-share-metrics.format';
import type { ScreenShareMetrics } from './screen-share-metrics.types';

const ON_EVENT: AnalyticsEventName = 'cabinet_screen_share_on';

// Счётчики «Показа экрана» в кабинете терапевта для /stats (событие cabinet_screen_share_on
// из AnalyticsEvent, смысл — src/analytics/cabinet-events.constants.ts). Имя типизировано
// AnalyticsEventName: опечатка не даст молча пустой отчёт. Без сырого SQL — count/groupBy через
// Prisma. Свой домен — свой файл (правило №10), образец — concept-graph-metrics.service.ts.
@Injectable()
export class ScreenShareMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Готовый текстовый блок для /stats. */
  async render(): Promise<string> {
    return formatScreenShareMetrics(await this.getMetrics());
  }

  async getMetrics(): Promise<ScreenShareMetrics> {
    const createdAt = { gte: new Date(Date.now() - 30 * 86_400_000) };
    const [on, therapists] = await Promise.all([
      this.prisma.analyticsEvent.count({
        where: { name: ON_EVENT, createdAt },
      }),
      // Одна группа на терапевта; анонимная строка (userId null) терапевтом не считается.
      this.prisma.analyticsEvent.groupBy({
        by: ['userId'],
        where: { name: ON_EVENT, createdAt, userId: { not: null } },
      }),
    ]);
    return { on30: on, therapists30: therapists.length };
  }
}
