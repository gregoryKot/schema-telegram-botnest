import { PrismaService } from '../prisma/prisma.service';
import { NeedId, NEED_IDS } from './bot.service';
import { localDate } from '../utils/tz';
import { userTimezone } from './user-tz';

// Метрики по истории оценок потребностей: история/стрики заполнения,
// давность, перерывы. Вынесено из BotAnalyticsService (правило №10);
// публичный API остался на фасаде bot.analytics.service.ts.
export class RatingHistoryMetrics {
  constructor(private readonly prisma: PrismaService) {}

  private async tzOf(userId: bigint, tzArg?: string): Promise<string> {
    return tzArg ?? (await userTimezone(this.prisma, userId));
  }

  /**
   * Батчевый обзор клиентов для кабинета терапевта (аудит 2026-07, N+1).
   * Раньше getClients делал ~6 SQL на каждого клиента (стрик, давность,
   * история — каждый с отдельным чтением таймзоны): 50 клиентов ≈ 300
   * запросов. Теперь 3 запроса на весь список. Семантика полей идентична
   * getConsecutiveDays / getDaysSinceLastFill / getHistoryRatings(14).
   */
  async getHistoryRatings(
    userId: bigint,
    days: number,
    tzArg?: string,
  ): Promise<
    Array<{ date: string; ratings: Partial<Record<NeedId, number>> }>
  > {
    const tz = await this.tzOf(userId, tzArg);
    const dates = Array.from({ length: days }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return localDate(tz, d);
    });
    const rows = await this.prisma.rating.findMany({
      where: { userId, date: { in: dates } },
    });
    const byDate = new Map<string, Partial<Record<NeedId, number>>>();
    for (const row of rows) {
      if (!byDate.has(row.date)) byDate.set(row.date, {});
      byDate.get(row.date)![row.needId as NeedId] = row.value;
    }
    return dates
      .filter((d) => byDate.has(d))
      .map((d) => ({ date: d, ratings: byDate.get(d)! }));
  }

  async getLowStreakNeeds(
    userId: bigint,
    threshold: number,
    days: number,
    tzArg?: string,
  ): Promise<NeedId[]> {
    const tz = await this.tzOf(userId, tzArg);
    const dates = Array.from({ length: days }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return localDate(tz, d);
    });
    const rows = await this.prisma.rating.findMany({
      where: { userId, date: { in: dates } },
    });
    return NEED_IDS.filter((needId) => {
      const needRows = rows.filter((r) => r.needId === needId);
      return (
        needRows.length === days && needRows.every((r) => r.value < threshold)
      );
    });
  }

  async getConsecutiveDays(userId: bigint, tzArg?: string): Promise<number> {
    const tz = await this.tzOf(userId, tzArg);
    const rows = await this.prisma.rating.findMany({
      where: { userId },
      select: { date: true },
      distinct: ['date'],
    });
    const dates = new Set(rows.map((r) => r.date));
    let count = 0;
    while (true) {
      const dateStr = localDate(tz, new Date(Date.now() - count * 86_400_000));
      if (!dates.has(dateStr)) break;
      count++;
    }
    return count;
  }

  async getTotalDaysFilled(userId: bigint): Promise<number> {
    const rows = await this.prisma.rating.findMany({
      where: { userId },
      select: { date: true },
      distinct: ['date'],
    });
    return rows.length;
  }

  async getDaysSinceLastFill(userId: bigint, tzArg?: string): Promise<number> {
    const last = await this.prisma.rating.findFirst({
      where: { userId },
      orderBy: { date: 'desc' },
      select: { date: true },
    });
    if (!last) return -1;
    const tz = await this.tzOf(userId, tzArg);
    const today = localDate(tz);
    const diffMs =
      new Date(today + 'T00:00:00Z').getTime() -
      new Date(last.date + 'T00:00:00Z').getTime();
    return Math.floor(diffMs / 86_400_000);
  }

  /** Сколько разных дней с записями за последние N локальных дней (включая сегодня) */
  async getFillDaysInLast(
    userId: bigint,
    days: number,
    tzArg?: string,
  ): Promise<number> {
    const tz = await this.tzOf(userId, tzArg);
    const dates = Array.from({ length: days }, (_, i) =>
      localDate(tz, new Date(Date.now() - i * 86_400_000)),
    );
    const rows = await this.prisma.rating.findMany({
      where: { userId, date: { in: dates } },
      select: { date: true },
      distinct: ['date'],
    });
    return rows.length;
  }

  /**
   * Перерыв (в днях) перед самой свежей записью: разница между двумя последними
   * различными датами записей. null если записей меньше двух.
   * Используется для comeback: свежая запись сегодня после перерыва ≥3 дней.
   */
  async getGapBeforeLatestFill(userId: bigint): Promise<number | null> {
    const rows = await this.prisma.rating.findMany({
      where: { userId },
      select: { date: true },
      distinct: ['date'],
      orderBy: { date: 'desc' },
      take: 2,
    });
    if (rows.length < 2) return null;
    const diffMs =
      new Date(rows[0].date + 'T00:00:00Z').getTime() -
      new Date(rows[1].date + 'T00:00:00Z').getTime();
    return Math.floor(diffMs / 86_400_000);
  }
}
