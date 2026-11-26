import type { PrismaService } from '../prisma/prisma.service';
import {
  formatWeeklyRepeatMetrics,
  type WeeklyRepeatMetrics,
} from './weekly-repeat-metrics.format';
import { formatSelfMapMetrics } from './self-map-metrics.format';
import type { SelfMapMetrics } from './self-map-metrics.format';

/** Счётчики «Повторов недели» для /stats: weekly_repeat_queued за 30 дней по meta.kind. */
export async function getWeeklyRepeatMetrics(
  prisma: Pick<PrismaService, 'analyticsEvent'>,
): Promise<WeeklyRepeatMetrics> {
  const createdAt = { gte: new Date(Date.now() - 30 * 86_400_000) };
  const byKind = (kind: 'mode' | 'need') =>
    prisma.analyticsEvent.count({
      where: {
        name: 'weekly_repeat_queued',
        createdAt,
        meta: { path: ['kind'], equals: kind },
      },
    });
  const [mode, need] = await Promise.all([byKind('mode'), byKind('need')]);
  return { total: mode + need, mode, need };
}

/** Блоки /stats про «Карту себя»: переходы и «Повторы недели» (ссылка из уведомления ведёт на карту). */
export async function selfMapBlocks(
  cases: { getSelfMapLinks(): Promise<SelfMapMetrics> },
  prisma: Pick<PrismaService, 'analyticsEvent'>,
): Promise<string> {
  const [links, weekly] = await Promise.all([
    cases.getSelfMapLinks(),
    getWeeklyRepeatMetrics(prisma),
  ]);
  return `${formatSelfMapMetrics(links)}\n\n${formatWeeklyRepeatMetrics(weekly)}`;
}
