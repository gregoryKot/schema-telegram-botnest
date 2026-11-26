import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { localDate } from '../utils/tz';
import { formatStatsHeader } from './admin-stats.sections';
import { adminStatsBlocks } from './admin-stats.blocks';
import { settleBlocks } from './stats-settle';
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

// Админский отчёт по всей базе (не по конкретному юзеру, в отличие от
// BotAnalyticsService) — единственный потребитель: команда `/stats` в
// TelegramService. Вынесено из BotAnalyticsService (правило №10).
@Injectable()
export class BotAdminStatsService {
  private readonly logger = new Logger(BotAdminStatsService.name);

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

  /**
   * «Главные цифры» /stats. Разделы независимы (admin-stats.blocks.ts):
   * упавший запрос гасит только свой раздел — заглушкой с причиной, а не всё
   * первое сообщение отчёта (аудит 2026-10, infra#28).
   */
  async getAdminStats(): Promise<string> {
    const now = new Date();
    const day = (ago: number) =>
      this.localDateString(
        REPORT_TZ,
        new Date(now.getTime() - ago * 86_400_000),
      );
    const days = { now, today: day(0), d7: day(7), d30: day(30) };
    const retention = async () =>
      formatRetentionBlock(await this.getRetentionStats());
    const parts = await settleBlocks(
      adminStatsBlocks(this.prisma, days, retention),
      this.logger,
    );
    return [formatStatsHeader(days.today), ...parts].join('\n\n');
  }
}
