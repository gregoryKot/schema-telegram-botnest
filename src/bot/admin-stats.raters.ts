import type { PrismaService } from '../prisma/prisma.service';

/**
 * Средняя по потребности в /stats видна, только если за неделю оценки ставили
 * столько разных людей: при 1–4 она указывает на оценку конкретного человека.
 */
export const MIN_RATERS_FOR_NEED_AVG = 5;

/**
 * Хватает ли разных людей с оценками с дня `d7`. GROUP BY с LIMIT считает
 * Postgres; findMany с distinct дедуплицирует в памяти уже после LIMIT, а у
 * одного человека пять строк в день — пять строк дали бы одного человека.
 */
export async function enoughRaters(
  prisma: Pick<PrismaService, 'rating'>,
  d7: string,
): Promise<boolean> {
  const rows = await prisma.rating.groupBy({
    by: ['userId'],
    where: { date: { gte: d7 } },
    orderBy: { userId: 'asc' },
    take: MIN_RATERS_FOR_NEED_AVG,
  });
  return rows.length >= MIN_RATERS_FOR_NEED_AVG;
}
