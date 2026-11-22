import type { PrismaService } from '../prisma/prisma.service';
import type { AnalyticsEventName } from '../analytics/analytics.constants';

/**
 * Счёт событий по таблице «поле отчёта → событие» одним запросом: groupBy по
 * имени вместо count на поле — длинная таблица не читает AnalyticsEvent по разу на строку.
 */
export async function countEventsGrouped<K extends string>(
  prisma: PrismaService,
  table: readonly (readonly [K, AnalyticsEventName])[],
  createdAt: { gte: Date },
): Promise<Record<K, number>> {
  const rows = await prisma.analyticsEvent.groupBy({
    by: ['name'],
    where: { name: { in: table.map(([, name]) => name) }, createdAt },
    _count: { _all: true },
  });
  const byName = new Map(rows.map((r) => [r.name, r._count._all]));
  return Object.fromEntries(
    table.map(([key, name]) => [key, byName.get(name) ?? 0]),
  ) as Record<K, number>;
}
