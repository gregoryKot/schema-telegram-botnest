import type { PrismaService } from '../prisma/prisma.service';
import type { AnalyticsEventName } from '../analytics/analytics.constants';

/**
 * Счёт событий AnalyticsEvent за окно по таблице «поле отчёта → событие»:
 * один count на поле, параллельно. Общий для блоков /stats с такой таблицей
 * (concept-graph-metrics, guide-reference-metrics), а не копия в каждом.
 */
export async function countEventsByKey<K extends string>(
  prisma: PrismaService,
  table: readonly (readonly [K, AnalyticsEventName])[],
  createdAt: { gte: Date },
): Promise<Record<K, number>> {
  const counts = await Promise.all(
    table.map(([, name]) =>
      prisma.analyticsEvent.count({ where: { name, createdAt } }),
    ),
  );
  return Object.fromEntries(
    table.map(([key], i) => [key, counts[i]]),
  ) as Record<K, number>;
}
