import {
  DIARY_QUICK_TAGS,
  HOME_TILES,
} from '../analytics/home-events.constants';
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

export interface DiaryQuickCounts {
  /** Сохранений по тегам (и быстрых, и через «Заполнить подробно»). */
  byTag: Array<{ tag: string; count: number }>;
  /** Из них ушедших в старый мастер (meta.detailed = true). */
  detailed: number;
}

/** Сохранения «Дневника одной страницей» за период. JSON-фильтр Prisma, без сырого SQL. */
export async function countDiaryQuickSaves(
  prisma: PrismaService,
  since: Date,
): Promise<DiaryQuickCounts> {
  const base = { name: 'diary_quick_save', createdAt: { gte: since } };
  const [byTag, detailed] = await Promise.all([
    Promise.all(
      DIARY_QUICK_TAGS.map(async (tag) => ({
        tag,
        count: await prisma.analyticsEvent.count({
          where: { ...base, meta: { path: ['tag'], equals: tag } },
        }),
      })),
    ),
    prisma.analyticsEvent.count({
      where: { ...base, meta: { path: ['detailed'], equals: true } },
    }),
  ]);
  return { byTag, detailed };
}

/** Все счётчики главной простого клиента для /stats за период. */
export async function countHomeMetrics(prisma: PrismaService, since: Date) {
  const [homeTiles, trackerSkips, diaryQuick] = await Promise.all([
    countHomeTiles(prisma, since),
    countTrackerSkips(prisma, since),
    countDiaryQuickSaves(prisma, since),
  ]);
  return { homeTiles, trackerSkips, diaryQuick };
}
