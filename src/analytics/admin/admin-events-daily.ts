import type { PrismaService } from '../../prisma/prisma.service';
import { REPORT_TZ } from './admin-overview.builders';

/** Действия по календарным дням МСК: группировка по дню в базе, а не выгрузка
 *  всех строк за окно (событий за 90 дней — сотни тысяч). */
export async function eventsPerDay(
  prisma: PrismaService,
  since: Date,
): Promise<Map<string, number>> {
  const rows = await prisma.$queryRaw<Array<{ day: string; n: bigint }>>`
    SELECT to_char(("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${REPORT_TZ})::date, 'YYYY-MM-DD') AS day,
           count(*)::bigint AS n
    FROM "AnalyticsEvent"
    WHERE "createdAt" >= ${since}
    GROUP BY 1`;
  return new Map(rows.map((r) => [r.day, Number(r.n)]));
}
