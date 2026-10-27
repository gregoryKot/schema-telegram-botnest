import { HOME_TILES } from '../analytics/home-events.constants';
import type { PrismaService } from '../prisma/prisma.service';

/** Нажатия плиток главной за период, по плиткам. JSON-фильтр Prisma, без сырого SQL. */
export async function countHomeTiles(
  prisma: PrismaService,
  since: Date,
): Promise<Array<{ tile: string; count: number }>> {
  const counts = await Promise.all(
    HOME_TILES.map((tile) =>
      prisma.analyticsEvent.count({
        where: {
          name: 'home_tile',
          createdAt: { gte: since },
          meta: { path: ['tile'], equals: tile },
        },
      }),
    ),
  );
  return HOME_TILES.map((tile, i) => ({ tile, count: counts[i] }));
}

/** «Пропустить» на вопросе трекера за период. Событие tracker_skip без meta. */
export function countTrackerSkips(
  prisma: PrismaService,
  since: Date,
): Promise<number> {
  return prisma.analyticsEvent.count({
    where: { name: 'tracker_skip', createdAt: { gte: since } },
  });
}
