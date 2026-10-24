import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { localDate } from '../utils/tz';
import { formatAdminStats } from './admin-stats.format';
import {
  formatRetentionBlock,
  RetentionStats,
  RetentionPoint,
} from './retention.format';

// Rating.date — календарный день в зоне пользователя (bot.service.ts, по
// умолчанию notifyTimezone = Europe/Moscow), поэтому «сегодня» и окна отчёта
// считаются в той же зоне: по UTC с 00:00 до 03:00 МСК «сегодня» было
// вчерашним днём (правило №25, аудит 2026-10).
const REPORT_TZ = 'Europe/Moscow';
type ActivityKey = 'month30' | 'week7' | 'churn' | 'core';

// Админский отчёт по всей базе (не по конкретному юзеру, в отличие от
// BotAnalyticsService) — единственный потребитель: команда `/stats` в
// TelegramService. Вынесено из BotAnalyticsService (правило №10).
@Injectable()
export class BotAdminStatsService {
  constructor(private readonly prisma: PrismaService) {}

  private localDateString(tz: string, base = new Date()): string {
    return localDate(tz, base);
  }

  /**
   * Когортный retention + воронка онбординга (аудит 2026-07, этап 4.6 /
   * правило №8: гипотезы про онбординг проверяются D1/D7/D30, а не ощущениями).
   * Данные существующие: User.createdAt, AppActivity, Rating, disclaimerAccepted.
   */
  async getRetentionStats(): Promise<RetentionStats> {
    // DN: созданные [N, N+7) дней назад; retained = есть AppActivity в день
    // createdAt + N. Границы — Date из Node: createdAt это timestamp без зоны,
    // now() в SQL зависел бы от TimeZone сессии.
    const nowMs = Date.now();
    const point = async (n: number): Promise<RetentionPoint> => {
      const from = new Date(nowMs - (n + 7) * 86_400_000);
      const to = new Date(nowMs - n * 86_400_000);
      const rows = await this.prisma.$queryRaw<
        Array<{ cohort: bigint; retained: bigint }>
      >`
        SELECT count(*)::bigint AS cohort,
               count(*) FILTER (
                 WHERE EXISTS (
                   SELECT 1 FROM "AppActivity" a
                   WHERE a."userId" = u.id
                     AND a."date" = to_char((u."createdAt" + make_interval(days => ${n}))::date, 'YYYY-MM-DD')
                 )
               )::bigint AS retained
        FROM "User" u
        WHERE u."createdAt" >= ${from} AND u."createdAt" < ${to}
      `;
      return {
        cohort: Number(rows[0]?.cohort ?? 0),
        retained: Number(rows[0]?.retained ?? 0),
      };
    };
    const since30 = new Date(nowMs - 30 * 86_400_000);
    const [d1, d7, d30, registered30, consented30, filledRows] =
      await Promise.all([
        point(1),
        point(7),
        point(30),
        this.prisma.user.count({ where: { createdAt: { gte: since30 } } }),
        this.prisma.user.count({
          where: { createdAt: { gte: since30 }, disclaimerAccepted: true },
        }),
        this.prisma.$queryRaw<Array<{ c: bigint }>>`
          SELECT count(*)::bigint AS c FROM "User" u
          WHERE u."createdAt" >= ${since30}
            AND EXISTS (SELECT 1 FROM "Rating" r WHERE r."userId" = u.id)
        `,
      ]);
    return {
      d1,
      d7,
      d30,
      funnel: {
        registered30,
        consented30,
        filledOnce30: Number(filledRows[0]?.c ?? 0),
      },
    };
  }

