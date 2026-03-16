import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NeedId, NEED_IDS } from './bot.service';

@Injectable()
export class BotAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private localDateString(tzOffsetHours = 0, base = new Date()): string {
    const local = new Date(base.getTime() + tzOffsetHours * 3600_000);
    const y = local.getUTCFullYear();
    const m = String(local.getUTCMonth() + 1).padStart(2, '0');
    const d = String(local.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private async userTzOffset(userId: number): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(userId) },
      select: { notifyTzOffset: true },
    });
    return user?.notifyTzOffset ?? 0;
  }

  async getHistoryRatings(userId: number, days: number): Promise<Array<{ date: string; ratings: Partial<Record<NeedId, number>> }>> {
    const tzOffset = await this.userTzOffset(userId);
    const dates = Array.from({ length: days }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return this.localDateString(tzOffset, d);
    });
    const rows = await this.prisma.rating.findMany({ where: { userId: BigInt(userId), date: { in: dates } } });
    const byDate = new Map<string, Partial<Record<NeedId, number>>>();
    for (const row of rows) {
      if (!byDate.has(row.date)) byDate.set(row.date, {});
      byDate.get(row.date)![row.needId as NeedId] = row.value;
    }
    return dates.filter((d) => byDate.has(d)).map((d) => ({ date: d, ratings: byDate.get(d)! }));
  }

  async getLowStreakNeeds(userId: number, threshold: number, days: number): Promise<NeedId[]> {
    const tzOffset = await this.userTzOffset(userId);
    const dates = Array.from({ length: days }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return this.localDateString(tzOffset, d);
    });
    const rows = await this.prisma.rating.findMany({ where: { userId: BigInt(userId), date: { in: dates } } });
    return NEED_IDS.filter((needId) => {
      const needRows = rows.filter((r) => r.needId === needId);
      return needRows.length === days && needRows.every((r) => r.value < threshold);
    });
  }

  async getConsecutiveDays(userId: number): Promise<number> {
    const tzOffset = await this.userTzOffset(userId);
    const rows = await this.prisma.rating.findMany({
      where: { userId: BigInt(userId) },
      select: { date: true },
      distinct: ['date'],
    });
    const dates = new Set(rows.map((r) => r.date));
    let count = 0;
    while (true) {
      const dateStr = this.localDateString(tzOffset, new Date(Date.now() - count * 86_400_000));
      if (!dates.has(dateStr)) break;
      count++;
    }
    return count;
  }

  async getTotalDaysFilled(userId: number): Promise<number> {
    const rows = await this.prisma.rating.findMany({
      where: { userId: BigInt(userId) },
      select: { date: true },
      distinct: ['date'],
    });
    return rows.length;
  }

  async getDaysSinceLastFill(userId: number): Promise<number> {
    const last = await this.prisma.rating.findFirst({
      where: { userId: BigInt(userId) },
      orderBy: { date: 'desc' },
      select: { date: true },
    });
    if (!last) return -1;
    const tzOffset = await this.userTzOffset(userId);
    const today = this.localDateString(tzOffset);
    const diffMs = new Date(today + 'T00:00:00Z').getTime() - new Date(last.date + 'T00:00:00Z').getTime();
    return Math.floor(diffMs / 86_400_000);
  }

  async getWeeklyStats(userId: number): Promise<Array<{ needId: NeedId; avg: number | null; trend: '↑' | '↓' | '→' }>> {
    const tzOffset = await this.userTzOffset(userId);
    const last14 = Array.from({ length: 14 }, (_, i) =>
      this.localDateString(tzOffset, new Date(Date.now() - i * 86_400_000)),
    );
    const rows = await this.prisma.rating.findMany({ where: { userId: BigInt(userId), date: { in: last14 } } });
    const curSet = new Set(last14.slice(0, 7));
    const prevSet = new Set(last14.slice(7));

    return NEED_IDS.map((needId) => {
      const cur = rows.filter((r) => r.needId === needId && curSet.has(r.date));
      const prev = rows.filter((r) => r.needId === needId && prevSet.has(r.date));
      const avg = cur.length ? cur.reduce((s, r) => s + r.value, 0) / cur.length : null;
      const prevAvg = prev.length ? prev.reduce((s, r) => s + r.value, 0) / prev.length : null;
      const trend: '↑' | '↓' | '→' =
        avg !== null && prevAvg !== null && avg - prevAvg > 0.5 ? '↑'
        : avg !== null && prevAvg !== null && avg - prevAvg < -0.5 ? '↓'
        : '→';
      return { needId, avg, trend };
    });
  }

  async getBestDayOfWeek(userId: number): Promise<string | null> {
    const tzOffset = await this.userTzOffset(userId);
    const last7 = Array.from({ length: 7 }, (_, i) =>
      this.localDateString(tzOffset, new Date(Date.now() - i * 86_400_000)),
    );
    const rows = await this.prisma.rating.findMany({ where: { userId: BigInt(userId), date: { in: last7 } } });
    if (rows.length === 0) return null;
    const sumByDate = new Map<string, number>();
    for (const r of rows) sumByDate.set(r.date, (sumByDate.get(r.date) ?? 0) + r.value);
    const bestDate = [...sumByDate.entries()].reduce((a, b) => (b[1] > a[1] ? b : a))[0];
    const DAY_NAMES = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
    return DAY_NAMES[new Date(bestDate + 'T12:00:00Z').getUTCDay()];
  }
}
