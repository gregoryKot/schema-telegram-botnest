import {
  DIARY_QUICK_TAGS,
  HOME_TILES,
  NEXT_STEP_FROM,
  NEXT_STEP_TO,
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

export interface NextStepCount {
  from: string;
  to: string;
  count: number;
}

/** Переходы «Что дальше» за период, по парам from→to. JSON-фильтр Prisma, без сырого SQL. */
export async function countDoneNextSteps(
  prisma: PrismaService,
  since: Date,
): Promise<NextStepCount[]> {
  const pairs = NEXT_STEP_FROM.flatMap((from) =>
    NEXT_STEP_TO.map((to) => ({ from, to })),
  );
  return Promise.all(
    pairs.map(async ({ from, to }) => ({
      from,
      to,
      count: await prisma.analyticsEvent.count({
        where: {
          name: 'done_next_step',
          createdAt: { gte: since },
          AND: [
            { meta: { path: ['from'], equals: from } },
            { meta: { path: ['to'], equals: to } },
          ],
        },
      }),
    })),
  );
}

/** Все счётчики главной простого клиента для /stats за период. */
export async function countHomeMetrics(prisma: PrismaService, since: Date) {
  const [homeTiles, trackerSkips, diaryQuick, nextSteps] = await Promise.all([
    countHomeTiles(prisma, since),
    countTrackerSkips(prisma, since),
    countDiaryQuickSaves(prisma, since),
    countDoneNextSteps(prisma, since),
  ]);
  return { homeTiles, trackerSkips, diaryQuick, nextSteps };
}