  async getAdminStats(): Promise<string> {
    const now = new Date();
    const day = (ago: number) =>
      this.localDateString(
        REPORT_TZ,
        new Date(now.getTime() - ago * 86_400_000),
      );
    const [today, d7, d30] = [day(0), day(7), day(30)];
    const ago7 = new Date(now.getTime() - 7 * 86_400_000);
    const ago30 = new Date(now.getTime() - 30 * 86_400_000);

    const [
      totalUsers,
      newUsers7,
      newUsers30,
      notifyOff,
      blockedUsers,
      activePairs,
      todayCountRows,
      activityRows,
      needAvgs,
      perDayRows,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({
        where: { deletedAt: null, createdAt: { gte: ago7 } },
      }),
      this.prisma.user.count({
        where: { deletedAt: null, createdAt: { gte: ago30 } },
      }),
      this.prisma.user.count({
        where: { deletedAt: null, notifyEnabled: false },
      }),
      this.prisma.user.count({
        where: { deletedAt: null, botBlockedAt: { not: null } },
      }),
      this.prisma.pair.count({ where: { status: 'active' } }),
      // D-4 (аудит 2026-07): честный COUNT(DISTINCT), а не выборка id.
      this.prisma.$queryRaw<Array<{ c: bigint }>>`
        SELECT COUNT(DISTINCT "userId")::bigint AS c FROM "Rating" WHERE date = ${today}
      `,
      // Заходившие за месяц/неделю, «могут уйти» и «ядро» (≥3 разных дня за
      // неделю, docs/LAUNCH_STRATEGY.md §5) — одним проходом в SQL. Раньше —
      // findMany с distinct и take: 5000: Prisma дедуплицирует в памяти поверх
      // ORDER BY id, и выше ~170 человек в день свежие дни выпадали — «ядро»
      // показывало 0 из 500 (аудит 2026-10). «Могут уйти» = последний день
      // в окне месяца раньше недели.
      this.prisma.$queryRaw<Array<Record<ActivityKey, bigint>>>`
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
      // Average score per need over last 7 days — по числу потребностей
      // (NEED_IDS), не растёт с таблицей, take не нужен.
      this.prisma.rating.groupBy({
        by: ['needId'],
        where: { date: { gte: d7 } },
        _avg: { value: true },
        orderBy: { _avg: { value: 'asc' } },
      }),
      // Сколько разных людей заполняли в каждый день за 30 дней — ≤31 строки;
      // день недели считается ниже в JS, без каста строки в date в SQL.
      this.prisma.$queryRaw<Array<{ date: string; c: bigint }>>`
        SELECT date, COUNT(DISTINCT "userId")::bigint AS c
        FROM "Rating" WHERE date >= ${d30} GROUP BY date
      `,
    ]);
    const todayCount = Number(todayCountRows[0]?.c ?? 0);
    const act = (k: ActivityKey): number => Number(activityRows[0]?.[k] ?? 0);
    const month30Count = act('month30');

    // Retention funnel — count users with N+ distinct fill days (raw SQL for efficiency)
    const retentionRows = await this.prisma.$queryRaw<Array<{ cnt: bigint }>>`
      SELECT COUNT(*) AS cnt FROM (
        SELECT "userId" FROM "Rating" GROUP BY "userId" HAVING COUNT(DISTINCT date) >= 1
      ) t`;
    const ret1 = Number(retentionRows[0]?.cnt ?? 0);
    const ret3 = Number(
      (
        await this.prisma.$queryRaw<Array<{ cnt: bigint }>>`
      SELECT COUNT(*) AS cnt FROM (SELECT "userId" FROM "Rating" GROUP BY "userId" HAVING COUNT(DISTINCT date) >= 3) t`
      )[0]?.cnt ?? 0,
    );
    const ret7 = Number(
      (
        await this.prisma.$queryRaw<Array<{ cnt: bigint }>>`
      SELECT COUNT(*) AS cnt FROM (SELECT "userId" FROM "Rating" GROUP BY "userId" HAVING COUNT(DISTINCT date) >= 7) t`
      )[0]?.cnt ?? 0,
    );
    const ret30 = Number(
      (
        await this.prisma.$queryRaw<Array<{ cnt: bigint }>>`
      SELECT COUNT(*) AS cnt FROM (SELECT "userId" FROM "Rating" GROUP BY "userId" HAVING COUNT(DISTINCT date) >= 30) t`
      )[0]?.cnt ?? 0,
    );

    // Most neglected need (lowest avg this week)
    const lowestNeed = needAvgs[0];

    // День недели с наибольшим числом пар «человек–день»; на пустой базе —
    // null, а не «вс» из массива нулей (правило №8).
    const dowCounts: number[] = new Array<number>(7).fill(0);
    for (const r of perDayRows) {
      dowCounts[new Date(r.date + 'T12:00:00Z').getUTCDay()] += Number(r.c);
    }
    const maxDow = Math.max(...dowCounts);
    const bestDow = maxDow > 0 ? dowCounts.indexOf(maxDow) : null;
    const fillRate =
      month30Count > 0 ? Math.round((todayCount / month30Count) * 100) : 0;

    const report = formatAdminStats({
      today,
      totalUsers,
      newUsers7,
      newUsers30,
      notifyOff,
      blockedUsers,
      todayCount,
      fillRate,
      week7Count: act('week7'),
      activeCoreCount: act('core'),
      month30Count,
      churnRisk: act('churn'),
      ret1,
      ret3,
      ret7,
      ret30,
      lowestNeed,
      bestDow,
      activePairs,
    });

    const retention = await this.getRetentionStats();
    return report + '\n\n' + formatRetentionBlock(retention);
  }
}
