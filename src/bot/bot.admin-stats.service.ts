import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { localDate } from '../utils/tz';
import { formatAdminStats } from './admin-stats.format';
import { countActiveCore } from './active-core-metrics';
import {
  formatRetentionBlock,
  RetentionStats,
  RetentionPoint,
} from './retention.format';

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
   * правило №8 CLAUDE.md: гипотезы про онбординг проверяются D1/D7/D30,
   * а не ощущениями). Всё выводится из существующих данных — User.createdAt,
   * AppActivity, Rating, disclaimerAccepted; событийной таблицы не требуется.
   */
  async getRetentionStats(): Promise<RetentionStats> {
    // DN: юзеры, зарегистрированные [N, N+7) дней назад (когорта недели);
    // retained = есть AppActivity ровно в день createdAt + N дней.
    // AppActivity.date — локальная дата юзера, createdAt — UTC: для
    // админ-метрики допустимо (±1 день на границах таймзон).
    const point = async (n: number): Promise<RetentionPoint> => {
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
        WHERE u."createdAt" >= now() - make_interval(days => ${n + 7})
          AND u."createdAt" <  now() - make_interval(days => ${n})
      `;
      return {
        cohort: Number(rows[0]?.cohort ?? 0),
        retained: Number(rows[0]?.retained ?? 0),
      };
    };
    const since30 = new Date(Date.now() - 30 * 86_400_000);
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
    const today = this.localDateString('UTC', now);
    const d7 = this.localDateString(
      'UTC',
      new Date(now.getTime() - 7 * 86_400_000),
    );
    const d30 = this.localDateString(
      'UTC',
      new Date(now.getTime() - 30 * 86_400_000),
    );
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
      week7Ratings,
      month30CountRows,
      needAvgs,
      fillsByDow,
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
      // D-4 (аудит 2026-07): раньше findMany({distinct:['userId']}).length —
      // без take это неограниченная выборка. Здесь нужен только сам счётчик
      // (не id), поэтому меняем на честный COUNT(DISTINCT), а не на take —
      // take исказил бы статистику при росте числа активных юзеров.
      this.prisma.$queryRaw<Array<{ c: bigint }>>`
        SELECT COUNT(DISTINCT "userId")::bigint AS c FROM "Rating" WHERE date = ${today}
      `,
      this.prisma.rating.findMany({
        where: { date: { gte: d7 } },
        select: { userId: true },
        distinct: ['userId'],
        // D-4: явная страховка от роста таблицы (не пагинация). Тут (в
        // отличие от today/month30) нужен сам список id — используется ниже
        // для churnRisk (activeRecent) — поэтому COUNT(DISTINCT) не подходит.
        take: 5000,
      }),
      this.prisma.$queryRaw<Array<{ c: bigint }>>`
        SELECT COUNT(DISTINCT "userId")::bigint AS c FROM "Rating" WHERE date >= ${d30}
      `,
      // Average score per need over last 7 days — по числу потребностей
      // (NEED_IDS), не растёт с таблицей, take не нужен.
      this.prisma.rating.groupBy({
        by: ['needId'],
        where: { date: { gte: d7 } },
        _avg: { value: true },
        orderBy: { _avg: { value: 'asc' } },
      }),
      // Fills by day of week (last 30 days) — date strings, compute DOW in JS.
      // D-4: явная страховка от роста таблицы (не пагинация) — нужны сами
      // пары (date, userId) для подсчёта по дням недели, COUNT не подходит.
      this.prisma.rating.findMany({
        where: { date: { gte: d30 } },
        select: { date: true, userId: true },
        distinct: ['userId', 'date'],
        take: 5000,
      }),
    ]);
    const todayCount = Number(todayCountRows[0]?.c ?? 0);
    const month30Count = Number(month30CountRows[0]?.c ?? 0);

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

    // Churn signal: active in d7-d30 but NOT in last 7 days
    const activeRecent = new Set(week7Ratings.map((r) => String(r.userId)));
    const activeOlder = new Set(
      await this.prisma.rating
        .findMany({
          where: { date: { gte: d30, lt: d7 } },
          select: { userId: true },
          distinct: ['userId'],
          // D-4: страховка от роста таблицы (не пагинация) — нужен сам
          // список id для сравнения с activeRecent (churnRisk).
          take: 5000,
        })
        .then((rows) => rows.map((r) => String(r.userId))),
    );
    const churnRisk = [...activeOlder].filter(
      (id) => !activeRecent.has(id),
    ).length;

    // Most neglected need (lowest avg this week)
    const lowestNeed = needAvgs[0];

    // Best fill day of week (last 30 days) — count user-day pairs per DOW
    const dowCounts: number[] = new Array<number>(7).fill(0);
    for (const r of fillsByDow) {
      dowCounts[new Date(r.date + 'T12:00:00Z').getUTCDay()]++;
    }
    const bestDow = dowCounts.indexOf(Math.max(...dowCounts));
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
      week7Count: week7Ratings.length,
      activeCoreCount: countActiveCore(fillsByDow, d7),
      month30Count,
      churnRisk,
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
