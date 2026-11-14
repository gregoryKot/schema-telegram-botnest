import type { PrismaService } from '../prisma/prisma.service';
import type { SettleBlock } from './stats-settle';
import {
  formatDays,
  formatDiary,
  formatNoticed,
  formatPairs,
  formatPeople,
} from './admin-stats.sections';
import { enoughRaters } from './admin-stats.raters';

// Разделы «Главных цифр» /stats — каждый со своими запросами и своим блоком
// settleBlocks: упавший запрос ставит заглушку только на место своего раздела,
// а не гасит всё сообщение. Живая проверка SQL —
// test/raw-sql-live-admin-stats.e2e-spec.ts (№18).

type ActivityKey = 'month30' | 'week7' | 'churn' | 'core';
type RetKey = 'ret1' | 'ret3' | 'ret7' | 'ret30';

/** Дни отчёта в зоне Rating.date (шапка bot.admin-stats.service.ts). */
export interface ReportDays {
  now: Date;
  today: string;
  d7: string;
  d30: string;
}

async function people(prisma: PrismaService, now: Date): Promise<string> {
  const ago7 = new Date(now.getTime() - 7 * 86_400_000);
  const ago30 = new Date(now.getTime() - 30 * 86_400_000);
  const alive = { deletedAt: null };
  const [totalUsers, newUsers7, newUsers30, notifyOff, blockedUsers] =
    await Promise.all([
      prisma.user.count({ where: alive }),
      prisma.user.count({ where: { ...alive, createdAt: { gte: ago7 } } }),
      prisma.user.count({ where: { ...alive, createdAt: { gte: ago30 } } }),
      prisma.user.count({ where: { ...alive, notifyEnabled: false } }),
      prisma.user.count({ where: { ...alive, botBlockedAt: { not: null } } }),
    ]);
  return formatPeople({
    totalUsers,
    newUsers7,
    newUsers30,
    notifyOff,
    blockedUsers,
  });
}

async function diary(prisma: PrismaService, days: ReportDays): Promise<string> {
  const { today, d7, d30 } = days;
  const [todayCountRows, activityRows] = await Promise.all([
    // D-4 (аудит 2026-07): честный COUNT(DISTINCT), а не выборка id.
    prisma.$queryRaw<Array<{ c: bigint }>>`
        SELECT COUNT(DISTINCT "userId")::bigint AS c FROM "Rating" WHERE date = ${today}
      `,
    // Заходившие за месяц/неделю, «могут уйти» и «ядро» (≥3 разных дня за
    // неделю, docs/LAUNCH_STRATEGY.md §5) — одним проходом в SQL. Раньше —
    // findMany с distinct и take: 5000: Prisma дедуплицирует в памяти поверх
    // ORDER BY id, и выше ~170 человек в день свежие дни выпадали — «ядро»
    // показывало 0 из 500 (аудит 2026-10). «Могут уйти» = последний день
    // в окне месяца раньше недели.
    prisma.$queryRaw<Array<Record<ActivityKey, bigint>>>`
        SELECT count(*)::bigint AS month30,
               count(*) FILTER (WHERE t.last_day >= ${d7})::bigint AS week7,
               count(*) FILTER (WHERE t.last_day < ${d7})::bigint AS churn,
               count(*) FILTER (WHERE t.days7 >= 3)::bigint AS core
        FROM (
          SELECT p."userId", max(p.date) AS last_day,
                 count(*) FILTER (WHERE p.date >= ${d7}) AS days7
          FROM (SELECT DISTINCT "userId", date FROM "Rating" WHERE date >= ${d30}) p
          GROUP BY p."userId"
        ) t
      `,
  ]);
  const todayCount = Number(todayCountRows[0]?.c ?? 0);
  const act = (k: ActivityKey): number => Number(activityRows[0]?.[k] ?? 0);
  const month30Count = act('month30');
  const fillRate =
    month30Count > 0 ? Math.round((todayCount / month30Count) * 100) : 0;
  return formatDiary({
    todayCount,
    fillRate,
    week7Count: act('week7'),
    activeCoreCount: act('core'),
    month30Count,
    churnRisk: act('churn'),
  });
}

/** Воронка удержания: у скольких людей 1+, 3+, 7+ и 30+ разных дней
 * заполнения — один GROUP BY по всей Rating вместо четырёх (по ~250 мс). */
async function daysFunnel(prisma: PrismaService): Promise<string> {
  const [funnel] = await prisma.$queryRaw<Array<Record<RetKey, bigint>>>`
      SELECT count(*) FILTER (WHERE t.days >= 1)::bigint AS ret1,
             count(*) FILTER (WHERE t.days >= 3)::bigint AS ret3,
             count(*) FILTER (WHERE t.days >= 7)::bigint AS ret7,
             count(*) FILTER (WHERE t.days >= 30)::bigint AS ret30
      FROM (SELECT COUNT(DISTINCT date) AS days FROM "Rating" GROUP BY "userId") t`;
  const ret = (k: RetKey): number => Number(funnel?.[k] ?? 0);
  return formatDays({
    ret1: ret('ret1'),
    ret3: ret('ret3'),
    ret7: ret('ret7'),
    ret30: ret('ret30'),
  });
}

async function noticed(prisma: PrismaService, days: ReportDays) {
  const { d7, d30 } = days;
  const [needAvgs, enough, perDayRows] = await Promise.all([
    // Средняя по потребности за 7 дней — строк по числу NEED_IDS, без take.
    prisma.rating.groupBy({
      by: ['needId'],
      where: { date: { gte: d7 } },
      _avg: { value: true },
      orderBy: { _avg: { value: 'asc' } },
    }),
    enoughRaters(prisma, d7),
    // Сколько разных людей заполняли в каждый день за 30 дней — ≤31 строки;
    // день недели считается ниже в JS, без каста строки в date в SQL.
    prisma.$queryRaw<Array<{ date: string; c: bigint }>>`
        SELECT date, COUNT(DISTINCT "userId")::bigint AS c
        FROM "Rating" WHERE date >= ${d30} GROUP BY date
      `,
  ]);
  // День недели с наибольшим числом пар «человек–день»; пустая база — null (№8).
  const dowCounts: number[] = new Array<number>(7).fill(0);
  for (const r of perDayRows) {
    dowCounts[new Date(r.date + 'T12:00:00Z').getUTCDay()] += Number(r.c);
  }
  const maxDow = Math.max(...dowCounts);
  const bestDow = maxDow > 0 ? dowCounts.indexOf(maxDow) : null;
  return formatNoticed({
    lowestNeed: enough ? needAvgs[0] : undefined,
    bestDow,
  });
}

/** Разделы в порядке отчёта; retention — последним, его считает сервис. */
export function adminStatsBlocks(
  prisma: PrismaService,
  days: ReportDays,
  retention: () => Promise<string>,
): SettleBlock[] {
  return [
    { name: 'Люди', run: () => people(prisma, days.now) },
    { name: 'Дневник настроения', run: () => diary(prisma, days) },
    { name: 'Сколько дней люди ведут дневник', run: () => daysFunnel(prisma) },
    { name: 'Что заметили за неделю', run: () => noticed(prisma, days) },
    {
      name: 'Пары',
      run: async () =>
        formatPairs(await prisma.pair.count({ where: { status: 'active' } })),
    },
    { name: 'Возвращаются ли новенькие', run: retention },
  ];
}
